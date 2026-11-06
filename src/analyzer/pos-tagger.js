/**
 * Offline Rule-Based English Part-of-Speech (POS) Tagger.
 * Tags tokens using dictionary metadata, morphological heuristics, and contextual grammar rules.
 *
 * Supported POS Tags:
 * - NOUN
 * - VERB
 * - ADJECTIVE
 * - ADVERB
 * - PRONOUN
 * - PREPOSITION
 * - CONJUNCTION
 * - DETERMINER
 * - AUXILIARY
 * - MODAL
 * - INTERJECTION
 * - NUMBER
 * - PUNCTUATION
 * - UNKNOWN
 */

const { searchDictionary } = require('../dictionary/dictionary');
const { lemmatizeWord } = require('../dictionary/lemmatizer');

const DETERMINERS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'whose', 'all', 'some', 'any', 'each', 'every', 'either', 'neither', 'no', 'both', 'much', 'many',
  'several', 'few', 'little', 'enough', 'another', 'other'
]);

const PRONOUNS = new Set([
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'mine', 'yours', 'his', 'hers', 'its', 'ours', 'theirs',
  'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'themselves',
  'who', 'whom', 'whose', 'which', 'what', 'whoever', 'whomever', 'whatever',
  'someone', 'somebody', 'something', 'anyone', 'anybody', 'anything',
  'everyone', 'everybody', 'everything', 'nobody', 'nothing', 'none', 'one'
]);

const MODALS = new Set([
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'ought'
]);

const AUX_BE = new Set(['am', 'is', 'are', 'was', 'were', 'been', 'being', 'be']);
const AUX_HAVE = new Set(['have', 'has', 'had', 'having']);
const AUX_DO = new Set(['do', 'does', 'did']);

const PREPOSITIONS = new Set([
  'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'of', 'about', 'into', 'through',
  'after', 'over', 'between', 'out', 'against', 'during', 'without', 'before', 'under',
  'around', 'among', 'upon', 'behind', 'beyond', 'below', 'beneath', 'near', 'across',
  'throughout', 'towards', 'toward', 'within', 'along', 'above', 'despite', 'unlike',
  'onto', 'since', 'until', 'till'
]);

const CONJUNCTIONS = new Set([
  'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'because', 'although', 'though',
  'while', 'whereas', 'if', 'unless', 'whether', 'as', 'since', 'that', 'so that',
  'in order that', 'as long as', 'provided that'
]);

const ADVERBS_COMMON = new Set([
  'not', "n't", 'never', 'always', 'often', 'usually', 'sometimes', 'already', 'still',
  'yet', 'now', 'then', 'soon', 'today', 'yesterday', 'tomorrow', 'tonight', 'here',
  'there', 'everywhere', 'very', 'quite', 'too', 'so', 'really', 'extremely', 'fairly',
  'almost', 'just', 'only', 'well', 'together', 'away', 'back', 'again', 'also', 'even',
  'indeed', 'perhaps', 'maybe', 'probably', 'certainly', 'hardly', 'scarcely', 'barely'
]);

const INTERJECTIONS = new Set([
  'hello', 'hi', 'hey', 'oh', 'ah', 'wow', 'oops', 'alas', 'ouch', 'hurray', 'bravo', 'please'
]);

const COMMON_PARTICIPIAL_ADJECTIVES = new Set([
  'interesting', 'boring', 'exciting', 'surprising', 'charming', 'amazing', 'confusing', 'tiring', 'frightening',
  'tired', 'bored', 'interested', 'excited', 'confused', 'pleased', 'worried', 'crowded', 'disappointed'
]);

