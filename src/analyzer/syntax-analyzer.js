/**
 * Offline English Syntax & Clause Structure Analyzer.
 * Identifies:
 * - Subject (head and full phrase span, handling imperatives and interrogative inversion)
 * - Predicate (verb phrase and complement span)
 * - Direct Object (DO)
 * - Indirect Object (IO)
 * - Subject Complement (SC)
 * - Object Complement (OC)
 * - Sentence Patterns: S+V, S+V+O, S+V+C, S+V+IO+DO, S+V+O+C
 */

const LINKING_VERBS = new Set([
  'be', 'seem', 'appear', 'become', 'feel', 'look', 'smell', 'taste', 'sound', 'remain', 'stay', 'grow', 'turn'
]);

const DITRANSITIVE_VERBS = new Set([
  'give', 'tell', 'send', 'show', 'buy', 'offer', 'teach', 'lend', 'pass', 'pay', 'write', 'read', 'bring', 'award', 'hand', 'promise'
]);

const COMPLEX_TRANSITIVE_VERBS = new Set([
  'call', 'make', 'name', 'elect', 'find', 'consider', 'paint', 'keep', 'leave', 'appoint', 'prove'
]);

/**
 * Extract noun phrase starting at token index `startIndex`.
 * @param {Array<Object>} tokens
 * @param {number} startIndex
 * @returns {{ tokens: Array<Object>, head: Object, endIndex: number } | null}
 */
function extractNounPhrase(tokens, startIndex) {
  if (startIndex >= tokens.length) return null;

  let i = startIndex;
  const npTokens = [];

  // Single pronoun
  if (tokens[i].pos === 'PRONOUN') {
    return {
      tokens: [tokens[i]],
      head: tokens[i],
      startIndex: tokens[i].startIndex,
      endIndex: tokens[i].endIndex
    };
  }

  // Standalone determiners acting as pronoun (e.g. "see that", "like this", "all of us")
  if (tokens[i].pos === 'DETERMINER') {
    const nextTok = i + 1 < tokens.length ? tokens[i + 1] : null;
    if (!nextTok || nextTok.pos === 'PUNCTUATION' || nextTok.pos === 'VERB' || nextTok.pos === 'AUXILIARY' || nextTok.pos === 'PREPOSITION') {
      return {
        tokens: [tokens[i]],
        head: tokens[i],
        startIndex: tokens[i].startIndex,
        endIndex: tokens[i].endIndex
      };
    }
  }

  // Consume determiners
  if (tokens[i].pos === 'DETERMINER' || tokens[i].pos === 'NUMBER') {
    npTokens.push(tokens[i]);
    i++;
  }

  // Consume adjectives/adverbs modifying adjectives
  while (i < tokens.length && (tokens[i].pos === 'ADJECTIVE' || (tokens[i].pos === 'ADVERB' && i + 1 < tokens.length && tokens[i + 1].pos === 'ADJECTIVE'))) {
    npTokens.push(tokens[i]);
    i++;
  }

  // Consume nouns
  const nounTokens = [];
  while (i < tokens.length && (tokens[i].pos === 'NOUN' || tokens[i].pos === 'PRONOUN')) {
    nounTokens.push(tokens[i]);
    npTokens.push(tokens[i]);
    i++;
  }

  if (nounTokens.length > 0) {
    const head = nounTokens[nounTokens.length - 1];
    return {
      tokens: npTokens,
      head,
      startIndex: npTokens[0].startIndex,
      endIndex: npTokens[npTokens.length - 1].endIndex
    };
  }

  return null;
}

/**
 * Analyze the syntactic structure of a clause or sentence.
 * @param {string} sentenceText Raw text of sentence
 * @param {Array<Object>} taggedTokens Tagged tokens
 * @param {Array<Object>} verbPhrases Detected verb phrases
 * @param {Object} tenseInfo Tense information
 * @returns {Object} Full syntactic analysis with pattern, subject, DO, IO, SC, OC
 */
