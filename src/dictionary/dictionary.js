const { getDatabase } = require('./db');

/**
 * Bounded LRU Cache implementation using native Map insertion order.
 */
class LRUCache {
  constructor(maxSize = 1000) {
    if (typeof maxSize !== 'number' || maxSize <= 0) {
      throw new Error('LRUCache maxSize must be a positive integer.');
    }
    this.maxSize = maxSize;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  get(key) {
    if (!this.cache.has(key)) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    const value = this.cache.get(key);
    // Refresh position to mark as most recently used
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first item in map)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.evictions++;
    }
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) : 0;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: Number((hitRate * 100).toFixed(2))
    };
  }

  setMaxSize(newSize) {
    if (typeof newSize !== 'number' || newSize <= 0) {
      throw new Error('New maxSize must be a positive integer.');
    }
    this.maxSize = newSize;
    while (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.evictions++;
    }
  }
}

// Bounded LRU Cache instance (default 1,000 entries)
const dictionaryCache = new LRUCache(1000);

// Prepared SQL Statements and casing variations map
let preparedStatements = null;
let casingMap = null;

function getCasingMap() {
  if (casingMap) {
    return casingMap;
  }
  const db = getDatabase();
  const rows = db.prepare("SELECT word FROM words WHERE word != lower(word)").all();
  casingMap = new Map();
  for (const r of rows) {
    const lower = r.word.toLowerCase();
    if (!casingMap.has(lower)) {
      casingMap.set(lower, []);
    }
    casingMap.get(lower).push(r.word);
  }
  return casingMap;
}

function getPreparedStatements() {
  if (preparedStatements) {
    return preparedStatements;
  }

  const db = getDatabase();

  preparedStatements = {
    // 1. Fast exact headword lookup using index idx_words_unique (word, lang_code)
    findWordExact: db.prepare(`
      SELECT id, word, lang_code 
      FROM words 
      WHERE word = ? 
      LIMIT 1
    `),

    // 2. Fetch definitions for a word_id using idx_word_definitions_word_id
    findDefinitions: db.prepare(`
      SELECT 
        d.pos, 
        d.sub_pos, 
        d.definition, 
        wd.example
      FROM word_definitions wd
      JOIN definitions d ON wd.definition_id = d.id
      WHERE wd.word_id = ?
      ORDER BY wd.id ASC
    `),

    // 3. Fetch pronunciations using idx_pronunciations_word_id
    findPronunciations: db.prepare(`
      SELECT ipa, region 
      FROM pronunciations 
      WHERE word_id = ?
      ORDER BY id ASC
    `),

    // 4. Prefix search (useful for autocomplete or variations)
    findPrefix: db.prepare(`
      SELECT word 
      FROM words 
      WHERE word >= ? AND word < ? || 'z' 
      LIMIT ?
    `)
  };

  return preparedStatements;
}

/**
 * Human-friendly labels for part of speech abbreviations.
 */
const POS_LABELS = {
  'N': 'noun',
  'noun': 'noun',
  'n': 'noun',
  'V': 'verb',
  'verb': 'verb',
  'v': 'verb',
  'A': 'adjective',
  'adj': 'adjective',
  'a': 'adjective',
  'D': 'adverb',
  'adv': 'adverb',
  'd': 'adverb',
  'P': 'pronoun',
  'pron': 'pronoun',
  'C': 'conjunction',
  'conj': 'conjunction',
  'E': 'preposition',
  'prep': 'preposition',
  'idiom': 'idiom',
  'O': 'interjection',
  'M': 'numeral/modal',
  'S': 'suffix/prefix',
  'X': 'phrase/particle',
  'name': 'proper noun'
};

/**
 * Normalize search string:
 * - String type safety check
 * - Trim whitespace
 * - Normalize typographic apostrophes to standard ASCII single quote
 * - Lowercase
 * - Collapse multiple spaces into single space
 */
