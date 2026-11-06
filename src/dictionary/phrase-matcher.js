const { getDatabase } = require('./db');
const { searchDictionary, normalizeQuery } = require('./dictionary');

/**
 * Standard list of English phrasal particles/prepositions that form phrasal verbs.
 */
const PHRASAL_PARTICLES = new Set([
  'about', 'above', 'across', 'after', 'against', 'ahead', 'along', 'apart',
  'around', 'aside', 'at', 'away', 'back', 'before', 'behind', 'below',
  'beneath', 'beside', 'between', 'beyond', 'by', 'down', 'for', 'forth',
  'forward', 'from', 'in', 'into', 'of', 'off', 'on', 'onto', 'out', 'over',
  'past', 'round', 'through', 'to', 'together', 'toward', 'towards', 'under',
  'up', 'upon', 'with', 'without'
]);

// Lazy loader for lemmatizer to prevent circular dependency
let _getPossibleLemmas = null;
let _lemmatizeWord = null;

function getLemmatizer() {
  if (!_getPossibleLemmas) {
    try {
      _getPossibleLemmas = require('./lemmatizer').getPossibleLemmas;
    } catch (e) {
      // ignore
    }
  }
  return _getPossibleLemmas;
}

function getLemmatizeWord() {
  if (!_lemmatizeWord) {
    try {
      _lemmatizeWord = require('./lemmatizer').lemmatizeWord;
    } catch (e) {
      // ignore
    }
  }
  return _lemmatizeWord;
}

/**
 * Word-level Trie for fast O(1) multi-word phrase prefix matching.
 */
class PhraseTrie {
  constructor() {
    this.root = {};
    this.isLoaded = false;
    this.totalPhrases = 0;
  }

  ensureLoaded() {
    if (this.isLoaded) return;

    const db = getDatabase();
    // Load all multi-word expressions from words table
    const rows = db.prepare("SELECT word FROM words WHERE word LIKE '% %'").all();

    for (const r of rows) {
      this.insert(r.word);
    }

    this.isLoaded = true;
    this.totalPhrases = rows.length;
  }

  insert(phrase) {
    if (!phrase || typeof phrase !== 'string') return;
    // Normalize typographic quotes and split by whitespace
    const tokens = phrase
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.length < 2) return;

    let curr = this.root;
    for (const tok of tokens) {
      if (!curr[tok]) {
        curr[tok] = {};
      }
      curr = curr[tok];
    }

    curr.$isEnd = true;
    if (!curr.$headwords) {
      curr.$headwords = [];
    }
    if (!curr.$headwords.includes(phrase)) {
      curr.$headwords.push(phrase);
    }
    // Headword to use for lookup
    curr.$headword = curr.$headwords[0];
    curr.$wordCount = tokens.length;
  }

  /**
   * Search all candidate phrases starting at tokens[startIndex].
   * Supports inflected forms (e.g. "looking forward to" -> "look forward to")
   * Strictly enforces sentence boundaries: phrases cannot cross sentence-breaking punctuation.
   * @param {Array<Object>} tokens Token list with character offsets.
   * @param {number} startIndex Starting token index.
   * @param {string} rawText Original un-modified input string.
   * @returns {Array<Object>} List of candidate phrases.
   */
  searchCandidates(tokens, startIndex, rawText) {
    this.ensureLoaded();
    const candidates = [];
    const lemmatizerFn = getLemmatizer();

    const dfs = (currNode, tokenIdx) => {
      if (tokenIdx >= tokens.length) return;

      // Sentence boundaries: punctuation between previous token and current token terminates phrase search
      if (tokenIdx > startIndex) {
        const gap = rawText.substring(tokens[tokenIdx - 1].endIndex, tokens[tokenIdx].startIndex);
        if (/[\n\r.!?;\u2026]/.test(gap)) {
          return;
        }
      }

      const tok = tokens[tokenIdx].cleanWord;
      const keysToTry = [tok];

      // If lemmatizer is available, also test base lemmas (e.g. looking -> look, took -> take, gives -> give)
      if (lemmatizerFn) {
        const lemmas = lemmatizerFn(tok);
        if (Array.isArray(lemmas)) {
          for (const l of lemmas) {
            if (!keysToTry.includes(l)) {
              keysToTry.push(l);
            }
          }
        }
      }

      for (const key of keysToTry) {
        if (currNode[key]) {
          const nextNode = currNode[key];
          if (nextNode.$isEnd) {
            candidates.push({
              headword: nextNode.$headword,
              headwords: nextNode.$headwords || [nextNode.$headword],
              wordCount: nextNode.$wordCount,
              endTokenIndex: tokenIdx
            });
          }
          dfs(nextNode, tokenIdx + 1);
        }
      }
    };

    dfs(this.root, startIndex);
    return candidates;
  }

  getStats() {
    return {
      loaded: this.isLoaded,
      totalPhrases: this.totalPhrases,
      rootKeys: Object.keys(this.root).length
    };
  }
}

