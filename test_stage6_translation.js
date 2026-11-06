/**
 * Comprehensive Stage 6 Test Suite: Rule-Based English to Vietnamese Translation Engine.
 * Tests:
 * Group A: Simple Sentences (S+V, S+V+O)
 * Group B: Tense Variations (Continuous, Perfect, Past, Future)
 * Group C: Diverse Sentence Structures (S+V+IO+DO, S+V+O+C, S+V+C)
 * Group D: Negation & Questions (Polar Yes/No, WH-questions, Auxiliary negation)
 * Group E: Passive Voice (Standard 'được' and Adverse 'bị')
 * Group F: Multi-word Expressions & Idioms (Phrasal verbs, idioms, politeness markers)
 * Group G: Complex Sentences & Clauses (Adverbial, conditional, relative, weather dummy subject)
 * Group H: Unknown & Ambiguous Words (Graceful preservation, diagnostics, confidence ratings)
 * Group I: Multi-sentence Text & Document Offset Tracking
 * Group J: LRU Translation Cache Operations & Bounded Eviction
 * Group K: Performance & Throughput Benchmarks (Cold vs Warm, Latency, Heap memory)
 */

const assert = require('assert');
const {
  translateSentence,
  translateText,
  clearTranslationCache,
  getTranslationCacheStats,
  translateWord,
  translateVerbPhrase,
  reorderNounPhrase,
  formatTranslation,
  matchAndTranslatePhrases
} = require('./src/translator/index');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log('================================================================');
console.log('STAGE 6: RULE-BASED ENGLISH TO VIETNAMESE TRANSLATION SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// GROUP A: SIMPLE SENTENCES
// -------------------------------------------------------------
console.log('Group A: Simple Sentences');

runTest('Translate "I love you." (S+V+O)', () => {
  const res = translateSentence('I love you.');
  assert.strictEqual(res.translatedText, 'Tôi yêu bạn.');
  assert.strictEqual(res.confidence, 'high');
  assert.strictEqual(res.tense, 'Present Simple');
  assert.strictEqual(res.pattern, 'S+V+O');
  assert.strictEqual(res.diagnostics.wordsCount, 3);
  assert.strictEqual(res.diagnostics.unknownWords.length, 0);
});

runTest('Translate "She reads books." (S+V+O plural noun)', () => {
  const res = translateSentence('She reads books.');
  assert.strictEqual(res.translatedText, 'Cô ấy đọc sách.');
  assert.strictEqual(res.confidence, 'high');
  assert.strictEqual(res.pattern, 'S+V+O');
});

runTest('Translate "He works every day." (S+V with time adverbial)', () => {
  const res = translateSentence('He works every day.');
  assert.strictEqual(res.translatedText, 'Anh ấy làm việc mỗi ngày.');
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate "The sun shines." (S+V intransitive)', () => {
  const res = translateSentence('The sun shines.');
  assert.strictEqual(res.translatedText, 'Mặt trời chiếu sáng.');
  assert.strictEqual(res.confidence, 'high');
  assert.strictEqual(res.pattern, 'S+V');
});

// -------------------------------------------------------------
// GROUP B: TENSE VARIATIONS
// -------------------------------------------------------------
console.log('\nGroup B: Tense Variations');

runTest('Translate Present Continuous: "I am studying English."', () => {
  const res = translateSentence('I am studying English.');
  assert.strictEqual(res.translatedText, 'Tôi đang học tiếng Anh.');
  assert.strictEqual(res.tense, 'Present Continuous');
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate Present Perfect: "She has finished her homework."', () => {
  const res = translateSentence('She has finished her homework.');
  assert.ok(
    res.translatedText === 'Cô ấy đã hoàn thành bài tập về nhà.' ||
    res.translatedText === 'Cô ấy đã hoàn thành bài tập về nhà của cô ấy.'
  );
  assert.strictEqual(res.tense, 'Present Perfect');
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate Past Continuous: "They were playing football."', () => {
  const res = translateSentence('They were playing football.');
  assert.strictEqual(res.translatedText, 'Họ đang chơi bóng đá.');
  assert.strictEqual(res.tense, 'Past Continuous');
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate Future Simple: "I will call you tomorrow."', () => {
  const res = translateSentence('I will call you tomorrow.');
  assert.strictEqual(res.translatedText, 'Tôi sẽ gọi cho bạn ngày mai.');
  assert.strictEqual(res.tense, 'Future Simple');
  assert.strictEqual(res.confidence, 'high');
});

// -------------------------------------------------------------
// GROUP C: DIVERSE SENTENCE STRUCTURES
// -------------------------------------------------------------
console.log('\nGroup C: Diverse Sentence Structures');

runTest('Translate Ditransitive S+V+IO+DO: "She gave him a book."', () => {
  const res = translateSentence('She gave him a book.');
  assert.strictEqual(res.translatedText, 'Cô ấy đã cho anh ấy một quyển sách.');
  assert.strictEqual(res.pattern, 'S+V+IO+DO');
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate Complex Transitive S+V+O+C: "They made him happy."', () => {
  const res = translateSentence('They made him happy.');
  assert.strictEqual(res.translatedText, 'Họ đã làm cho anh ấy hạnh phúc.');
  assert.strictEqual(res.pattern, 'S+V+O+C');
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate Copular/Linking S+V+C: "The soup tastes delicious."', () => {
  const res = translateSentence('The soup tastes delicious.');
  assert.strictEqual(res.translatedText, 'Món súp có vị ngon.');
  assert.strictEqual(res.pattern, 'S+V+C');
  assert.strictEqual(res.confidence, 'high');
});

// -------------------------------------------------------------
// GROUP D: NEGATION & QUESTIONS
// -------------------------------------------------------------
console.log('\nGroup D: Negation & Questions');

runTest('Translate Negation: "I do not understand."', () => {
  const res = translateSentence('I do not understand.');
  assert.strictEqual(res.translatedText, 'Tôi không hiểu.');
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate Yes/No Question: "Did you see him?"', () => {
  const res = translateSentence('Did you see him?');
  assert.strictEqual(res.translatedText, 'Bạn có thấy anh ấy không?');
  assert.strictEqual(res.sentenceType, 'interrogative');
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate WH-Question: "Where are you going?"', () => {
  const res = translateSentence('Where are you going?');
  assert.strictEqual(res.translatedText, 'Bạn đang đi đâu?');
  assert.strictEqual(res.sentenceType, 'interrogative');
  assert.strictEqual(res.confidence, 'high');
});

// -------------------------------------------------------------
// GROUP E: PASSIVE VOICE
// -------------------------------------------------------------
console.log('\nGroup E: Passive Voice');

runTest('Translate Agent Passive: "The letter was written by Mary."', () => {
  const res = translateSentence('The letter was written by Mary.');
  assert.strictEqual(res.translatedText, 'Lá thư đã được viết bởi Mary.');
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate Agentless Passive: "The bridge has been built."', () => {
  const res = translateSentence('The bridge has been built.');
  assert.strictEqual(res.translatedText, 'Cây cầu đã được xây dựng.');
  assert.strictEqual(res.tense, 'Present Perfect');
  assert.strictEqual(res.confidence, 'high');
});

// -------------------------------------------------------------
// GROUP F: MULTI-WORD EXPRESSIONS & IDIOMS
// -------------------------------------------------------------
console.log('\nGroup F: Multi-word Expressions & Idioms');

runTest('Translate Phrasal Verb + Gerund: "I look forward to meeting you."', () => {
  const res = translateSentence('I look forward to meeting you.');
  assert.strictEqual(res.translatedText, 'Tôi mong đợi gặp bạn.');
  assert.ok(res.phrases.some(p => p.word === 'look forward to'));
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate Phrasal Verb: "He gave up smoking."', () => {
  const res = translateSentence('He gave up smoking.');
  assert.strictEqual(res.translatedText, 'Anh ấy đã từ bỏ hút thuốc.');
  assert.ok(res.phrases.some(p => p.word === 'give up'));
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate Imperative with Phrasal Verb: "Please take care of my dog."', () => {
  const res = translateSentence('Please take care of my dog.');
  assert.strictEqual(res.translatedText, 'Xin hãy chăm sóc con chó của tôi.');
  assert.strictEqual(res.sentenceType, 'imperative');
  assert.ok(res.phrases.some(p => p.word === 'take care of'));
  assert.strictEqual(res.confidence, 'high');
});

// -------------------------------------------------------------
// GROUP G: COMPLEX SENTENCES (CLAUSES)
// -------------------------------------------------------------
console.log('\nGroup G: Complex Sentences (Clauses)');

runTest('Translate Adverbial Clause with Weather Subject: "I stayed home because it was raining."', () => {
  const res = translateSentence('I stayed home because it was raining.');
  assert.strictEqual(res.translatedText, 'Tôi đã ở nhà bởi vì trời đang mưa.');
  assert.strictEqual(res.clausesCount, 2);
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate Conditional Clause: "If you study hard, you will pass the exam."', () => {
  const res = translateSentence('If you study hard, you will pass the exam.');
  assert.strictEqual(res.translatedText, 'Nếu bạn học chăm chỉ, bạn sẽ vượt qua kỳ thi.');
  assert.strictEqual(res.clausesCount, 2);
  assert.strictEqual(res.confidence, 'high');
});

runTest('Translate Relative Clause: "The book that I bought is interesting."', () => {
  const res = translateSentence('The book that I bought is interesting.');
  assert.strictEqual(res.translatedText, 'Quyển sách mà tôi đã mua rất thú vị.');
  assert.strictEqual(res.clausesCount, 2);
  assert.strictEqual(res.confidence, 'high');
});

// -------------------------------------------------------------
// GROUP H: UNKNOWN & AMBIGUOUS WORDS
// -------------------------------------------------------------
console.log('\nGroup H: Unknown & Ambiguous Words');

runTest('Graceful preservation of unknown word: "The device xyz123 was broken."', () => {
  const res = translateSentence('The device xyz123 was broken.');
  assert.strictEqual(res.translatedText, 'Thiết bị xyz123 đã bị hỏng.');
  assert.strictEqual(res.confidence, 'medium');
  assert.ok(res.diagnostics.unknownWords.includes('xyz123'), 'xyz123 must be diagnosed as unknown');
  assert.ok(res.tokens.some(t => t.text === 'xyz123' && t.pos === 'UNKNOWN'));
});

runTest('Contextual disambiguation of polysemous word: "I saw him yesterday."', () => {
  const res = translateSentence('I saw him yesterday.');
  assert.strictEqual(res.translatedText, 'Tôi đã thấy anh ấy hôm qua.');
  assert.strictEqual(res.confidence, 'high');
  // 'saw' must be tagged as VERB (see), not NOUN (cái cưa)
  const sawToken = res.tokens.find(t => t.text === 'saw');
  assert.strictEqual(sawToken.pos, 'VERB');
  assert.strictEqual(sawToken.lemma, 'see');
});

// -------------------------------------------------------------
// GROUP I: MULTI-SENTENCE TEXT & OFFSET TRACKING
// -------------------------------------------------------------
console.log('\nGroup I: Multi-sentence Text & Offset Tracking');

runTest('Translate 3-sentence paragraph with exact offsets', () => {
  const text = 'I love you. She reads books. The sun shines.';
  const results = translateText(text);

  assert.strictEqual(results.length, 3, 'Must detect exactly 3 sentences');

  assert.strictEqual(results[0].originalText, 'I love you.');
  assert.strictEqual(results[0].translatedText, 'Tôi yêu bạn.');
  assert.strictEqual(results[0].startIndex, 0);
  assert.strictEqual(results[0].endIndex, 11);
  assert.strictEqual(text.substring(results[0].startIndex, results[0].endIndex), 'I love you.');

  assert.strictEqual(results[1].originalText, 'She reads books.');
  assert.strictEqual(results[1].translatedText, 'Cô ấy đọc sách.');
  assert.strictEqual(results[1].startIndex, 12);
  assert.strictEqual(results[1].endIndex, 28);
  assert.strictEqual(text.substring(results[1].startIndex, results[1].endIndex), 'She reads books.');

  assert.strictEqual(results[2].originalText, 'The sun shines.');
  assert.strictEqual(results[2].translatedText, 'Mặt trời chiếu sáng.');
  assert.strictEqual(results[2].startIndex, 29);
  assert.strictEqual(results[2].endIndex, 44);
  assert.strictEqual(text.substring(results[2].startIndex, results[2].endIndex), 'The sun shines.');
});

// -------------------------------------------------------------
// GROUP J: TRANSLATION CACHE OPERATIONS
// -------------------------------------------------------------
console.log('\nGroup J: Translation Cache Operations');

runTest('Cache hit count increments on repeated query', () => {
  clearTranslationCache();
  const initStats = getTranslationCacheStats();
  assert.strictEqual(initStats.size, 0);
  assert.strictEqual(initStats.hits, 0);

  translateSentence('I love you.');
  const missStats = getTranslationCacheStats();
  assert.strictEqual(missStats.size, 1);
  assert.strictEqual(missStats.hits, 0);
  assert.strictEqual(missStats.misses, 1);

  translateSentence('I love you.');
  const hitStats = getTranslationCacheStats();
  assert.strictEqual(hitStats.size, 1);
  assert.strictEqual(hitStats.hits, 1);
  assert.strictEqual(hitStats.misses, 1);
  assert.strictEqual(hitStats.hitRate, 50);
});

runTest('Cache clearing resets all metrics to zero', () => {
  clearTranslationCache();
  const stats = getTranslationCacheStats();
  assert.strictEqual(stats.size, 0);
  assert.strictEqual(stats.hits, 0);
  assert.strictEqual(stats.misses, 0);
  assert.strictEqual(stats.hitRate, 0);
});

runTest('Bounded cache eviction does not exceed limit', () => {
  clearTranslationCache();
  for (let i = 0; i < 1050; i++) {
    translateSentence(`This is item number ${i}.`);
  }
  const stats = getTranslationCacheStats();
  assert.ok(stats.size <= 1000, `Cache size ${stats.size} must not exceed 1,000`);
});

// -------------------------------------------------------------
// GROUP K: PERFORMANCE BENCHMARK
// -------------------------------------------------------------
console.log('\nGroup K: Performance Benchmark');

runTest('Cold and Warm Latency, Throughput & Memory Benchmark', () => {
  const benchSentences = [
    'I love you.',
    'She reads books.',
    'He works every day.',
    'The sun shines.',
    'I am studying English.',
    'She has finished her homework.',
    'They were playing football.',
    'I will call you tomorrow.',
    'She gave him a book.',
    'They made him happy.',
    'The soup tastes delicious.',
    'I do not understand.',
    'Did you see him?',
    'Where are you going?',
    'The letter was written by Mary.',
    'The bridge has been built.',
    'I look forward to meeting you.',
    'He gave up smoking.',
    'Please take care of my dog.',
    'I stayed home because it was raining.',
    'If you study hard, you will pass the exam.',
    'The book that I bought is interesting.',
    'The device xyz123 was broken.',
    'I saw him yesterday.',
    'We must find out the truth.'
  ];

  const BENCH_COUNT = 50;

  // 1. Cold benchmark (bypassCache: true)
  clearTranslationCache();
  const startHeap = process.memoryUsage().heapUsed;
  const coldStart = process.hrtime.bigint();
  const coldLatencies = [];

  for (let i = 0; i < BENCH_COUNT; i++) {
    const s = benchSentences[i % benchSentences.length];
    const sStart = process.hrtime.bigint();
    translateSentence(s, { bypassCache: true });
    const sEnd = process.hrtime.bigint();
    coldLatencies.push(Number(sEnd - sStart) / 1e6);
  }

  const coldEnd = process.hrtime.bigint();
  const endHeap = process.memoryUsage().heapUsed;
  const coldTotalMs = Number(coldEnd - coldStart) / 1e6;
  const coldThroughput = Math.round((BENCH_COUNT / coldTotalMs) * 1000);

  coldLatencies.sort((a, b) => a - b);
  const coldAvg = (coldTotalMs / BENCH_COUNT).toFixed(3);
  const coldMedian = coldLatencies[Math.floor(BENCH_COUNT * 0.5)].toFixed(3);
  const coldP95 = coldLatencies[Math.floor(BENCH_COUNT * 0.95)].toFixed(3);
  const heapDeltaMB = ((endHeap - startHeap) / (1024 * 1024)).toFixed(2);

  // 2. Warm benchmark (cache hits)
  // Populate cache first
  for (const s of benchSentences) {
    translateSentence(s);
  }

  const warmStart = process.hrtime.bigint();
  const warmLatencies = [];

  for (let i = 0; i < BENCH_COUNT; i++) {
    const s = benchSentences[i % benchSentences.length];
    const sStart = process.hrtime.bigint();
    translateSentence(s);
    const sEnd = process.hrtime.bigint();
    warmLatencies.push(Number(sEnd - sStart) / 1e6);
  }

  const warmEnd = process.hrtime.bigint();
  const warmTotalMs = Number(warmEnd - warmStart) / 1e6;
  const warmThroughput = Math.round((BENCH_COUNT / warmTotalMs) * 1000);

  warmLatencies.sort((a, b) => a - b);
  const warmAvg = (warmTotalMs / BENCH_COUNT).toFixed(3);
  const warmMedian = warmLatencies[Math.floor(BENCH_COUNT * 0.5)].toFixed(3);
  const warmP95 = warmLatencies[Math.floor(BENCH_COUNT * 0.95)].toFixed(3);

  console.log(`    Cold Latency:     avg=${coldAvg}ms, median=${coldMedian}ms, p95=${coldP95}ms`);
  console.log(`    Cold Throughput:  ${coldThroughput.toLocaleString()} sentences/sec`);
  console.log(`    Warm Latency:     avg=${warmAvg}ms, median=${warmMedian}ms, p95=${warmP95}ms`);
  console.log(`    Warm Throughput:  ${warmThroughput.toLocaleString()} sentences/sec`);
  console.log(`    Heap Delta:       ${heapDeltaMB} MB`);

  assert.ok(coldThroughput > 100, 'Cold throughput should exceed 100 sentences/sec');
  assert.ok(warmThroughput > 1000, 'Warm throughput should exceed 1,000 sentences/sec');
  assert.ok(Number(coldAvg) < 20, 'Average cold latency should be under 20ms per sentence');
});

console.log('\n================================================================');
console.log(`STAGE 6 TEST SUITE COMPLETED: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
console.log('================================================================\n');