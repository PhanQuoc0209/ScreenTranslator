/**
 * Offline English Verb Phrase Analyzer.
 * Extracts verb clusters, auxiliaries, modals, negations, main verbs,
 * phrasal verbs, voice, aspect, infinitives, and gerunds with exact character offsets.
 */

const { AUX_BE, AUX_HAVE, AUX_DO, MODALS } = require('./pos-tagger');
const { IRREGULAR_FORMS } = require('../dictionary/irregular-forms');
const { matchPhrases } = require('../dictionary/phrase-matcher');

/**
 * Determine verb form: 'base' | 'past' | 'past_participle' | 'present_participle' | 'third_person_singular'
 * @param {Object} token Tagged token
 * @param {boolean} hasAuxHave Preceded by have/has/had
 * @param {boolean} hasAuxBe Preceded by be/am/is/are/was/were/been/being
 * @returns {string}
 */
function getVerbForm(token, hasAuxHave = false, hasAuxBe = false) {
  const clean = token.cleanWord;
  if (!clean) return 'base';

  if (clean.endsWith('ing')) {
    return 'present_participle';
  }

  const irreg = IRREGULAR_FORMS[clean];
  if (irreg && irreg.some(x => x.pos === 'V')) {
    const vEntry = irreg.find(x => x.pos === 'V');
    if (vEntry.category === 'past_participle') return 'past_participle';
    if (vEntry.category === 'past') {
      return (hasAuxHave || hasAuxBe) ? 'past_participle' : 'past';
    }
    if (vEntry.category === 'present_singular') return 'third_person_singular';
    if (vEntry.category === 'base_or_past') {
      return (hasAuxHave || hasAuxBe) ? 'past_participle' : 'base';
    }
  }

  if (clean.endsWith('ed')) {
    return (hasAuxHave || hasAuxBe) ? 'past_participle' : 'past';
  }

  if (/(?:[s|z|x|ch|sh]es|[b-df-hj-np-tv-z]ies|[a-z]s)$/.test(clean) && !clean.endsWith('ss')) {
    if (token.lemma && !token.lemma.endsWith('s')) {
      return 'third_person_singular';
    }
  }

  return 'base';
}

/**
 * Check if token is a negation marker.
 * @param {Object} token
 * @returns {boolean}
 */
function isNegationToken(token) {
  if (!token) return false;
  if (token.cleanWord === 'not' || token.cleanWord === 'never') return true;
  if (token.contraction && token.contraction.suffix === "n't") return true;
  return false;
}

/**
 * Analyze verb phrases in a sentence.
 * @param {string} sentenceText Full sentence string
 * @param {Array<Object>} taggedTokens Tokens from tagSentence
 * @returns {Array<Object>} Array of verb phrase descriptors
 */
