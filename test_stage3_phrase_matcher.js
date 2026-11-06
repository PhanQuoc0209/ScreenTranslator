const assert = require('assert');
const {
  matchPhrases,
  tokenizeWithOffsets,
  classifyMatchType,
  compareCandidates,
  calculateCandidateScore,
  phraseTrie
} = require('./src/dictionary/phrase-matcher');
const { searchDictionary } = require('./src/dictionary/dictionary');
const { closeDatabase } = require('./src/dictionary/db');

async function runStage31Tests() {
  console.log('=== STAGE 3.1: HARDENED PHRASE & IDIOM MATCHER TESTS ===\n');

  // --------------------------------------------------------------------------
  // 1. Tokenization with Exact Character Bounds & Unicode Apostrophes
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Tokenization with Precise Offset Preservation ---');
  const sampleRaw = '  Hello,   world! I\'m ready, don’t quit. ';
  const tokens = tokenizeWithOffsets(sampleRaw);
  assert.strictEqual(tokens.length, 6);

  // Verify exact substrings and cleanWord normalization
  for (const t of tokens) {
    const extracted = sampleRaw.substring(t.startIndex, t.endIndex);
    assert.strictEqual(extracted, t.text, `Token ${t.text} offset mismatch`);
  }
  assert.strictEqual(tokens[0].text, 'Hello');
  assert.strictEqual(tokens[1].text, 'world');
  assert.strictEqual(tokens[2].text, "I'm");
  assert.strictEqual(tokens[2].cleanWord, "i'm");
  assert.strictEqual(tokens[3].text, 'ready');
  assert.strictEqual(tokens[4].text, 'don’t');
  assert.strictEqual(tokens[4].cleanWord, "don't"); // Normalized typographic apostrophe
  assert.strictEqual(tokens[5].text, 'quit');
  console.log('✓ Tokenizer accurately preserves character bounds and normalizes typographic apostrophes.');

  // --------------------------------------------------------------------------
  // 2. Single Word Matches
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Single Word Matches ---');
  const singleMatches = matchPhrases('Open this book and use a computer.');
  const bookMatch = singleMatches.find(m => m.word === 'book');
  const compMatch = singleMatches.find(m => m.word === 'computer');

  assert.ok(bookMatch && bookMatch.matched, 'book should be matched');
  assert.strictEqual(bookMatch.matchType, 'word');
  assert.ok(compMatch && compMatch.matched, 'computer should be matched');
  assert.strictEqual(compMatch.matchType, 'word');
  console.log('✓ Single words correctly matched and classified as matchType: "word".');

  // --------------------------------------------------------------------------
  // 3. Phrasal Verbs Recognition
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Phrasal Verbs Recognition ---');
  const textPv = 'Never give up when trying to find out the truth, look forward to success, and take care of your work.';
  const matchesPv = matchPhrases(textPv);

  const giveUp = matchesPv.find(m => m.word === 'give up');
  assert.ok(giveUp && giveUp.matched);
  assert.strictEqual(giveUp.matchType, 'phrasal_verb');
  assert.strictEqual(textPv.substring(giveUp.startIndex, giveUp.endIndex), 'give up');

  const findOut = matchesPv.find(m => m.word === 'find out');
  assert.ok(findOut && findOut.matched);
  assert.strictEqual(findOut.matchType, 'phrasal_verb');

  const lft = matchesPv.find(m => m.word === 'look forward to');
  assert.ok(lft && lft.matched);
  assert.strictEqual(lft.matchType, 'phrasal_verb');
  assert.strictEqual(textPv.substring(lft.startIndex, lft.endIndex), 'look forward to');

  const tco = matchesPv.find(m => m.word === 'take care of');
  assert.ok(tco && tco.matched);
  assert.strictEqual(tco.matchType, 'phrasal_verb');

  console.log('✓ Multi-word phrasal verbs ("give up", "find out", "look forward to", "take care of") correctly identified.');

  // --------------------------------------------------------------------------
  // 4. Precise Classification: Non-Phrasal Multi-Word Verbs & General Phrases
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Classification Precision (Phrasal Verbs vs General Phrases) ---');
  // "upper cut" has POS = V in the dictionary, but lacks phrasal particles. It must NOT be labeled phrasal_verb.
  const upperCutRes = searchDictionary('upper cut');
  assert.ok(upperCutRes.found, '"upper cut" must exist in dictionary');
  const upperCutType = classifyMatchType(upperCutRes, 2);
  assert.strictEqual(upperCutType, 'phrase', '"upper cut" without particle must be classified as phrase, not phrasal_verb');

  // "double click" has POS = N -> must be 'phrase'
  const doubleClickRes = searchDictionary('double click');
  assert.ok(doubleClickRes.found, '"double click" must exist in dictionary');
  assert.strictEqual(classifyMatchType(doubleClickRes, 2), 'phrase');

  // In full matchPhrases workflow
  const textClassification = 'The boxer delivered a fierce upper cut in the final round.';
  const matchesClass = matchPhrases(textClassification);
  const ucMatch = matchesClass.find(m => m.word === 'upper cut');
  assert.ok(ucMatch && ucMatch.matched);
  assert.strictEqual(ucMatch.matchType, 'phrase', 'upper cut must be classified as general phrase');
  console.log(`✓ "upper cut" correctly classified as "${ucMatch.matchType}" (not phrasal_verb).`);

  // --------------------------------------------------------------------------
  // 5. Idiom Recognition
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Idiom Recognition ---');
  const textIdiom = 'He decided to kick the bucket in that old novel.';
  const matchesIdiom = matchPhrases(textIdiom);
  const ktb = matchesIdiom.find(m => m.word === 'kick the bucket');
  assert.ok(ktb && ktb.matched);
  assert.strictEqual(ktb.matchType, 'idiom');
  assert.strictEqual(textIdiom.substring(ktb.startIndex, ktb.endIndex), 'kick the bucket');
  console.log(`✓ Idiom "kick the bucket" correctly classified as matchType: "${ktb.matchType}".`);

  // --------------------------------------------------------------------------
  // 6. Strict Longest Match First & Overlapping Phrases
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Strict Longest Match First & Overlapping Phrases ---');

  // Test 6A: Longer Noun Phrase vs Shorter Phrasal Verb
  // "shut down" (2 words, phrasal_verb) vs "shut down price" (3 words, phrase)
  // Even though "shut down" is a phrasal verb, the 3-word "shut down price" must win!
  const overlapTextA = 'The company calculated the shut down price before closing.';
  const matchesOA = matchPhrases(overlapTextA);
  const sdpMatch = matchesOA.find(m => m.word === 'shut down price');
  assert.ok(sdpMatch, '3-token phrase "shut down price" must win over 2-token "shut down"');
  assert.strictEqual(sdpMatch.originalText, 'shut down price');
  assert.strictEqual(overlapTextA.substring(sdpMatch.startIndex, sdpMatch.endIndex), 'shut down price');
  const standaloneShutDown = matchesOA.find(m => m.word === 'shut down');
  assert.strictEqual(standaloneShutDown, undefined, 'Shorter "shut down" must not override longer phrase');
  console.log('✓ Overlap Test A: 3-word phrase ("shut down price") strictly preferred over 2-word phrasal verb ("shut down").');

  // Test 6B: Longer Phrasal Verb vs Shorter Phrasal Verb
  // "add up" (2 words) vs "add up to" (3 words)
  const overlapTextB = 'These small expenses will add up to a major problem.';
  const matchesOB = matchPhrases(overlapTextB);
  const autMatch = matchesOB.find(m => m.word === 'add up to');
  assert.ok(autMatch, '"add up to" (3 words) must win over "add up" (2 words)');
  assert.strictEqual(autMatch.matchType, 'phrasal_verb');
  const standaloneAddUp = matchesOB.find(m => m.word === 'add up');
  assert.strictEqual(standaloneAddUp, undefined, 'Shorter "add up" must be superseded by "add up to"');
  console.log('✓ Overlap Test B: 3-word phrasal verb ("add up to") strictly preferred over 2-word ("add up").');

  // Test 6C: 4-Word Expression vs 2-Word Expression
  // "capital asset" (2 words) vs "capital asset pricing model" (4 words)
  const overlapTextC = 'We studied the capital asset pricing model in our economics class.';
  const matchesOC = matchPhrases(overlapTextC);
  const capmMatch = matchesOC.find(m => m.word === 'capital asset pricing model');
  assert.ok(capmMatch, '4-word expression "capital asset pricing model" must win');
  assert.strictEqual(capmMatch.originalText, 'capital asset pricing model');
  assert.strictEqual(overlapTextC.substring(capmMatch.startIndex, capmMatch.endIndex), 'capital asset pricing model');
  console.log('✓ Overlap Test C: 4-word expression ("capital asset pricing model") strictly preferred over 2-word ("capital asset").');

  // Test 6D: Subphrase token suppression
  // "look forward to" must not produce standalone "look" or "forward"
  const overlapTextD = 'We look forward to meeting you soon.';
  const matchesOD = matchPhrases(overlapTextD);
  const lookSolo = matchesOD.find(m => m.word === 'look' && m.originalText === 'look');
  assert.strictEqual(lookSolo, undefined, 'Individual sub-tokens must be suppressed when part of longest phrase');
  console.log('✓ Overlap Test D: Individual subphrase tokens successfully suppressed.');

  // --------------------------------------------------------------------------
  // 7. Sentence Boundaries
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Testing Sentence Boundaries ---');

  // Period (.) must prevent phrase spanning
  const textBoundaryPeriod = 'We had to look. Forward to tomorrow, we have hope.';
  const matchesPeriod = matchPhrases(textBoundaryPeriod);
  const crossPeriodMatch = matchesPeriod.find(m => m.word === 'look forward to');
  assert.strictEqual(crossPeriodMatch, undefined, 'Phrase must NOT cross sentence-terminating period "."');

  // Exclamation mark (!) must prevent phrase spanning
  const textBoundaryExcl = 'Never give up! On Monday we try again.';
  const matchesExcl = matchPhrases(textBoundaryExcl);
  const crossExclMatch = matchesExcl.find(m => m.word === 'give up on');
  assert.strictEqual(crossExclMatch, undefined, 'Phrase must NOT cross exclamation mark "!"');

  // Semicolon (;) must prevent phrase spanning
  const textBoundarySemi = 'He decided to shut down; price was not an issue.';
  const matchesSemi = matchPhrases(textBoundarySemi);
  const crossSemiMatch = matchesSemi.find(m => m.word === 'shut down price');
  assert.strictEqual(crossSemiMatch, undefined, 'Phrase must NOT cross semicolon ";"');

  // Question mark (?) and Newline (\n)
  const textBoundaryNewline = 'Can you bail?\nOut of here is best.';
  const matchesNewline = matchPhrases(textBoundaryNewline);
  const crossNewlineMatch = matchesNewline.find(m => m.word === 'bail out of');
  assert.strictEqual(crossNewlineMatch, undefined, 'Phrase must NOT cross question mark or newline');
  console.log('✓ Sentence boundaries (., !, ;, ?, \\n) strictly prevent phrases from crossing clauses.');

  // --------------------------------------------------------------------------
  // 8. Casing, Whitespace Normalization & Character Offset Faithfulness
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Testing Casing, Whitespace & Exact Substring Integrity ---');
  const messyText = 'Please   TAKE    CARE    OF   him, thank you!';
  const messyMatches = matchPhrases(messyText);
  const tcoMessy = messyMatches.find(m => m.word === 'take care of');
  assert.ok(tcoMessy && tcoMessy.matched);
  assert.strictEqual(tcoMessy.originalText, 'TAKE    CARE    OF');
  assert.strictEqual(messyText.substring(tcoMessy.startIndex, tcoMessy.endIndex), 'TAKE    CARE    OF');

  // Comprehensive substring verification across all matches in messy text
  for (const m of messyMatches) {
    const rawSubstring = messyText.substring(m.startIndex, m.endIndex);
    assert.strictEqual(rawSubstring, m.originalText, `Integrity failed for match: "${m.originalText}"`);
  }
  console.log('✓ Irregular whitespace and casing preserved with 100% character-level accuracy.');

  // --------------------------------------------------------------------------
  // 9. Unmatched Words
  // --------------------------------------------------------------------------
  console.log('\n--- 9. Testing Unmatched Words ---');
  const unmatchedText = 'The xyznonexistentword123 was exciting.';
  const unmatchedMatches = matchPhrases(unmatchedText);
  const missingToken = unmatchedMatches.find(m => m.originalText === 'xyznonexistentword123');
  assert.ok(missingToken, 'xyznonexistentword123 token must be present');
  assert.strictEqual(missingToken.matched, false);
  assert.strictEqual(missingToken.matchType, 'unmatched');
  assert.strictEqual(missingToken.word, null);
  assert.deepStrictEqual(missingToken.meanings, []);
  console.log('✓ Unmatched word correctly flagged with matched: false and empty meanings.');

  // --------------------------------------------------------------------------
  // 10. Multi-Phrase Paragraph
  // --------------------------------------------------------------------------
  console.log('\n--- 10. Testing Multiple Phrases in Single Paragraph ---');
  const multiBlock = 'When you find out new facts, do not give up, but take care of your responsibilities.';
  const multiMatches = matchPhrases(multiBlock);
  const matchedPhrases = multiMatches.filter(m => m.matched && (m.matchType === 'phrasal_verb' || m.matchType === 'idiom' || m.matchType === 'phrase'));
  assert.strictEqual(matchedPhrases.length, 3, 'Must match all 3 phrases: find out, give up, take care of');
  console.log('✓ Multi-phrase paragraph parsed accurately.');

  // --------------------------------------------------------------------------
  // 11. Multi-Round Performance Benchmarks
  // --------------------------------------------------------------------------
  console.log('\n--- 11. Running Multi-Round Performance Benchmarks ---');

  const benchmarkSentences = [
    'I really look forward to seeing the new computer systems tomorrow morning.',
    'Please take care of the paperwork before we give up on the contract.',
    'Scientists must find out the cause of the disease and get along with each other.',
    'He decided to kick the bucket in that famous historical drama.',
    'We need to open this book, read the English instructions, and make a plan.',
    'You should never give up your dreams, even when difficulties arise.',
    'Please take care of yourself during this cold winter weather.',
    'Can you help me find out what time the meeting starts?',
    'Good coworkers always try to get along with their team members.',
    'The company analyzed the shut down price before closing operations.'
  ];

  // Warm-up phase (5 rounds of 10 sentences)
  for (let w = 0; w < 50; w++) {
    matchPhrases(benchmarkSentences[w % benchmarkSentences.length]);
  }

  // Multi-round measurement (10 rounds of 100 sentences = 1,000 sentences)
  const ROUNDS = 10;
  const SENTENCES_PER_ROUND = 100;
  const TOTAL_SENTENCES = ROUNDS * SENTENCES_PER_ROUND;

  const sentenceLatencies = [];
  let totalPhrasesMatched = 0;
  let totalUnmatchedWords = 0;

  const memBefore = process.memoryUsage();
  const tBenchStart = process.hrtime.bigint();

  for (let r = 0; r < ROUNDS; r++) {
    for (let sIdx = 0; sIdx < SENTENCES_PER_ROUND; sIdx++) {
      const sentence = benchmarkSentences[(r * SENTENCES_PER_ROUND + sIdx) % benchmarkSentences.length];
      const t0 = process.hrtime.bigint();
      const res = matchPhrases(sentence);
      const t1 = process.hrtime.bigint();
      const latMs = Number(t1 - t0) / 1e6;
      sentenceLatencies.push(latMs);

      for (const item of res) {
        if (item.matchType === 'phrase' || item.matchType === 'phrasal_verb' || item.matchType === 'idiom') {
          totalPhrasesMatched++;
        } else if (!item.matched) {
          totalUnmatchedWords++;
        }
      }
    }
  }

  const tBenchEnd = process.hrtime.bigint();
  const memAfter = process.memoryUsage();

  const totalBenchMs = Number(tBenchEnd - tBenchStart) / 1e6;
  const avgPerSentenceMs = totalBenchMs / TOTAL_SENTENCES;

  // Compute Median and P95
  sentenceLatencies.sort((a, b) => a - b);
  const medianMs = sentenceLatencies[Math.floor(sentenceLatencies.length * 0.5)];
  const p95Ms = sentenceLatencies[Math.floor(sentenceLatencies.length * 0.95)];
  const minMs = sentenceLatencies[0];
  const maxMs = sentenceLatencies[sentenceLatencies.length - 1];
  const throughput = Math.round(1000 / avgPerSentenceMs);

  console.log(`\n======================================================`);
  console.log(` BENCHMARK REPORT: HARDENED PHRASE & IDIOM MATCHER`);
  console.log(` (${TOTAL_SENTENCES.toLocaleString()} Sentences across ${ROUNDS} Rounds)`);
  console.log(`======================================================`);
  console.log(`Total Execution Time:          ${totalBenchMs.toFixed(2)} ms`);
  console.log(`Average Latency per Sentence:  ${avgPerSentenceMs.toFixed(4)} ms`);
  console.log(`Median Latency:                ${medianMs.toFixed(4)} ms`);
  console.log(`95th Percentile (P95):         ${p95Ms.toFixed(4)} ms`);
  console.log(`Min Latency:                   ${minMs.toFixed(4)} ms`);
  console.log(`Max Latency:                   ${maxMs.toFixed(4)} ms`);
  console.log(`Throughput:                    ${throughput.toLocaleString()} sentences / sec`);
  console.log(`Total Phrases Matched:         ${totalPhrasesMatched.toLocaleString()}`);
  console.log(`Total Unmatched Words:         ${totalUnmatchedWords.toLocaleString()}`);
  console.log(`Memory RSS Before:             ${(memBefore.rss / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Memory RSS After:              ${(memAfter.rss / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Memory Heap Used:              ${(memAfter.heapUsed / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Trie Phrases Loaded:           ${phraseTrie.getStats().totalPhrases.toLocaleString()}`);
  console.log(`======================================================\n`);

  assert.ok(avgPerSentenceMs < 5.0, `Average time per sentence (${avgPerSentenceMs} ms) must be well under 5.0 ms`);
  assert.ok(p95Ms < 5.0, `P95 time per sentence (${p95Ms} ms) must be under 5.0 ms`);

  closeDatabase();
  console.log('✓ Stage 3.1 tests and benchmarks passed successfully.');
}

runStage31Tests().catch(err => {
  console.error('Stage 3.1 Test Suite Failed:', err);
  process.exit(1);
});
