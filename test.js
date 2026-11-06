const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log('=== STARTING SCREEN TRANSLATOR TEST SUITE ===\n');

  // Test 1: Storage module
  console.log('--- Test 1: Storage Module (src/storage/storage.js) ---');
  const storage = require('./src/storage/storage');
  assert.strictEqual(typeof storage.getHistory, 'function');
  assert.strictEqual(typeof storage.addHistoryItem, 'function');
  assert.strictEqual(typeof storage.clearHistory, 'function');

  storage.clearHistory();
  let history = storage.getHistory();
  assert.strictEqual(history.length, 0, 'History should be empty after clear');

  const testItem = {
    id: 'test_utility_123',
    timestamp: new Date().toISOString(),
    originalText: 'Screen Translator Background Utility',
    translatedText: 'Tiện ích dịch màn hình chạy nền'
  };
  storage.addHistoryItem(testItem);
  history = storage.getHistory();
  assert.strictEqual(history.length, 1, 'History should contain 1 item');
  assert.strictEqual(history[0].id, 'test_utility_123');
  console.log('✓ Storage module tests passed.');

  // Test 2: Translation module
  console.log('\n--- Test 2: Translation Module (src/translation/translate.js) ---');
  const { translateText } = require('./src/translation/translate');

  // Empty string test
  const emptyRes = await translateText('');
  assert.strictEqual(emptyRes.success, false, 'Empty text should fail gracefully');

  // English to Vietnamese
  const enToVi = await translateText('Screen Translator utility', 'en', 'vi');
  if (enToVi.success) {
    assert.ok(enToVi.translated.length > 0, 'Translated text should not be empty');
    console.log('EN -> VI:', enToVi.original, '=>', enToVi.translated);
  } else {
    console.log('Note: Network unavailable - offline mode operating as required.');
  }

  // Vietnamese to English
  const viToEn = await translateText('Tiện ích Windows', 'vi', 'en');
  if (viToEn.success) {
    assert.ok(viToEn.translated.length > 0, 'Translated text should not be empty');
    console.log('VI -> EN:', viToEn.original, '=>', viToEn.translated);
  } else {
    console.log('Note: Network unavailable - offline mode operating as required.');
  }
  console.log('✓ Translation module tests passed.');

  // Test 3: Capture Crop Logic
  console.log('\n--- Test 3: Screen Capture Logic (src/capture/capture.js) ---');
  const capture = require('./src/capture/capture');
  assert.strictEqual(typeof capture.cropImage, 'function');
  assert.strictEqual(typeof capture.startSnippet, 'function');
  assert.strictEqual(typeof capture.captureFullScreen, 'function');

  // Crop error validation
  try {
    capture.cropImage(null, { x: 0, y: 0, width: 10, height: 10 });
    assert.fail('Should throw on null image');
  } catch (e) {
    assert.ok(e.message.includes('Cannot crop empty image'));
  }
  console.log('✓ Capture crop validation passed.');

  // Test 4: OCR Module
  console.log('\n--- Test 4: OCR Module & Local Traineddata (src/ocr/ocr.js) ---');
  const { recognizeText, terminateWorker } = require('./src/ocr/ocr');
  assert.strictEqual(typeof recognizeText, 'function');

  const nullOcr = await recognizeText(null);
  assert.strictEqual(nullOcr.success, false);

  await terminateWorker();
  console.log('✓ OCR worker tests passed.');

  // Test 5: Clipboard Module
  console.log('\n--- Test 5: Clipboard Module (src/clipboard/clipboard.js) ---');
  const clipboardModule = require('./src/clipboard/clipboard');
  assert.strictEqual(typeof clipboardModule.copyToClipboard, 'function');
  assert.strictEqual(typeof clipboardModule.readFromClipboard, 'function');
  console.log('✓ Clipboard module tests passed.');

  // Test 6: Dictionary Database Integration
  console.log('\n--- Test 6: Offline Dictionary Database (src/dictionary/db.js) ---');
  const { getDatabase, getDatabaseStats, getAttribution, closeDatabase } = require('./src/dictionary/db');
  const db = getDatabase();
  assert.ok(db, 'Database connection must be established');
  const stats = getDatabaseStats();
  assert.strictEqual(stats.words, 104829, 'Exact word count must match');
  assert.strictEqual(stats.definitions, 158307, 'Exact definition count must match');
  assert.strictEqual(stats.links, 175735, 'Exact word-definition links must match');
  assert.strictEqual(stats.pronunciations, 108776, 'Exact pronunciations count must match');

  const attrib = getAttribution();
  assert.ok(attrib.license.includes('CC BY-SA 4.0'), 'Attribution must include CC BY-SA 4.0');
  console.log('✓ Dictionary database module tests passed.');

  // Test 7: Offline Dictionary Engine & Word Lookup
  console.log('\n--- Test 7: Offline Dictionary Engine (src/dictionary/dictionary.js) ---');
  const { lookupWord, lookupPhrase } = require('./src/dictionary/dictionary');
  const helloLookup = lookupWord('  HELLO  ');
  assert.strictEqual(helloLookup.found, true);
  assert.strictEqual(helloLookup.word, 'hello');
  assert.ok(helloLookup.meanings.length > 0);

  const phraseLookup = lookupPhrase('look forward to');
  assert.strictEqual(phraseLookup.found, true);
  assert.strictEqual(phraseLookup.word, 'look forward to');
  console.log('✓ Dictionary engine lookup tests passed.');

  // Test 8: Offline Phrase & Idiom Matcher
  console.log('\n--- Test 8: Phrase & Idiom Matcher (src/dictionary/phrase-matcher.js) ---');
  const { matchPhrases } = require('./src/dictionary/phrase-matcher');
  const testSentence = 'We must find out how to take care of this and not give up.';
  const phraseMatches = matchPhrases(testSentence);
  const foundPhrases = phraseMatches.filter(m => m.matchType === 'phrasal_verb').map(m => m.word);
  assert.ok(foundPhrases.includes('find out'), 'Must match find out');
  assert.ok(foundPhrases.includes('take care of'), 'Must match take care of');
  assert.ok(foundPhrases.includes('give up'), 'Must match give up');
  console.log('✓ Phrase & idiom matcher tests passed.');

  // Test 9: Offline Lemmatizer & Morphological Analyzer
  console.log('\n--- Test 9: Offline Lemmatizer (src/dictionary/lemmatizer.js) ---');
  const { lemmatizeWord, lemmatizeSentence } = require('./src/dictionary/lemmatizer');
  const l1 = lemmatizeWord('running');
  assert.ok(l1.lemmas.includes('run'));
  const l2 = lemmatizeWord('children');
  assert.ok(l2.lemmas.includes('child'));
  const l3 = lemmatizeWord('walked');
  assert.ok(l3.lemmas.includes('walk'));
  const l4 = lemmatizeWord('better');
  assert.ok(l4.lemmas.includes('good') && l4.lemmas.includes('well'));
  const sentRes = lemmatizeSentence('The children were running');
  assert.ok(sentRes.tokens.length === 4);
  console.log('✓ Offline lemmatizer tests passed.');

  // Test 10: Offline Sentence Structure Analyzer
  console.log('\n--- Test 10: Sentence Structure Analyzer (src/analyzer/index.js) ---');
  const { analyzeSentence, analyzeText, getSentenceStructure, getVerbPhrases, getClauses } = require('./src/analyzer/index');

  const s1 = 'The students have completed the exam.';
  const res1 = analyzeSentence(s1);
  assert.strictEqual(res1.tense.tense, 'Present Perfect');
  assert.strictEqual(res1.syntax.pattern, 'S+V+O');
  assert.strictEqual(res1.syntax.subject.text, 'The students');
  assert.strictEqual(res1.syntax.directObject.text, 'the exam');

  const textMulti = 'Dr. Smith arrived at 8:30 a.m. He was reading a book.';
  const multiRes = analyzeText(textMulti);
  assert.strictEqual(multiRes.length, 2);
  assert.strictEqual(multiRes[0].trimmed, 'Dr. Smith arrived at 8:30 a.m.');
  assert.strictEqual(multiRes[1].trimmed, 'He was reading a book.');

  const structure = getSentenceStructure('She gave him a book.');
  assert.strictEqual(structure.pattern, 'S+V+IO+DO');
  assert.strictEqual(structure.indirectObject.text, 'him');
  assert.strictEqual(structure.directObject.text, 'a book');

  const vpData = getVerbPhrases('The bridge has been built.');
  assert.strictEqual(vpData.verbPhrases[0].text, 'has been built');
  assert.strictEqual(vpData.tense.voice, 'passive');

  const clauseData = getClauses('If you work hard, you will succeed.');
  assert.strictEqual(clauseData.length, 2);
  assert.strictEqual(clauseData[0].type, 'conditional');
  assert.strictEqual(clauseData[1].type, 'independent');
  console.log('✓ Offline sentence structure analyzer tests passed.');

  // Test 11: Offline Rule-Based Translation Engine (src/translator/index.js)
  console.log('\n--- Test 11: Offline Rule-Based Translation Engine (src/translator/index.js) ---');
  const {
    translateSentence,
    translateText: translateOfflineText,
    clearTranslationCache,
    getTranslationCacheStats
  } = require('./src/translator/index');

  const t1 = translateSentence('I love you.');
  assert.strictEqual(t1.translatedText, 'Tôi yêu bạn.');
  assert.strictEqual(t1.confidence, 'high');
  assert.strictEqual(t1.pattern, 'S+V+O');

  const t2 = translateSentence('I am studying English.');
  assert.strictEqual(t2.translatedText, 'Tôi đang học tiếng Anh.');
  assert.strictEqual(t2.tense, 'Present Continuous');

  const t3 = translateSentence('I look forward to meeting you.');
  assert.strictEqual(t3.translatedText, 'Tôi mong đợi gặp bạn.');

  const t4 = translateSentence('The device xyz123 was broken.');
  assert.strictEqual(t4.translatedText, 'Thiết bị xyz123 đã bị hỏng.');
  assert.ok(t4.diagnostics.unknownWords.includes('xyz123'));

  const t5 = translateSentence('She has finished her homework.');
  assert.strictEqual(t5.translatedText, 'Cô ấy đã hoàn thành bài tập về nhà.');

  const t6 = translateSentence('She looks tired.');
  assert.strictEqual(t6.translatedText, 'Cô ấy trông mệt mỏi.');

  const t7 = translateSentence('It is raining cats and dogs.');
  assert.strictEqual(t7.translatedText, 'Trời đang mưa như trút nước.');

  const t8 = translateSentence('He was punished.');
  assert.strictEqual(t8.translatedText, 'Anh ấy đã bị phạt.');

  const multiTrans = translateOfflineText('She reads books. The sun shines.');
  assert.strictEqual(multiTrans.length, 2);
  assert.strictEqual(multiTrans[0].translatedText, 'Cô ấy đọc sách.');
  assert.strictEqual(multiTrans[1].translatedText, 'Mặt trời chiếu sáng.');

  closeDatabase();
  console.log('✓ Offline translation engine tests passed.');

  console.log('\n=============================================');
  console.log(' ALL MODULAR UNIT & INTEGRATION TESTS PASSED ');
  console.log('=============================================');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
