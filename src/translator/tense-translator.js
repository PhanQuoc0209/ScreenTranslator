/**
 * Offline Tense, Aspect, Voice, and Mood Translator.
 * Deterministically applies Vietnamese grammatical particles without mechanical over-insertion:
 * - Present Continuous: 'đang'
 * - Present Perfect: 'đã'
 * - Past Simple / Past Perfect: 'đã'
 * - Future Simple: 'sẽ'
 * - Passive Voice: 'được' (or 'bị' for adverse events)
 * - Negation: 'không' / 'chưa'
 * - Imperatives: 'hãy' / 'xin hãy'
 * - Questions: 'có ... không?' / WH question particles ('ở đâu', 'gì', 'khi nào', 'tại sao')
 */

const { translateWord, CORE_LEXICON_PREFERENCES } = require('./word-translator');
const { CANONICAL_PHRASES } = require('./phrase-translator');

const MODAL_TRANSLATIONS = {
  'will': 'sẽ',
  'shall': 'sẽ',
  'can': 'có thể',
  'could': 'có thể',
  'must': 'phải',
  'should': 'nên',
  'may': 'có thể',
  'might': 'có thể',
  'would': 'sẽ'
};

// Adverse verbs that take 'bị' in passive voice rather than 'được'
const ADVERSE_VERBS = new Set([
  'punish', 'kill', 'damage', 'destroy', 'fine', 'criticize', 'arrest', 'scold', 'hit', 'hurt', 'injure', 'steal', 'break'
]);

/**
 * Translate verb phrase incorporating tense, aspect, voice, and negation.
 * @param {Object} verbPhrase Verb phrase object from analyzeVerbPhrases
 * @param {Object} tenseInfo Tense object from detectTense
 * @param {Object} [options]
 * @returns {Object} Translated verb phrase components
 */
function translateVerbPhrase(verbPhrase, tenseInfo, options = {}) {
  if (!verbPhrase) {
    return {
      translated: '',
      prefix: '',
      headVerb: '',
      isPassive: false,
      isNegative: false
    };
  }

  const isPassive = (tenseInfo && tenseInfo.voice === 'passive') || verbPhrase.voice === 'passive';
  const isNegative = (tenseInfo && tenseInfo.negation) || verbPhrase.negation;
  const tense = (tenseInfo && tenseInfo.tense) || 'Present Simple';
  const aspect = (tenseInfo && tenseInfo.aspect) || verbPhrase.aspect || 'simple';
  const sentenceType = (tenseInfo && tenseInfo.sentenceType) || 'declarative';

  // 1. Determine base translated verb / phrasal verb
  let verbGloss = '';
  const headTok = verbPhrase.headVerb;
  const headLemma = headTok ? headTok.lemma : '';

  if (verbPhrase.isPhrasalVerb && verbPhrase.phrasalVerbName) {
    const pName = verbPhrase.phrasalVerbName.toLowerCase().trim();
    verbGloss = CANONICAL_PHRASES[pName] || CANONICAL_PHRASES[verbPhrase.headVerb.lemma] || pName;
  } else if (headLemma) {
    // Special handling for linking verb 'be'
    if (headLemma === 'be') {
      if (options.isLinkingNoun) {
        verbGloss = 'là';
      } else if (options.isLinkingAdj) {
        verbGloss = 'thì'; // or omitted in Vietnamese, e.g. "thì thú vị" or "rất"
      } else {
        verbGloss = 'là';
      }
    } else if (headLemma === 'taste') {
      verbGloss = 'có vị';
    } else if (CORE_LEXICON_PREFERENCES[headLemma] && CORE_LEXICON_PREFERENCES[headLemma].pos === 'VERB') {
      verbGloss = CORE_LEXICON_PREFERENCES[headLemma].gloss;
    } else {
      const vWordRes = translateWord(headTok ? { text: headTok.text, cleanWord: headTok.cleanWord, lemma: headLemma, pos: 'VERB' } : headLemma, { pos: 'VERB' });
      verbGloss = vWordRes.translated;
    }
  }

  // 2. Modals (can, could, must, should, may, will...)
  let modalParticle = '';
  if (verbPhrase.modal && MODAL_TRANSLATIONS[verbPhrase.modal.toLowerCase()]) {
    modalParticle = MODAL_TRANSLATIONS[verbPhrase.modal.toLowerCase()];
  }

  // 3. Tense / Aspect Particles
  let tenseParticle = '';
  if (modalParticle) {
    // Modal already conveys future/mood (e.g. "sẽ", "có thể", "phải", "nên")
    tenseParticle = modalParticle;
  } else if (tense === 'Present Continuous') {
    tenseParticle = 'đang';
  } else if (tense === 'Past Continuous') {
    tenseParticle = 'đang';
  } else if (tense === 'Future Simple') {
    tenseParticle = 'sẽ';
  } else if (tense === 'Future Continuous') {
    tenseParticle = 'sẽ đang';
  } else if (tense === 'Future Perfect' || tense === 'Future Perfect Continuous') {
    tenseParticle = 'sẽ';
  } else if (tense === 'Present Perfect' || tense === 'Present Perfect Continuous') {
    tenseParticle = isNegative ? '' : 'đã';
  } else if (tense === 'Past Simple' || tense === 'Past Perfect' || tense === 'Past Perfect Continuous') {
    tenseParticle = isNegative ? '' : 'đã';
  } else {
    // Present Simple: natural Vietnamese does not require a time particle
    tenseParticle = '';
  }

  // 4. Voice Particle (Passive: 'được' or 'bị')
  let voiceParticle = '';
  if (isPassive) {
    const isAdverse = ADVERSE_VERBS.has(headLemma);
    voiceParticle = isAdverse ? 'bị' : 'được';
  }

  // 5. Negation Particle ('không' or 'chưa')
  let negationParticle = '';
  if (isNegative) {
    if (tense.startsWith('Present Perfect') && !verbPhrase.negationWord?.includes('never')) {
      negationParticle = 'chưa';
    } else {
      negationParticle = 'không';
    }
  }

  // 6. Assemble verb phrase string
  const vpParts = [];
  if (tenseParticle && !isNegative) {
    vpParts.push(tenseParticle);
  }
  if (isNegative) {
    if (tenseParticle === 'đã' || tenseParticle === 'sẽ') {
      vpParts.push(tenseParticle);
    }
    vpParts.push(negationParticle);
  }
  if (voiceParticle) {
    vpParts.push(voiceParticle);
  }
  if (verbGloss) {
    vpParts.push(verbGloss);
  }

  return {
    translated: vpParts.join(' ').replace(/\s+/g, ' ').trim(),
    verbGloss,
    tenseParticle,
    voiceParticle,
    negationParticle,
    isPassive,
    isNegative,
    isImperative: sentenceType === 'imperative',
    isQuestion: sentenceType === 'interrogative'
  };
}

module.exports = {
  translateVerbPhrase,
  MODAL_TRANSLATIONS,
  ADVERSE_VERBS
};
