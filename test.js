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
  assert.strictEqual(enToVi.success, true, 'Translation EN -> VI should succeed');
  assert.ok(enToVi.translated.length > 0, 'Translated text should not be empty');
  console.log('EN -> VI:', enToVi.original, '=>', enToVi.translated);

  // Vietnamese to English
  const viToEn = await translateText('Tiện ích Windows', 'vi', 'en');
  assert.strictEqual(viToEn.success, true, 'Translation VI -> EN should succeed');
  assert.ok(viToEn.translated.length > 0, 'Translated text should not be empty');
  console.log('VI -> EN:', viToEn.original, '=>', viToEn.translated);
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

  console.log('\n=============================================');
  console.log(' ALL MODULAR UNIT & INTEGRATION TESTS PASSED ');
  console.log('=============================================');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
