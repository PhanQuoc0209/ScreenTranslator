const assert = require('assert');
const {
  lemmatizeWord,
  lemmatizeSentence,
  getPossibleLemmas,
  isValidLemma,
  getLemmaStats,
  clearLemmaCache,
  lemmatizerCache
} = require('./src/dictionary/lemmatizer');
const { matchPhrases } = require('./src/dictionary/phrase-matcher');
const { closeDatabase } = require('./src/dictionary/db');

async function runStage4Tests() {
  console.log('=== STAGE 4: OFFLINE LEMMATIZER & MORPHOLOGICAL ANALYZER TESTS ===\n');

  clearLemmaCache();

  // --------------------------------------------------------------------------
  // 1. Regular Plurals
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Regular Plural Nouns ---');
  const regPlurals = [
    { input: 'books', expected: 'book' },
    { input: 'boxes', expected: 'box' },
    { input: 'studies', expected: 'study' },
    { input: 'cities', expected: 'city' }
  ];

  for (const item of regPlurals) {
    const res = lemmatizeWord(item.input);
    assert.strictEqual(res.original, item.input);
    assert.ok(res.lemmas.includes(item.expected), `Expected ${item.expected} for ${item.input}, got: ${res.lemmas.join(', ')}`);
    assert.strictEqual(res.source, 'regular_rule');
    assert.ok(res.confidence === 'high' || res.confidence === 'medium');
    console.log(`  ✓ ${item.input} → [${res.lemmas.join(', ')}] (source: ${res.source}, confidence: ${res.confidence})`);
  }

  // --------------------------------------------------------------------------
  // 2. Irregular Plurals
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Irregular Plural Nouns ---');
  const irregPlurals = [
    { input: 'children', expected: 'child' },
    { input: 'mice', expected: 'mouse' },
    { input: 'feet', expected: 'foot' },
    { input: 'men', expected: 'man' },
    { input: 'women', expected: 'woman' },
    { input: 'teeth', expected: 'tooth' }
  ];

  for (const item of irregPlurals) {
    const res = lemmatizeWord(item.input);
    assert.strictEqual(res.original, item.input);
    assert.ok(res.lemmas.includes(item.expected), `Expected ${item.expected} for ${item.input}, got: ${res.lemmas.join(', ')}`);
    assert.strictEqual(res.source, 'irregular');
    assert.strictEqual(res.confidence, 'high');
    console.log(`  ✓ ${item.input} → [${res.lemmas.join(', ')}] (source: ${res.source})`);
  }

  // --------------------------------------------------------------------------
  // 3. Regular Past Tense
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Regular Past Tense Verbs ---');
  const regPast = [
    { input: 'walked', expected: 'walk' },
    { input: 'stopped', expected: 'stop' },
    { input: 'studied', expected: 'study' },
    { input: 'carried', expected: 'carry' }
  ];

  for (const item of regPast) {
    const res = lemmatizeWord(item.input);
    assert.ok(res.lemmas.includes(item.expected), `Expected ${item.expected} for ${item.input}, got: ${res.lemmas.join(', ')}`);
    assert.strictEqual(res.source, 'regular_rule');
    console.log(`  ✓ ${item.input} → [${res.lemmas.join(', ')}]`);
  }

  // --------------------------------------------------------------------------
  // 4. Irregular Past Tense & Past Participles
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Irregular Past Tense & Participles ---');
  const irregVerbs = [
    { input: 'went', expected: 'go' },
    { input: 'gone', expected: 'go' },
    { input: 'written', expected: 'write' },
    { input: 'bought', expected: 'buy' },
    { input: 'taken', expected: 'take' }
  ];

  for (const item of irregVerbs) {
    const res = lemmatizeWord(item.input);
    assert.ok(res.lemmas.includes(item.expected), `Expected ${item.expected} for ${item.input}`);
    assert.strictEqual(res.source, 'irregular');
    console.log(`  ✓ ${item.input} → [${res.lemmas.join(', ')}]`);
  }

  // --------------------------------------------------------------------------
  // 5. Present Participles (-ing)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Present Participles (-ing) ---');
  const participles = [
    { input: 'running', expected: 'run' },
    { input: 'making', expected: 'make' },
    { input: 'studying', expected: 'study' },
    { input: 'lying', expected: 'lie' }
  ];

  for (const item of participles) {
    const res = lemmatizeWord(item.input);
    assert.ok(res.lemmas.includes(item.expected), `Expected ${item.expected} for ${item.input}`);
    assert.strictEqual(res.source, 'regular_rule');
    console.log(`  ✓ ${item.input} → [${res.lemmas.join(', ')}]`);
  }

  // --------------------------------------------------------------------------
  // 6. Third-Person Singular Verbs
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Third-Person Singular Verbs ---');
  const thirdPerson = [
    { input: 'works', expected: 'work' },
    { input: 'watches', expected: 'watch' },
    { input: 'studies', expected: 'study' }
  ];

  for (const item of thirdPerson) {
    const res = lemmatizeWord(item.input, { pos: 'V' });
    assert.ok(res.lemmas.includes(item.expected), `Expected ${item.expected} for ${item.input}`);
    console.log(`  ✓ ${item.input} (verb) → [${res.lemmas.join(', ')}]`);
  }

  // --------------------------------------------------------------------------
  // 7. Comparative and Superlative Adjectives
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Testing Comparatives and Superlatives ---');
  const compSuper = [
    { input: 'bigger', expected: 'big' },
    { input: 'biggest', expected: 'big' },
    { input: 'happier', expected: 'happy' },
    { input: 'happiest', expected: 'happy' }
  ];

  for (const item of compSuper) {
    const res = lemmatizeWord(item.input);
    assert.ok(res.lemmas.includes(item.expected), `Expected ${item.expected} for ${item.input}`);
    console.log(`  ✓ ${item.input} → [${res.lemmas.join(', ')}]`);
  }

  // --------------------------------------------------------------------------
  // 8. Ambiguous Forms & Multi-POS Candidates
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Testing Ambiguous Forms & Multiple Candidates ---');

  // "leaves" can be plural noun of "leaf" OR 3rd-person singular of "leave"
  const leavesRes = lemmatizeWord('leaves');
  assert.ok(leavesRes.lemmas.includes('leaf'), 'leaves should include noun lemma leaf');
  assert.ok(leavesRes.lemmas.includes('leave'), 'leaves should include verb lemma leave');
  assert.strictEqual(leavesRes.confidence, 'medium', 'Multiple candidates should yield medium confidence');
  console.log(`  ✓ "leaves" resolves to dual lemmas: [${leavesRes.lemmas.join(', ')}] (confidence: ${leavesRes.confidence})`);

  // POS-constrained lemmatization on "leaves"
  const leavesNoun = lemmatizeWord('leaves', { pos: 'N' });
  assert.ok(leavesNoun.lemmas.includes('leaf'));

  const leavesVerb = lemmatizeWord('leaves', { pos: 'V' });
  assert.ok(leavesVerb.lemmas.includes('leave'));
  console.log(`  ✓ POS constraints successfully filter "leaves": noun → [${leavesNoun.lemmas.join(', ')}], verb → [${leavesVerb.lemmas.join(', ')}]`);

  // "better" can be comparative of "good" (adj) or "well" (adv)
  const betterRes = lemmatizeWord('better');
  assert.ok(betterRes.lemmas.includes('good'), 'better should include good');
  assert.ok(betterRes.lemmas.includes('well'), 'better should include well');
  console.log(`  ✓ "better" resolves to: [${betterRes.lemmas.join(', ')}]`);

  // "best"
  const bestRes = lemmatizeWord('best');
  assert.ok(bestRes.lemmas.includes('good'));
  assert.ok(bestRes.lemmas.includes('well'));
  console.log(`  ✓ "best" resolves to: [${bestRes.lemmas.join(', ')}]`);

  // --------------------------------------------------------------------------
  // 9. Unknown / Nonexistent Words & Base Words
  // --------------------------------------------------------------------------
  console.log('\n--- 9. Testing Unknown Words & Exact Base Headwords ---');
  const unknownRes = lemmatizeWord('xyznonexistentword123');
  assert.strictEqual(unknownRes.confidence, 'low');
  assert.strictEqual(unknownRes.source, 'unknown');
  assert.deepStrictEqual(unknownRes.lemmas, ['xyznonexistentword123']);
  console.log('  ✓ Unknown word safely preserves original with confidence: "low".');

  const baseWordRes = lemmatizeWord('computer');
  assert.strictEqual(baseWordRes.confidence, 'high');
  assert.strictEqual(baseWordRes.source, 'exact');
  assert.deepStrictEqual(baseWordRes.lemmas, ['computer']);
  console.log('  ✓ Exact base headword recognized directly without modification.');

  // --------------------------------------------------------------------------
  // 10. Casing, Whitespace, and Unicode Apostrophes
  // --------------------------------------------------------------------------
  console.log('\n--- 10. Testing Casing, Whitespace & Typographic Quotes ---');
  const upperRunning = lemmatizeWord('  RUNNING  ');
  assert.strictEqual(upperRunning.original, 'RUNNING');
  assert.ok(upperRunning.lemmas.includes('run'));

  const titleChildren = lemmatizeWord('Children');
  assert.strictEqual(titleChildren.original, 'Children');
  assert.ok(titleChildren.lemmas.includes('child'));

  const typoContraction = lemmatizeWord('don’t');
  assert.ok(typoContraction.lemmas.length > 0);
  console.log('  ✓ Uppercase, whitespace, and typographic apostrophes handled seamlessly.');

  // --------------------------------------------------------------------------
  // 11. Sentence Lemmatization (API lemmatizeSentence)
  // --------------------------------------------------------------------------
  console.log('\n--- 11. Testing Full Sentence Lemmatization API ---');
  const sampleSentence = 'The children were running while studying in various cities.';
  const sentRes = lemmatizeSentence(sampleSentence);

  assert.strictEqual(sentRes.text, sampleSentence);
  assert.ok(sentRes.tokens.length >= 8);

  const childToken = sentRes.tokens.find(t => t.text === 'children');
  assert.ok(childToken && childToken.lemmas.includes('child'));

  const wereToken = sentRes.tokens.find(t => t.text === 'were');
  assert.ok(wereToken && wereToken.lemmas.includes('be'));

  const runToken = sentRes.tokens.find(t => t.text === 'running');
  assert.ok(runToken && runToken.lemmas.includes('run'));

  const cityToken = sentRes.tokens.find(t => t.text === 'cities');
  assert.ok(cityToken && cityToken.lemmas.includes('city'));

  // Character offset verification
  for (const t of sentRes.tokens) {
    assert.strictEqual(sampleSentence.substring(t.startIndex, t.endIndex), t.text);
  }
  console.log('  ✓ Sentence lemmatization preserved all character offsets and identified base lemmas.');

  // --------------------------------------------------------------------------
  // 12. Phrase Matcher Integration (Inflected Phrases)
  // --------------------------------------------------------------------------
  console.log('\n--- 12. Testing Phrase Matcher Integration (Inflected Multi-Word Expressions) ---');

  // Test 12A: "looking forward to" → "look forward to"
  const pTextA = 'I was looking forward to seeing the results.';
  const pMatchesA = matchPhrases(pTextA);
  const lftMatch = pMatchesA.find(m => m.word === 'look forward to');
  assert.ok(lftMatch && lftMatch.matched, 'Must match inflected phrase "look forward to"');
  assert.strictEqual(lftMatch.originalText, 'looking forward to', 'originalText must retain surface form');
  assert.strictEqual(lftMatch.word, 'look forward to', 'word must represent base headword');
  assert.strictEqual(lftMatch.lemma, 'look forward to', 'lemma must represent base headword');
  assert.strictEqual(pTextA.substring(lftMatch.startIndex, lftMatch.endIndex), 'looking forward to');
  console.log(`  ✓ Inflected phrase: "${lftMatch.originalText}" → word: "${lftMatch.word}", lemma: "${lftMatch.lemma}"`);

  // Test 12B: "taking care of" → "take care of"
  const pTextB = 'She was taking care of her young brother.';
  const pMatchesB = matchPhrases(pTextB);
  const tcoMatch = pMatchesB.find(m => m.word === 'take care of');
  assert.ok(tcoMatch && tcoMatch.matched);
  assert.strictEqual(tcoMatch.originalText, 'taking care of');
  assert.strictEqual(tcoMatch.word, 'take care of');
  console.log(`  ✓ Inflected phrase: "${tcoMatch.originalText}" → word: "${tcoMatch.word}"`);

  // Test 12C: "giving up" → "give up"
  const pTextC = 'He considered giving up after the second attempt.';
  const pMatchesC = matchPhrases(pTextC);
  const guMatch = pMatchesC.find(m => m.word === 'give up');
  assert.ok(guMatch && guMatch.matched);
  assert.strictEqual(guMatch.originalText, 'giving up');
  assert.strictEqual(guMatch.word, 'give up');
  console.log(`  ✓ Inflected phrase: "${guMatch.originalText}" → word: "${guMatch.word}"`);

  // Test 12D: Irregular inflected phrase: "took care of" → "take care of"
  const pTextD = 'They took care of all the tickets yesterday.';
  const pMatchesD = matchPhrases(pTextD);
  const tookMatch = pMatchesD.find(m => m.word === 'take care of');
  assert.ok(tookMatch && tookMatch.matched);
  assert.strictEqual(tookMatch.originalText, 'took care of');
  assert.strictEqual(tookMatch.word, 'take care of');
  console.log(`  ✓ Irregular inflected phrase: "${tookMatch.originalText}" → word: "${tookMatch.word}"`);

  // Test 12E: 3rd person singular inflected phrase: "gives up" → "give up"
  const pTextE = 'She never gives up easily.';
  const pMatchesE = matchPhrases(pTextE);
  const givesMatch = pMatchesE.find(m => m.word === 'give up');
  assert.ok(givesMatch && givesMatch.matched);
  assert.strictEqual(givesMatch.originalText, 'gives up');
  console.log(`  ✓ 3rd-person phrase: "${givesMatch.originalText}" → word: "${givesMatch.word}"`);

  // Test 12F: 3rd person singular 3-word inflected phrase: "gives up on" → "give up on"
  const pTextF = 'She never gives up on her dreams.';
  const pMatchesF = matchPhrases(pTextF);
  const givesOnMatch = pMatchesF.find(m => m.word === 'give up on');
  assert.ok(givesOnMatch && givesOnMatch.matched);
  assert.strictEqual(givesOnMatch.originalText, 'gives up on');
  assert.strictEqual(givesOnMatch.word, 'give up on');
  console.log(`  ✓ 3-word inflected phrase: "${givesOnMatch.originalText}" → word: "${givesOnMatch.word}"`);

  // --------------------------------------------------------------------------
  // 13. LRU Cache Behavior
  // --------------------------------------------------------------------------
  console.log('\n--- 13. Testing Lemmatizer LRU Cache Behavior ---');
  clearLemmaCache();

  // First call: cache miss
  const c1 = lemmatizeWord('running');
  assert.strictEqual(getLemmaStats().cache.misses, 1);
  assert.strictEqual(getLemmaStats().cache.hits, 0);

  // Second call: cache hit
  const c2 = lemmatizeWord('running');
  assert.strictEqual(getLemmaStats().cache.hits, 1);
  assert.strictEqual(c1.lemmas[0], c2.lemmas[0]);
  console.log('  ✓ LRU cache hit/miss tracking verified.');

  // --------------------------------------------------------------------------
  // 14. Performance Benchmarks
  // --------------------------------------------------------------------------
  console.log('\n--- 14. Running Performance Benchmarks ---');

  const benchmarkWords = [
    'running', 'walked', 'stopped', 'studies', 'cities',
    'children', 'mice', 'feet', 'better', 'best',
    'written', 'bought', 'taken', 'leaves', 'happier',
    'biggest', 'watches', 'carrying', 'making', 'lying'
  ];

  const benchmarkSentences = [
    'The children were running in the parks after school was finished.',
    'She was taking care of her brothers while studying for university exams.',
    'I am really looking forward to hearing your thoughts on the proposal.',
    'He decided to kick the bucket in that old historical drama.',
    'Never give up on your dreams when difficulties arise in life.',
    'They bought the biggest computer systems available in the market.',
    'The factory calculated the shut down price before stopping production.',
    'Good coworkers always try to get along with their team members.',
    'He wrote several books and carried out important scientific research.',
    'Better results are expected when students study consistently.'
  ];

  // Benchmark A: 1,000 Individual Words
  clearLemmaCache();
  const wordLatencies = [];
  const memBeforeWords = process.memoryUsage();
  const tWordsStart = process.hrtime.bigint();

  for (let i = 0; i < 1000; i++) {
    const w = benchmarkWords[i % benchmarkWords.length];
    const t0 = process.hrtime.bigint();
    lemmatizeWord(w);
    const t1 = process.hrtime.bigint();
    wordLatencies.push(Number(t1 - t0) / 1e6);
  }

  const tWordsEnd = process.hrtime.bigint();
  const totalWordsMs = Number(tWordsEnd - tWordsStart) / 1e6;
  const avgWordMs = totalWordsMs / 1000;
  const memAfterWords = process.memoryUsage();

  wordLatencies.sort((a, b) => a - b);
  const medianWordMs = wordLatencies[Math.floor(wordLatencies.length * 0.5)];
  const p95WordMs = wordLatencies[Math.floor(wordLatencies.length * 0.95)];
  const wordStats = getLemmaStats();

  console.log(`\n======================================================`);
  console.log(` BENCHMARK 1: 1,000 INDIVIDUAL WORDS`);
  console.log(`======================================================`);
  console.log(`Total Execution Time:        ${totalWordsMs.toFixed(2)} ms`);
  console.log(`Average Latency per Word:    ${avgWordMs.toFixed(4)} ms`);
  console.log(`Median Latency:              ${medianWordMs.toFixed(4)} ms`);
  console.log(`P95 Latency:                 ${p95WordMs.toFixed(4)} ms`);
  console.log(`Throughput:                  ${Math.round(1000 / avgWordMs).toLocaleString()} words / sec`);
  console.log(`Cache Hit Rate:              ${wordStats.cache.hitRate}% (${wordStats.cache.hits} hits / ${wordStats.cache.hits + wordStats.cache.misses} total)`);
  console.log(`Memory RSS Before:           ${(memBeforeWords.rss / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Memory RSS After:            ${(memAfterWords.rss / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Memory Heap Used:            ${(memAfterWords.heapUsed / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`======================================================`);

  // Benchmark B: 1,000 Sentences (Full lemmatizeSentence + matchPhrases)
  const sentLatencies = [];
  const memBeforeSent = process.memoryUsage();
  const tSentStart = process.hrtime.bigint();

  for (let i = 0; i < 1000; i++) {
    const s = benchmarkSentences[i % benchmarkSentences.length];
    const t0 = process.hrtime.bigint();
    lemmatizeSentence(s);
    const t1 = process.hrtime.bigint();
    sentLatencies.push(Number(t1 - t0) / 1e6);
  }

  const tSentEnd = process.hrtime.bigint();
  const totalSentMs = Number(tSentEnd - tSentStart) / 1e6;
  const avgSentMs = totalSentMs / 1000;
  const memAfterSent = process.memoryUsage();

  sentLatencies.sort((a, b) => a - b);
  const medianSentMs = sentLatencies[Math.floor(sentLatencies.length * 0.5)];
  const p95SentMs = sentLatencies[Math.floor(sentLatencies.length * 0.95)];

  console.log(`\n======================================================`);
  console.log(` BENCHMARK 2: 1,000 FULL SENTENCES`);
  console.log(`======================================================`);
  console.log(`Total Execution Time:        ${totalSentMs.toFixed(2)} ms`);
  console.log(`Average Latency per Sentence:${avgSentMs.toFixed(4)} ms`);
  console.log(`Median Latency:              ${medianSentMs.toFixed(4)} ms`);
  console.log(`P95 Latency:                 ${p95SentMs.toFixed(4)} ms`);
  console.log(`Throughput:                  ${Math.round(1000 / avgSentMs).toLocaleString()} sentences / sec`);
  console.log(`Memory RSS Before:           ${(memBeforeSent.rss / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Memory RSS After:            ${(memAfterSent.rss / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Memory Heap Used:            ${(memAfterSent.heapUsed / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`======================================================\n`);

  assert.ok(avgWordMs < 1.0, `Average time per word (${avgWordMs} ms) must be well under 1.0 ms`);
  assert.ok(avgSentMs < 5.0, `Average time per sentence (${avgSentMs} ms) must be well under 5.0 ms`);

  closeDatabase();
  console.log('✓ Stage 4 tests and benchmarks passed successfully.');
}

runStage4Tests().catch(err => {
  console.error('Stage 4 Test Suite Failed:', err);
  process.exit(1);
});
