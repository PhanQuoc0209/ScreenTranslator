/**
 * Offline English Clause Structure Analyzer.
 * Detects:
 * - Independent clauses
 * - Dependent / Subordinate clauses
 * - Relative clauses (who, whom, whose, which, that)
 * - Conditional clauses (if, unless, provided that)
 * - Noun clauses (that, what, whether, how)
 * - Adverbial clauses (because, although, while, when, since, after, before)
 * - Coordinated clauses (and, but, or, nor, yet, so)
 * with exact character offsets and clause boundary preservation.
 */

const SUBORDINATING_ADVERBIAL = {
  'because': 'reason',
  'since': 'reason_or_time',
  'although': 'concession',
  'though': 'concession',
  'even though': 'concession',
  'while': 'time_or_contrast',
  'when': 'time',
  'whenever': 'time',
  'after': 'time',
  'before': 'time',
  'as': 'time_or_reason',
  'until': 'time',
  'whereas': 'contrast',
  'so that': 'purpose'
};

const CONDITIONAL_MARKERS = new Set(['if', 'unless', 'provided that', 'as long as']);
const RELATIVE_PRONOUNS = new Set(['who', 'whom', 'whose', 'which']);
const COORDINATING = new Set(['and', 'but', 'or', 'nor', 'yet', 'so']);
const REPORTING_VERBS = new Set(['know', 'think', 'believe', 'say', 'see', 'hear', 'tell', 'hope', 'feel', 'wonder', 'notice']);

/**
 * Detect clauses in a sentence.
 * @param {string} sentenceText Full sentence string
 * @param {Array<Object>} taggedTokens Tokens from tagSentence
 * @returns {Array<Object>} Array of detected clauses with offsets and classification
 */
