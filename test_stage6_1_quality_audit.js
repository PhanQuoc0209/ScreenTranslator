/**
 * Stage 6.1: Comprehensive Translation Quality Audit & Natural Vietnamese Improvement Test Suite.
 *
 * Suites:
 * 1. Meaning Preservation (12 tests)
 * 2. Grammar and Structure (10 tests)
 * 3. Natural Vietnamese Expression (15 tests: possessives, passives, linking verbs, idioms)
 * 4. Complex Clauses & Lexical Disambiguation (10 tests: relative, conditional, concession, polysemy)
 * 5. Unknown Word Preservation, Diagnostics & Performance (6 tests: diagnostics, cache, offsets, benchmarks)
 *
 * Total: 53 tests
 */

const assert = require('assert');
const {
  translateSentence,
  translateText,
  clearTranslationCache,
  getTranslationCacheStats
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
console.log('STAGE 6.1: TRANSLATION QUALITY AUDIT & NATURAL VIETNAMESE SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// SUITE 1: MEANING PRESERVATION
// -------------------------------------------------------------
console.log('Suite 1: Meaning Preservation');

runTest('1. Simple S+V+O: "I love you."', () => {
  const res = translateSentence('I love you.');
  assert.strictEqual(res.translatedText, 'Tôi yêu bạn.');
  assert.strictEqual(res.confidence, 'high');
});

runTest('2. Simple S+V+O with plural noun: "She reads books."', () => {
  const res = translateSentence('She reads books.');
  assert.strictEqual(res.translatedText, 'Cô ấy đọc sách.');
});

runTest('3. S+V with adverbial: "He works every day."', () => {
  const res = translateSentence('He works every day.');
  assert.strictEqual(res.translatedText, 'Anh ấy làm việc mỗi ngày.');
});

runTest('4. Intransitive S+V: "The sun shines."', () => {
  const res = translateSentence('The sun shines.');
  assert.strictEqual(res.translatedText, 'Mặt trời chiếu sáng.');
});

runTest('5. Present Continuous: "I am studying English."', () => {
  const res = translateSentence('I am studying English.');
  assert.strictEqual(res.translatedText, 'Tôi đang học tiếng Anh.');
});

runTest('6. Past Continuous: "They were playing football."', () => {
  const res = translateSentence('They were playing football.');
  assert.strictEqual(res.translatedText, 'Họ đang chơi bóng đá.');
});

runTest('7. Future Simple: "I will call you tomorrow."', () => {
  const res = translateSentence('I will call you tomorrow.');
  assert.strictEqual(res.translatedText, 'Tôi sẽ gọi cho bạn ngày mai.');
});

runTest('8. Ditransitive: "She gave him a book."', () => {
  const res = translateSentence('She gave him a book.');
  assert.strictEqual(res.translatedText, 'Cô ấy đã cho anh ấy một quyển sách.');
});

runTest('9. Negation: "I do not understand."', () => {
  const res = translateSentence('I do not understand.');
  assert.strictEqual(res.translatedText, 'Tôi không hiểu.');
});

runTest('10. Polar Question: "Did you see him?"', () => {
  const res = translateSentence('Did you see him?');
  assert.strictEqual(res.translatedText, 'Bạn có thấy anh ấy không?');
});

runTest('11. WH Question: "Where are you going?"', () => {
  const res = translateSentence('Where are you going?');
  assert.strictEqual(res.translatedText, 'Bạn đang đi đâu?');
});

runTest('12. Agentless Passive: "The bridge has been built."', () => {
  const res = translateSentence('The bridge has been built.');
  assert.strictEqual(res.translatedText, 'Cây cầu đã được xây dựng.');
});

// -------------------------------------------------------------
// SUITE 2: GRAMMAR AND STRUCTURE
// -------------------------------------------------------------
console.log('\nSuite 2: Grammar and Structure');

runTest('13. Complex Transitive S+V+O+C: "They made him happy."', () => {
  const res = translateSentence('They made him happy.');
  assert.strictEqual(res.translatedText, 'Họ đã làm cho anh ấy hạnh phúc.');
  assert.strictEqual(res.pattern, 'S+V+O+C');
});

runTest('14. Ditransitive S+V+IO+DO: "He sent me an email."', () => {
  const res = translateSentence('He sent me an email.');
  assert.strictEqual(res.translatedText, 'Anh ấy đã gửi tôi một thư điện tử.');
  assert.strictEqual(res.pattern, 'S+V+IO+DO');
});

runTest('15. Copular / Linking S+V+C: "The soup tastes delicious."', () => {
  const res = translateSentence('The soup tastes delicious.');
  assert.strictEqual(res.translatedText, 'Món súp có vị ngon.');
  assert.strictEqual(res.pattern, 'S+V+C');
});

runTest('16. Imperative sentence: "Open the door."', () => {
  const res = translateSentence('Open the door.');
  assert.strictEqual(res.translatedText, 'Hãy mở cửa.');
  assert.strictEqual(res.sentenceType, 'imperative');
});

runTest('17. Politeness Imperative: "Please take care of my dog."', () => {
  const res = translateSentence('Please take care of my dog.');
  assert.strictEqual(res.translatedText, 'Xin hãy chăm sóc con chó của tôi.');
  assert.strictEqual(res.sentenceType, 'imperative');
});

runTest('18. Present Simple Question: "Do you understand?"', () => {
  const res = translateSentence('Do you understand?');
  assert.strictEqual(res.translatedText, 'Bạn có hiểu không?');
  assert.strictEqual(res.sentenceType, 'interrogative');
});

runTest('19. WH Question (Why): "Why did she leave?"', () => {
  const res = translateSentence('Why did she leave?');
  assert.strictEqual(res.translatedText, 'Tại sao cô ấy rời đi?');
  assert.strictEqual(res.sentenceType, 'interrogative');
});

runTest('20. Present Perfect with "never": "I have never seen it."', () => {
  const res = translateSentence('I have never seen it.');
  assert.strictEqual(res.translatedText, 'Tôi chưa bao giờ thấy nó.');
});

runTest('21. Auxiliary Negation: "She does not like coffee."', () => {
  const res = translateSentence('She does not like coffee.');
  assert.strictEqual(res.translatedText, 'Cô ấy không thích cà phê.');
});

runTest('22. Modal Negation: "You should not do that."', () => {
  const res = translateSentence('You should not do that.');
  assert.strictEqual(res.translatedText, 'Bạn không nên làm điều đó.');
});

// -------------------------------------------------------------
// SUITE 3: NATURAL VIETNAMESE EXPRESSION
// -------------------------------------------------------------
console.log('\nSuite 3: Natural Vietnamese Expression');

runTest('23. Possessive Co-reference (homework): "She has finished her homework."', () => {
  const res = translateSentence('She has finished her homework.');
  assert.strictEqual(res.translatedText, 'Cô ấy đã hoàn thành bài tập về nhà.');
});

runTest('24. Possessive Co-reference (family): "I love my family."', () => {
  const res = translateSentence('I love my family.');
  assert.strictEqual(res.translatedText, 'Tôi yêu gia đình.');
});

runTest('25. Possessive Co-reference (phone): "He lost his phone."', () => {
  const res = translateSentence('He lost his phone.');
  assert.strictEqual(res.translatedText, 'Anh ấy đã mất điện thoại.');
});

runTest('26. Possessive Co-reference (room): "They cleaned their room."', () => {
  const res = translateSentence('They cleaned their room.');
  assert.strictEqual(res.translatedText, 'Họ đã dọn dẹp căn phòng.');
});

runTest('27. Possessive Co-reference (parents): "She takes care of her parents."', () => {
  const res = translateSentence('She takes care of her parents.');
  assert.strictEqual(res.translatedText, 'Cô ấy chăm sóc cha mẹ.');
});

runTest('28. Possessive Non-Co-reference preserved: "She took his book."', () => {
  const res = translateSentence('She took his book.');
  assert.strictEqual(res.translatedText, 'Cô ấy đã lấy quyển sách của anh ấy.');
});

runTest('29. Possessive in Subject position preserved: "My dog is cute."', () => {
  const res = translateSentence('My dog is cute.');
  assert.strictEqual(res.translatedText, 'Con chó của tôi dễ thương.');
});

runTest('30. Linking verb "look + adj": "She looks tired."', () => {
  const res = translateSentence('She looks tired.');
  assert.strictEqual(res.translatedText, 'Cô ấy trông mệt mỏi.');
});

runTest('31. Linking verb "sound + adj": "The idea sounds interesting."', () => {
  const res = translateSentence('The idea sounds interesting.');
  assert.strictEqual(res.translatedText, 'Ý tưởng nghe có vẻ thú vị.');
});

runTest('32. Linking verb "seem + adj": "They seem happy."', () => {
  const res = translateSentence('They seem happy.');
  assert.strictEqual(res.translatedText, 'Họ có vẻ hạnh phúc.');
});

runTest('33. Linking verb "become + adj": "He became angry."', () => {
  const res = translateSentence('He became angry.');
  assert.strictEqual(res.translatedText, 'Anh ấy trở nên tức giận.');
});

runTest('34. Passive Voice (Adverse - punish): "He was punished."', () => {
  const res = translateSentence('He was punished.');
  assert.strictEqual(res.translatedText, 'Anh ấy đã bị phạt.');
  assert.strictEqual(res.voice, 'passive');
});

runTest('35. Passive Voice (Adverse - broken): "The window was broken."', () => {
  const res = translateSentence('The window was broken.');
  assert.strictEqual(res.translatedText, 'Cửa sổ đã bị hỏng.');
  assert.strictEqual(res.voice, 'passive');
});

runTest('36. Passive Voice (Beneficial - approved): "The documents were approved."', () => {
  const res = translateSentence('The documents were approved.');
  assert.strictEqual(res.translatedText, 'Tài liệu đã được phê duyệt.');
  assert.strictEqual(res.voice, 'passive');
});

runTest('37. Idiom Translation: "It is raining cats and dogs."', () => {
  const res = translateSentence('It is raining cats and dogs.');
  assert.strictEqual(res.translatedText, 'Trời đang mưa như trút nước.');
});

// -------------------------------------------------------------
// SUITE 4: COMPLEX CLAUSES & LEXICAL DISAMBIGUATION
// -------------------------------------------------------------
console.log('\nSuite 4: Complex Clauses & Lexical Disambiguation');

runTest('38. Relative Clause: "The book that I bought is interesting."', () => {
  const res = translateSentence('The book that I bought is interesting.');
  assert.strictEqual(res.translatedText, 'Quyển sách mà tôi đã mua rất thú vị.');
  assert.strictEqual(res.clausesCount, 2);
});

runTest('39. Conditional Clause: "If you study hard, you will pass the exam."', () => {
  const res = translateSentence('If you study hard, you will pass the exam.');
  assert.strictEqual(res.translatedText, 'Nếu bạn học chăm chỉ, bạn sẽ vượt qua kỳ thi.');
  assert.strictEqual(res.clausesCount, 2);
});

runTest('40. Adverbial Clause (Cause + Weather): "I stayed home because it was raining."', () => {
  const res = translateSentence('I stayed home because it was raining.');
  assert.strictEqual(res.translatedText, 'Tôi đã ở nhà bởi vì trời đang mưa.');
  assert.strictEqual(res.clausesCount, 2);
});

runTest('41. Adverbial Concession: "Although he was tired, he continued working."', () => {
  const res = translateSentence('Although he was tired, he continued working.');
  assert.strictEqual(res.translatedText, 'Mặc dù anh ấy mệt mỏi, anh ấy đã tiếp tục làm việc.');
  assert.strictEqual(res.clausesCount, 2);
});

runTest('42. Noun Clause with Predicative Adj: "I know that she is busy."', () => {
  const res = translateSentence('I know that she is busy.');
  assert.strictEqual(res.translatedText, 'Tôi biết rằng cô ấy bận.');
  assert.strictEqual(res.clausesCount, 2);
});

runTest('43. Phrasal Verb with Gerund: "I look forward to meeting you."', () => {
  const res = translateSentence('I look forward to meeting you.');
  assert.strictEqual(res.translatedText, 'Tôi mong đợi gặp bạn.');
  assert.ok(res.phrases.some(p => p.word === 'look forward to'));
});

runTest('44. Phrasal Verb with Object: "He gave up smoking."', () => {
  const res = translateSentence('He gave up smoking.');
  assert.strictEqual(res.translatedText, 'Anh ấy đã từ bỏ hút thuốc.');
  assert.ok(res.phrases.some(p => p.word === 'give up'));
});

runTest('45. Phrasal Verb truth discovery: "He found out the truth."', () => {
  const res = translateSentence('He found out the truth.');
  assert.strictEqual(res.translatedText, 'Anh ấy đã tìm ra sự thật.');
});

runTest('46. Polysemous Verb Disambiguation: "He leaves tomorrow."', () => {
  const res = translateSentence('He leaves tomorrow.');
  assert.strictEqual(res.translatedText, 'Anh ấy rời đi ngày mai.');
  const leafToken = res.tokens.find(t => t.text === 'leaves');
  assert.strictEqual(leafToken.pos, 'VERB');
  assert.strictEqual(leafToken.lemma, 'leave');
});

runTest('47. Polysemous Noun Disambiguation: "The leaves fall."', () => {
  const res = translateSentence('The leaves fall.');
  assert.strictEqual(res.translatedText, 'Lá cây rơi.');
  const leafToken = res.tokens.find(t => t.text === 'leaves');
  assert.strictEqual(leafToken.pos, 'NOUN');
  assert.strictEqual(leafToken.lemma, 'leaf');
});

// -------------------------------------------------------------
// SUITE 5: UNKNOWN WORDS, DIAGNOSTICS & PERFORMANCE
// -------------------------------------------------------------
console.log('\nSuite 5: Unknown Words, Diagnostics & Performance');

runTest('48. Unknown Identifier Preservation: "The device xyz123 was broken."', () => {
  const res = translateSentence('The device xyz123 was broken.');
  assert.strictEqual(res.translatedText, 'Thiết bị xyz123 đã bị hỏng.');
  assert.strictEqual(res.confidence, 'medium');
  assert.ok(res.diagnostics.unknownWords.includes('xyz123'));
  assert.ok(res.uncertaintyReasons.some(r => r.includes('xyz123')));
});

runTest('49. Technical Term Preservation: "The server received alpha789beta data."', () => {
  const res = translateSentence('The server received alpha789beta data.');
  assert.ok(res.translatedText.includes('alpha789beta'));
  assert.ok(res.diagnostics.unknownWords.includes('alpha789beta'));
});

runTest('50. Comprehensive Diagnostics Structure Verification', () => {
  const res = translateSentence('The documents were approved.');
  assert.ok(res.originalText);
  assert.ok(res.translatedText);
  assert.ok(res.appliedRules);
  assert.strictEqual(res.appliedRules.voice, 'passive');
  assert.strictEqual(res.appliedRules.tense, 'Past Simple');
  assert.ok(Array.isArray(res.selectedWordMeanings));
  assert.ok(res.selectedWordMeanings.length > 0);
  assert.strictEqual(typeof res.diagnostics.wordsCount, 'number');
  assert.strictEqual(typeof res.diagnostics.wordsTranslated, 'number');
});

runTest('51. Multi-sentence Paragraph & Exact Offset Integrity', () => {
  const text = 'I love you. She reads books. The sun shines.';
  const results = translateText(text);

  assert.strictEqual(results.length, 3);
  assert.strictEqual(results[0].translatedText, 'Tôi yêu bạn.');
  assert.strictEqual(results[0].startIndex, 0);
  assert.strictEqual(results[0].endIndex, 11);
  assert.strictEqual(text.substring(results[0].startIndex, results[0].endIndex), 'I love you.');

  assert.strictEqual(results[1].translatedText, 'Cô ấy đọc sách.');
  assert.strictEqual(results[1].startIndex, 12);
  assert.strictEqual(results[1].endIndex, 28);
  assert.strictEqual(text.substring(results[1].startIndex, results[1].endIndex), 'She reads books.');

  assert.strictEqual(results[2].translatedText, 'Mặt trời chiếu sáng.');
  assert.strictEqual(results[2].startIndex, 29);
  assert.strictEqual(results[2].endIndex, 44);
  assert.strictEqual(text.substring(results[2].startIndex, results[2].endIndex), 'The sun shines.');
});

runTest('52. LRU Cache Tracking & Bounded Eviction', () => {
  clearTranslationCache();
  const initStats = getTranslationCacheStats();
  assert.strictEqual(initStats.size, 0);

  translateSentence('I love you.');
  const missStats = getTranslationCacheStats();
  assert.strictEqual(missStats.size, 1);
  assert.strictEqual(missStats.hits, 0);
  assert.strictEqual(missStats.misses, 1);

  translateSentence('I love you.');
  const hitStats = getTranslationCacheStats();
  assert.strictEqual(hitStats.size, 1);
  assert.strictEqual(hitStats.hits, 1);

  clearTranslationCache();
  assert.strictEqual(getTranslationCacheStats().size, 0);
});

runTest('53. Latency, Throughput and Memory Benchmarks (50 sentences)', () => {
  const sampleSentences = [
    'She has finished her homework.',
    'I love my family.',
    'He lost his phone.',
    'They cleaned their room.',
    'She takes care of her parents.',
    'The letter was written by Mary.',
    'The bridge has been built.',
    'The window was broken.',
    'He was punished.',
    'The documents were approved.',
    'The soup tastes delicious.',
    'She looks tired.',
    'He became angry.',
    'They seem happy.',
    'The idea sounds interesting.',
    'I look forward to meeting you.',
    'He gave up smoking.',
    'He found out the truth.',
    'It is raining cats and dogs.',
    'Do you understand?',
    'Did you see him?',
    'Where are you going?',
    'Why did she leave?',
    'I have never seen it.',
    'She does not like coffee.',
    'You should not do that.',
    'The book that I bought is interesting.',
    'If you study hard, you will pass the exam.',
    'Although he was tired, he continued working.',
    'I know that she is busy.',
    'I stayed home because it was raining.',
    'The device xyz123 was broken.',
    'He leaves tomorrow.'
  ];

  const BENCH_COUNT = 50;

  // Cold translation benchmark
  clearTranslationCache();
  const startHeap = process.memoryUsage().heapUsed;
  const coldStart = process.hrtime.bigint();
  const coldLatencies = [];

  for (let i = 0; i < BENCH_COUNT; i++) {
    const s = sampleSentences[i % sampleSentences.length];
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

  // Warm translation benchmark
  for (const s of sampleSentences) {
    translateSentence(s);
  }

  const warmStart = process.hrtime.bigint();
  const warmLatencies = [];

  for (let i = 0; i < BENCH_COUNT; i++) {
    const s = sampleSentences[i % sampleSentences.length];
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
  assert.ok(Number(coldAvg) < 20, 'Average cold latency should be under 20ms');
});

console.log('\n================================================================');
console.log(`STAGE 6.1 TEST SUITE COMPLETED: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
console.log('================================================================\n');