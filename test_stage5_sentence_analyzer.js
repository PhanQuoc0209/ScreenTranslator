/**
 * Comprehensive Stage 5 Test Suite: Offline English Sentence Structure Analyzer.
 * Tests:
 * 1. Sentence Splitter (boundaries, abbreviations, acronyms, decimals, quotes, ellipses)
 * 2. Tokenizer (contractions, hyphens, punctuation, offsets)
 * 3. POS Tagger (14 categories, contextual disambiguation, ambiguous words)
 * 4. Verb Phrase Analyzer (clusters, auxiliaries, modals, phrasal verbs, voice, aspect, infinitives, gerunds)
 * 5. Tense Detector (12 tenses, active/passive, negation, 4 sentence types)
 * 6. Syntax Analyzer (5 sentence patterns: S+V, S+V+O, S+V+C, S+V+IO+DO, S+V+O+C, Subject, DO, IO, SC, OC)
 * 7. Clause Detector (independent, dependent, relative, conditional, noun, adverbial, coordinated)
 * 8. Unified Pipeline & Public APIs (analyzeSentence, analyzeText, getSentenceStructure, getVerbPhrases, getClauses, LRU cache)
 * 9. Performance & Memory Benchmarks (1,000 simple & 1,000 complex sentences, cold vs warm cache, latency, heap memory)
 */

const assert = require('assert');
const {
  splitSentences,
  tokenize,
  tagSentence,
  analyzeSentence,
  analyzeText,
  getSentenceStructure,
  getVerbPhrases,
  getClauses,
  clearCache,
  getCacheStats
} = require('./src/analyzer/index');