function analyzeSyntax(sentenceText, taggedTokens, verbPhrases, tenseInfo) {
  if (!Array.isArray(taggedTokens) || taggedTokens.length === 0) {
    return {
      pattern: 'UNKNOWN',
      subject: null,
      predicate: null,
      verb: null,
      directObject: null,
      indirectObject: null,
      subjectComplement: null,
      objectComplement: null,
      confidence: 'low'
    };
  }

  const finiteVp = (verbPhrases && verbPhrases.find(vp => vp.type === 'finite')) || (verbPhrases && verbPhrases[0]) || null;
  const sentenceType = (tenseInfo && tenseInfo.sentenceType) || 'declarative';

  let subject = null;
  let directObject = null;
  let indirectObject = null;
  let subjectComplement = null;
  let objectComplement = null;
  let pattern = 'S+V';

  // 1. Identify Subject
  if (sentenceType === 'imperative') {
    subject = {
      text: '(you)',
      isImplicit: true,
      isPronoun: true,
      head: { text: 'you', cleanWord: 'you', pos: 'PRONOUN' },
      startIndex: null,
      endIndex: null
    };
  } else if (finiteVp && finiteVp.invertedSubject) {
    // Interrogative inverted subject
    const inv = finiteVp.invertedSubject;
    const headTok = inv.tokens[inv.tokens.length - 1];
    subject = {
      text: inv.text,
      isImplicit: false,
      isPronoun: headTok.pos === 'PRONOUN',
      head: headTok,
      startIndex: inv.startIndex,
      endIndex: inv.endIndex,
      tokens: inv.tokens
    };
  } else if (finiteVp) {
    // Declarative subject: Tokens before finiteVp.startIndex
    const preTokens = taggedTokens.filter(t => t.endIndex <= finiteVp.startIndex && t.pos !== 'PUNCTUATION');
    // Skip leading conjunctions / adverbs (e.g. "However, the girl...", "And he...")
    let subjStart = 0;
    while (subjStart < preTokens.length && (preTokens[subjStart].pos === 'CONJUNCTION' || preTokens[subjStart].pos === 'ADVERB')) {
      subjStart++;
    }

    const candidateTokens = preTokens.slice(subjStart);
    if (candidateTokens.length > 0) {
      // Find head noun / pronoun (the principal noun or pronoun closest to verb)
      let headTok = null;
      for (let k = candidateTokens.length - 1; k >= 0; k--) {
        if (candidateTokens[k].pos === 'NOUN' || candidateTokens[k].pos === 'PRONOUN') {
          headTok = candidateTokens[k];
          break;
        }
      }
      if (!headTok) headTok = candidateTokens[candidateTokens.length - 1];

      subject = {
        text: sentenceText.substring(candidateTokens[0].startIndex, candidateTokens[candidateTokens.length - 1].endIndex),
        isImplicit: false,
        isPronoun: headTok.pos === 'PRONOUN',
        head: headTok,
        startIndex: candidateTokens[0].startIndex,
        endIndex: candidateTokens[candidateTokens.length - 1].endIndex,
        tokens: candidateTokens
      };
    }
  }

  // 2. Identify Predicate
  let predicate = null;
  if (finiteVp) {
    const predTokens = taggedTokens.filter(t => t.startIndex >= finiteVp.startIndex && t.pos !== 'PUNCTUATION');
    if (predTokens.length > 0) {
      predicate = {
        text: sentenceText.substring(predTokens[0].startIndex, predTokens[predTokens.length - 1].endIndex),
        startIndex: predTokens[0].startIndex,
        endIndex: predTokens[predTokens.length - 1].endIndex,
        tokens: predTokens
      };
    }
  }

  // 3. Post-Verb Complements and Objects
  if (finiteVp) {
    const lemma = (finiteVp.headVerb && finiteVp.headVerb.lemma) || '';
    const isPassive = finiteVp.voice === 'passive';

    // Find first token index after verb phrase
    let afterVerbIdx = 0;
    while (afterVerbIdx < taggedTokens.length && taggedTokens[afterVerbIdx].startIndex < finiteVp.endIndex) {
      afterVerbIdx++;
    }

    // Passive sentences generally promote DO to Subject -> pattern S + V
    if (isPassive) {
      pattern = 'S+V';
    } else if (LINKING_VERBS.has(lemma)) {
      // LINKING VERB: S + V + C
      // Find following Adjective Phrase or Noun Phrase
      if (afterVerbIdx < taggedTokens.length) {
        const nextTok = taggedTokens[afterVerbIdx];
        if (nextTok.pos === 'ADJECTIVE') {
          subjectComplement = {
            text: nextTok.text,
            type: 'adjective',
            head: nextTok,
            startIndex: nextTok.startIndex,
            endIndex: nextTok.endIndex
          };
          pattern = 'S+V+C';
        } else {
          const scNp = extractNounPhrase(taggedTokens, afterVerbIdx);
          if (scNp) {
            subjectComplement = {
              text: sentenceText.substring(scNp.startIndex, scNp.endIndex),
              type: 'noun',
              head: scNp.head,
              startIndex: scNp.startIndex,
              endIndex: scNp.endIndex
            };
            pattern = 'S+V+C';
          }
        }
      }
    } else {
      // Check for first Noun Phrase after verb
      // Skip intervening adverbs
      while (afterVerbIdx < taggedTokens.length && taggedTokens[afterVerbIdx].pos === 'ADVERB') {
        afterVerbIdx++;
      }

      const np1 = extractNounPhrase(taggedTokens, afterVerbIdx);
      if (np1) {
        // Advance index past np1
        let afterNp1Idx = afterVerbIdx;
        while (afterNp1Idx < taggedTokens.length && taggedTokens[afterNp1Idx].endIndex <= np1.endIndex) {
          afterNp1Idx++;
        }

        // Check if there is a second phrase after np1
        const np2 = extractNounPhrase(taggedTokens, afterNp1Idx);
        const adj2 = (afterNp1Idx < taggedTokens.length && taggedTokens[afterNp1Idx].pos === 'ADJECTIVE') ? taggedTokens[afterNp1Idx] : null;

        if (DITRANSITIVE_VERBS.has(lemma) && np2) {
          // Ditransitive: S + V + IO + DO
          indirectObject = {
            text: sentenceText.substring(np1.startIndex, np1.endIndex),
            head: np1.head,
            startIndex: np1.startIndex,
            endIndex: np1.endIndex
          };
          directObject = {
            text: sentenceText.substring(np2.startIndex, np2.endIndex),
            head: np2.head,
            startIndex: np2.startIndex,
            endIndex: np2.endIndex
          };
          pattern = 'S+V+IO+DO';
        } else if (COMPLEX_TRANSITIVE_VERBS.has(lemma) && (np2 || adj2)) {
          // Complex transitive: S + V + O + C
          directObject = {
            text: sentenceText.substring(np1.startIndex, np1.endIndex),
            head: np1.head,
            startIndex: np1.startIndex,
            endIndex: np1.endIndex
          };
          const compTarget = np2 || adj2;
          objectComplement = {
            text: sentenceText.substring(compTarget.startIndex, compTarget.endIndex),
            type: np2 ? 'noun' : 'adjective',
            head: np2 ? np2.head : adj2,
            startIndex: compTarget.startIndex,
            endIndex: compTarget.endIndex
          };
          pattern = 'S+V+O+C';
        } else {
          // Monotransitive: S + V + O
          directObject = {
            text: sentenceText.substring(np1.startIndex, np1.endIndex),
            head: np1.head,
            startIndex: np1.startIndex,
            endIndex: np1.endIndex
          };
          pattern = 'S+V+O';
        }
      } else {
        // No direct object NP: S + V
        pattern = 'S+V';
      }
    }
  }

  return {
    pattern,
    subject,
    predicate,
    verb: finiteVp ? {
      text: finiteVp.text,
      lemma: finiteVp.headVerb ? finiteVp.headVerb.lemma : finiteVp.text,
      startIndex: finiteVp.startIndex,
      endIndex: finiteVp.endIndex
    } : null,
    directObject,
    indirectObject,
    subjectComplement,
    objectComplement,
    confidence: 'high'
  };
}

module.exports = {
  analyzeSyntax,
  extractNounPhrase,
  LINKING_VERBS,
  DITRANSITIVE_VERBS,
  COMPLEX_TRANSITIVE_VERBS
};
