const { searchDictionary, normalizeQuery, LRUCache } = require('./dictionary');
const { getIrregularCandidates, getIrregularCount } = require('./irregular-forms');
const { generateMorphologyCandidates, matchesPos } = require('./morphology-rules');
const { tokenizeWithOffsets } = require('./phrase-matcher');

// Bounded LRU Cache for Lemmatizer (default 2,000 items)
const lemmatizerCache = new LRUCache(2000);
let totalLookups = 0;

// Set of invariant words and words that must never be modified by morphology rules
const INVARIANT_WORDS = new Set([
  'species', 'series', 'corps', 'means', 'headquarters', 'crossroads',
  'chassis', 'news', 'business', 'glass', 'novel', 'solve', 'analysis',
  'crisis', 'basis', 'status', 'virus', 'lens', 'gas', 'chaos', 'canvas'
]);

/**
 * Check if a dictionary definition describes an inflection rather than a primary meaning.
 */
function isInflectionDefinition(def) {
  if (!def || typeof def !== 'string') return false;
  const d = def.toLowerCase();
  return (
    d.includes('quá khứ') ||
    d.includes('phân từ') ||
    d.includes('số nhiều của') ||
    d.includes('ngôi thứ ba số ít của') ||
    d.includes('so sánh hơn của') ||
    d.includes('so sánh nhất của') ||
    d.includes('gerund của')
  );
}

/**
 * Check if dictionary result contains at least one primary base definition (not an inflection pointer).
 */
function hasPrimaryBaseDefinition(dictResult) {
  if (!dictResult || !dictResult.found || !Array.isArray(dictResult.meanings) || dictResult.meanings.length === 0) {
    return false;
  }
  return dictResult.meanings.some(m => !isInflectionDefinition(m.definition));
}

/**
 * Check if a word or lemma exists in the dictionary.
 * @param {string} lemma
 * @returns {boolean}
 */
function isValidLemma(lemma) {
  if (!lemma || typeof lemma !== 'string') return false;
  const normalized = normalizeQuery(lemma);
  if (!normalized) return false;
  const res = searchDictionary(normalized);
  return res.found;
}

/**
 * Lemmatize a single English word to its base form(s).
 *
 * Processing order:
 * 1. Irregular forms lookup (e.g. went -> go, children -> child, better -> good / well).
 * 2. Regular morphological inflection rules (plurals, past tense, participles, comparatives).
 * 3. Exact dictionary headword match (already in base lemma form).
 * 4. Fallback: preserve original word with low confidence.
 *
 * @param {string} word Surface word
 * @param {Object} [options]
 * @param {'N' | 'V' | 'A' | 'D'} [options.pos] Optional POS constraint
 * @returns {{ original: string, lemmas: string[], confidence: 'high' | 'medium' | 'low', source: 'exact' | 'irregular' | 'regular_rule' | 'unknown' }}
 */
