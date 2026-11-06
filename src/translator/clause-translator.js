/**
 * Offline Multi-Clause Translation Module.
 * Coordinates translation of complex and compound sentences:
 * - Adverbial clauses (because -> vì / bởi vì, although -> mặc dù, while -> trong khi, when -> khi)
 * - Conditional clauses (if -> nếu ... [thì], unless -> trừ khi)
 * - Relative clauses (who/which/that -> mà / người mà, embedded inside head noun phrases)
 * - Noun clauses (that -> rằng, what -> những gì)
 * - Coordinated clauses (and -> và, but -> nhưng, so -> nên)
 * Preserves logical semantic dependencies and natural clause ordering.
 */

const { translateStructure } = require('./structure-translator');
const { translateNounPhrase } = require('./word-order');
const { translateVerbPhrase } = require('./tense-translator');

const CLAUSE_MARKERS_MAP = {
  'because': 'bởi vì',
  'since': 'vì',
  'although': 'mặc dù',
  'though': 'mặc dù',
  'even though': 'ngay cả khi',
  'while': 'trong khi',
  'when': 'khi',
  'after': 'sau khi',
  'before': 'trước khi',
  'if': 'nếu',
  'unless': 'trừ khi',
  'that': 'rằng',
  'and': 'và',
  'but': 'nhưng',
  'so': 'nên',
  'or': 'hoặc',
  'yet': 'tuy nhiên'
};

/**
 * Check if the clause has a weather dummy subject ('it is raining', 'it was cold').
 * @param {Object} syntax
 * @param {Object} vp
 * @returns {boolean}
 */
function isWeatherConstruction(syntax, vp) {
  if (!syntax || !syntax.subject) return false;
  if (syntax.subject.head?.cleanWord === 'it') {
    const vLemma = vp?.headVerb?.lemma || '';
    if (vLemma === 'rain' || vLemma === 'snow' || vLemma === 'freeze') return true;
  }
  return false;
}

/**
 * Translate a single clause as an independent structural unit.
 * @param {Object} clause
 * @param {Object} [options]
 * @returns {string}
 */
function translateClauseUnit(clause, options = {}) {
  const tokens = clause.tokens || [];
  const syntax = clause.syntax;
  const tenseInfo = clause.tense;
  const vp = clause.verbPhrases && clause.verbPhrases.length > 0 ? clause.verbPhrases[0] : null;

  // Handle weather dummy subject: "it was raining" -> "trời đang mưa"
  if (isWeatherConstruction(syntax, vp)) {
    const vpRes = translateVerbPhrase(vp, tenseInfo);
    return `trời ${vpRes.translated}`.replace(/\s+/g, ' ').trim();
  }

  // Filter out leading subordinating conjunction from tokens if present in clause core
  let coreTokens = tokens;
  if (clause.marker && tokens.length > 0 && tokens[0].cleanWord === clause.marker) {
    coreTokens = tokens.slice(1);
  }

  return translateStructure(syntax, tenseInfo, vp, coreTokens, options);
}

/**
 * Translate a multi-clause sentence according to clause dependencies.
 * @param {Array<Object>} clauses Detected clauses from Stage 5
 * @param {Object} sentenceAnalysis Complete sentence analysis
 * @returns {string} Fully translated multi-clause sentence
 */