function analyzeVerbPhrases(sentenceText, taggedTokens) {
  if (!Array.isArray(taggedTokens) || taggedTokens.length === 0) {
    return [];
  }

  // Pre-calculate phrasal verb matches in this sentence
  let phraseMatches = [];
  try {
    phraseMatches = matchPhrases(sentenceText).filter(m => m.matchType === 'phrasal_verb' || m.matchType === 'idiom');
  } catch (err) {
    phraseMatches = [];
  }

  const verbPhrases = [];
  const consumedTokenIndices = new Set();

  for (let i = 0; i < taggedTokens.length; i++) {
    if (consumedTokenIndices.has(i)) continue;

    const tok = taggedTokens[i];

    // 1. Check for Infinitive: "to" + base verb (e.g. "to learn", "to be evaluated")
    if (tok.cleanWord === 'to' && i + 1 < taggedTokens.length) {
      // Find following verb skipping adverbs (e.g. "to quickly learn")
      let vIdx = i + 1;
      const advs = [];
      while (vIdx < taggedTokens.length && taggedTokens[vIdx].pos === 'ADVERB') {
        advs.push(taggedTokens[vIdx]);
        vIdx++;
      }

      if (vIdx < taggedTokens.length) {
        const targetTok = taggedTokens[vIdx];
        if (targetTok.pos === 'VERB' || targetTok.pos === 'AUXILIARY') {
          // Check if passive infinitive: "to be evaluated"
          let isPassiveInf = false;
          let passiveHead = null;
          let lastIdx = vIdx;

          if (targetTok.cleanWord === 'be' && vIdx + 1 < taggedTokens.length && taggedTokens[vIdx + 1].pos === 'VERB') {
            isPassiveInf = true;
            passiveHead = taggedTokens[vIdx + 1];
            lastIdx = vIdx + 1;
          }

          const head = passiveHead || targetTok;
          const vpStart = tok.startIndex;
          const vpEnd = taggedTokens[lastIdx].endIndex;

          verbPhrases.push({
            text: sentenceText.substring(vpStart, vpEnd),
            startIndex: vpStart,
            endIndex: vpEnd,
            type: 'infinitive',
            isInfinitive: true,
            isPassive: isPassiveInf,
            voice: isPassiveInf ? 'passive' : 'active',
            negation: false,
            modal: null,
            auxiliaries: isPassiveInf ? ['be'] : [],
            headVerb: {
              text: head.text,
              cleanWord: head.cleanWord,
              lemma: head.lemma || head.cleanWord,
              form: isPassiveInf ? 'past_participle' : 'base',
              startIndex: head.startIndex,
              endIndex: head.endIndex
            },
            tokens: taggedTokens.slice(i, lastIdx + 1)
          });

          for (let k = i; k <= lastIdx; k++) {
            consumedTokenIndices.add(k);
          }
          continue;
        }
      }
    }

    // 2. Check for Gerund or Participle standing alone (e.g. after preposition or beginning clause)
    if (tok.pos === 'VERB' && tok.cleanWord.endsWith('ing')) {
      const prevTok = i > 0 ? taggedTokens[i - 1] : null;
      // If NOT preceded by AUX_BE, this is non-finite (gerund or participle)
      const isPrecededByAuxBe = prevTok && (AUX_BE.has(prevTok.cleanWord) || (prevTok.contraction && AUX_BE.has(prevTok.contraction.stem)));

      if (!isPrecededByAuxBe) {
        const isAfterPrep = prevTok && prevTok.pos === 'PREPOSITION';
        const type = isAfterPrep ? 'gerund' : 'participle';

        verbPhrases.push({
          text: tok.text,
          startIndex: tok.startIndex,
          endIndex: tok.endIndex,
          type,
          isGerund: type === 'gerund',
          isParticiple: type === 'participle',
          voice: 'active',
          negation: false,
          modal: null,
          auxiliaries: [],
          headVerb: {
            text: tok.text,
            cleanWord: tok.cleanWord,
            lemma: tok.lemma || tok.cleanWord,
            form: 'present_participle',
            startIndex: tok.startIndex,
            endIndex: tok.endIndex
          },
          tokens: [tok]
        });
        consumedTokenIndices.add(i);
        continue;
      }
    }

    // 3. Finite Verb Phrase (Modal, Auxiliary, or finite Main Verb)
    const isModal = tok.pos === 'MODAL';
    const isAux = tok.pos === 'AUXILIARY';
    const isVerb = tok.pos === 'VERB';

    if (isModal || isAux || isVerb) {
      let vpStartIndex = tok.startIndex;
      let modalName = null;
      const auxNames = [];
      let hasNegation = false;
      let negWord = null;
      const clusterTokens = [tok];

      if (isNegationToken(tok)) {
        hasNegation = true;
        negWord = tok.cleanWord;
      }

      if (isModal) {
        modalName = tok.cleanWord;
      } else if (isAux) {
        const stem = (tok.contraction && tok.contraction.stem) || tok.cleanWord;
        auxNames.push(stem);
      }

      let headToken = (isVerb && !isAux) ? tok : null;
      let lastToken = tok;
      let invertedSubject = null;

      // Scan forward for auxiliary chain, negation, adverbs, and main verb (only if started with modal/aux)
      let curr = i + 1;
      if (isModal || isAux) {
        while (curr < taggedTokens.length) {
          const nextTok = taggedTokens[curr];

          if (isNegationToken(nextTok)) {
            hasNegation = true;
            negWord = nextTok.cleanWord;
            clusterTokens.push(nextTok);
            lastToken = nextTok;
            curr++;
            continue;
          }

          if (nextTok.pos === 'ADVERB') {
            clusterTokens.push(nextTok);
            lastToken = nextTok;
            curr++;
            continue;
          }

          if (nextTok.pos === 'AUXILIARY') {
            const stem = (nextTok.contraction && nextTok.contraction.stem) || nextTok.cleanWord;
            // If we already have a modal or auxiliary, and nextTok is do/did/done/does,
            // it functions as the lexical main verb (e.g. "should not do", "have done"), not an auxiliary!
            if ((isModal || auxNames.length > 0) && (stem === 'do' || stem === 'did' || stem === 'done' || stem === 'does')) {
              headToken = {
                ...nextTok,
                pos: 'VERB',
                lemma: 'do'
              };
              clusterTokens.push(nextTok);
              lastToken = nextTok;
              curr++;
              break;
            }
            auxNames.push(stem);
            clusterTokens.push(nextTok);
            lastToken = nextTok;
            curr++;
            continue;
          }

          // Check for inverted subject in questions: e.g. "Did [you] see", "Are [they] reading"
          if (!invertedSubject && (nextTok.pos === 'PRONOUN' || nextTok.pos === 'NOUN' || nextTok.pos === 'DETERMINER')) {
            let sEnd = curr;
            while (sEnd < taggedTokens.length && (taggedTokens[sEnd].pos === 'NOUN' || taggedTokens[sEnd].pos === 'DETERMINER' || taggedTokens[sEnd].pos === 'ADJECTIVE' || taggedTokens[sEnd].pos === 'PRONOUN')) {
              sEnd++;
            }
            if (sEnd < taggedTokens.length && (taggedTokens[sEnd].pos === 'VERB' || taggedTokens[sEnd].pos === 'AUXILIARY')) {
              invertedSubject = {
                text: sentenceText.substring(nextTok.startIndex, taggedTokens[sEnd - 1].endIndex),
                tokens: taggedTokens.slice(curr, sEnd),
                startIndex: nextTok.startIndex,
                endIndex: taggedTokens[sEnd - 1].endIndex
              };
              curr = sEnd;
              continue;
            }
          }

          if (nextTok.pos === 'VERB') {
            headToken = nextTok;
            clusterTokens.push(nextTok);
            lastToken = nextTok;
            curr++;
            break; // Head verb found
          }

          break;
        }
      }

      // If no separate main verb was found, the auxiliary itself acts as the main verb
      // e.g. "She is happy.", "He has a car.", "They did their homework."
      if (!headToken) {
        headToken = tok;
      }

      // Check for Phrasal Verb match overlapping headToken
      let phrasalMatch = null;
      if (headToken) {
        phrasalMatch = phraseMatches.find(m => headToken.startIndex >= m.startIndex && headToken.startIndex < m.endIndex);
      }

      let vpEndIndex = lastToken.endIndex;
      let phrasalName = null;
      if (phrasalMatch && phrasalMatch.endIndex > vpEndIndex) {
        vpEndIndex = phrasalMatch.endIndex;
        phrasalName = phrasalMatch.word || phrasalMatch.originalText;
        // Include any remaining tokens in phrasal verb
        while (curr < taggedTokens.length && taggedTokens[curr].endIndex <= vpEndIndex) {
          clusterTokens.push(taggedTokens[curr]);
          curr++;
        }
      }

      // Determine voice: passive if be + separate lexical past_participle (be itself cannot be passive)
      const hasAuxBe = auxNames.some(a => AUX_BE.has(a));
      const hasAuxHave = auxNames.some(a => AUX_HAVE.has(a));
      const headForm = getVerbForm(headToken, hasAuxHave, hasAuxBe);

      const isPassive = hasAuxBe && !AUX_BE.has(headToken.cleanWord) && (headForm === 'past_participle' || (headToken.pos === 'VERB' && (headToken.cleanWord.endsWith('ed') || (IRREGULAR_FORMS[headToken.cleanWord] && IRREGULAR_FORMS[headToken.cleanWord].some(x => x.category === 'past_participle')))));

      // Determine aspect
      let aspect = 'simple';
      if (hasAuxHave && hasAuxBe && headForm === 'present_participle') {
        aspect = 'perfect_continuous';
      } else if (hasAuxHave && isPassive) {
        aspect = 'perfect';
      } else if (hasAuxHave && !hasAuxBe && (headForm === 'past_participle' || headToken.cleanWord.endsWith('ed'))) {
        aspect = 'perfect';
      } else if (hasAuxBe && (headForm === 'present_participle' || auxNames.includes('being'))) {
        aspect = 'continuous';
      }

      verbPhrases.push({
        text: sentenceText.substring(vpStartIndex, vpEndIndex),
        startIndex: vpStartIndex,
        endIndex: vpEndIndex,
        type: 'finite',
        isFinite: true,
        invertedSubject,
        isPhrasalVerb: Boolean(phrasalMatch),
        phrasalVerbName: phrasalName,
        modal: modalName,
        auxiliaries: auxNames,
        negation: hasNegation,
        negationWord: negWord,
        voice: isPassive ? 'passive' : 'active',
        aspect,
        headVerb: {
          text: headToken.text,
          cleanWord: headToken.cleanWord,
          lemma: headToken.lemma || headToken.cleanWord,
          form: headForm,
          startIndex: headToken.startIndex,
          endIndex: headToken.endIndex
        },
        tokens: clusterTokens
      });

      for (const ct of clusterTokens) {
        const ctIdx = taggedTokens.indexOf(ct);
        if (ctIdx !== -1) consumedTokenIndices.add(ctIdx);
      }
      i = curr - 1;
    }
  }

  // Detect verb chains: e.g. "wants to learn", "started crying"
  for (let j = 0; j < verbPhrases.length - 1; j++) {
    const vp1 = verbPhrases[j];
    const vp2 = verbPhrases[j + 1];
    if (vp1.type === 'finite' && (vp2.type === 'infinitive' || vp2.type === 'gerund')) {
      const gapText = sentenceText.substring(vp1.endIndex, vp2.startIndex).trim();
      if (gapText === '' || /^(?:him|her|me|us|them|you|it)$/i.test(gapText)) {
        vp1.isVerbChain = true;
        vp1.verbChainNext = vp2;
      }
    }
  }

  return verbPhrases;
}

module.exports = {
  analyzeVerbPhrases,
  getVerbForm,
  isNegationToken
};