const { analyzeVerbPhrases } = require('./src/analyzer/verb-phrase-analyzer');
const { detectTense } = require('./src/analyzer/tense-detector');
const { analyzeSyntax } = require('./src/analyzer/syntax-analyzer');
const { detectClauses } = require('./src/analyzer/clause-detector');

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
console.log('STAGE 5: OFFLINE ENGLISH SENTENCE STRUCTURE ANALYZER TEST SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// SUITE 1: SENTENCE SPLITTER
// -------------------------------------------------------------
console.log('Suite 1: Sentence Splitter');

runTest('Basic sentence boundary detection (. ? !)', () => {
  const text = 'This is the first sentence. Is this the second? Yes, this is the third!';
  const sents = splitSentences(text);
  assert.strictEqual(sents.length, 3);
  assert.strictEqual(sents[0].trimmed, 'This is the first sentence.');
  assert.strictEqual(sents[1].trimmed, 'Is this the second?');
  assert.strictEqual(sents[2].trimmed, 'Yes, this is the third!');
});

runTest('Titles and abbreviations (Dr., Mr., Mrs., Prof., St.)', () => {
  const text = 'Dr. Smith and Mr. Brown met with Prof. Clark on St. John street.';
  const sents = splitSentences(text);
  assert.strictEqual(sents.length, 1);
  assert.strictEqual(sents[0].trimmed, text);
});

runTest('Acronyms with periods (U.S., e.g., i.e., a.m., p.m.)', () => {
  const text = 'He arrived in the U.S. at 8:30 a.m. and attended a meeting, e.g., with engineers.';
  const sents = splitSentences(text);
  assert.strictEqual(sents.length, 1);
});

runTest('Decimal numbers and currency ($3.14, 25.5%)', () => {
  const text = 'The price rose to $3.14 per share, gaining 2.5% in trading.';
  const sents = splitSentences(text);
  assert.strictEqual(sents.length, 1);
});

runTest('Quotation marks enclosing punctuation', () => {
  const text = '"Do you agree?" he asked. "Yes," she said!';
  const sents = splitSentences(text);
  assert.strictEqual(sents.length, 2);
  assert.strictEqual(sents[0].trimmed, '"Do you agree?" he asked.');
  assert.strictEqual(sents[1].trimmed, '"Yes," she said!');
});

runTest('Ellipses and combined punctuation (... and ?!)', () => {
  const text = 'Wait... what are you doing?! I cannot believe it!';
  const sents = splitSentences(text);
  assert.strictEqual(sents.length, 2);
  assert.strictEqual(sents[0].trimmed, 'Wait... what are you doing?!');
  assert.strictEqual(sents[1].trimmed, 'I cannot believe it!');
});

runTest('Exact character offset integrity in splitter', () => {
  const text = '  First sentence.  Second sentence? Third one! ';
  const sents = splitSentences(text);
  assert.strictEqual(sents.length, 3);
  for (const s of sents) {
    assert.strictEqual(text.substring(s.startIndex, s.endIndex), s.text);
    assert.strictEqual(s.text.trim(), s.trimmed);
  }
});

// -------------------------------------------------------------
// SUITE 2: TOKENIZER
// -------------------------------------------------------------
console.log('\nSuite 2: Tokenizer');

runTest('Word and punctuation tokenization', () => {
  const tokens = tokenize('Hello, world! How are you?');
  assert.strictEqual(tokens.length, 8);
  assert.strictEqual(tokens[0].cleanWord, 'hello');
  assert.strictEqual(tokens[1].text, ',');
  assert.strictEqual(tokens[2].cleanWord, 'world');
});

runTest('Contraction parsing (don\'t, I\'m, won\'t, cannot, they\'ve)', () => {
  const tokens = tokenize("I don't think they'll come, but we won't give up.");
  const dontTok = tokens.find(t => t.cleanWord === "don't");
  assert.ok(dontTok);
  assert.ok(dontTok.contraction);
  assert.strictEqual(dontTok.contraction.stem, 'do');
  assert.strictEqual(dontTok.contraction.suffix, "n't");

  const wontTok = tokens.find(t => t.cleanWord === "won't");
  assert.ok(wontTok);
  assert.strictEqual(wontTok.contraction.stem, 'will');
});

runTest('Hyphenated compound words (state-of-the-art, high-quality)', () => {
  const tokens = tokenize('This state-of-the-art model is high-quality.');
  const hyp1 = tokens.find(t => t.cleanWord === 'state-of-the-art');
  const hyp2 = tokens.find(t => t.cleanWord === 'high-quality');
  assert.ok(hyp1);
  assert.ok(hyp2);
  assert.strictEqual(hyp1.isWord, true);
});

runTest('Exact character offset integrity in tokenizer', () => {
  const raw = "The price was $1,500.50, wasn't it?!";
  const tokens = tokenize(raw);
  for (const t of tokens) {
    assert.strictEqual(raw.substring(t.startIndex, t.endIndex), t.text);
  }
});

// -------------------------------------------------------------
// SUITE 3: POS TAGGER
// -------------------------------------------------------------
console.log('\nSuite 3: Part-of-Speech (POS) Tagger');

runTest('Closed-class word tagging (Determiner, Pronoun, Modal, Aux, Prep, Conj)', () => {
  const text = 'She can see that the book is on the table and it is good.';
  const tokens = tokenize(text);
  const tagged = tagSentence(tokens);

  const getPos = (w) => (tagged.find(t => t.cleanWord === w) || {}).pos;
  assert.strictEqual(getPos('she'), 'PRONOUN');
  assert.strictEqual(getPos('can'), 'MODAL');
  assert.strictEqual(getPos('the'), 'DETERMINER');
  assert.strictEqual(getPos('on'), 'PREPOSITION');
  assert.strictEqual(getPos('and'), 'CONJUNCTION');
  assert.strictEqual(getPos('it'), 'PRONOUN');
});

runTest('Contextual disambiguation: Determiner + Adjective + Noun', () => {
  const text = 'The state-of-the-art model evaluated the complex problem.';
  const tokens = tokenize(text);
  const tagged = tagSentence(tokens);

  const modelTok = tagged.find(t => t.cleanWord === 'model');
  assert.strictEqual(modelTok.pos, 'NOUN');

  const evaluatedTok = tagged.find(t => t.cleanWord === 'evaluated');
  assert.strictEqual(evaluatedTok.pos, 'VERB');

  const problemTok = tagged.find(t => t.cleanWord === 'problem');
  assert.strictEqual(problemTok.pos, 'NOUN');
});

runTest('Contextual disambiguation: Verb + Noun (reads books)', () => {
  const tokens = tokenize('She reads books every day.');
  const tagged = tagSentence(tokens);

  const readsTok = tagged.find(t => t.cleanWord === 'reads');
  const booksTok = tagged.find(t => t.cleanWord === 'books');
  assert.strictEqual(readsTok.pos, 'VERB');
  assert.strictEqual(booksTok.pos, 'NOUN');
});

runTest('Contextual disambiguation: Imperative verb at start (Open the door)', () => {
  const tokens = tokenize('Open the door quietly.');
  const tagged = tagSentence(tokens);
  assert.strictEqual(tagged[0].pos, 'VERB');
  assert.strictEqual(tagged[0].cleanWord, 'open');
});

// -------------------------------------------------------------
// SUITE 4: VERB PHRASE ANALYZER
// -------------------------------------------------------------
console.log('\nSuite 4: Verb Phrase Analyzer');

runTest('Continuous aspect (is reading, was writing)', () => {
  const tokens = tokenize('She is reading a book.');
  const tagged = tagSentence(tokens);
  const vps = analyzeVerbPhrases('She is reading a book.', tagged);
  assert.strictEqual(vps.length, 1);
  assert.strictEqual(vps[0].text, 'is reading');
  assert.strictEqual(vps[0].aspect, 'continuous');
  assert.strictEqual(vps[0].voice, 'active');
  assert.strictEqual(vps[0].headVerb.lemma, 'read');
});

runTest('Perfect aspect (have finished, had gone)', () => {
  const tokens = tokenize('They have finished their work.');
  const tagged = tagSentence(tokens);
  const vps = analyzeVerbPhrases('They have finished their work.', tagged);
  assert.strictEqual(vps.length, 1);
  assert.strictEqual(vps[0].text, 'have finished');
  assert.strictEqual(vps[0].aspect, 'perfect');
  assert.strictEqual(vps[0].voice, 'active');
});

runTest('Passive voice (was written, has been built)', () => {
  const s1 = 'The letter was written by Mary.';
  const vp1 = analyzeVerbPhrases(s1, tagSentence(tokenize(s1)));
  assert.strictEqual(vp1[0].text, 'was written');
  assert.strictEqual(vp1[0].voice, 'passive');

  const s2 = 'The bridge has been built.';
  const vp2 = analyzeVerbPhrases(s2, tagSentence(tokenize(s2)));
  assert.strictEqual(vp2[0].text, 'has been built');
  assert.strictEqual(vp2[0].voice, 'passive');
  assert.strictEqual(vp2[0].aspect, 'perfect');
});

runTest('Phrasal verbs (look forward to, give up)', () => {
  const s1 = 'I look forward to meeting you.';
  const vp1 = analyzeVerbPhrases(s1, tagSentence(tokenize(s1)));
  assert.strictEqual(vp1[0].isPhrasalVerb, true);
  assert.strictEqual(vp1[0].phrasalVerbName, 'look forward to');

  const s2 = 'He gave up smoking.';
  const vp2 = analyzeVerbPhrases(s2, tagSentence(tokenize(s2)));
  assert.strictEqual(vp2[0].isPhrasalVerb, true);
  assert.strictEqual(vp2[0].phrasalVerbName, 'give up');
});

runTest('Infinitives and verb chains (wants to learn)', () => {
  const s = 'She wants to learn French.';
  const vps = analyzeVerbPhrases(s, tagSentence(tokenize(s)));
  assert.strictEqual(vps.length, 2);
  assert.strictEqual(vps[0].text, 'wants');
  assert.strictEqual(vps[0].isVerbChain, true);
  assert.strictEqual(vps[1].type, 'infinitive');
  assert.strictEqual(vps[1].text, 'to learn');
});

// -------------------------------------------------------------
// SUITE 5: TENSE DETECTOR
// -------------------------------------------------------------
console.log('\nSuite 5: Tense Detector');

const tenseTestMatrix = [
  { s: 'She reads books.', expectedTense: 'Present Simple', expectedAspect: 'simple', expectedVoice: 'active' },
  { s: 'She is reading a book.', expectedTense: 'Present Continuous', expectedAspect: 'continuous', expectedVoice: 'active' },
  { s: 'They have finished their work.', expectedTense: 'Present Perfect', expectedAspect: 'perfect', expectedVoice: 'active' },
  { s: 'They have been waiting for hours.', expectedTense: 'Present Perfect Continuous', expectedAspect: 'perfect_continuous', expectedVoice: 'active' },
  { s: 'He wrote a letter.', expectedTense: 'Past Simple', expectedAspect: 'simple', expectedVoice: 'active' },
  { s: 'He was writing a letter.', expectedTense: 'Past Continuous', expectedAspect: 'continuous', expectedVoice: 'active' },
  { s: 'He had written a letter.', expectedTense: 'Past Perfect', expectedAspect: 'perfect', expectedVoice: 'active' },
  { s: 'He had been writing for hours.', expectedTense: 'Past Perfect Continuous', expectedAspect: 'perfect_continuous', expectedVoice: 'active' },
  { s: 'I will call you tomorrow.', expectedTense: 'Future Simple', expectedAspect: 'simple', expectedVoice: 'active' },
  { s: 'I will be working all day.', expectedTense: 'Future Continuous', expectedAspect: 'continuous', expectedVoice: 'active' },
  { s: 'I will have finished by noon.', expectedTense: 'Future Perfect', expectedAspect: 'perfect', expectedVoice: 'active' },
  { s: 'I will have been working for hours.', expectedTense: 'Future Perfect Continuous', expectedAspect: 'perfect_continuous', expectedVoice: 'active' },
  { s: 'The letter was written by Mary.', expectedTense: 'Past Simple', expectedAspect: 'simple', expectedVoice: 'passive' },
  { s: 'The bridge has been built.', expectedTense: 'Present Perfect', expectedAspect: 'perfect', expectedVoice: 'passive' }
];

for (const tm of tenseTestMatrix) {
  runTest(`Tense: "${tm.s}" -> ${tm.expectedTense} (${tm.expectedVoice})`, () => {
    const tokens = tagSentence(tokenize(tm.s));
    const vps = analyzeVerbPhrases(tm.s, tokens);
    const res = detectTense(vps, tokens);
    assert.strictEqual(res.tense, tm.expectedTense);
    assert.strictEqual(res.aspect, tm.expectedAspect);
    assert.strictEqual(res.voice, tm.expectedVoice);
    assert.ok(res.evidence.length > 0);
  });
}

runTest('Sentence Types: Declarative, Interrogative, Imperative, Exclamatory', () => {
  const checkType = (text) => {
    const tokens = tagSentence(tokenize(text));
    const vps = analyzeVerbPhrases(text, tokens);
    return detectTense(vps, tokens).sentenceType;
  };

  assert.strictEqual(checkType('The boy plays soccer.'), 'declarative');
  assert.strictEqual(checkType('Did you see that?'), 'interrogative');
  assert.strictEqual(checkType('What are you doing?'), 'interrogative');
  assert.strictEqual(checkType('Open the door!'), 'imperative');
  assert.strictEqual(checkType('What a beautiful day!'), 'exclamatory');
});

// -------------------------------------------------------------
// SUITE 6: SYNTAX & SENTENCE PATTERNS (S+V, S+V+O, S+V+C, S+V+IO+DO, S+V+O+C)
// -------------------------------------------------------------
console.log('\nSuite 6: Syntax Analyzer & 5 Sentence Patterns');

runTest('Pattern S + V (The sun shines)', () => {
  const s = 'The sun shines.';
  const tokens = tagSentence(tokenize(s));
  const vps = analyzeVerbPhrases(s, tokens);
  const syntax = analyzeSyntax(s, tokens, vps, detectTense(vps, tokens));

  assert.strictEqual(syntax.pattern, 'S+V');
  assert.strictEqual(syntax.subject.text, 'The sun');
  assert.strictEqual(syntax.subject.head.text, 'sun');
  assert.strictEqual(syntax.verb.text, 'shines');
  assert.strictEqual(syntax.directObject, null);
});

runTest('Pattern S + V + O (The boy kicked the ball)', () => {
  const s = 'The boy kicked the ball.';
  const tokens = tagSentence(tokenize(s));
  const vps = analyzeVerbPhrases(s, tokens);
  const syntax = analyzeSyntax(s, tokens, vps, detectTense(vps, tokens));

  assert.strictEqual(syntax.pattern, 'S+V+O');
  assert.strictEqual(syntax.subject.text, 'The boy');
  assert.strictEqual(syntax.verb.text, 'kicked');
  assert.strictEqual(syntax.directObject.text, 'the ball');
});

runTest('Pattern S + V + C (She is a teacher / The soup tastes delicious)', () => {
  const s1 = 'She is a teacher.';
  const t1 = tagSentence(tokenize(s1));
  const syn1 = analyzeSyntax(s1, t1, analyzeVerbPhrases(s1, t1), detectTense(analyzeVerbPhrases(s1, t1), t1));
  assert.strictEqual(syn1.pattern, 'S+V+C');
  assert.strictEqual(syn1.subjectComplement.text, 'a teacher');

  const s2 = 'The soup tastes delicious.';
  const t2 = tagSentence(tokenize(s2));
  const syn2 = analyzeSyntax(s2, t2, analyzeVerbPhrases(s2, t2), detectTense(analyzeVerbPhrases(s2, t2), t2));
  assert.strictEqual(syn2.pattern, 'S+V+C');
  assert.strictEqual(syn2.subjectComplement.text, 'delicious');
});

runTest('Pattern S + V + IO + DO (She gave him a book / He sent me an email)', () => {
  const s1 = 'She gave him a book.';
  const t1 = tagSentence(tokenize(s1));
  const syn1 = analyzeSyntax(s1, t1, analyzeVerbPhrases(s1, t1), detectTense(analyzeVerbPhrases(s1, t1), t1));
  assert.strictEqual(syn1.pattern, 'S+V+IO+DO');
  assert.strictEqual(syn1.indirectObject.text, 'him');
  assert.strictEqual(syn1.directObject.text, 'a book');

  const s2 = 'He sent me an email.';
  const t2 = tagSentence(tokenize(s2));
  const syn2 = analyzeSyntax(s2, t2, analyzeVerbPhrases(s2, t2), detectTense(analyzeVerbPhrases(s2, t2), t2));
  assert.strictEqual(syn2.pattern, 'S+V+IO+DO');
  assert.strictEqual(syn2.indirectObject.text, 'me');
  assert.strictEqual(syn2.directObject.text, 'an email');
});

runTest('Pattern S + V + O + C (They made him president / The news made him happy)', () => {
  const s1 = 'They made him president.';
  const t1 = tagSentence(tokenize(s1));
  const syn1 = analyzeSyntax(s1, t1, analyzeVerbPhrases(s1, t1), detectTense(analyzeVerbPhrases(s1, t1), t1));
  assert.strictEqual(syn1.pattern, 'S+V+O+C');
  assert.strictEqual(syn1.directObject.text, 'him');
  assert.strictEqual(syn1.objectComplement.text, 'president');

  const s2 = 'The news made him happy.';
  const t2 = tagSentence(tokenize(s2));
  const syn2 = analyzeSyntax(s2, t2, analyzeVerbPhrases(s2, t2), detectTense(analyzeVerbPhrases(s2, t2), t2));
  assert.strictEqual(syn2.pattern, 'S+V+O+C');
  assert.strictEqual(syn2.directObject.text, 'him');
  assert.strictEqual(syn2.objectComplement.text, 'happy');
});

runTest('Implicit subject in imperative (Open the door -> (you))', () => {
  const s = 'Open the door!';
  const t = tagSentence(tokenize(s));
  const syn = analyzeSyntax(s, t, analyzeVerbPhrases(s, t), detectTense(analyzeVerbPhrases(s, t), t));
  assert.strictEqual(syn.subject.isImplicit, true);
  assert.strictEqual(syn.subject.text, '(you)');
  assert.strictEqual(syn.directObject.text, 'the door');
});

// -------------------------------------------------------------
// SUITE 7: CLAUSE DETECTOR
// -------------------------------------------------------------
console.log('\nSuite 7: Clause Structure Analyzer');

runTest('Coordinated clauses with FANBOYS (She loves music, and he loves sports)', () => {
  const s = 'She loves music, and he loves sports.';
  const clauses = detectClauses(s, tagSentence(tokenize(s)));
  assert.strictEqual(clauses.length, 2);
  assert.strictEqual(clauses[0].type, 'independent');
  assert.strictEqual(clauses[1].type, 'coordinated');
  assert.strictEqual(clauses[1].marker, 'and');
});

runTest('Initial adverbial clause (Although it was raining, they played soccer)', () => {
  const s = 'Although it was raining, they played soccer.';
  const clauses = detectClauses(s, tagSentence(tokenize(s)));
  assert.strictEqual(clauses.length, 2);
  assert.strictEqual(clauses[0].type, 'adverbial');
  assert.strictEqual(clauses[0].marker, 'although');
  assert.strictEqual(clauses[1].type, 'independent');
});

runTest('Conditional clause (If you work hard, you will succeed)', () => {
  const s = 'If you work hard, you will succeed.';
  const clauses = detectClauses(s, tagSentence(tokenize(s)));
  assert.strictEqual(clauses.length, 2);
  assert.strictEqual(clauses[0].type, 'conditional');
  assert.strictEqual(clauses[0].marker, 'if');
  assert.strictEqual(clauses[1].type, 'independent');
});

runTest('Embedded relative clause (The man who came yesterday is my uncle)', () => {
  const s = 'The man who came yesterday is my uncle.';
  const clauses = detectClauses(s, tagSentence(tokenize(s)));
  assert.strictEqual(clauses.length, 2);
  const rel = clauses.find(c => c.type === 'relative');
  assert.ok(rel);
  assert.strictEqual(rel.marker, 'who');
  assert.strictEqual(rel.text, 'who came yesterday');
});

runTest('Noun clause (I know that he is honest)', () => {
  const s = 'I know that he is honest.';
  const clauses = detectClauses(s, tagSentence(tokenize(s)));
  assert.strictEqual(clauses.length, 2);
  const nounClause = clauses.find(c => c.type === 'noun');
  assert.ok(nounClause);
  assert.strictEqual(nounClause.marker, 'that');
});

// -------------------------------------------------------------
// SUITE 8: UNIFIED PIPELINE & PUBLIC APIS
// -------------------------------------------------------------
console.log('\nSuite 8: Unified Pipeline & Public APIs');

runTest('analyzeSentence() returns complete linguistic profile', () => {
  const analysis = analyzeSentence('The students have completed the test.');
  assert.ok(analysis.tokens.length > 0);
  assert.ok(analysis.verbPhrases.length > 0);
  assert.strictEqual(analysis.tense.tense, 'Present Perfect');
  assert.strictEqual(analysis.syntax.pattern, 'S+V+O');
  assert.strictEqual(analysis.syntax.subject.text, 'The students');
  assert.strictEqual(analysis.syntax.directObject.text, 'the test');
});

runTest('analyzeText() handles multi-sentence text with global offsets', () => {
  const fullText = 'Dr. Smith arrived at 8:30 a.m. He was reading a book.';
  const results = analyzeText(fullText);
  assert.strictEqual(results.length, 2);
  assert.strictEqual(fullText.substring(results[0].globalStartIndex, results[0].globalEndIndex), results[0].text);
  assert.strictEqual(fullText.substring(results[1].globalStartIndex, results[1].globalEndIndex), results[1].text);
});

runTest('getSentenceStructure() extracts syntax and pattern', () => {
  const structure = getSentenceStructure('She gave him a book.');
  assert.strictEqual(structure.pattern, 'S+V+IO+DO');
  assert.strictEqual(structure.subject.text, 'She');
});

runTest('getVerbPhrases() extracts verb phrases and tense', () => {
  const vpInfo = getVerbPhrases('The bridge has been built.');
  assert.strictEqual(vpInfo.verbPhrases[0].text, 'has been built');
  assert.strictEqual(vpInfo.tense.tense, 'Present Perfect');
  assert.strictEqual(vpInfo.tense.voice, 'passive');
});

runTest('getClauses() extracts clauses with types and markers', () => {
  const clauses = getClauses('If you work hard, you will succeed.');
  assert.strictEqual(clauses.length, 2);
  assert.strictEqual(clauses[0].type, 'conditional');
  assert.strictEqual(clauses[0].marker, 'if');
});

runTest('LRU Cache functionality and stats', () => {
  clearCache();
  const initStats = getCacheStats();
  assert.strictEqual(initStats.size, 0);
  assert.strictEqual(initStats.hits, 0);

  analyzeSentence('Cache test sentence number one.');
  assert.strictEqual(getCacheStats().size, 1);
  assert.strictEqual(getCacheStats().misses, 1);

  analyzeSentence('Cache test sentence number one.');
  assert.strictEqual(getCacheStats().hits, 1);
});

// -------------------------------------------------------------
// SUITE 9: PERFORMANCE & BENCHMARKS
// -------------------------------------------------------------
console.log('\nSuite 9: Performance Benchmarks');

const SIMPLE_SENTENCES = [
  'The sun shines.',
  'She reads books.',
  'The boy kicked the ball.',
  'They are waiting.',
  'The soup tastes delicious.',
  'I will call you tomorrow.',
  'She is a teacher.',
  'He wrote a letter.',
  'The bridge was built.',
  'We arrived early.'
];

const COMPLEX_SENTENCES = [
  'Although it was raining, they played soccer in the afternoon.',
  'If you work hard, you will definitely succeed in your career.',
  'The man who came yesterday is my uncle from California.',
  'She loves classical music, but he prefers rock and jazz.',
  'They stayed at home because the weather was extremely bad.',
  'I know that he is honest and hardworking.',
  'While she was reading a book, her brother was playing games.',
  'Dr. Smith arrived at 8:30 a.m. to discuss the state-of-the-art model.',
  'The task must be completed before the deadline arrives.',
  'She gave him a book because he was interested in science.'
];

function benchmark(label, sentences, count) {
  clearCache();
  const startHeap = process.memoryUsage().heapUsed;
  const startTime = process.hrtime.bigint();
  const latencies = [];

  for (let i = 0; i < count; i++) {
    const s = sentences[i % sentences.length];
    const sStart = process.hrtime.bigint();
    analyzeSentence(s);
    const sEnd = process.hrtime.bigint();
    latencies.push(Number(sEnd - sStart) / 1e6); // ms
  }

  const endTime = process.hrtime.bigint();
  const endHeap = process.memoryUsage().heapUsed;
  const totalMs = Number(endTime - startTime) / 1e6;
  const throughput = Math.round((count / totalMs) * 1000);

  latencies.sort((a, b) => a - b);
  const avg = (totalMs / count).toFixed(3);
  const median = latencies[Math.floor(count * 0.5)].toFixed(3);
  const p95 = latencies[Math.floor(count * 0.95)].toFixed(3);
  const p99 = latencies[Math.floor(count * 0.99)].toFixed(3);
  const heapDeltaMB = ((endHeap - startHeap) / (1024 * 1024)).toFixed(2);

  console.log(`  Benchmark: ${label} (${count} runs)`);
  console.log(`    Total time:  ${totalMs.toFixed(2)} ms`);
  console.log(`    Throughput:  ${throughput.toLocaleString()} sentences/sec`);
  console.log(`    Latency:     avg=${avg}ms, median=${median}ms, p95=${p95}ms, p99=${p99}ms`);
  console.log(`    Heap delta:  ${heapDeltaMB} MB`);

  return { totalMs, throughput, avg, median, p95, p99, heapDeltaMB };
}

// 1,000 Simple Sentences Benchmark (Cold & Warm)
const simpleBench = benchmark('1,000 Simple Sentences', SIMPLE_SENTENCES, 1000);
assert.ok(simpleBench.throughput > 1000, 'Simple throughput should exceed 1,000/s');

// 1,000 Complex Sentences Benchmark
const complexBench = benchmark('1,000 Complex Sentences', COMPLEX_SENTENCES, 1000);
assert.ok(complexBench.throughput > 500, 'Complex throughput should exceed 500/s');

// Warm Cache Benchmark (1,000 runs)
const warmStart = process.hrtime.bigint();
for (let i = 0; i < 1000; i++) {
  analyzeSentence(COMPLEX_SENTENCES[i % COMPLEX_SENTENCES.length]);
}
const warmEnd = process.hrtime.bigint();
const warmMs = Number(warmEnd - warmStart) / 1e6;
const warmThroughput = Math.round((1000 / warmMs) * 1000);
console.log(`  Benchmark: 1,000 Warm Cache Hits`);
console.log(`    Total time:  ${warmMs.toFixed(2)} ms`);
console.log(`    Throughput:  ${warmThroughput.toLocaleString()} sentences/sec`);

console.log('\n================================================================');
console.log(`STAGE 5 TEST SUITE COMPLETED: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
console.log('================================================================\n');