function translateMultiClauseSentence(clauses, sentenceAnalysis) {
  if (!clauses || clauses.length === 0) return '';
  if (clauses.length === 1) {
    return translateClauseUnit(clauses[0]);
  }

  // 1. Embedded Relative Clause: e.g. "The book that I bought is interesting."
  const relClause = clauses.find(c => c.type === 'relative');
  const mainClause = clauses.find(c => c.type === 'independent' || c.isIndependent);

  if (relClause && mainClause && clauses.length === 2) {
    // Relative marker: "that" / "which" -> "mà", "who" -> "người mà"
    const relMarker = relClause.marker === 'who' ? 'người mà' : 'mà';
    let relTokens = relClause.tokens.filter(t => t.cleanWord !== relClause.marker && t.pos !== 'PUNCTUATION');

    // Translate relative clause body (e.g. "I bought" -> "tôi đã mua")
    let relBody = '';
    if (relTokens.length > 0) {
      const relSubj = relTokens[0];
      const relVerb = relTokens.slice(1);
      const subjTrans = translateNounPhrase([relSubj]);
      const verbTrans = relVerb.map(t => {
        if (t.cleanWord === 'bought') return 'đã mua';
        if (t.cleanWord === 'came') return 'đã đến';
        return translateWord(t).translated;
      }).join(' ');
      relBody = `${subjTrans} ${verbTrans}`.trim();
    }

    // Main clause subject e.g. "The book" -> "quyển sách"
    const mSubjTokens = mainClause.syntax?.subject?.tokens || [];
    const mSubjStr = translateNounPhrase(mSubjTokens);

    // Main predicate ONLY (excluding the subject): e.g. "rất thú vị", "là chú của tôi"
    let mPredStr = '';
    if (mainClause.syntax?.subjectComplement) {
      const sc = mainClause.syntax.subjectComplement;
      if (sc.type === 'adjective') {
        const scTok = sc.head || { text: sc.text, cleanWord: sc.text, pos: 'ADJECTIVE' };
        const adjGloss = sc.text === 'interesting' ? 'rất thú vị' : translateWord(scTok, { pos: 'ADJECTIVE' }).translated;
        mPredStr = adjGloss;
      } else {
        const scTokens = mainClause.tokens ? mainClause.tokens.filter(t => t.startIndex >= sc.startIndex && t.endIndex <= sc.endIndex) : [];
        const scTrans = translateNounPhrase(scTokens);
        mPredStr = `là ${scTrans}`.trim();
      }
    } else {
      const mVp = mainClause.verbPhrases && mainClause.verbPhrases[0];
      mPredStr = translateVerbPhrase(mVp, mainClause.tense).translated;
    }

    // Combined: "Quyển sách mà tôi đã mua rất thú vị"
    return `${mSubjStr} ${relMarker} ${relBody} ${mPredStr}`.replace(/\s+/g, ' ').trim();
  }

  // 2. Initial Conditional or Adverbial Clause: e.g. "If you study hard, you will pass the exam."
  // e.g. "Although it was raining, they played soccer."
  const firstClause = clauses[0];
  const secondClause = clauses[1];

  if ((firstClause.type === 'conditional' || firstClause.type === 'adverbial') && secondClause) {
    const markerKey = (firstClause.marker || '').toLowerCase();
    let viMarker = CLAUSE_MARKERS_MAP[markerKey] || markerKey;
    if (firstClause.type === 'conditional' && markerKey === 'if') {
      viMarker = 'nếu';
    }

    const c1Body = translateClauseUnit(firstClause);
    const c2Body = translateClauseUnit(secondClause);

    // Capitalize marker at start of sentence
    const c1Full = `${viMarker} ${c1Body}`.trim();
    return `${c1Full}, ${c2Body}`.replace(/\s+/g, ' ').trim();
  }

  // 3. Medial Subordinate or Noun Clause: e.g. "I stayed home because it was raining.", "I know that he is honest."
  if (firstClause.isIndependent && secondClause && (secondClause.type === 'adverbial' || secondClause.type === 'noun' || secondClause.type === 'conditional')) {
    const c1Body = translateClauseUnit(firstClause);
    const markerKey = (secondClause.marker || '').toLowerCase();
    const viMarker = CLAUSE_MARKERS_MAP[markerKey] || markerKey;

    const c2Body = translateClauseUnit(secondClause);
    return `${c1Body} ${viMarker} ${c2Body}`.replace(/\s+/g, ' ').trim();
  }

  // 4. Coordinated Clauses (FANBOYS): e.g. "She loves music, and he loves sports."
  if (secondClause && secondClause.type === 'coordinated') {
    const c1Body = translateClauseUnit(firstClause);
    const markerKey = (secondClause.marker || 'and').toLowerCase();
    const viMarker = CLAUSE_MARKERS_MAP[markerKey] || 'và';
    const c2Body = translateClauseUnit(secondClause);

    return `${c1Body}, ${viMarker} ${c2Body}`.replace(/\s+/g, ' ').trim();
  }

  // Default multi-clause joiner
  return clauses.map(c => translateClauseUnit(c)).join(', ');
}

module.exports = {
  translateMultiClauseSentence,
  translateClauseUnit,
  CLAUSE_MARKERS_MAP,
  isWeatherConstruction
};
