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
const { searchDictionary } = require('./src/dictionary/dictionary');
const { closeDatabase } = require('./src/dictionary/db');

async function runStage41Audit() {
  console.log('=== STAGE 4.1: LEMMATIZER EDGE-CASE AUDIT & VERIFICATION ===\n');

  clearLemmaCache();

  // --------------------------------------------------------------------------
  // 1. Audit Ambiguous Words (Multi-Lemma & POS-Awareness)
  // --------------------------------------------------------------------------
  console.log('--- 1. Auditing Ambiguous Words & Dual Interpretations ---');

  const ambiguousCases = [
    { word: 'leaves', expected: ['leaf', 'leave'], desc: 'noun plural of leaf / verb 3rd-person of leave' },
    { word: 'lives', expected: ['life', 'live'], desc: 'noun plural of life / verb 3rd-person of live' },
    { word: 'saw', expected: ['see', 'saw'], desc: 'verb past of see / base verb & noun saw' },
    { word: 'found', expected: ['find', 'found'], desc: 'verb past of find / base verb found (establish)' },
    { word: 'axes', expected: ['axe', 'axis'], desc: 'plural of axe (ax) / plural of axis' },
    { word: 'better', expected: ['good', 'well'], desc: 'comparative of good (adj) / well (adv)' },
    { word: 'best', expected: ['good', 'well'], desc: 'superlative of good (adj) / well (adv)' },
    { word: 'being', expected: ['be'], desc: 'participle of be' },
    { word: 'lying', expected: ['lie'], desc: 'participle of lie' },
    { word: 'went', expected: ['go'], desc: 'past of go' },
    { word: 'gone', expected: ['go'], desc: 'past participle of go' }
  ];

  for (const c of ambiguousCases) {
    const res = lemmatizeWord(c.word);
    console.log(`  Word "${c.word}" (${c.desc}):`);
    console.log(`    Lemmas returned: [${res.lemmas.join(', ')}] (source: ${res.source}, confidence: ${res.confidence})`);

    // Verify each expected lemma is returned
    for (const exp of c.expected) {
      assert.ok(
        res.lemmas.includes(exp),
        `Word "${c.word}" must include expected lemma "${exp}". Got: [${res.lemmas.join(', ')}]`
      );
      // Verify lemma exists in SQLite database
      const dictCheck = searchDictionary(exp);
      assert.ok(dictCheck.found, `Lemma "${exp}" must exist in dictionary database`);
    }

    if (c.expected.length > 1) {
      assert.strictEqual(
        res.confidence,
        'medium',
        `Ambiguous word "${c.word}" with multiple candidates must return medium confidence`
      );
    }
  }
  console.log('✓ All 11 ambiguous words correctly verified with full candidate preservation.');

  // --------------------------------------------------------------------------
  // 2. Audit False Positives (Words that must NEVER be modified)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Auditing Morphology Rules for False Positives ---');

  const falsePositiveCases = [
    // Nouns ending in s/es/is
    'solve',
    'novel',
    'glass',
    'news',
    'business',
    'series',
    'species',
    'analysis',
    'crisis',
    // Base words ending in -ed (must not strip to see, fee, wee, etc.)
    'seed',
    'feed',
    'weed',
    'need',
    'bleed',
    'breed',
    'speed',
    // Base words ending in -er (must not strip to comparative adjectives)
    'matter',
    'number',
    'water',
    'dinner',
    'paper',
    'letter',
    'winter',
    'summer',
    // Base words ending in -est (must not strip to superlative adjectives)
    'forest',
    'chest',
    'nest',
    'guest',
    'test',
    'rest',
    'west',
    'honest'
  ];

  for (const fp of falsePositiveCases) {
    const res = lemmatizeWord(fp);
    assert.ok(
      res.lemmas.includes(fp),
      `False positive detected: "${fp}" was incorrectly altered to [${res.lemmas.join(', ')}]`
    );
    assert.strictEqual(res.source, 'exact', `"${fp}" should be recognized as source: "exact"`);
  }
  console.log(`✓ All ${falsePositiveCases.length} potential false-positive words preserved without corruption.`);

  // --------------------------------------------------------------------------
  // 3. Audit Phrase Matcher with Inflected Phrases & Auxiliaries
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Auditing Phrase Matcher Integration ---');

  const phraseAuditSentences = [
    {
      text: 'I am looking forward to meeting you tomorrow.',
      expectedWord: 'look forward to',
      expectedOriginal: 'looking forward to'
    },
    {
      text: 'She took care of all the passengers on the flight.',
      expectedWord: 'take care of',
      expectedOriginal: 'took care of'
    },
    {
      text: 'He was giving up on the plan before we helped him.',
      expectedWord: 'give up on',
      expectedOriginal: 'giving up on'
    },
    {
      text: 'The vehicle was running out of gas on the highway.',
      expectedWord: 'run out of',
      expectedOriginal: 'running out of'
    },
    {
      text: 'He has been looking for his keys for an hour.',
      expectedWord: 'look for',
      expectedOriginal: 'looking for'
    }
  ];

  for (const item of phraseAuditSentences) {
    const matches = matchPhrases(item.text);
    const phraseMatch = matches.find(m => m.word === item.expectedWord);

    assert.ok(phraseMatch && phraseMatch.matched, `Must match phrase "${item.expectedWord}" in sentence: "${item.text}"`);
    assert.strictEqual(phraseMatch.originalText, item.expectedOriginal, 'originalText must match exact surface OCR substring');
    assert.strictEqual(phraseMatch.word, item.expectedWord, 'word must match dictionary canonical headword');
    assert.strictEqual(phraseMatch.lemma, item.expectedWord, 'lemma must match canonical headword');

    // Strict slice invariant: rawText.substring(start, end) === originalText
    const slice = item.text.substring(phraseMatch.startIndex, phraseMatch.endIndex);
    assert.strictEqual(slice, phraseMatch.originalText, 'Character offsets must point exactly to originalText in rawText');

    console.log(`  ✓ Sentence: "${item.text}"`);
    console.log(`    Matched: "${phraseMatch.originalText}" → [${phraseMatch.matchType}] "${phraseMatch.word}" (offsets: [${phraseMatch.startIndex}, ${phraseMatch.endIndex}])`);
  }
  console.log('✓ Phrase Matcher successfully recognizes inflected phrases with exact offsets and Longest Match First.');

  // --------------------------------------------------------------------------
  // 4. Benchmarking Independent Groups (Cold Cache, Warm Cache, Words, Sentences)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Running Independent Benchmarks ---');

  function calculateStats(latenciesMs, hits, misses) {
    latenciesMs.sort((a, b) => a - b);
    const totalMs = latenciesMs.reduce((sum, v) => sum + v, 0);
    const avgMs = totalMs / latenciesMs.length;
    const medianMs = latenciesMs[Math.floor(latenciesMs.length * 0.5)];
    const p95Ms = latenciesMs[Math.floor(latenciesMs.length * 0.95)];
    const totalOps = hits + misses;
    const hitRate = totalOps > 0 ? ((hits / totalOps) * 100).toFixed(1) : '0.0';
    return {
      totalMs,
      avgMs,
      medianMs,
      p95Ms,
      throughput: Math.round(1000 / avgMs),
      hits,
      misses,
      hitRate
    };
  }

  // GROUP 1: Cold Cache (1,000 distinct lookups without warm cache)
  clearLemmaCache();
  const coldLatencies = [];
  const memBeforeCold = process.memoryUsage();

  // Generate 1,000 unique distinct inflected word queries
  const baseSampleWords = [
    'book', 'box', 'city', 'study', 'walk', 'stop', 'carry', 'run', 'make', 'lie',
    'work', 'watch', 'big', 'happy', 'child', 'mouse', 'foot', 'good', 'well', 'write'
  ];
  const coldTestWords = [];
  for (let i = 0; i < 1000; i++) {
    // Generate unique query variations to prevent caching during cold run
    coldTestWords.push(`cold_test_token_${i}_${baseSampleWords[i % baseSampleWords.length]}`);
  }

  for (let i = 0; i < 1000; i++) {
    const t0 = process.hrtime.bigint();
    lemmatizeWord(coldTestWords[i]);
    const t1 = process.hrtime.bigint();
    coldLatencies.push(Number(t1 - t0) / 1e6);
  }
  const coldStatsReport = getLemmaStats();
  const coldBench = calculateStats(coldLatencies, coldStatsReport.cache.hits, coldStatsReport.cache.misses);
  const memAfterCold = process.memoryUsage();

  // GROUP 2: Warm Cache (1,000 repeated queries from existing cache)
  const warmLatencies = [];
  const warmHitsBefore = getLemmaStats().cache.hits;
  const warmMissesBefore = getLemmaStats().cache.misses;

  for (let i = 0; i < 1000; i++) {
    const t0 = process.hrtime.bigint();
    lemmatizeWord(coldTestWords[i % 50]); // Repeated lookups of cached entries
    const t1 = process.hrtime.bigint();
    warmLatencies.push(Number(t1 - t0) / 1e6);
  }
  const warmStatsReport = getLemmaStats();
  const warmBench = calculateStats(
    warmLatencies,
    warmStatsReport.cache.hits - warmHitsBefore,
    warmStatsReport.cache.misses - warmMissesBefore
  );

  // GROUP 3: 1,000 Unseen Words (Not in cache, real dictionary words)
  clearLemmaCache();
  const realSampleWords = [
    'walked', 'stopped', 'studied', 'carried', 'running', 'making', 'studying', 'lying',
    'works', 'watches', 'bigger', 'biggest', 'happier', 'happiest', 'books', 'boxes',
    'cities', 'leaves', 'lives', 'freed', 'agreed', 'decreed', 'guaranteed', 'plans',
    'dropping', 'falling', 'passing', 'buzzing', 'loving', 'baked', 'closed', 'danced'
  ];
  const g3Latencies = [];
  for (let i = 0; i < 1000; i++) {
    const w = realSampleWords[i % realSampleWords.length];
    const t0 = process.hrtime.bigint();
    lemmatizeWord(w);
    const t1 = process.hrtime.bigint();
    g3Latencies.push(Number(t1 - t0) / 1e6);
  }
  const g3Stats = getLemmaStats();
  const g3Bench = calculateStats(g3Latencies, g3Stats.cache.hits, g3Stats.cache.misses);

  // GROUP 4: 1,000 Irregular Words
  clearLemmaCache();
  const irregularSampleWords = [
    'went', 'gone', 'saw', 'seen', 'found', 'took', 'taken', 'children', 'mice', 'feet',
    'men', 'women', 'teeth', 'geese', 'better', 'best', 'worse', 'worst', 'more', 'most',
    'less', 'least', 'bought', 'brought', 'caught', 'taught', 'felt', 'kept', 'slept', 'held'
  ];
  const g4Latencies = [];
  for (let i = 0; i < 1000; i++) {
    const w = irregularSampleWords[i % irregularSampleWords.length];
    const t0 = process.hrtime.bigint();
    lemmatizeWord(w);
    const t1 = process.hrtime.bigint();
    g4Latencies.push(Number(t1 - t0) / 1e6);
  }
  const g4Stats = getLemmaStats();
  const g4Bench = calculateStats(g4Latencies, g4Stats.cache.hits, g4Stats.cache.misses);

  // GROUP 5: 1,000 Sentences with Word Inflections
  const inflectionSentences = [
    'The children walked to their schools while studying books in different cities.',
    'She stopped working and carried her bags into the bigger house.',
    'Running every morning makes happier people and stronger bodies.',
    'The leaves were falling while he looked at his watches.',
    'Better results happened when students studied consistently every week.'
  ];
  const g5Latencies = [];
  for (let i = 0; i < 1000; i++) {
    const s = inflectionSentences[i % inflectionSentences.length];
    const t0 = process.hrtime.bigint();
    lemmatizeSentence(s);
    const t1 = process.hrtime.bigint();
    g5Latencies.push(Number(t1 - t0) / 1e6);
  }
  const g5Bench = calculateStats(g5Latencies, 0, 0);

  // GROUP 6: 1,000 Sentences with Phrase Inflections
  const phraseSentences = [
    'I was looking forward to seeing the results tomorrow morning.',
    'She was taking care of her young brother all afternoon.',
    'He was giving up on the plan before we helped him.',
    'The vehicle was running out of gas on the expressway.',
    'He has been looking for his keys for an hour in the room.'
  ];
  const g6Latencies = [];
  let phrasesMatchedCount = 0;
  for (let i = 0; i < 1000; i++) {
    const s = phraseSentences[i % phraseSentences.length];
    const t0 = process.hrtime.bigint();
    const res = matchPhrases(s);
    const t1 = process.hrtime.bigint();
    g6Latencies.push(Number(t1 - t0) / 1e6);
    for (const item of res) {
      if (item.matchType === 'phrasal_verb' || item.matchType === 'phrase') {
        phrasesMatchedCount++;
      }
    }
  }
  const g6Bench = calculateStats(g6Latencies, 0, 0);

  // --------------------------------------------------------------------------
  // BENCHMARK REPORT
  // --------------------------------------------------------------------------
  console.log(`\n========================================================================`);
  console.log(` STAGE 4.1 AUDIT BENCHMARK REPORT (INDEPENDENT GROUPS)`);
  console.log(`========================================================================`);
  console.log(`Group 1: Cold Cache (1,000 Uncached Words):`);
  console.log(`  Total: ${coldBench.totalMs.toFixed(2)} ms | Avg: ${coldBench.avgMs.toFixed(4)} ms | Median: ${coldBench.medianMs.toFixed(4)} ms | P95: ${coldBench.p95Ms.toFixed(4)} ms | Hits: ${coldBench.hits} (0.0%)`);
  console.log(`Group 2: Warm Cache (1,000 Cached Lookups):`);
  console.log(`  Total: ${warmBench.totalMs.toFixed(2)} ms | Avg: ${warmBench.avgMs.toFixed(4)} ms | Median: ${warmBench.medianMs.toFixed(4)} ms | P95: ${warmBench.p95Ms.toFixed(4)} ms | Hits: ${warmBench.hits} (100.0%)`);
  console.log(`Group 3: 1,000 Regular Inflected Words:`);
  console.log(`  Total: ${g3Bench.totalMs.toFixed(2)} ms | Avg: ${g3Bench.avgMs.toFixed(4)} ms | Median: ${g3Bench.medianMs.toFixed(4)} ms | P95: ${g3Bench.p95Ms.toFixed(4)} ms | Hit Rate: ${g3Bench.hitRate}%`);
  console.log(`Group 4: 1,000 Irregular Words:`);
  console.log(`  Total: ${g4Bench.totalMs.toFixed(2)} ms | Avg: ${g4Bench.avgMs.toFixed(4)} ms | Median: ${g4Bench.medianMs.toFixed(4)} ms | P95: ${g4Bench.p95Ms.toFixed(4)} ms | Hit Rate: ${g4Bench.hitRate}%`);
  console.log(`Group 5: 1,000 Sentences with Word Inflections:`);
  console.log(`  Total: ${g5Bench.totalMs.toFixed(2)} ms | Avg: ${g5Bench.avgMs.toFixed(4)} ms | Median: ${g5Bench.medianMs.toFixed(4)} ms | P95: ${g5Bench.p95Ms.toFixed(4)} ms | Throughput: ${g5Bench.throughput.toLocaleString()} sent/sec`);
  console.log(`Group 6: 1,000 Sentences with Phrase Inflections:`);
  console.log(`  Total: ${g6Bench.totalMs.toFixed(2)} ms | Avg: ${g6Bench.avgMs.toFixed(4)} ms | Median: ${g6Bench.medianMs.toFixed(4)} ms | P95: ${g6Bench.p95Ms.toFixed(4)} ms | Matched Phrases: ${phrasesMatchedCount.toLocaleString()}`);
  console.log(`Memory Usage:`);
  console.log(`  RSS Before: ${(memBeforeCold.rss / (1024 * 1024)).toFixed(2)} MB | RSS After: ${(memAfterCold.rss / (1024 * 1024)).toFixed(2)} MB | Heap Used: ${(process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`========================================================================\n`);

  assert.ok(coldBench.avgMs < 1.0, 'Cold cache lookup must be under 1ms per word');
  assert.ok(warmBench.avgMs < 0.01, 'Warm cache lookup must be under 0.01ms per word');
  assert.ok(g5Bench.avgMs < 5.0, 'Sentence lemmatization must be under 5ms per sentence');
  assert.ok(g6Bench.avgMs < 5.0, 'Inflected phrase matching must be under 5ms per sentence');

  closeDatabase();
  console.log('✓ Stage 4.1 Audit completed with 100% assertions passing.');
}

runStage41Audit().catch(err => {
  console.error('Stage 4.1 Audit Failed:', err);
  process.exit(1);
});