function lemmatizeWord(word, options = {}) {
  totalLookups++;

  if (typeof word !== 'string' || !word.trim()) {
    return {
      original: typeof word === 'string' ? word : '',
      lemmas: [],
      confidence: 'low',
      source: 'unknown'
    };
  }

  const rawWord = word.trim();
  const normalized = normalizeQuery(rawWord);
  const targetPos = options && options.pos ? options.pos.toUpperCase() : null;

  // 1. Check LRU Cache
  const cacheKey = `${normalized}|${targetPos || ''}`;
  const cached = lemmatizerCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      original: rawWord
    };
  }

  // 1.5. Invariant words (words ending in -s, -es that are invariant base forms, e.g. species, series, news, glass)
  if (INVARIANT_WORDS.has(normalized)) {
    const result = {
      original: rawWord,
      lemmas: [normalized],
      confidence: 'high',
      source: 'exact'
    };
    lemmatizerCache.set(cacheKey, result);
    return result;
  }

  // 2. Check Irregular Forms
  const irregEntries = getIrregularCandidates(normalized);
  if (irregEntries && irregEntries.length > 0) {
    // Filter by POS if specified
    const filteredIrreg = targetPos
      ? irregEntries.filter(e => matchesTargetPos(e.pos, targetPos))
      : irregEntries;

    if (filteredIrreg.length > 0) {
      // Validate candidate lemmas against dictionary database
      const validLemmas = [];
      for (const entry of filteredIrreg) {
        const dict = searchDictionary(entry.lemma);
        if (dict.found) {
          if (!validLemmas.includes(entry.lemma)) {
            validLemmas.push(entry.lemma);
          }
        }
      }

      if (validLemmas.length > 0) {
        const result = {
          original: rawWord,
          lemmas: validLemmas,
          confidence: validLemmas.length === 1 ? 'high' : 'medium',
          source: 'irregular'
        };
        lemmatizerCache.set(cacheKey, result);
        return result;
      }
    }
  }

  // 3. Regular Morphological Inflection Rules
  const exactRes = searchDictionary(normalized);
  const isBaseWordInDict = exactRes.found && hasPrimaryBaseDefinition(exactRes);

  const morphCandidates = generateMorphologyCandidates(normalized);
  const validMorphLemmas = [];

  for (const m of morphCandidates) {
    if (targetPos && !matchesTargetPos(m.pos, targetPos)) {
      continue;
    }

    // If word is already an established base headword in the dictionary,
    // do not allow comparative/superlative adjective rules to convert a base word into an adjective lemma
    if (isBaseWordInDict && (m.pos === 'A' || m.pos === 'D') && (!targetPos || (targetPos !== 'A' && targetPos !== 'D'))) {
      continue;
    }

    const dict = searchDictionary(m.candidate);
    if (dict.found && matchesPos(dict, m.pos)) {
      if (!validMorphLemmas.includes(m.candidate)) {
        validMorphLemmas.push(m.candidate);
      }
    }
  }

  if (validMorphLemmas.length > 0) {
    const result = {
      original: rawWord,
      lemmas: validMorphLemmas,
      // If multiple distinct base interpretations exist (e.g. leaves -> leaf, leave), confidence is medium
      confidence: validMorphLemmas.length === 1 ? 'high' : 'medium',
      source: 'regular_rule'
    };
    lemmatizerCache.set(cacheKey, result);
    return result;
  }

  // 4. Exact Dictionary Match (Word is already in base form)
  if (exactRes.found) {
    // Check target POS if specified
    if (!targetPos || matchesPos(exactRes, targetPos)) {
      const result = {
        original: rawWord,
        lemmas: [exactRes.word || normalized],
        confidence: 'high',
        source: 'exact'
      };
      lemmatizerCache.set(cacheKey, result);
      return result;
    }
  }

  // 5. Unknown / Fallback: Preserve original surface word
  const fallback = {
    original: rawWord,
    lemmas: [rawWord.toLowerCase()],
    confidence: 'low',
    source: 'unknown'
  };
  lemmatizerCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Get list of possible lemmas for a word.
 * @param {string} word
 * @param {Object} [options]
 * @returns {string[]}
 */
function getPossibleLemmas(word, options) {
  const res = lemmatizeWord(word, options);
  return res.lemmas;
}

/**
 * Lemmatize an entire sentence while preserving tokens and character offsets.
 * @param {string} text
 * @param {Object} [options]
 * @returns {{ text: string, tokens: Array<Object> }}
 */
function lemmatizeSentence(text, options) {
  if (typeof text !== 'string' || !text.trim()) {
    return { text: typeof text === 'string' ? text : '', tokens: [] };
  }

  const rawTokens = tokenizeWithOffsets(text);
  const tokens = [];

  for (const t of rawTokens) {
    const lemmaRes = lemmatizeWord(t.cleanWord, options);
    tokens.push({
      text: t.text,
      cleanWord: t.cleanWord,
      startIndex: t.startIndex,
      endIndex: t.endIndex,
      lemmas: lemmaRes.lemmas,
      confidence: lemmaRes.confidence,
      source: lemmaRes.source
    });
  }

  return {
    text,
    tokens
  };
}

/**
 * Helper to match POS codes.
 */
function matchesTargetPos(candidatePos, targetPos) {
  if (!targetPos) return true;
  const p1 = (candidatePos || '').toUpperCase();
  const p2 = targetPos.toUpperCase();
  if (p2 === 'N' || p2 === 'NOUN') return p1 === 'N' || p1 === 'NOUN';
  if (p2 === 'V' || p2 === 'VERB') return p1 === 'V' || p1 === 'VERB';
  if (p2 === 'A' || p2 === 'ADJ') return p1 === 'A' || p1 === 'ADJ';
  if (p2 === 'D' || p2 === 'ADV') return p1 === 'D' || p1 === 'ADV';
  return p1 === p2;
}

/**
 * Clear the lemmatizer cache.
 */
function clearLemmaCache() {
  lemmatizerCache.clear();
  totalLookups = 0;
}

/**
 * Get lemmatizer usage statistics.
 */
function getLemmaStats() {
  return {
    irregularFormsCount: getIrregularCount(),
    totalLookups,
    cache: lemmatizerCache.getStats()
  };
}

module.exports = {
  lemmatizeWord,
  lemmatizeSentence,
  getPossibleLemmas,
  isValidLemma,
  getLemmaStats,
  clearLemmaCache,
  lemmatizerCache
};