// Singleton phrase trie
const phraseTrie = new PhraseTrie();

/**
 * Tokenize raw text into words while recording exact character start/end offsets.
 * Preserves hyphens within words (e.g. "mom-and-pop") and apostrophes (e.g. "I'm").
 * Typographic apostrophes are normalized in cleanWord for dictionary matching.
 * @param {string} text
 * @returns {Array<{ text: string, cleanWord: string, startIndex: number, endIndex: number }>}
 */
function tokenizeWithOffsets(text) {
  if (typeof text !== 'string' || !text) {
    return [];
  }

  const tokens = [];
  const wordRegex = /[a-zA-Z0-9]+(?:['’\-][a-zA-Z0-9]+)*/g;
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    const rawWord = match[0];
    tokens.push({
      text: rawWord,
      cleanWord: rawWord.toLowerCase().replace(/[\u2018\u2019]/g, "'"),
      startIndex: match.index,
      endIndex: match.index + rawWord.length
    });
  }

  return tokens;
}

/**
 * Classify the match type based on dictionary metadata and linguistic structure.
 * Categories:
 * - 'idiom': POS = idiom or definitions containing idiom keywords (thành ngữ, quán ngữ, idiom)
 * - 'phrasal_verb': Multi-word verb containing a recognized English phrasal particle or explicit phrasal verb keyword
 * - 'phrase': General multi-word expressions (e.g. compound nouns, compound verbs without particles)
 * - 'word': Single words
 * - 'unmatched': Word not found in dictionary
 * @param {Object} dictResult Output from searchDictionary
 * @param {number} wordCount Number of words in expression
 * @returns {'idiom' | 'phrasal_verb' | 'phrase' | 'word' | 'unmatched'}
 */
function classifyMatchType(dictResult, wordCount) {
  if (!dictResult || !dictResult.found) {
    return 'unmatched';
  }

  const isMultiWord = wordCount > 1 || (dictResult.word && dictResult.word.includes(' '));
  const meanings = dictResult.meanings || [];

  // 1. Check for Idiom
  const isIdiom = meanings.some(m => {
    const pos = (m.pos || '').toLowerCase();
    const def = (m.definition || '').toLowerCase();
    return pos === 'idiom' ||
           def.includes('thành ngữ') ||
           def.includes('quán ngữ') ||
           def.includes('(idiom') ||
           def.includes('idiom,') ||
           def.includes('idiom)');
  });

  if (isIdiom) {
    return 'idiom';
  }

  // 2. Check for Multi-Word Expressions: Phrasal Verb vs General Phrase
  if (isMultiWord) {
    const isVerb = meanings.some(m => {
      const pos = (m.pos || '').toUpperCase();
      const posLabel = (m.posLabel || '').toLowerCase();
      const def = (m.definition || '').toLowerCase();
      return pos === 'V' || posLabel === 'verb' || def.includes('cụm động từ') || def.includes('phrasal verb');
    });

    if (isVerb) {
      // Extract tokens from headword
      const hwTokens = (dictResult.word || '')
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .split(/\s+/)
        .filter(Boolean);

      // Phrasal verb requires a particle/preposition following the verb, or explicit phrasal verb keyword in definition
      const hasParticle = hwTokens.slice(1).some(tok => PHRASAL_PARTICLES.has(tok));
      const hasExplicitPhrasalKeyword = meanings.some(m => {
        const def = (m.definition || '').toLowerCase();
        return def.includes('cụm động từ') || def.includes('phrasal verb');
      });

      if (hasParticle || hasExplicitPhrasalKeyword) {
        return 'phrasal_verb';
      }
    }

    // General multi-word phrase (e.g. "upper cut", "double click", "social welfare")
    return 'phrase';
  }

  // 3. Single Word
  return 'word';
}

/**
 * Deterministic candidate comparator implementing strict Longest Match First.
 * Selection Algorithm:
 * 1. Prefer candidate containing the greatest number of tokens (wordCount descending).
 * 2. If candidates have equal length, prioritize by category metadata: idiom > phrasal_verb > phrase.
 * 3. If category is equal, tie-break by definition count descending.
 * 4. Final deterministic tie-breaker: lexicographical order of headword.
 * @param {Object} a Candidate A
 * @param {Object} b Candidate B
 * @returns {number}
 */
function compareCandidates(a, b) {
  // 1. Greatest number of tokens strictly first (Longest Match First)
  if (b.wordCount !== a.wordCount) {
    return b.wordCount - a.wordCount;
  }

  // 2. Equal length: rank by reliable category metadata
  const typeRank = { idiom: 3, phrasal_verb: 2, phrase: 1, word: 0, unmatched: 0 };
  const rankA = typeRank[a.matchType] || 0;
  const rankB = typeRank[b.matchType] || 0;
  if (rankB !== rankA) {
    return rankB - rankA;
  }

  // 3. Deterministic tie-breaker 1: Number of definitions
  const defsA = (a.dictResult && a.dictResult.meanings) ? a.dictResult.meanings.length : 0;
  const defsB = (b.dictResult && b.dictResult.meanings) ? b.dictResult.meanings.length : 0;
  if (defsB !== defsA) {
    return defsB - defsA;
  }

  // 4. Deterministic tie-breaker 2: Lexicographical order
  return a.headword.localeCompare(b.headword);
}

/**
 * Numeric candidate priority score adhering strictly to Longest Match First.
 * Token count dominates entirely so a shorter candidate can never win over a longer one.
 * @param {string} matchType
 * @param {number} wordCount
 * @returns {number}
 */
function calculateCandidateScore(matchType, wordCount) {
  const typeRank = { idiom: 3, phrasal_verb: 2, phrase: 1, word: 0, unmatched: 0 };
  const rank = typeRank[matchType] || 0;
  return (wordCount * 10000) + rank;
}

/**
 * Extract and match phrases from English text using strict Longest Match First.
 * Supports inflected phrases while preserving raw OCR text and offsets.
 * @param {string} text Raw OCR text or sentence.
 * @returns {Array<Object>} List of matched expression objects in order of appearance.
 */
function matchPhrases(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const tokens = tokenizeWithOffsets(text);
  if (tokens.length === 0) {
    return [];
  }

  const results = [];
  let i = 0;

  while (i < tokens.length) {
    // 1. Search multi-word phrase candidates starting at token i
    const rawCandidates = phraseTrie.searchCandidates(tokens, i, text);

    const validCandidates = [];
    if (rawCandidates.length > 0) {
      for (const cand of rawCandidates) {
        // Query dictionary using headword (handles case-insensitivity and duplicates via casingMap)
        const dictRes = searchDictionary(cand.headword);
        if (dictRes.found) {
          const matchType = classifyMatchType(dictRes, cand.wordCount);
          validCandidates.push({
            ...cand,
            dictResult: dictRes,
            matchType
          });
        }
      }
    }

    // 2. Select best candidate using strict Longest Match First
    if (validCandidates.length > 0) {
      validCandidates.sort(compareCandidates);
      const best = validCandidates[0];

      const startTok = tokens[i];
      const endTok = tokens[best.endTokenIndex];
      const originalPhrase = text.substring(startTok.startIndex, endTok.endIndex);
      const firstMeaning = best.dictResult.meanings[0] || {};

      results.push({
        matched: true,
        originalText: originalPhrase,
        startIndex: startTok.startIndex,
        endIndex: endTok.endIndex,
        matchType: best.matchType,
        word: best.dictResult.word,
        lemma: best.dictResult.word,
        pos: firstMeaning.pos || null,
        posLabel: firstMeaning.posLabel || null,
        meanings: best.dictResult.meanings,
        pronunciations: best.dictResult.pronunciations,
        example: firstMeaning.example || null
      });

      // Advance token index by the number of matched words
      i = best.endTokenIndex + 1;
      continue;
    }

    // 3. Single Word Lookup (with lemmatizer integration)
    const currentTok = tokens[i];
    const singleDictRes = searchDictionary(currentTok.cleanWord);
    let lemmaInfo = null;
    const lemmatizeWordFn = getLemmatizeWord();
    if (lemmatizeWordFn) {
      lemmaInfo = lemmatizeWordFn(currentTok.cleanWord);
    }

    if (singleDictRes.found) {
      const matchType = classifyMatchType(singleDictRes, 1);
      const firstMeaning = singleDictRes.meanings[0] || {};

      results.push({
        matched: true,
        originalText: currentTok.text,
        startIndex: currentTok.startIndex,
        endIndex: currentTok.endIndex,
        matchType: matchType,
        word: singleDictRes.word,
        lemma: (lemmaInfo && lemmaInfo.lemmas && lemmaInfo.lemmas[0]) || singleDictRes.word,
        lemmas: (lemmaInfo && lemmaInfo.lemmas) || [singleDictRes.word],
        pos: firstMeaning.pos || null,
        posLabel: firstMeaning.posLabel || null,
        meanings: singleDictRes.meanings,
        pronunciations: singleDictRes.pronunciations,
        example: firstMeaning.example || null
      });
    } else if (lemmaInfo && lemmaInfo.lemmas && lemmaInfo.lemmas.length > 0 && lemmaInfo.source !== 'unknown') {
      // Base lemma lookup
      const baseDictRes = searchDictionary(lemmaInfo.lemmas[0]);
      if (baseDictRes.found) {
        const matchType = classifyMatchType(baseDictRes, 1);
        const firstMeaning = baseDictRes.meanings[0] || {};

        results.push({
          matched: true,
          originalText: currentTok.text,
          startIndex: currentTok.startIndex,
          endIndex: currentTok.endIndex,
          matchType: matchType,
          word: baseDictRes.word,
          lemma: baseDictRes.word,
          lemmas: lemmaInfo.lemmas,
          pos: firstMeaning.pos || null,
          posLabel: firstMeaning.posLabel || null,
          meanings: baseDictRes.meanings,
          pronunciations: baseDictRes.pronunciations,
          example: firstMeaning.example || null
        });
      } else {
        // Fallback unmatched
        results.push({
          matched: false,
          originalText: currentTok.text,
          startIndex: currentTok.startIndex,
          endIndex: currentTok.endIndex,
          matchType: 'unmatched',
          word: null,
          lemma: currentTok.cleanWord,
          lemmas: [],
          pos: null,
          posLabel: null,
          meanings: [],
          pronunciations: [],
          example: null
        });
      }
    } else {
      // Unmatched token
      results.push({
        matched: false,
        originalText: currentTok.text,
        startIndex: currentTok.startIndex,
        endIndex: currentTok.endIndex,
        matchType: 'unmatched',
        word: null,
        lemma: currentTok.cleanWord,
        lemmas: [],
        pos: null,
        posLabel: null,
        meanings: [],
        pronunciations: [],
        example: null
      });
    }

    i++;
  }

  return results;
}

module.exports = {
  matchPhrases,
  tokenizeWithOffsets,
  classifyMatchType,
  calculateCandidateScore,
  compareCandidates,
  PHRASAL_PARTICLES,
  PhraseTrie,
  phraseTrie
};
