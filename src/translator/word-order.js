/**
 * Offline Vietnamese Word-Order Transformation Module.
 * Implements deterministic syntactic restructuring rules:
 * 1. Noun Phrase Reordering:
 *    English: [Determiner] [Adjectives]* [Head Noun]
 *    Vietnamese: [Quantifier/Classifier] [Head Noun] [Adjectives]* [Demonstrative/Possessive]
 *    Examples:
 *    - "a red book" -> "một quyển sách đỏ"
 *    - "the delicious soup" -> "món súp ngon"
 *    - "my dog" -> "con chó của tôi"
 *    - "her homework" -> "bài tập về nhà của cô ấy"
 *    - "state-of-the-art model" -> "mô hình hiện đại"
 *    - "this book" -> "quyển sách này"
 *
 * 2. Prepositional Phrase Transformation:
 *    [Preposition] [Noun Phrase] -> [Giới từ] [Cụm danh từ]
 *    - "by Mary" -> "bởi Mary"
 *    - "in the room" -> "trong phòng"
 *    - "every day" -> "mỗi ngày"
 */

const { translateWord, POSSESSIVES_MAP } = require('./word-translator');

// Natural Vietnamese noun classifiers for common objects and entities
const NOUN_CLASSIFIERS = {
  'book': 'quyển',
  'books': '',
  'dog': 'con',
  'cat': 'con',
  'bird': 'con',
  'birds': 'những con',
  'boy': '', // boy alone translates to 'cậu bé' which already includes classifier
  'soup': '', // soup translates to 'món súp'
  'letter': '', // letter translates to 'lá thư'
  'bridge': '', // bridge translates to 'cây cầu'
  'ball': '', // ball translates to 'quả bóng'
  'sun': '', // sun translates to 'mặt trời'
  'exam': '', // exam translates to 'kỳ thi'
  'test': '', // test translates to 'bài kiểm tra'
  'homework': '', // homework translates to 'bài tập về nhà'
  'car': 'chiếc',
  'house': 'ngôi',
  'room': 'căn',
  'table': 'chiếc',
  'tree': 'cây'
};

/**
 * Translate and restructure an English noun phrase into natural Vietnamese word order.
 * @param {Array<Object>} tokens Tagged tokens forming the noun phrase
 * @param {Object} [options]
 * @returns {string} Restructured Vietnamese noun phrase
 */
function translateNounPhrase(tokens, options = {}) {
  if (!tokens || tokens.length === 0) return '';

  // Single token NP
  if (tokens.length === 1) {
    const wordRes = translateWord(tokens[0], options);
    return wordRes.translated;
  }

  const quantifiers = [];
  const adjs = [];
  const nouns = [];
  let possessive = null;
  let demonstrative = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const clean = t.cleanWord;

    // 1. Possessive pronouns (my, your, his, her, its, our, their)
    if (POSSESSIVES_MAP[clean]) {
      possessive = POSSESSIVES_MAP[clean];
      continue;
    }

    // 2. Demonstratives (this, that, these, those)
    if (clean === 'this') {
      demonstrative = 'này';
      continue;
    }
    if (clean === 'that') {
      demonstrative = 'đó';
      continue;
    }
    if (clean === 'these') {
      quantifiers.push('những');
      demonstrative = 'này';
      continue;
    }
    if (clean === 'those') {
      quantifiers.push('những');
      demonstrative = 'đó';
      continue;
    }

    // 3. Determiners & Quantifiers (a, an, the, every, all, some, many, two...)
    if (t.pos === 'DETERMINER' || t.pos === 'NUMBER') {
      if (clean === 'the') {
        // 'the' is omitted or absorbed into classifier in Vietnamese
        continue;
      }
      const detRes = translateWord(t, options);
      if (detRes.translated) {
        quantifiers.push(detRes.translated);
      }
      continue;
    }

    // 4. Adjectives modifying head noun
    if (t.pos === 'ADJECTIVE' || clean.includes('-')) {
      const adjRes = translateWord(t, options);
      if (adjRes.translated) {
        adjs.push(adjRes.translated);
      }
      continue;
    }

    // 5. Nouns / Pronouns
    if (t.pos === 'NOUN' || t.pos === 'PRONOUN' || t.pos === 'UNKNOWN') {
      const nounRes = translateWord(t, options);
      if (nounRes.translated) {
        nouns.push(nounRes.translated);
      }
      continue;
    }

    // Fallback for any other modifier
    const fallbackRes = translateWord(t, options);
    if (fallbackRes.translated) {
      nouns.push(fallbackRes.translated);
    }
  }

  const resultSegments = [];

  // 1. Quantifiers lead
  if (quantifiers.length > 0) {
    resultSegments.push(quantifiers.join(' '));
  }

  // 2. Classifier + Noun
  const headTok = tokens.slice().reverse().find(t => t.pos === 'NOUN') || tokens[tokens.length - 1];
  const headClean = headTok ? headTok.cleanWord : '';
  const classifier = NOUN_CLASSIFIERS[headClean] || '';

  const nounText = nouns.join(' ');
  if (classifier && !nounText.startsWith(classifier)) {
    resultSegments.push(classifier);
  }
  if (nounText) {
    resultSegments.push(nounText);
  }

  // 3. Adjectives follow the noun
  if (adjs.length > 0) {
    resultSegments.push(adjs.join(' '));
  }

  // 4. Possessive follows adjective
  if (possessive) {
    resultSegments.push(possessive);
  }

  // 5. Demonstrative follows all
  if (demonstrative) {
    resultSegments.push(demonstrative);
  }

  return resultSegments.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Translate a prepositional phrase (Preposition + Noun Phrase).
 * e.g. "by Mary" -> "bởi Mary", "in the room" -> "trong căn phòng"
 * @param {Array<Object>} tokens
 * @param {Object} [options]
 * @returns {string}
 */
function translatePrepositionalPhrase(tokens, options = {}) {
  if (!tokens || tokens.length === 0) return '';

  const firstTok = tokens[0];
  if (firstTok.pos === 'PREPOSITION') {
    const prepTrans = translateWord(firstTok, options).translated;
    const npTokens = tokens.slice(1);
    const npTrans = translateNounPhrase(npTokens, options);
    return `${prepTrans} ${npTrans}`.trim();
  }

  return translateNounPhrase(tokens, options);
}

module.exports = {
  translateNounPhrase,
  translatePrepositionalPhrase,
  NOUN_CLASSIFIERS
};
