/**
 * Offline Phrase and Idiom Translator.
 * Integrates Stage 3.1 phrase matcher to identify and translate:
 * - Phrasal verbs (look forward to, give up, take care of, find out)
 * - Idiomatic expressions (kick the bucket)
 * - Prepositional and common multi-word phrases (at home, every day)
 * Ensures multi-word expressions are translated as unified conceptual units,
 * preventing disjointed word-by-word translation.
 */

const { matchPhrases } = require('../dictionary/phrase-matcher');
const { extractCleanGloss } = require('./word-translator');

// Curated canonical translations for common idioms & phrasal verbs
const CANONICAL_PHRASES = {
  'look forward to': 'mong đợi',
  'take care of': 'chăm sóc',
  'give up': 'từ bỏ',
  'find out': 'tìm ra',
  'kick the bucket': 'qua đời',
  'at home': 'ở nhà',
  'every day': 'mỗi ngày',
  'run out of': 'hết',
  'give up on': 'từ bỏ',
  'put up with': 'chịu đựng',
  'bring up': 'nuôi nấng',
  'call off': 'hủy bỏ',
  'carry on': 'tiếp tục',
  'come across': 'tình cờ gặp',
  'get along with': 'hòa thuận với',
  'give in': 'nhượng bộ',
  'go on': 'tiếp tục',
  'look for': 'tìm kiếm',
  'make up': 'bịa đặt',
  'pass away': 'qua đời',
  'set up': 'thiết lập',
  'turn down': 'từ chối'
};

/**
 * Translate a phrase match from phrase-matcher.
 * @param {Object} match Phrase match object
 * @returns {string} Vietnamese translated phrase
 */
function translatePhraseMatch(match) {
  const normKey = (match.word || match.originalText || '').toLowerCase().trim();

  // 1. Check canonical phrase translations
  if (CANONICAL_PHRASES[normKey]) {
    return CANONICAL_PHRASES[normKey];
  }

  // Check lemma variant
  if (match.lemma && CANONICAL_PHRASES[match.lemma.toLowerCase().trim()]) {
    return CANONICAL_PHRASES[match.lemma.toLowerCase().trim()];
  }

  // 2. Extract from dictionary meanings attached to phrase match
  if (match.meanings && match.meanings.length > 0) {
    for (const m of match.meanings) {
      if (m.definition) {
        const gloss = extractCleanGloss(m.definition);
        if (gloss) return gloss;
      }
    }
  }

  return match.originalText;
}

/**
 * Detect and translate all phrases and idioms in a sentence.
 * Returns array of translated phrase spans sorted by startIndex.
 * @param {string} sentenceText
 * @returns {Array<Object>}
 */
function findAndTranslatePhrases(sentenceText) {
  if (!sentenceText || typeof sentenceText !== 'string') return [];

  let matches = [];
  try {
    matches = matchPhrases(sentenceText);
  } catch (err) {
    return [];
  }

  // Filter only multi-word matches (phrasal_verb, idiom, phrase)
  const multiWordMatches = matches.filter(m =>
    m.matched && (m.matchType === 'phrasal_verb' || m.matchType === 'idiom' || m.matchType === 'phrase')
  );

  return multiWordMatches.map(m => {
    const translated = translatePhraseMatch(m);
    return {
      originalText: m.originalText,
      startIndex: m.startIndex,
      endIndex: m.endIndex,
      word: m.word,
      lemma: m.lemma,
      matchType: m.matchType,
      translated,
      confidence: 'high'
    };
  });
}

module.exports = {
  findAndTranslatePhrases,
  translatePhraseMatch,
  CANONICAL_PHRASES
};
