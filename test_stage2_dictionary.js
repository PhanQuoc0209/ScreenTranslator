const assert = require('assert');
const {
  lookupWord,
  lookupPhrase,
  searchDictionary,
  clearCache,
  getCacheStats,
  setCacheCapacity,
  normalizeQuery,
  LRUCache
} = require('./src/dictionary/dictionary');
const { closeDatabase } = require('./src/dictionary/db');

async function runStage2Tests() {
  console.log('=== STAGE 2: DICTIONARY ENGINE TESTS & BENCHMARKS ===\n');

  clearCache();

  // --------------------------------------------------------------------------
  // 1. Test Query Normalization
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Query Normalization ---');
  assert.strictEqual(normalizeQuery('  HELLO   WORLD  '), 'hello world');
  assert.strictEqual(normalizeQuery('look    forward     to'), 'look forward to');
  assert.strictEqual(normalizeQuery('\tbook\n'), 'book');
  assert.strictEqual(normalizeQuery(null), '');
  assert.strictEqual(normalizeQuery(undefined), '');
  assert.strictEqual(normalizeQuery(123), '');
  console.log('✓ Normalization handles casing, whitespace, and invalid inputs.');

  // --------------------------------------------------------------------------
  // 2. Test Core Headwords: hello, book, computer
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Core Headwords ---');

  // "hello"
  const helloRes = lookupWord('hello');
  assert.strictEqual(helloRes.found, true);
  assert.strictEqual(helloRes.word, 'hello');
  assert.ok(helloRes.meanings.length >= 5, 'hello should have multiple meanings');
  assert.ok(helloRes.pronunciations.length > 0, 'hello should have IPA pronunciation');
  assert.ok(helloRes.meanings.some(m => m.example), 'hello should have example sentences');
  console.log(`✓ "hello" verified: ${helloRes.meanings.length} meanings, IPA: ${helloRes.pronunciations[0].ipa}`);

  // "book" (multiple parts of speech: noun, verb)
  const bookRes = lookupWord('book');
  assert.strictEqual(bookRes.found, true);
  assert.strictEqual(bookRes.word, 'book');
  const bookPos = [...new Set(bookRes.meanings.map(m => m.posLabel))];
  console.log(`✓ "book" verified: ${bookRes.meanings.length} meanings across POS: [${bookPos.join(', ')}]`);
  assert.ok(bookPos.includes('noun'), 'book should include noun POS');
  assert.ok(bookPos.includes('verb'), 'book should include verb POS');

  // "computer"
  const compRes = lookupWord('computer');
  assert.strictEqual(compRes.found, true);
  assert.strictEqual(compRes.word, 'computer');
  console.log(`✓ "computer" verified: ${compRes.meanings[0].definition}, IPA: ${compRes.pronunciations[0]?.ipa}`);

  // --------------------------------------------------------------------------
  // 3. Test Phrases: "look forward to", "take care of"
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Multi-word Phrases ---');

  // "look forward to"
  const lftRes = lookupPhrase('look forward to');
  assert.strictEqual(lftRes.found, true);
  assert.strictEqual(lftRes.word, 'look forward to');
  assert.ok(lftRes.meanings.some(m => m.definition.toLowerCase().includes('mong') || m.definition.toLowerCase().includes('đợi')));
  console.log(`✓ "look forward to" verified: "${lftRes.meanings[0].definition}" (Example: "${lftRes.meanings[0].example}")`);

  // "take care of"
  const tcoRes = lookupPhrase('take care of');
  assert.strictEqual(tcoRes.found, true);
  assert.strictEqual(tcoRes.word, 'take care of');
  assert.ok(tcoRes.meanings.some(m => m.definition.toLowerCase().includes('chăm sóc') || m.definition.toLowerCase().includes('lo')));
  console.log(`✓ "take care of" verified: "${tcoRes.meanings[0].definition}" (Example: "${tcoRes.meanings[0].example}")`);

  // --------------------------------------------------------------------------
  // 4. Test Case-Insensitivity & Whitespace Normalization
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Case & Space Invariance ---');
  const upperRes = searchDictionary('HELLO');
  const mixedRes = searchDictionary('HeLLo');
  const spaceRes = searchDictionary('   hello    ');
  assert.strictEqual(upperRes.found, true);
  assert.strictEqual(mixedRes.found, true);
  assert.strictEqual(spaceRes.found, true);
  assert.strictEqual(upperRes.word, 'hello');
  assert.strictEqual(mixedRes.word, 'hello');
  assert.strictEqual(spaceRes.word, 'hello');

  const multiSpacePhrase = searchDictionary('look    forward     to');
  assert.strictEqual(multiSpacePhrase.found, true);
  assert.strictEqual(multiSpacePhrase.word, 'look forward to');
  console.log('✓ Upper/mixed case and irregular spacing correctly resolve to headwords.');

  // --------------------------------------------------------------------------
  // 5. Test Missing / Nonexistent Words
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Missing Words ---');
  const missing = searchDictionary('xyznonexistentword123');
  assert.strictEqual(missing.found, false);
  assert.strictEqual(missing.word, null);
  assert.strictEqual(missing.meanings.length, 0);
  assert.strictEqual(missing.pronunciations.length, 0);
  console.log('✓ Nonexistent word returns consistent empty structure (no crashes).');

  // --------------------------------------------------------------------------
  // 6. Test Bounded LRU Cache & Eviction
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing LRU Cache Behavior & Eviction ---');
  clearCache();
  const testCache = new LRUCache(3); // Small capacity of 3

  testCache.set('a', 1);
  testCache.set('b', 2);
  testCache.set('c', 3);
  assert.strictEqual(testCache.get('a'), 1); // access 'a', so 'b' becomes oldest
  testCache.set('d', 4); // should evict 'b'

  assert.strictEqual(testCache.get('b'), undefined, 'b should have been evicted');
  assert.strictEqual(testCache.get('a'), 1, 'a should remain');
  assert.strictEqual(testCache.get('c'), 3, 'c should remain');
  assert.strictEqual(testCache.get('d'), 4, 'd should remain');
  assert.strictEqual(testCache.getStats().size, 3, 'Size must not exceed capacity');
  assert.strictEqual(testCache.getStats().evictions, 1, 'Evictions count must be 1');
  console.log('✓ LRU eviction correctly removes least recently used entry when full.');

  // Test caching in dictionary engine
  clearCache();
  setCacheCapacity(500);

  // First call: DB query (fromCache: false)
  const first = searchDictionary('computer');
  assert.strictEqual(first.fromCache, false, 'First query should be from DB');

  // Second call: Cache hit (fromCache: true)
  const second = searchDictionary('computer');
  assert.strictEqual(second.fromCache, true, 'Second query should be from cache');

  const stats = getCacheStats();
  assert.strictEqual(stats.hits, 1, 'Should have 1 cache hit');
  assert.strictEqual(stats.misses, 1, 'Should have 1 cache miss');
  console.log('✓ In-memory dictionary cache hit/miss tracking verified.');

  // --------------------------------------------------------------------------
  // 7. Benchmarks
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Performance Benchmarks ---');

  // Record initial memory
  if (global.gc) global.gc();
  const memBefore = process.memoryUsage();

  // Test words sample pool
  const sampleWords = [
    'hello', 'world', 'book', 'computer', 'run', 'water', 'language',
    'screen', 'translator', 'windows', 'desktop', 'utility', 'system',
    'table', 'paper', 'look forward to', 'take care of', 'give up',
    'apple', 'house', 'car', 'road', 'time', 'year', 'people'
  ];

  // A. Cold / Direct Database Lookup (Cache cleared each time)
  clearCache();
  const dbTimes = [];
  for (const word of sampleWords) {
    const start = process.hrtime.bigint();
    searchDictionary(word);
    const end = process.hrtime.bigint();
    dbTimes.push(Number(end - start) / 1e6); // ms
  }
  const avgDbTime = dbTimes.reduce((a, b) => a + b, 0) / dbTimes.length;

  // B. Warm / Cached Lookup
  const cacheTimes = [];
  for (const word of sampleWords) {
    const start = process.hrtime.bigint();
    searchDictionary(word);
    const end = process.hrtime.bigint();
    cacheTimes.push(Number(end - start) / 1e6); // ms
  }
  const avgCacheTime = cacheTimes.reduce((a, b) => a + b, 0) / cacheTimes.length;

  // C. 1,000 Iteration Mixed Query Benchmark
  console.log('\nRunning 1,000 query benchmark...');
  clearCache();
  setCacheCapacity(500);

  const totalQueries = 1000;
  const tStartAll = process.hrtime.bigint();
  for (let i = 0; i < totalQueries; i++) {
    // 80% repetitive queries (real-world reading behavior), 20% varied queries
    const idx = (i % 5 === 0) ? (i % sampleWords.length) : (i % 6);
    searchDictionary(sampleWords[idx]);
  }
  const tEndAll = process.hrtime.bigint();
  const totalElapsedMs = Number(tEndAll - tStartAll) / 1e6;
  const avgPerQueryMs = totalElapsedMs / totalQueries;

  const finalStats = getCacheStats();
  const memAfter = process.memoryUsage();

  console.log(`\n======================================================`);
  console.log(` BENCHMARK REPORT (${totalQueries.toLocaleString()} Queries)`);
  console.log(`======================================================`);
  console.log(`Average Direct DB lookup time:  ${avgDbTime.toFixed(4)} ms`);
  console.log(`Average Cached lookup time:     ${avgCacheTime.toFixed(4)} ms`);
  console.log(`Total 1,000 queries time:       ${totalElapsedMs.toFixed(2)} ms`);
  console.log(`Average overall lookup time:    ${avgPerQueryMs.toFixed(4)} ms / query`);
  console.log(`Throughput:                     ${Math.round(1000 / avgPerQueryMs).toLocaleString()} queries / sec`);
  console.log(`Cache Hit Rate:                 ${finalStats.hitRate}% (${finalStats.hits} hits / ${finalStats.hits + finalStats.misses} total)`);
  console.log(`Cache Entries stored:           ${finalStats.size} / ${finalStats.maxSize}`);
  console.log(`Memory RSS before:              ${(memBefore.rss / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Memory RSS after:               ${(memAfter.rss / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Memory Heap Used:               ${(memAfter.heapUsed / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`======================================================\n`);

  assert.ok(avgPerQueryMs < 1.0, 'Average lookup time must be well under 1ms');
  assert.ok(finalStats.hitRate > 70, 'Cache hit rate should be high for repeated queries');

  closeDatabase();
  console.log('✓ All Stage 2 tests & benchmarks completed successfully.');
}

runStage2Tests().catch(err => {
  console.error('Stage 2 Test Suite Failed:', err);
  process.exit(1);
});
