/**
 * Offline English-to-Vietnamese Translation Engine.
 *
 * Implements the deterministic linguistic translation pipeline:
 * Input English sentence
 * → Sentence Analyzer (Stage 5)
 * → Tokenization and POS tagging
 * → Lemmatization (Stage 4)
 * → Phrase and idiom matching (Stage 3.1)
 * → Dictionary lookup (Stage 2)
 * → Contextual meaning selection
 * → Sentence structure analysis (S+V, S+V+O, S+V+C, S+V+IO+DO, S+V+O+C)
 * → Clause analysis (independent, adverbial, conditional, relative, noun, coordinated)
 * → Tense and voice handling
 * → Vietnamese word-order transformation
 * → Translation formatting
 * → Final Vietnamese output
 *
 * Features:
 * - 100% offline
 * - Zero AI / cloud / external dependencies
 * - Bounded LRU cache for ultra-fast repetition
 * - Full diagnostic tracking (words translated, phrases recognized, unknown words, confidence)
 */

const { analyzeSentence, analyzeText: analyzeTextStage5 } = require('../analyzer/index');
const { translateWord } = require('./word-translator');
const { findAndTranslatePhrases } = require('./phrase-translator');
const { translateStructure } = require('./structure-translator');
const { translateMultiClauseSentence, translateClauseUnit } = require('./clause-translator');
const { formatTranslation } = require('./translation-formatter');

// Bounded LRU Cache for translations (1,000 sentences)
const CACHE_MAX_SIZE = 1000;
const translationCache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

function getFromCache(key) {
  if (translationCache.has(key)) {
    const val = translationCache.get(key);
    translationCache.delete(key);
    translationCache.set(key, val);
    cacheHits++;
    return val;
  }
  cacheMisses++;
  return null;
}

function setToCache(key, value) {
  if (translationCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = translationCache.keys().next().value;
    translationCache.delete(oldestKey);
  }
  translationCache.set(key, value);
}

/**
 * Translate a single English sentence into understandable Vietnamese.
 * @param {string} sentenceText Full English sentence
 * @param {Object} [options]
 * @returns {Object} Structured translation result
 */
function translateSentence(sentenceText, options = {}) {
  if (!sentenceText || typeof sentenceText !== 'string' || !sentenceText.trim()) {
    return formatTranslation('', '', {
      sentenceType: 'declarative',
      tense: 'UNKNOWN',
      pattern: 'UNKNOWN',
      clausesCount: 0,
      wordsCount: 0,
      wordsTranslated: 0,
      phrasesRecognized: 0,
      unknownWords: [],
      uncertainWords: []
    });
  }

  const trimmed = sentenceText.trim();

  // Check LRU Cache (unless bypassCache requested)
  if (!options.bypassCache) {
    const cached = getFromCache(trimmed);
    if (cached) {
      return cached;
    }
  }

  // 1. Analyze sentence structure using Stage 5 Analyzer
  const analysis = analyzeSentence(trimmed);

  // 2. Identify multi-word expressions and idioms (Stage 3.1)
  const matchedPhrases = findAndTranslatePhrases(trimmed);

  // 3. Collect word-level diagnostics
  const wordTokens = analysis.tokens.filter(t => t.isWord);
  const unknownWords = [];
  const uncertainWords = [];
  let wordsTranslated = 0;

  for (const t of wordTokens) {
    const wRes = translateWord(t);
    if (wRes.isUnknown) {
      unknownWords.push(t.text);
    } else if (wRes.confidence === 'medium') {
      uncertainWords.push(t.text);
      wordsTranslated++;
    } else {
      wordsTranslated++;
    }
  }

  // 4. Translate based on Clause Architecture
  let rawTranslation = '';
  const clauses = analysis.clauses || [];

  if (clauses.length > 1) {
    // Multi-clause sentence (adverbial, conditional, relative, noun, coordinated)
    rawTranslation = translateMultiClauseSentence(clauses, analysis);
  } else if (clauses.length === 1) {
    // Single clause sentence
    rawTranslation = translateClauseUnit(clauses[0]);
  } else {
    // Fallback: translate simple structure
    rawTranslation = translateStructure(analysis.syntax, analysis.tense, analysis.verbPhrases[0], analysis.tokens);
  }

  // 5. Format Translation & Aggregate Diagnostics
  const formatted = formatTranslation(rawTranslation, trimmed, {
    sentenceType: analysis.tense?.sentenceType || 'declarative',
    tense: analysis.tense?.tense || 'Present Simple',
    pattern: analysis.syntax?.pattern || 'S+V',
    clausesCount: clauses.length,
    wordsCount: wordTokens.length,
    wordsTranslated,
    phrasesRecognized: matchedPhrases.length,
    unknownWords,
    uncertainWords
  });

  // Attach metadata
  formatted.clauses = clauses.map(c => ({
    text: c.text,
    type: c.type,
    marker: c.marker
  }));
  formatted.phrases = matchedPhrases;
  formatted.tokens = analysis.tokens;

  // Cache result
  if (!options.bypassCache) {
    setToCache(trimmed, formatted);
  }

  return formatted;
}

/**
 * Translate multi-sentence text with paragraph and sentence offset tracking.
 * @param {string} text Full raw text
 * @param {Object} [options]
 * @returns {Array<Object>} Array of translated sentences with global offsets
 */
function translateText(text, options = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const analyzedSentences = analyzeTextStage5(text);
  const results = [];

  for (const s of analyzedSentences) {
    const trans = translateSentence(s.text, options);
    results.push({
      ...trans,
      startIndex: s.globalStartIndex,
      endIndex: s.globalEndIndex,
      globalStartIndex: s.globalStartIndex,
      globalEndIndex: s.globalEndIndex,
      trimmed: s.trimmed
    });
  }

  return results;
}

/**
 * Clear the translation LRU cache.
 */
function clearCache() {
  translationCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Get cache performance statistics.
 * @returns {{ size: number, hits: number, misses: number, hitRate: number }}
 */
function getCacheStats() {
  const total = cacheHits + cacheMisses;
  const hitRate = total > 0 ? (cacheHits / total) : 0;
  return {
    size: translationCache.size,
    maxSize: CACHE_MAX_SIZE,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: Number((hitRate * 100).toFixed(2))
  };
}

module.exports = {
  translateSentence,
  translateText,
  clearCache,
  getCacheStats
};
