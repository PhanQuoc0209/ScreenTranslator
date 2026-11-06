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
  'punish', 'kill', 'damage', 'destroy', 'fine', 'criticize', 'arrest', 'scold', 'hit', 'hurt', 'injure', 'steal', 'break', 'rob', 'wound', 'abandon', 'delay', 'reject', 'lose', 'infect', 'trap'
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
    verbGloss = CANONICAL_PHRASES[pName] || CANONICAL_PHRASES[verbPhrase.headVerb?.lemma] || pName;
  } else if (headLemma) {
    // Special handling for linking verbs when followed by adjective complement
    if (options.isLinkingAdj) {
      if (headLemma === 'be') {
        verbGloss = ''; // In Vietnamese: predicative adjectives don't take copula "là" (e.g. "cô ấy bận", "anh ấy mệt mỏi")
      } else if (headLemma === 'look') {
        verbGloss = 'trông';
      } else if (headLemma === 'sound') {
        verbGloss = 'nghe có vẻ';
      } else if (headLemma === 'seem' || headLemma === 'appear') {
        verbGloss = 'có vẻ';
      } else if (headLemma === 'taste') {
        verbGloss = 'có vị';
      } else if (headLemma === 'smell') {
        verbGloss = 'có mùi';
      } else if (headLemma === 'feel') {
        verbGloss = 'cảm thấy';
      } else if (headLemma === 'become') {
        verbGloss = 'trở nên';
      }
    } else {
      if (headLemma === 'be') {
        verbGloss = options.isLinkingNoun ? 'là' : 'là';
      } else if (headLemma === 'taste') {
        verbGloss = 'có vị';
      } else if (headLemma === 'seem') {
        verbGloss = 'có vẻ';
      } else if (headLemma === 'become') {
        verbGloss = 'trở nên';
      } else if (headLemma === 'sound') {
        verbGloss = 'nghe có vẻ';
      } else if (CORE_LEXICON_PREFERENCES[headLemma] && CORE_LEXICON_PREFERENCES[headLemma].pos === 'VERB') {
        verbGloss = CORE_LEXICON_PREFERENCES[headLemma].gloss;
      } else {
        const vWordRes = translateWord(headTok ? { text: headTok.text, cleanWord: headTok.cleanWord, lemma: headLemma, pos: 'VERB' } : headLemma, { pos: 'VERB' });
        verbGloss = vWordRes.translated;
      }
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
    // For linking verb 'become', do not insert redundant 'đã'
    if (headLemma === 'become' || (headLemma === 'be' && options.isLinkingAdj)) {
      tenseParticle = '';
    } else {
      tenseParticle = isNegative ? '' : 'đã';
    }
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

  // 5. Negation Particle ('không', 'chưa', 'chưa bao giờ', 'không bao giờ')
  const isNever = (verbPhrase.negationWord && verbPhrase.negationWord.toLowerCase() === 'never') ||
                  (options.tokens && options.tokens.some(t => t.cleanWord === 'never'));

  let negationParticle = '';
  if (isNever) {
    if (tense.startsWith('Present Perfect') || tense === 'Past Simple') {
      negationParticle = 'chưa bao giờ';
    } else {
      negationParticle = 'không bao giờ';
    }
    tenseParticle = '';
  } else if (isNegative) {
    if (tense.startsWith('Present Perfect')) {
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
    if (modalParticle) {
      // In Vietnamese: "không nên", "không thể", "không phải", "sẽ không"
      if (modalParticle === 'nên') {
        vpParts.push('không nên');
      } else if (modalParticle === 'có thể') {
        vpParts.push('không thể');
      } else if (modalParticle === 'phải') {
        vpParts.push('không phải');
      } else if (modalParticle === 'sẽ') {
        vpParts.push('sẽ không');
      } else {
        vpParts.push(`không ${modalParticle}`);
      }
    } else {
      if (tenseParticle === 'đã' || tenseParticle === 'sẽ') {
        vpParts.push(tenseParticle);
      }
      if (negationParticle) {
        vpParts.push(negationParticle);
      }
    }
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