const IRREGULAR_PAST_PARTICIPLES = new Set([
  'arisen', 'awoken', 'been', 'borne', 'beaten', 'begun', 'bent', 'bet', 'bitten', 'bled', 'blown',
  'bought', 'bound', 'broken', 'bred', 'brought', 'built', 'burnt', 'burst', 'caught', 'chosen',
  'clung', 'come', 'cost', 'crept', 'cut', 'dealt', 'dug', 'done', 'drawn', 'dreamt', 'driven',
  'drunk', 'eaten', 'fallen', 'fed', 'felt', 'fought', 'found', 'fled', 'flung', 'flown', 'forbidden',
  'forgotten', 'forgiven', 'frozen', 'got', 'gotten', 'given', 'gone', 'ground', 'grown', 'hung',
  'heard', 'hidden', 'hit', 'held', 'hurt', 'kept', 'known', 'laid', 'led', 'left', 'lent', 'let',
  'lain', 'lost', 'made', 'meant', 'met', 'paid', 'put', 'read', 'ridden', 'rung', 'risen', 'run',
  'said', 'seen', 'sought', 'sold', 'sent', 'set', 'sewn', 'shaken', 'shone', 'shot', 'shown', 'shrunk',
  'shut', 'sung', 'sunk', 'sat', 'slept', 'slid', 'spoken', 'spent', 'spun', 'split', 'spread', 'sprung',
  'stood', 'stolen', 'stuck', 'stung', 'struck', 'sworn', 'swept', 'swum', 'swung', 'taken', 'taught',
  'torn', 'told', 'thought', 'thrown', 'understood', 'woken', 'worn', 'won', 'wound', 'written'
]);

/**
 * Assign POS tags to a sequence of tokens.
 * @param {Array<Object>} tokens Tokens from tokenizer
 * @returns {Array<Object>} Tagged tokens with pos, posCandidates, lemma, and confidence
 */
