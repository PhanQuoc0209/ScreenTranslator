/**
 * Offline English Tense, Aspect, Voice, and Sentence Type Detector.
 * Identifies the 12 primary English tenses, active/passive voice, negation,
 * and sentence type (declarative, interrogative, imperative, exclamatory)
 * with confidence and evidence tracing.
 */

const { AUX_BE, AUX_HAVE, AUX_DO, MODALS } = require('./pos-tagger');

/**
 * Detect sentence type from tokens and punctuation.
 * @param {Array<Object>} tokens All sentence tokens
 * @param {Array<Object>} verbPhrases Detected verb phrases
 * @returns {string} 'declarative' | 'interrogative' | 'imperative' | 'exclamatory'
 */
function detectSentenceType(tokens, verbPhrases) {
  if (!tokens || tokens.length === 0) return 'declarative';

  const lastToken = tokens[tokens.length - 1];
  const lastChar = lastToken.text.slice(-1);

  if (lastChar === '?') {
    return 'interrogative';
  }

  // Check question start words even if punctuation is missing or period in OCR
  const firstWord = tokens[0].cleanWord;
  const WH_WORDS = new Set(['what', 'where', 'when', 'why', 'who', 'whom', 'whose', 'which', 'how']);
  if (WH_WORDS.has(firstWord) && tokens.length > 1) {
    const secondTok = tokens[1];
    if (secondTok.pos === 'AUXILIARY' || secondTok.pos === 'MODAL') {
      return 'interrogative';
    }
  }

  if (tokens[0].pos === 'AUXILIARY' || tokens[0].pos === 'MODAL') {
    // Subject inverted question e.g. "Did you see that?", "Are you coming?"
    if (tokens.length > 2 && (tokens[1].pos === 'PRONOUN' || tokens[1].pos === 'NOUN' || tokens[1].pos === 'DETERMINER')) {
      return 'interrogative';
    }
  }

  // Exclamatory
  if (lastChar === '!') {
    if (firstWord === 'what' || firstWord === 'how') {
      return 'exclamatory';
    }
  }

  // Imperative: Starts with base verb, no preceding subject (or after 'please')
  if (verbPhrases && verbPhrases.length > 0) {
    const firstVp = verbPhrases[0];
    const isAtStartOrAfterPlease = firstVp.startIndex === tokens[0].startIndex ||
      (tokens[0].cleanWord === 'please' && tokens.length > 1 && firstVp.startIndex === tokens[1].startIndex);
    if (isAtStartOrAfterPlease) {
      if (firstVp.headVerb && (firstVp.headVerb.form === 'base' || firstVp.headVerb.cleanWord === 'let')) {
        return 'imperative';
      }
    }
  }

  return lastChar === '!' ? 'exclamatory' : 'declarative';
}

/**
 * Detect tense, aspect, voice, and sentence type for a sentence or clause.
 * @param {Array<Object>} verbPhrases Detected verb phrases from analyzeVerbPhrases
 * @param {Array<Object>} tokens Tagged tokens
 * @returns {Object} Tense analysis result
 */
