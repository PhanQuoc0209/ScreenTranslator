/**
 * Offline English Tokenizer.
 * Splits text into words, punctuation, numbers, and contractions with exact character offsets.
 * Features:
 * - Contraction parsing (don't, won't, can't, I'm, it's, they've, we'll, wouldn't, etc.)
 * - Hyphenated compound words (state-of-the-art, high-quality, co-worker)
 * - Number and currency detection ($3.14, 25%, 1,000)
 * - Multi-character punctuation (..., ?!, !?, --, —)
 * - Typographic quotes and Unicode normalization
 * - Exact start and end offsets: rawText.substring(tok.startIndex, tok.endIndex) === tok.text
 */

const CONTRACTIONS_MAP = {
  "n't": { type: 'negation', expanded: 'not' },
  "'m": { type: 'be', expanded: 'am' },
  "'re": { type: 'be', expanded: 'are' },
  "'s": { type: 'be_or_has_or_pos', expanded: 'is' },
  "'ve": { type: 'have', expanded: 'have' },
  "'ll": { type: 'modal', expanded: 'will' },
  "'d": { type: 'modal_or_had', expanded: 'would' }
};

const IRREGULAR_CONTRACTIONS = {
  "won't": { stem: 'will', suffix: "n't", expanded: ['will', 'not'] },
  "can't": { stem: 'can', suffix: "n't", expanded: ['can', 'not'] },
  "cannot": { stem: 'can', suffix: 'not', expanded: ['can', 'not'] },
  "shan't": { stem: 'shall', suffix: "n't", expanded: ['shall', 'not'] },
  "ain't": { stem: 'be', suffix: "n't", expanded: ['are', 'not'] },
  "let's": { stem: 'let', suffix: "'s", expanded: ['let', 'us'] }
};

/**
 * Parse contraction info for a word.
 * @param {string} word
 * @returns {Object|null}
 */
function parseContraction(word) {
  if (!word || typeof word !== 'string') return null;
  const clean = word.toLowerCase().replace(/[\u2018\u2019]/g, "'");

  if (IRREGULAR_CONTRACTIONS[clean]) {
    return {
      original: word,
      clean,
      ...IRREGULAR_CONTRACTIONS[clean]
    };
  }

  for (const [suffix, info] of Object.entries(CONTRACTIONS_MAP)) {
    if (clean.endsWith(suffix) && clean.length > suffix.length) {
      const stem = clean.slice(0, -suffix.length);
      return {
        original: word,
        clean,
        stem,
        suffix,
        type: info.type,
        expanded: [stem, info.expanded]
      };
    }
  }

  return null;
}

/**
 * Tokenize sentence or text into structured tokens with exact character offsets.
 * @param {string} text
 * @returns {Array<Object>}
 */
function tokenize(text) {
  if (typeof text !== 'string' || !text) {
    return [];
  }

  const tokens = [];
  // Tokenization Regex matches:
  // 1. Contractions: e.g. don't, I'm, it's, they've, we'll, wouldn't, John's
  // 2. Hyphenated compound words: e.g. state-of-the-art, high-quality, co-worker
  // 3. Numbers & currency: e.g. $3.14, 1,000, 25%, 42
  // 4. Standard alphanumeric words
  // 5. Multi-character punctuation: ..., ?!, !?, --, —
  // 6. Single punctuation characters
  const tokenRegex = /(?:[a-zA-Z0-9]+(?:['’][a-zA-Z]+)+)|(?:[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)+)|(?:\$?\d+(?:,\d{3})*(?:\.\d+)?%?)|(?:[a-zA-Z0-9]+)|(?:\.{2,3}|\?!|!\?|--|—)|(?:[^\s\w])/g;

  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    const raw = match[0];
    const startIndex = match.index;
    const endIndex = match.index + raw.length;
    const clean = raw.toLowerCase().replace(/[\u2018\u2019]/g, "'");

    const isPunct = /^[^\w\s]+$/.test(raw) && !/^['’]/.test(raw);
    const isNum = /^\$?\d+(?:,\d{3})*(?:\.\d+)?%?$/.test(raw);
    const isWord = /^[a-zA-Z0-9]/.test(raw) && !isNum;
    const contraction = isWord ? parseContraction(raw) : null;

    tokens.push({
      text: raw,
      cleanWord: clean,
      startIndex,
      endIndex,
      isWord,
      isNumber: isNum,
      isPunctuation: isPunct,
      contraction
    });
  }

  return tokens;
}

module.exports = {
  tokenize,
  parseContraction,
  CONTRACTIONS_MAP,
  IRREGULAR_CONTRACTIONS
};
