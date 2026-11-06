/**
 * Offline English Sentence Structure Analyzer — Main Entry Point.
 *
 * Integrates:
 * - Sentence Splitter (abbreviations, titles, punctuation)
 * - Tokenizer (contractions, hyphens, numbers, offsets)
 * - Part-of-Speech Tagger (rule-based with dictionary disambiguation)
 * - Verb Phrase Analyzer (auxiliaries, modals, aspect, voice, phrasal verbs)
 * - Tense Detector (12 tenses, interrogative, imperative, exclamatory)
 * - Syntax Analyzer (Subject, DO, IO, SC, OC, 5 sentence patterns)
 * - Clause Detector (independent, dependent, relative, conditional, noun, adverbial, coordinated)
 *
 * Features:
 * - 100% offline
 * - Zero external AI / cloud dependencies
 * - Bounded LRU cache for high-throughput repetition
 * - Exact character offset tracking for all constituents
 */

const { splitSentences } = require('./sentence-splitter');
const { tokenize } = require('./tokenizer');
const { tagSentence } = require('./pos-tagger');
const { analyzeVerbPhrases } = require('./verb-phrase-analyzer');
const { detectTense } = require('./tense-detector');
const { analyzeSyntax } = require('./syntax-analyzer');
const { detectClauses } = require('./clause-detector');

// Bounded LRU Cache for sentence analyses
const CACHE_MAX_SIZE = 1000;
const analysisCache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Get cached analysis or compute fresh.
 * @param {string} key
 * @returns {Object|null}
 */
function getFromCache(key) {
  if (analysisCache.has(key)) {
    const val = analysisCache.get(key);
    // Refresh LRU order
    analysisCache.delete(key);
    analysisCache.set(key, val);
    cacheHits++;
    return val;
  }
  cacheMisses++;
  return null;
}

/**
 * Set analysis in bounded LRU cache.
 * @param {string} key
 * @param {Object} value
 */
function setToCache(key, value) {
  if (analysisCache.size >= CACHE_MAX_SIZE) {
    const firstKey = analysisCache.keys().next().value;
    analysisCache.delete(firstKey);
  }
  analysisCache.set(key, value);
}

/**
 * Analyze a single sentence.
 * @param {string} sentenceText
 * @returns {Object} Complete sentence analysis
 */
function analyzeSentence(sentenceText) {
  if (typeof sentenceText !== 'string' || !sentenceText.trim()) {
    return {
      text: '',
      tokens: [],
      verbPhrases: [],
      tense: { tense: 'UNKNOWN', aspect: 'simple', voice: 'active', sentenceType: 'declarative', confidence: 'low', evidence: [] },
      syntax: { pattern: 'UNKNOWN', subject: null, predicate: null, verb: null, directObject: null, indirectObject: null, subjectComplement: null, objectComplement: null },
      clauses: []
    };
  }

  const trimmed = sentenceText.trim();
  const cached = getFromCache(trimmed);
  if (cached) {
    return cached;
  }

  // 1. Tokenize
  const tokens = tokenize(sentenceText);

  // 2. POS Tagging
  const taggedTokens = tagSentence(tokens);

  // 3. Clause Detection
  const clauses = detectClauses(sentenceText, taggedTokens);

  // Enrich each clause with its own verb phrases, tense, and syntax
  for (const c of clauses) {
    const cTokens = c.tokens || taggedTokens;
    const cVps = analyzeVerbPhrases(sentenceText, cTokens);
    const cTense = detectTense(cVps, cTokens);
    const cSyntax = analyzeSyntax(sentenceText, cTokens, cVps, cTense);
    c.verbPhrases = cVps;
    c.tense = cTense;
    c.syntax = cSyntax;
  }

  // Find main / primary clause for sentence-level summary
  const mainClause = clauses.find(c => c.isIndependent) || clauses[0];

  // Overall sentence-level verb phrases, tense, and syntax
  const verbPhrases = analyzeVerbPhrases(sentenceText, taggedTokens);
  const tenseInfo = (mainClause && mainClause.tense) || detectTense(verbPhrases, taggedTokens);
  const syntaxInfo = (mainClause && mainClause.syntax) || analyzeSyntax(sentenceText, taggedTokens, verbPhrases, tenseInfo);

  const result = {
    text: sentenceText,
    tokens: taggedTokens,
    verbPhrases,
    tense: tenseInfo,
    syntax: syntaxInfo,
    clauses
  };

  setToCache(trimmed, result);
  return result;
}

/**
 * Analyze multi-sentence text.
 * @param {string} text
 * @returns {Array<Object>} Array of analyzed sentences with global offsets
 */
function analyzeText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const rawSentences = splitSentences(text);
  const results = [];

  for (const s of rawSentences) {
    const analysis = analyzeSentence(s.text);

    // Attach global offsets to sentence analysis
    results.push({
      ...analysis,
      globalStartIndex: s.startIndex,
      globalEndIndex: s.endIndex,
      trimmed: s.trimmed
    });
  }

  return results;
}

/**
 * Extract just the sentence syntax and pattern structure.
 * @param {string} sentenceText
 * @returns {Object}
 */
function getSentenceStructure(sentenceText) {
  const analysis = analyzeSentence(sentenceText);
  return analysis.syntax;
}

/**
 * Extract just the verb phrases and tense profile.
 * @param {string} sentenceText
 * @returns {Object}
 */
function getVerbPhrases(sentenceText) {
  const analysis = analyzeSentence(sentenceText);
  return {
    verbPhrases: analysis.verbPhrases,
    tense: analysis.tense
  };
}

/**
 * Extract just the clauses and classifications.
 * @param {string} sentenceText
 * @returns {Array<Object>}
 */
function getClauses(sentenceText) {
  const analysis = analyzeSentence(sentenceText);
  return analysis.clauses;
}

/**
 * Clear the internal LRU cache.
 */
function clearCache() {
  analysisCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Get internal cache stats.
 * @returns {{ size: number, hits: number, misses: number }}
 */
function getCacheStats() {
  return {
    size: analysisCache.size,
    hits: cacheHits,
    misses: cacheMisses
  };
}

module.exports = {
  analyzeSentence,
  analyzeText,
  getSentenceStructure,
  getVerbPhrases,
  getClauses,
  clearCache,
  getCacheStats,
  splitSentences,
  tokenize,
  tagSentence
};