function tagSentence(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return [];
  }

  const tagged = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const clean = tok.cleanWord;

    // 1. Punctuation
    if (tok.isPunctuation) {
      tagged.push({
        ...tok,
        pos: 'PUNCTUATION',
        posCandidates: ['PUNCTUATION'],
        confidence: 'high'
      });
      continue;
    }

    // 2. Numbers & Currency
    if (tok.isNumber) {
      tagged.push({
        ...tok,
        pos: 'NUMBER',
        posCandidates: ['NUMBER'],
        confidence: 'high'
      });
      continue;
    }

    // 3. Contractions with negation or auxiliary
    if (tok.contraction) {
      const c = tok.contraction;
      if (c.suffix === "n't") {
        const isMod = MODALS.has(c.stem);
        tagged.push({
          ...tok,
          pos: isMod ? 'MODAL' : 'AUXILIARY',
          posCandidates: isMod ? ['MODAL'] : ['AUXILIARY', 'VERB'],
          isNegative: true,
          contractionStem: c.stem,
          confidence: 'high'
        });
        continue;
      }
      if (c.suffix === "'m" || c.suffix === "'re" || c.suffix === "'ve" || c.suffix === "'ll" || c.suffix === "'d") {
        tagged.push({
          ...tok,
          pos: PRONOUNS.has(c.stem) ? 'PRONOUN' : 'NOUN',
          posCandidates: PRONOUNS.has(c.stem) ? ['PRONOUN'] : ['NOUN'],
          hasClitic: true,
          contractionStem: c.stem,
          confidence: 'high'
        });
        continue;
      }
    }

    // 4. Modals
    if (MODALS.has(clean)) {
      tagged.push({
        ...tok,
        pos: 'MODAL',
        posCandidates: ['MODAL'],
        lemma: clean,
        confidence: 'high'
      });
      continue;
    }

    // 5. Auxiliaries (be, have, do)
    if (AUX_BE.has(clean) || AUX_HAVE.has(clean) || AUX_DO.has(clean)) {
      tagged.push({
        ...tok,
        pos: 'AUXILIARY',
        posCandidates: ['AUXILIARY', 'VERB'],
        lemma: AUX_BE.has(clean) ? 'be' : (AUX_HAVE.has(clean) ? 'have' : 'do'),
        confidence: 'high'
      });
      continue;
    }

    // 6. Common Adverbs
    if (ADVERBS_COMMON.has(clean)) {
      tagged.push({
        ...tok,
        pos: 'ADVERB',
        posCandidates: ['ADVERB'],
        lemma: clean,
        confidence: 'high'
      });
      continue;
    }

    // 7. Closed-class Lookups
    if (COMMON_PARTICIPIAL_ADJECTIVES.has(clean)) {
      tagged.push({
        ...tok,
        pos: 'ADJECTIVE',
        posCandidates: ['ADJECTIVE'],
        lemma: clean,
        confidence: 'high'
      });
      continue;
    }

    if (clean === 'that') {
      // Preceded by verb or noun -> conjunction / relative pronoun (e.g. "know that...", "book that...")
      const prevTok = i > 0 ? tagged[i - 1] : null;
      if (prevTok && (prevTok.pos === 'VERB' || prevTok.pos === 'NOUN' || prevTok.pos === 'PRONOUN')) {
        tagged.push({
          ...tok,
          pos: 'CONJUNCTION',
          posCandidates: ['CONJUNCTION', 'DETERMINER', 'PRONOUN'],
          lemma: 'that',
          confidence: 'high'
        });
        continue;
      }
    }

    if (DETERMINERS.has(clean)) {
      tagged.push({
        ...tok,
        pos: 'DETERMINER',
        posCandidates: ['DETERMINER'],
        lemma: clean,
        confidence: 'high'
      });
      continue;
    }
    if (PRONOUNS.has(clean)) {
      tagged.push({
        ...tok,
        pos: 'PRONOUN',
        posCandidates: ['PRONOUN'],
        lemma: clean,
        confidence: 'high'
      });
      continue;
    }
    if (CONJUNCTIONS.has(clean)) {
      tagged.push({
        ...tok,
        pos: 'CONJUNCTION',
        posCandidates: ['CONJUNCTION'],
        lemma: clean,
        confidence: 'high'
      });
      continue;
    }
    if (PREPOSITIONS.has(clean)) {
      tagged.push({
        ...tok,
        pos: 'PREPOSITION',
        posCandidates: ['PREPOSITION'],
        lemma: clean,
        confidence: 'high'
      });
      continue;
    }
    if (INTERJECTIONS.has(clean)) {
      tagged.push({
        ...tok,
        pos: 'INTERJECTION',
        posCandidates: ['INTERJECTION'],
        lemma: clean,
        confidence: 'high'
      });
      continue;
    }

    // 8. Dictionary & Lemmatizer Lookups
    const dict = searchDictionary(clean);
    const lemmaRes = lemmatizeWord(clean);

    const candidates = new Set();
    function addPosFromDict(d) {
      if (d && d.found) {
        for (const m of d.meanings) {
          const p = (m.pos || '').toUpperCase();
          if (p === 'N' || p === 'NOUN') candidates.add('NOUN');
          else if (p === 'V' || p === 'VERB') candidates.add('VERB');
          else if (p === 'A' || p === 'ADJ' || p === 'ADJECTIVE') candidates.add('ADJECTIVE');
          else if (p === 'D' || p === 'ADV' || p === 'ADVERB') candidates.add('ADVERB');
          else if (p === 'P' || p === 'PRON') candidates.add('PRONOUN');
          else if (p === 'E' || p === 'PREP') candidates.add('PREPOSITION');
          else if (p === 'C' || p === 'CONJ') candidates.add('CONJUNCTION');
          else if (p === 'O') candidates.add('INTERJECTION');
        }
      }
    }
    addPosFromDict(dict);
    if (lemmaRes && Array.isArray(lemmaRes.lemmas)) {
      for (const lem of lemmaRes.lemmas) {
        if (lem !== clean) {
          addPosFromDict(searchDictionary(lem));
        }
      }
    }

    // 9. Contextual Disambiguation Rules
    let pos = 'UNKNOWN';
    let confidence = 'medium';
    let ambiguous = candidates.size > 1;

    // Find preceding non-adverb token if adverbs intervene
    let prevNonAdv = null;
    for (let k = i - 1; k >= 0; k--) {
      if (tagged[k] && tagged[k].pos !== 'ADVERB') {
        prevNonAdv = tagged[k];
        break;
      }
    }
    const prev = i > 0 ? tagged[i - 1] : null;
    const next = i + 1 < tokens.length ? tokens[i + 1] : null;

    const SUBJECT_PRONOUNS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they']);

    if (prev && prev.pos === 'DETERMINER') {
      // Determiner + ambiguous -> check if followed by NOUN
      if (next && next.isWord) {
        const nextDict = searchDictionary(next.cleanWord);
        const nextHasNoun = nextDict.found && nextDict.meanings.some(m => {
          const p = (m.pos || '').toUpperCase();
          return p === 'N' || p === 'NOUN';
        });
        if (nextHasNoun && (candidates.has('ADJECTIVE') || clean.includes('-'))) {
          pos = 'ADJECTIVE';
          ambiguous = false;
          confidence = 'high';
        } else {
          pos = 'NOUN';
          ambiguous = false;
          confidence = 'high';
        }
      } else {
        pos = 'NOUN';
        ambiguous = false;
        confidence = 'high';
      }
    } else if (prev && prev.pos === 'ADJECTIVE') {
      // Adjective + ambiguous -> NOUN (e.g. "complex problem", "good student")
      if (candidates.has('NOUN')) {
        pos = 'NOUN';
        ambiguous = false;
        confidence = 'high';
      }
    } else if (clean.includes('-') && next && next.isWord) {
      // Hyphenated compound modifying noun (e.g. "state-of-the-art model")
      pos = 'ADJECTIVE';
      ambiguous = false;
      confidence = 'high';
    } else if (prev && prev.cleanWord === 'to') {
      // to + ambiguous (infinitive) -> VERB
      if (candidates.has('VERB')) {
        pos = 'VERB';
        ambiguous = false;
        confidence = 'high';
      }
    } else if (prevNonAdv && prevNonAdv.pos === 'MODAL') {
      // Modal + [adv]* + Verb
      if (candidates.has('VERB')) {
        pos = 'VERB';
        ambiguous = false;
        confidence = 'high';
      }
    } else if (prevNonAdv && prevNonAdv.pos === 'AUXILIARY') {
      const auxWord = prevNonAdv.cleanWord || (prevNonAdv.contraction && prevNonAdv.contraction.stem);
      if (AUX_DO.has(auxWord) && candidates.has('VERB')) {
        pos = 'VERB';
        ambiguous = false;
        confidence = 'high';
      } else if (AUX_BE.has(auxWord)) {
        const isParticipleVerb = (clean.endsWith('ing') || clean.endsWith('ed') || IRREGULAR_PAST_PARTICIPLES.has(clean)) && !COMMON_PARTICIPIAL_ADJECTIVES.has(clean);
        if (isParticipleVerb && candidates.has('VERB')) {
          pos = 'VERB';
          ambiguous = false;
          confidence = 'high';
        } else if (candidates.has('ADJECTIVE')) {
          pos = 'ADJECTIVE';
          ambiguous = false;
          confidence = 'high';
        } else if (candidates.has('VERB')) {
          pos = 'VERB';
          ambiguous = false;
          confidence = 'high';
        }
      } else if (AUX_HAVE.has(auxWord)) {
        if (candidates.has('VERB')) {
          pos = 'VERB';
          ambiguous = false;
          confidence = 'high';
        }
      }
    } else if (prev && prev.pos === 'VERB') {
      // Verb + ambiguous (Noun/Verb) -> Direct Object Noun (e.g. "reads books", "makes plans")
      if (candidates.has('NOUN')) {
        pos = 'NOUN';
        ambiguous = false;
        confidence = 'high';
      } else if (candidates.has('ADJECTIVE')) {
        pos = 'ADJECTIVE';
        ambiguous = false;
        confidence = 'high';
      }
    } else if (prev && (prev.pos === 'NOUN' || prev.pos === 'PRONOUN')) {
      const isObjPronoun = prev.pos === 'PRONOUN' && new Set(['me', 'him', 'her', 'us', 'them']).has(prev.cleanWord);
      if (isObjPronoun) {
        // Object pronoun + Adjective -> Object Complement (e.g. "made him happy", "found it difficult")
        if (candidates.has('ADJECTIVE')) {
          pos = 'ADJECTIVE';
          ambiguous = false;
          confidence = 'high';
        } else if (candidates.has('NOUN')) {
          pos = 'NOUN';
          ambiguous = false;
          confidence = 'high';
        } else if (candidates.has('VERB')) {
          pos = 'VERB';
        }
      } else {
        // Subject (Noun/Subject Pronoun) + ambiguous (Verb/Noun) -> Main Verb
        // e.g. "The news made him happy", "The boy kicked the ball", "Birds fly"
        if (candidates.has('VERB')) {
          pos = 'VERB';
          ambiguous = false;
          confidence = 'high';
        } else if (candidates.has('NOUN')) {
          pos = 'NOUN';
        } else if (candidates.has('ADJECTIVE')) {
          pos = 'ADJECTIVE';
        }
      }
    } else if (prev && prev.pos === 'PREPOSITION') {
      // Preposition + ambiguous -> Object of preposition is NOUN (e.g. "in order", "by train")
      if (candidates.has('NOUN')) {
        pos = 'NOUN';
        ambiguous = false;
        confidence = 'high';
      }
    } else if ((i === 0 || (prev && prev.pos === 'INTERJECTION')) && candidates.has('VERB') && next && (DETERMINERS.has(next.cleanWord) || PRONOUNS.has(next.cleanWord) || PREPOSITIONS.has(next.cleanWord) || next.isWord)) {
      // Imperative at sentence start or after interjection: e.g. "Open the door", "Please take care of"
      pos = 'VERB';
      ambiguous = false;
      confidence = 'high';
    } else {
      // Suffix heuristics for remaining tokens
      if (clean.endsWith('tion') || clean.endsWith('ment') || clean.endsWith('ness') || clean.endsWith('ity') || clean.endsWith('ship')) {
        pos = 'NOUN';
        confidence = 'high';
        ambiguous = false;
      } else if (clean.endsWith('able') || clean.endsWith('ible') || clean.endsWith('ous') || clean.endsWith('ful') || clean.endsWith('less')) {
        pos = 'ADJECTIVE';
        confidence = 'high';
        ambiguous = false;
      } else if (clean.endsWith('ly') && clean.length > 3) {
        pos = 'ADVERB';
        confidence = 'high';
        ambiguous = false;
      } else if (candidates.size > 0) {
        // Preferred default order: NOUN -> VERB -> ADJECTIVE -> ADVERB
        if (candidates.has('NOUN') && !candidates.has('VERB')) pos = 'NOUN';
        else if (candidates.has('VERB') && !candidates.has('NOUN')) pos = 'VERB';
        else if (candidates.has('ADJECTIVE') && !candidates.has('NOUN') && !candidates.has('VERB')) pos = 'ADJECTIVE';
        else pos = Array.from(candidates)[0];
      } else {
        // Unknown word fallback
        pos = 'NOUN';
        confidence = 'low';
      }
    }

    let finalLemma = clean;
    if (lemmaRes && Array.isArray(lemmaRes.lemmas) && lemmaRes.lemmas.length > 0) {
      if (lemmaRes.lemmas.length > 1 && pos) {
        const refinedLemmaRes = lemmatizeWord(clean, { pos });
        if (refinedLemmaRes && refinedLemmaRes.lemmas && refinedLemmaRes.lemmas.length > 0) {
          finalLemma = refinedLemmaRes.lemmas[0];
        } else {
          finalLemma = lemmaRes.lemmas[0];
        }
      } else {
        finalLemma = lemmaRes.lemmas[0];
      }
    }

    tagged.push({
      ...tok,
      pos,
      posCandidates: Array.from(candidates),
      ambiguous,
      lemma: finalLemma,
      confidence
    });
  }

  return tagged;
}

module.exports = {
  tagSentence,
  DETERMINERS,
  PRONOUNS,
  MODALS,
  AUX_BE,
  AUX_HAVE,
  AUX_DO,
  PREPOSITIONS,
  CONJUNCTIONS,
  ADVERBS_COMMON
};
