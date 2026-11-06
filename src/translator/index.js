/**
 * Offline English to Vietnamese Translation Engine — Main Entry Point.
 *
 * Exposes:
 * - translateSentence(sentenceText, options)
 * - translateText(text, options)
 * - clearTranslationCache()
 * - getTranslationCacheStats()
 * - Modular components for inspection and test suites
 */

const {
  translateSentence,
  translateText,
  clearCache: clearTranslationCache,
  getCacheStats: getTranslationCacheStats
} = require('./translation-engine');

const wordTranslator = require('./word-translator');
const phraseTranslator = require('./phrase-translator');
const structureTranslator = require('./structure-translator');
const tenseTranslator = require('./tense-translator');
const clauseTranslator = require('./clause-translator');
const wordOrder = require('./word-order');
const translationFormatter = require('./translation-formatter');

module.exports = {
  translateSentence,
  translateText,
  clearTranslationCache,
  getTranslationCacheStats,

  // Sub-modules
  wordTranslator,
  phraseTranslator,
  structureTranslator,
  tenseTranslator,
  clauseTranslator,
  wordOrder,
  translationFormatter
};