function detectTense(verbPhrases, tokens) {
  const sentenceType = detectSentenceType(tokens, verbPhrases);

  // If no finite verb phrase found
  const finiteVp = verbPhrases.find(vp => vp.type === 'finite') || verbPhrases[0];
  if (!finiteVp) {
    return {
      tense: 'UNKNOWN',
      aspect: 'simple',
      voice: 'active',
      negation: false,
      sentenceType,
      confidence: 'low',
      evidence: ['No finite verb phrase detected in clause']
    };
  }

  const evidence = [];
  let tense = 'UNKNOWN';
  let confidence = 'high';
  const voice = finiteVp.voice || 'active';
  const negation = finiteVp.negation || false;
  const aspect = finiteVp.aspect || 'simple';

  const modal = finiteVp.modal;
  const auxs = finiteVp.auxiliaries || [];
  const headForm = finiteVp.headVerb ? finiteVp.headVerb.form : 'base';
  const headClean = finiteVp.headVerb ? finiteVp.headVerb.cleanWord : '';

  if (negation) {
    evidence.push(`Negation marker present: '${finiteVp.negationWord || "n't"}'`);
  }
  if (voice === 'passive') {
    evidence.push('Passive voice: auxiliary be + past participle');
  }

  // 1. Future Tenses (will / shall)
  if (modal === 'will' || modal === 'shall') {
    evidence.push(`Future modal '${modal}' detected`);
    if (aspect === 'perfect_continuous') {
      tense = 'Future Perfect Continuous';
      evidence.push('Aspect: perfect continuous (have been + V-ing)');
    } else if (aspect === 'perfect') {
      tense = 'Future Perfect';
      evidence.push('Aspect: perfect (have + V3)');
    } else if (aspect === 'continuous') {
      tense = 'Future Continuous';
      evidence.push('Aspect: continuous (be + V-ing)');
    } else {
      tense = 'Future Simple';
      evidence.push('Aspect: simple (base verb)');
    }
  } else if (modal) {
    // Other modals: can, could, may, might, must, should, would, ought
    tense = `Modal (${modal.toUpperCase()})`;
    evidence.push(`Modal verb '${modal}' governing verb cluster`);
  } else if (auxs.includes('had')) {
    // 2. Past Perfect
    evidence.push("Auxiliary 'had' detected");
    if (aspect === 'perfect_continuous') {
      tense = 'Past Perfect Continuous';
      evidence.push('Aspect: perfect continuous (had been + V-ing)');
    } else {
      tense = 'Past Perfect';
      evidence.push('Aspect: perfect (had + V3)');
    }
  } else if (auxs.includes('was') || auxs.includes('were')) {
    // 3. Past Continuous or Past Simple Passive
    evidence.push(`Past auxiliary '${auxs.includes('was') ? 'was' : 'were'}' detected`);
    if (aspect === 'continuous') {
      tense = 'Past Continuous';
      evidence.push('Aspect: continuous (was/were + V-ing)');
    } else if (voice === 'passive') {
      tense = 'Past Simple';
      evidence.push('Past simple passive (was/were + V3)');
    } else {
      tense = 'Past Simple';
    }
  } else if (auxs.includes('did')) {
    // 4. Past Simple with Did
    tense = 'Past Simple';
    evidence.push("Auxiliary 'did' (past simple)");
  } else if (headForm === 'past') {
    // 5. Past Simple
    tense = 'Past Simple';
    evidence.push(`Main verb in past form '${headClean}'`);
  } else if (auxs.includes('have') || auxs.includes('has')) {
    // 6. Present Perfect
    const haveWord = auxs.includes('has') ? 'has' : 'have';
    evidence.push(`Present auxiliary '${haveWord}' detected`);
    if (aspect === 'perfect_continuous') {
      tense = 'Present Perfect Continuous';
      evidence.push('Aspect: perfect continuous (have/has been + V-ing)');
    } else {
      tense = 'Present Perfect';
      evidence.push('Aspect: perfect (have/has + V3)');
    }
  } else if (auxs.includes('am') || auxs.includes('is') || auxs.includes('are')) {
    // 7. Present Continuous or Present Simple Passive
    const beWord = auxs.find(a => ['am', 'is', 'are'].includes(a));
    evidence.push(`Present auxiliary '${beWord}' detected`);
    if (aspect === 'continuous') {
      tense = 'Present Continuous';
      evidence.push('Aspect: continuous (am/is/are + V-ing)');
    } else if (voice === 'passive') {
      tense = 'Present Simple';
      evidence.push('Present simple passive (am/is/are + V3)');
    } else {
      tense = 'Present Simple';
    }
  } else if (auxs.includes('do') || auxs.includes('does')) {
    // 8. Present Simple with Do/Does
    tense = 'Present Simple';
    evidence.push("Auxiliary 'do/does' (present simple)");
  } else if (headForm === 'third_person_singular') {
    // 9. Present Simple 3sg
    tense = 'Present Simple';
    evidence.push(`Main verb in 3rd person singular present form '${headClean}'`);
  } else if (headForm === 'base') {
    // 10. Present Simple base
    tense = 'Present Simple';
    evidence.push(`Main verb in base present form '${headClean}'`);
  } else {
    tense = 'Present Simple';
    confidence = 'medium';
    evidence.push(`Inferred default present simple for '${headClean}'`);
  }

  return {
    tense,
    aspect,
    voice,
    negation,
    sentenceType,
    confidence,
    evidence
  };
}

module.exports = {
  detectTense,
  detectSentenceType
};
