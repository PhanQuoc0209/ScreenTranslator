const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbInstance = null;

/**
 * Resolve the path to the SQLite dictionary database.
 */
function getDatabasePath() {
  const possiblePaths = [
    path.join(__dirname, '../../data/dictionary/dictionary_en_vi.db'),
    path.join(process.cwd(), 'data/dictionary/dictionary_en_vi.db'),
    path.join(__dirname, '../../../data/dictionary/dictionary_en_vi.db')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return possiblePaths[0];
}

/**
 * Get or initialize the read-only SQLite database connection.
 * @returns {import('better-sqlite3').Database}
 */
function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDatabasePath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Dictionary database not found at: ${dbPath}`);
  }

  dbInstance = new Database(dbPath, {
    readonly: true,
    fileMustExist: true
  });

  // Optimize PRAGMAs for fast read-only access with bounded cache
  dbInstance.pragma('query_only = ON');
  dbInstance.pragma('cache_size = -8000'); // ~8MB memory cache
  dbInstance.pragma('mmap_size = 33554432'); // 32MB memory-mapped I/O

  return dbInstance;
}

/**
 * Get statistical metadata from the dictionary database.
 */
function getDatabaseStats() {
  const db = getDatabase();
  const wordCount = db.prepare('SELECT COUNT(*) as c FROM words').get().c;
  const defCount = db.prepare('SELECT COUNT(*) as c FROM definitions').get().c;
  const wdCount = db.prepare('SELECT COUNT(*) as c FROM word_definitions').get().c;
  const pronCount = db.prepare('SELECT COUNT(*) as c FROM pronunciations').get().c;

  return {
    words: wordCount,
    definitions: defCount,
    links: wdCount,
    pronunciations: pronCount
  };
}

/**
 * Get legal attribution and licensing metadata.
 */
function getAttribution() {
  return {
    dataset: 'English-Vietnamese Dictionary Database',
    repository: 'https://github.com/skypediacode/english-vietnamese-dictionary',
    license: 'Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)',
    maintainer: 'Skypedia (2026)',
    upstreamSource: 'MinhQND Dictionary (Wiktionary, vntk, Hồ Ngọc Đức Vietnamese Dictionary Project)'
  };
}

/**
 * Close database connection cleanly.
 */
function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      // ignore
    }
    dbInstance = null;
  }
}

module.exports = {
  getDatabasePath,
  getDatabase,
  getDatabaseStats,
  getAttribution,
  closeDatabase
};