function normalizeQuery(query) {
  if (typeof query !== 'string') return '';
  return query
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Internal query execution against SQLite database.
 * Merges definitions across case variants while preserving unique meanings.
 * @param {string} normalized Normalized search term.
 * @returns {Object} Structured dictionary result.
 */
function queryDatabase(normalized) {
  const stmts = getPreparedStatements();
  const cMap = getCasingMap();

  // 1. Try fast exact match first
  let wordRows = [];
  const exactMatch = stmts.findWordExact.get(normalized);
  if (exactMatch) {
    wordRows.push(exactMatch);
  }

  // 2. Fast case variation lookups using in-memory casingMap + indexed exact lookup
  // Avoids any full table scans while correctly capturing all casing variations (e.g. 'English', 'Bring up')
  const variants = cMap.get(normalized);
  if (variants) {
    for (const v of variants) {
      if (v !== normalized) {
        const vRow = stmts.findWordExact.get(v);
        if (vRow && !wordRows.some(r => r.id === vRow.id)) {
          wordRows.push(vRow);
        }
      }
    }
  }

  if (wordRows.length === 0) {
    return {
      found: false,
      word: null,
      langCode: null,
      pronunciations: [],
      meanings: []
    };
  }

  // Gather definitions and pronunciations from all matching headwords, deduplicating
  const seenDefs = new Set();
  const meanings = [];

  const seenProns = new Set();
  const pronunciations = [];

  for (const wRow of wordRows) {
    const defRows = stmts.findDefinitions.all(wRow.id);
    for (const d of defRows) {
      const defKey = `${d.pos || ''}|${d.definition}`;
      if (!seenDefs.has(defKey)) {
        seenDefs.add(defKey);
        meanings.push({
          pos: d.pos || null,
          posLabel: (d.pos && POS_LABELS[d.pos]) ? POS_LABELS[d.pos] : (d.pos || 'unknown'),
          subPos: d.sub_pos || null,
          definition: d.definition,
          example: d.example || null
        });
      }
    }

    const pronRows = stmts.findPronunciations.all(wRow.id);
    for (const p of pronRows) {
      const pronKey = `${p.ipa}|${p.region || ''}`;
      if (!seenProns.has(pronKey)) {
        seenProns.add(pronKey);
        pronunciations.push({
          ipa: p.ipa,
          region: p.region || null
        });
      }
    }
  }

  // Use the headword that matches exact casing or the first found
  const matchedWord = exactMatch ? exactMatch.word : wordRows[0].word;
  const langCode = wordRows[0].lang_code;

  return {
    found: true,
    word: matchedWord,
    langCode,
    pronunciations,
    meanings
  };
}

/**
 * Search dictionary for a word or phrase with bounded LRU caching.
 * @param {string} query Word or phrase.
 * @returns {Object}
 */
function searchDictionary(query) {
  const normalized = normalizeQuery(query);

  if (!normalized) {
    return {
      found: false,
      query: typeof query === 'string' ? query : '',
      normalized: '',
      word: null,
      langCode: null,
      pronunciations: [],
      meanings: [],
      fromCache: false
    };
  }

  // Check LRU Cache
  const cached = dictionaryCache.get(normalized);
  if (cached) {
    return {
      ...cached,
      query: typeof query === 'string' ? query : normalized,
      fromCache: true
    };
  }

  // Query Database
  const result = queryDatabase(normalized);

  const entryToCache = {
    found: result.found,
    normalized,
    word: result.word,
    langCode: result.langCode,
    pronunciations: result.pronunciations,
    meanings: result.meanings
  };

  // Cache result (both hits and misses to prevent duplicate DB lookups)
  dictionaryCache.set(normalized, entryToCache);

  return {
    ...entryToCache,
    query: typeof query === 'string' ? query : normalized,
    fromCache: false
  };
}

/**
 * Look up a single word.
 * @param {string} word
 */
function lookupWord(word) {
  return searchDictionary(word);
}

/**
 * Look up a multi-word phrase or expression.
 * @param {string} phrase
 */
function lookupPhrase(phrase) {
  return searchDictionary(phrase);
}

/**
 * Clear the in-memory LRU cache.
 */
function clearCache() {
  dictionaryCache.clear();
}

/**
 * Get LRU cache statistics.
 */
function getCacheStats() {
  return dictionaryCache.getStats();
}

/**
 * Configure maximum LRU cache capacity.
 * @param {number} size
 */
function setCacheCapacity(size) {
  dictionaryCache.setMaxSize(size);
}

module.exports = {
  searchDictionary,
  lookupWord,
  lookupPhrase,
  normalizeQuery,
  clearCache,
  getCacheStats,
  setCacheCapacity,
  LRUCache
};
