/**
 * Offline English Sentence Splitter.
 * Accurately detects sentence boundaries with full support for:
 * - Abbreviations & honorifics (Mr., Mrs., Dr., Prof., etc.)
 * - Acronyms with periods (U.S., U.K., e.g., i.e., a.m., p.m.)
 * - Decimal numbers ($3.14, 2.5%)
 * - Quotation marks, brackets, and parentheses enclosing punctuation
 * - Ellipses and combined punctuation (..., ?!, !?)
 * - Exact character offset tracking for all sentences
 */

const TITLES = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'rev', 'gen', 'col', 'capt', 'lt', 'st'
]);

const ACRONYMS_AND_ABBREVIATIONS = new Set([
  'u.s', 'u.k', 'u.n', 'e.u', 'e.g', 'i.e', 'etc', 'vs', 'al', 'approx', 'est', 'dept',
  'fig', 'no', 'vol', 'a.m', 'p.m'
]);

/**
 * Extract word preceding period index including internal dots.
 * @param {string} text
 * @param {number} periodIndex
 * @returns {string}
 */
function getPrecedingWord(text, periodIndex) {
  let start = periodIndex - 1;
  while (start >= 0 && /[a-zA-Z.]/.test(text[start])) {
    start--;
  }
  start++;
  return text.substring(start, periodIndex);
}

/**
 * Split text into sentences with exact character offsets.
 * @param {string} text Full raw text
 * @returns {Array<{ text: string, trimmed: string, startIndex: number, endIndex: number }>}
 */
function splitSentences(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const sentences = [];
  const len = text.length;
  let start = 0;

  // Skip leading whitespace
  while (start < len && /\s/.test(text[start])) {
    start++;
  }

  let i = start;
  while (i < len) {
    const char = text[i];

    // Check sentence terminators: '.', '?', '!'
    if (char === '.' || char === '?' || char === '!') {
      // 1. Handle ellipsis (... or .. or ?!)
      let endPunct = i;
      while (endPunct + 1 < len && /[.?!]/.test(text[endPunct + 1])) {
        endPunct++;
      }
      const punctSeq = text.substring(i, endPunct + 1);

      // Check decimal numbers (e.g. 3.14, $1.50)
      if (char === '.' && punctSeq === '.') {
        if (i > 0 && /\d/.test(text[i - 1]) && i + 1 < len && /\d/.test(text[i + 1])) {
          i++;
          continue;
        }
      }

      // Check abbreviations for period
      if (char === '.' && (punctSeq === '.' || punctSeq === '..')) {
        const fullToken = getPrecedingWord(text, i + 1).toLowerCase();
        const tokenWithoutDot = fullToken.endsWith('.') ? fullToken.slice(0, -1) : fullToken;

        // Title abbreviation followed by name (e.g. "Dr. Smith", "Mr. Brown")
        if (TITLES.has(tokenWithoutDot)) {
          i = endPunct + 1;
          continue;
        }

        // Acronyms (e.g. U.S., e.g., i.e., a.m., p.m.)
        if (ACRONYMS_AND_ABBREVIATIONS.has(tokenWithoutDot) || ACRONYMS_AND_ABBREVIATIONS.has(fullToken)) {
          const nextSlice = text.substring(endPunct + 1);
          if (/^[\s,]+[a-z0-9]/.test(nextSlice)) {
            i = endPunct + 1;
            continue;
          }
        }

        // Single letter initial before a capitalized name (e.g. "J. K. Rowling", "George W. Bush")
        const singleInitialMatch = text.substring(0, i).match(/(?:^|\s)([A-Z])$/);
        if (singleInitialMatch) {
          const nextSlice = text.substring(endPunct + 1);
          if (/^\s+[A-Z]/.test(nextSlice)) {
            i = endPunct + 1;
            continue;
          }
        }
      }

      // Ellipsis followed by lowercase letter is continuing thought
      if (punctSeq.length >= 3 && char === '.') {
        const nextSlice = text.substring(endPunct + 1);
        if (/^\s+[a-z]/.test(nextSlice)) {
          i = endPunct + 1;
          continue;
        }
      }

      // 2. Check closing quotes, brackets, or parentheses
      let boundaryEnd = endPunct + 1;
      let hasClosingQuoteOrBracket = false;
      while (boundaryEnd < len && /['"’”\)\]]/.test(text[boundaryEnd])) {
        hasClosingQuoteOrBracket = true;
        boundaryEnd++;
      }

      // If quote is closed and followed by a lowercase dialogue tag (e.g. '"Do you agree?" he asked.'),
      // do not split here — continue until the end of the attribution clause
      if (hasClosingQuoteOrBracket && boundaryEnd < len) {
        const nextSlice = text.substring(boundaryEnd);
        if (/^\s+[a-z]/.test(nextSlice)) {
          i = boundaryEnd;
          continue;
        }
      }

      // Check if followed by whitespace or end of string
      if (boundaryEnd >= len || /\s/.test(text[boundaryEnd])) {
        const sentenceRaw = text.substring(start, boundaryEnd);
        sentences.push({
          text: sentenceRaw,
          trimmed: sentenceRaw.trim(),
          startIndex: start,
          endIndex: boundaryEnd
        });

        start = boundaryEnd;
        while (start < len && /\s/.test(text[start])) {
          start++;
        }
        i = start;
        continue;
      }
    }

    i++;
  }

  // Any remaining text without final punctuation
  if (start < len) {
    const remainingRaw = text.substring(start);
    if (remainingRaw.trim()) {
      sentences.push({
        text: remainingRaw,
        trimmed: remainingRaw.trim(),
        startIndex: start,
        endIndex: len
      });
    }
  }

  return sentences;
}

module.exports = {
  splitSentences,
  TITLES,
  ACRONYMS_AND_ABBREVIATIONS
};