function detectClauses(sentenceText, taggedTokens) {
  if (!Array.isArray(taggedTokens) || taggedTokens.length === 0) return [];

  const len = taggedTokens.length;
  const nonPunctTokens = taggedTokens.filter(t => t.pos !== 'PUNCTUATION');
  if (nonPunctTokens.length === 0) return [];

  const firstTok = nonPunctTokens[0];
  const firstClean = firstTok.cleanWord;

  // 1. Initial Conditional or Subordinate clause: "If...", "Although...", "Because..."
  if (CONDITIONAL_MARKERS.has(firstClean) || SUBORDINATING_ADVERBIAL[firstClean]) {
    const isCond = CONDITIONAL_MARKERS.has(firstClean);
    let commaIdx = -1;
    for (let i = 0; i < len; i++) {
      if (taggedTokens[i].text === ',') {
        commaIdx = i;
        break;
      }
    }

    if (commaIdx !== -1 && commaIdx < len - 1) {
      const c1End = taggedTokens[commaIdx].startIndex;
      const c2Start = taggedTokens[commaIdx + 1].startIndex;
      const c2End = taggedTokens[len - 1].endIndex;

      return [
        {
          text: sentenceText.substring(0, c1End).trim(),
          startIndex: 0,
          endIndex: c1End,
          type: isCond ? 'conditional' : 'adverbial',
          clauseType: isCond ? 'conditional_clause' : 'adverbial_clause',
          subType: isCond ? 'condition' : SUBORDINATING_ADVERBIAL[firstClean],
          marker: firstClean,
          isIndependent: false,
          tokens: taggedTokens.slice(0, commaIdx)
        },
        {
          text: sentenceText.substring(c2Start, c2End).trim(),
          startIndex: c2Start,
          endIndex: c2End,
          type: 'independent',
          clauseType: 'main_clause',
          marker: null,
          isIndependent: true,
          tokens: taggedTokens.slice(commaIdx + 1)
        }
      ];
    }
  }

  // 2. Embedded Relative Clause: "The man who came yesterday is my uncle"
  for (let i = 1; i < len - 1; i++) {
    const tok = taggedTokens[i];
    const prev = taggedTokens[i - 1];
    const isRel = RELATIVE_PRONOUNS.has(tok.cleanWord) || (tok.cleanWord === 'that' && (prev.pos === 'NOUN' || prev.pos === 'PRONOUN'));

    if (isRel) {
      let relVerbFound = false;
      let relEndIdx = -1;

      for (let j = i + 1; j < len; j++) {
        if (taggedTokens[j].text === ',') {
          relEndIdx = j;
          break;
        }
        if (taggedTokens[j].pos === 'VERB' || taggedTokens[j].pos === 'AUXILIARY') {
          if (!relVerbFound) {
            relVerbFound = true;
          } else {
            // Second verb belongs to main clause
            relEndIdx = j - 1;
            break;
          }
        }
      }

      if (relVerbFound && relEndIdx !== -1) {
        const rcStart = tok.startIndex;
        const rcEnd = taggedTokens[relEndIdx].endIndex;
        const rcTokens = taggedTokens.slice(i, relEndIdx + 1);

        const relClause = {
          text: sentenceText.substring(rcStart, rcEnd).trim(),
          startIndex: rcStart,
          endIndex: rcEnd,
          type: 'relative',
          clauseType: 'relative_clause',
          marker: tok.cleanWord,
          isIndependent: false,
          tokens: rcTokens
        };

        const mainClause = {
          text: (sentenceText.substring(0, rcStart) + ' ' + sentenceText.substring(rcEnd)).replace(/\s+/g, ' ').trim(),
          startIndex: 0,
          endIndex: taggedTokens[len - 1].endIndex,
          type: 'independent',
          clauseType: 'main_clause',
          marker: null,
          isIndependent: true,
          tokens: [...taggedTokens.slice(0, i), ...taggedTokens.slice(relEndIdx + 1)]
        };

        return [mainClause, relClause];
      }
    }
  }

  // 3. Medial Subordinate or Noun Clause or Coordinated Clause
  for (let i = 1; i < len; i++) {
    const tok = taggedTokens[i];
    const clean = tok.cleanWord;
    const prevNonPunct = taggedTokens.slice(0, i).reverse().find(t => t.pos !== 'PUNCTUATION');

    // Noun clause: "I know that he is honest", "I wonder what they will do"
    if ((clean === 'that' || clean === 'what' || clean === 'whether') && prevNonPunct && (prevNonPunct.pos === 'VERB' || REPORTING_VERBS.has(prevNonPunct.lemma || prevNonPunct.cleanWord))) {
      const c1End = prevNonPunct.endIndex;
      const c2Start = tok.startIndex;
      const c2End = taggedTokens[len - 1].endIndex;

      return [
        {
          text: sentenceText.substring(0, c1End).trim(),
          startIndex: 0,
          endIndex: c1End,
          type: 'independent',
          clauseType: 'main_clause',
          marker: null,
          isIndependent: true,
          tokens: taggedTokens.slice(0, i)
        },
        {
          text: sentenceText.substring(c2Start, c2End).trim(),
          startIndex: c2Start,
          endIndex: c2End,
          type: 'noun',
          clauseType: 'noun_clause',
          marker: clean,
          isIndependent: false,
          tokens: taggedTokens.slice(i)
        }
      ];
    }

    // Medial Conditional or Adverbial: "They stayed at home because it was raining"
    if (CONDITIONAL_MARKERS.has(clean) || SUBORDINATING_ADVERBIAL[clean]) {
      const isCond = CONDITIONAL_MARKERS.has(clean);
      const c1End = (taggedTokens[i - 1].text === ',') ? taggedTokens[i - 1].startIndex : tok.startIndex;
      const c2Start = tok.startIndex;
      const c2End = taggedTokens[len - 1].endIndex;

      return [
        {
          text: sentenceText.substring(0, c1End).trim(),
          startIndex: 0,
          endIndex: c1End,
          type: 'independent',
          clauseType: 'main_clause',
          marker: null,
          isIndependent: true,
          tokens: taggedTokens.slice(0, i)
        },
        {
          text: sentenceText.substring(c2Start, c2End).trim(),
          startIndex: c2Start,
          endIndex: c2End,
          type: isCond ? 'conditional' : 'adverbial',
          clauseType: isCond ? 'conditional_clause' : 'adverbial_clause',
          subType: isCond ? 'condition' : SUBORDINATING_ADVERBIAL[clean],
          marker: clean,
          isIndependent: false,
          tokens: taggedTokens.slice(i)
        }
      ];
    }

    // Coordinated clause with FANBOYS: ", and", ", but", etc.
    if (COORDINATING.has(clean) && (taggedTokens[i - 1].text === ',' || (i > 1 && taggedTokens[i + 1] && (taggedTokens[i + 1].pos === 'PRONOUN' || taggedTokens[i + 1].pos === 'NOUN' || taggedTokens[i + 1].pos === 'DETERMINER')))) {
      const c1End = (taggedTokens[i - 1].text === ',') ? taggedTokens[i - 1].startIndex : tok.startIndex;
      const c2Start = tok.startIndex;
      const c2End = taggedTokens[len - 1].endIndex;

      return [
        {
          text: sentenceText.substring(0, c1End).trim(),
          startIndex: 0,
          endIndex: c1End,
          type: 'independent',
          clauseType: 'main_clause',
          marker: null,
          isIndependent: true,
          tokens: taggedTokens.slice(0, i)
        },
        {
          text: sentenceText.substring(c2Start, c2End).trim(),
          startIndex: c2Start,
          endIndex: c2End,
          type: 'coordinated',
          clauseType: 'coordinated_clause',
          marker: clean,
          isIndependent: true,
          tokens: taggedTokens.slice(i)
        }
      ];
    }
  }

  // 4. Default single independent clause
  return [
    {
      text: sentenceText.trim(),
      startIndex: 0,
      endIndex: sentenceText.length,
      type: 'independent',
      clauseType: 'main_clause',
      marker: null,
      isIndependent: true,
      tokens: taggedTokens
    }
  ];
}

module.exports = {
  detectClauses,
  SUBORDINATING_ADVERBIAL,
  CONDITIONAL_MARKERS,
  RELATIVE_PRONOUNS,
  COORDINATING
};
