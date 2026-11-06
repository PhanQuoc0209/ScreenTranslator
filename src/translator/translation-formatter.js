/**
 * Offline Translation Formatter.
 * Formats the final Vietnamese translation:
 * - Sentence-initial capitalization
 * - Typographic spacing cleanup (no space before punctuation, single space after)
 * - Punctuation and quotes preservation
 * - Diagnostics and confidence score aggregation
 */

/**
 * Clean up spacing around punctuation.
 * @param {string} text
 * @returns {string}
 */
function cleanSpacing(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;?!])/g, '$1')
    .replace(/([,.:;?!])(?=[^\s,.:;?!])/g, '$1 ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/“\s+/g, '“')
    .replace(/\s+”/g, '”')
    .replace(/"\s+/g, '"')
    .replace(/\s+"/g, '"')
    .trim();
}

/**
 * Capitalize the first alphabetical character of a string.
 * @param {string} text
 * @returns {string}
 */
function capitalizeFirst(text) {
  if (!text) return '';
  // Find first word char
  const match = text.match(/[a-zA-ZÀ-ỹ]/);
  if (!match) return text;
  const idx = match.index;
  return text.substring(0, idx) + match[0].toUpperCase() + text.substring(idx + 1);
}

/**
 * Format translation with proper capitalization, spacing, and punctuation.
 * @param {string} rawTranslation
 * @param {string} originalSentence
 * @param {Object} [metadata]
 * @returns {Object} Structured translation result
 */
function formatTranslation(rawTranslation, originalSentence, metadata = {}) {
  let cleaned = cleanSpacing(rawTranslation);
  cleaned = capitalizeFirst(cleaned);

  // Preserve original terminating punctuation if missing
  const lastOrigChar = (originalSentence || '').trim().slice(-1);
  const lastCleanChar = cleaned.slice(-1);

  if (['.', '!', '?'].includes(lastOrigChar)) {
    if (!['.', '!', '?'].includes(lastCleanChar)) {
      cleaned = cleaned + lastOrigChar;
    }
  }

  // Determine overall confidence
  let confidence = 'high';
  const unknownWords = metadata.unknownWords || [];
  const uncertainWords = metadata.uncertainWords || [];
  const uncertaintyReasons = metadata.uncertaintyReasons ? [...metadata.uncertaintyReasons] : [];

  if (unknownWords.length > 0) {
    confidence = unknownWords.length > 2 ? 'low' : 'medium';
    if (!uncertaintyReasons.some(r => r.includes('unknown'))) {
      uncertaintyReasons.push(`Contains ${unknownWords.length} non-dictionary word(s): ${unknownWords.join(', ')}`);
    }
  } else if (uncertainWords.length > 0) {
    confidence = 'medium';
    if (!uncertaintyReasons.some(r => r.includes('ambiguous'))) {
      uncertaintyReasons.push(`Contains ambiguous word(s): ${uncertainWords.join(', ')}`);
    }
  }

  return {
    originalText: originalSentence,
    translatedText: cleaned,
    confidence,
    uncertaintyReasons,
    sentenceType: metadata.sentenceType || 'declarative',
    tense: metadata.tense || 'Present Simple',
    voice: metadata.voice || 'active',
    pattern: metadata.pattern || 'S+V',
    clausesCount: metadata.clausesCount || 1,
    appliedRules: {
      sentenceType: metadata.sentenceType || 'declarative',
      tense: metadata.tense || 'Present Simple',
      voice: metadata.voice || 'active',
      aspect: metadata.aspect || 'simple',
      pattern: metadata.pattern || 'S+V'
    },
    selectedWordMeanings: metadata.selectedWordMeanings || [],
    diagnostics: {
      wordsCount: metadata.wordsCount || 0,
      wordsTranslated: metadata.wordsTranslated || 0,
      phrasesRecognized: metadata.phrasesRecognized || 0,
      unknownWords,
      uncertainWords,
      uncertaintyReasons
    }
  };
}

module.exports = {
  formatTranslation,
  cleanSpacing,
  capitalizeFirst
};
