const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

function verifyDatabase() {
  console.log('=== STAGE 1: DICTIONARY DATABASE VERIFICATION ===\n');

  const dbPath = path.join(__dirname, 'data/dictionary/dictionary_en_vi.db');
  const licensePath = path.join(__dirname, 'data/dictionary/LICENSE');
  const attributionPath = path.join(__dirname, 'data/dictionary/ATTRIBUTION.md');
  const schemaPath = path.join(__dirname, 'data/dictionary/schema.sql');

  // 1. Verify files exist
  assert.ok(fs.existsSync(licensePath), 'LICENSE file must exist');
  assert.ok(fs.existsSync(attributionPath), 'ATTRIBUTION.md file must exist');
  assert.ok(fs.existsSync(schemaPath), 'schema.sql file must exist');
  assert.ok(fs.existsSync(dbPath), 'dictionary_en_vi.db file must exist');

  const stats = fs.statSync(dbPath);
  console.log(`✓ Database file exists: ${dbPath}`);
  console.log(`✓ Database file size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB (${stats.size} bytes)`);

  // 2. Open with better-sqlite3 in read-only mode
  const t0 = Date.now();
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const openTime = Date.now() - t0;
  console.log(`✓ Database opened successfully in ${openTime} ms`);

  // 3. Check SQLite integrity
  const integrity = db.pragma('integrity_check');
  console.log(`✓ SQLite integrity check:`, integrity[0].integrity_check);
  assert.strictEqual(integrity[0].integrity_check, 'ok', 'Integrity check must return ok');

  // 4. Verify Tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  const tableNames = tables.map(t => t.name);
  console.log('✓ Tables found in database:', tableNames.join(', '));

  assert.ok(tableNames.includes('words'), 'Must contain table words');
  assert.ok(tableNames.includes('definitions'), 'Must contain table definitions');
  assert.ok(tableNames.includes('word_definitions'), 'Must contain table word_definitions');
  assert.ok(tableNames.includes('pronunciations'), 'Must contain table pronunciations');

  // 5. Verify Table Columns (Strict check against schema)
  const wordsCols = db.pragma('table_info(words)').map(c => c.name);
  console.log('  - words columns:', wordsCols.join(', '));
  assert.deepStrictEqual(wordsCols, ['id', 'word', 'lang_code']);

  const defsCols = db.pragma('table_info(definitions)').map(c => c.name);
  console.log('  - definitions columns:', defsCols.join(', '));
  assert.deepStrictEqual(defsCols, ['id', 'definition', 'pos', 'sub_pos', 'definition_lang']);

  const wdCols = db.pragma('table_info(word_definitions)').map(c => c.name);
  console.log('  - word_definitions columns:', wdCols.join(', '));
  assert.deepStrictEqual(wdCols, ['id', 'word_id', 'definition_id', 'example']);

  const pronCols = db.pragma('table_info(pronunciations)').map(c => c.name);
  console.log('  - pronunciations columns:', pronCols.join(', '));
  assert.deepStrictEqual(pronCols, ['id', 'word_id', 'ipa', 'region']);

  // 6. Verify Row Counts
  const wordCount = db.prepare('SELECT COUNT(*) as c FROM words').get().c;
  const defCount = db.prepare('SELECT COUNT(*) as c FROM definitions').get().c;
  const wdCount = db.prepare('SELECT COUNT(*) as c FROM word_definitions').get().c;
  const pronCount = db.prepare('SELECT COUNT(*) as c FROM pronunciations').get().c;

  console.log(`\n--- Dataset Statistics ---`);
  console.log(`Total words/phrases:   ${wordCount.toLocaleString()}`);
  console.log(`Total definitions:     ${defCount.toLocaleString()}`);
  console.log(`Total word-def links:  ${wdCount.toLocaleString()}`);
  console.log(`Total pronunciations:  ${pronCount.toLocaleString()}`);

  assert.ok(wordCount >= 100000, 'Word count should be ~104,829');
  assert.ok(defCount >= 150000, 'Definition count should be ~158,307');

  // 7. Verify Real Data & Sample Queries
  console.log(`\n--- Verification Sample Queries ---`);

  // Query 1: "hello"
  const helloQuery = db.prepare(`
    SELECT w.word, p.ipa, p.region, d.pos, d.definition, wd.example
    FROM words w
    LEFT JOIN pronunciations p ON w.id = p.word_id
    JOIN word_definitions wd ON w.id = wd.word_id
    JOIN definitions d ON wd.definition_id = d.id
    WHERE w.word = ?
  `);
  const helloResults = helloQuery.all('hello');
  console.log(`Word "hello" found (${helloResults.length} meanings):`);
  helloResults.forEach(r => {
    console.log(`  - [${r.pos || 'pos'}] ${r.ipa ? '/' + r.ipa + '/' : ''}: ${r.definition}`);
    if (r.example) console.log(`    Ví dụ: "${r.example}"`);
  });
  assert.ok(helloResults.length > 0, 'Word hello must exist in dictionary');

  // Query 2: Multi-word phrase "look forward to"
  const phraseResults = helloQuery.all('look forward to');
  console.log(`\nPhrase "look forward to" found (${phraseResults.length} meanings):`);
  phraseResults.forEach(r => {
    console.log(`  - [${r.pos || 'phrase'}]: ${r.definition}`);
    if (r.example) console.log(`    Ví dụ: "${r.example}"`);
  });
  assert.ok(phraseResults.length > 0, 'Phrase "look forward to" must exist in dictionary');

  // 8. Verify Indexes
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(i => i.name);
  console.log(`\n✓ Indexes in database:`, indexes.filter(i => !i.startsWith('sqlite_autoindex')).join(', '));

  db.close();

  console.log('\n=============================================');
  console.log(' STAGE 1 VERIFICATION COMPLETED SUCCESSFULLY ');
  console.log('=============================================');
}

try {
  verifyDatabase();
} catch (err) {
  console.error('Verification error:', err);
  process.exit(1);
}
