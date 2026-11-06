/**
 * Offline Sentence Structure Translator.
 * Implements deterministic translation rules for the 5 core English sentence patterns:
 * - S + V (Subject + Verb)
 * - S + V + O (Subject + Verb + Direct Object)
 * - S + V + C (Subject + Linking Verb + Subject Complement)
 * - S + V + IO + DO (Subject + Ditransitive Verb + Indirect Object + Direct Object)
 * - S + V + O + C (Subject + Complex Transitive Verb + Direct Object + Object Complement)
 * as well as Imperatives, Interrogatives (Yes/No and WH-questions), and Negation.
 */

const { translateWord, CORE_LEXICON_PREFERENCES } = require('./word-translator');
const { translateNounPhrase, translatePrepositionalPhrase } = require('./word-order');
const { translateVerbPhrase } = require('./tense-translator');

/**
 * Extract trailing prepositional phrases, time adverbs, or other modifiers not part of core DO/IO.
 * @param {Array<Object>} tokens All tokens
 * @param {number} afterCoreIndex Index after the verb or core objects
 * @returns {string} Translated trailing modifier string
 */
function translateTrailingModifiers(tokens, afterCoreIndex) {
  if (!tokens || afterCoreIndex >= tokens.length) return '';

  const trailingTokens = tokens.slice(afterCoreIndex).filter(t => t.pos !== 'PUNCTUATION');
  if (trailingTokens.length === 0) return '';

  // Check if starts with preposition
  if (trailingTokens[0].pos === 'PREPOSITION') {
    return translatePrepositionalPhrase(trailingTokens);
  }

  // Check if time expression e.g. "every day", "tomorrow", "yesterday"
  return trailingTokens.map(t => translateWord(t).translated).join(' ').trim();
}

/**
 * Translate a complete clause or simple sentence using its syntactic structure.
 * @param {Object} syntax Syntax analysis from analyzeSyntax
 * @param {Object} tenseInfo Tense analysis from detectTense
 * @param {Object} verbPhrase Verb phrase analysis from analyzeVerbPhrases
 * @param {Array<Object>} tokens Tagged tokens
 * @param {Object} [options]
 * @returns {string} Vietnamese translated clause
 */
function translateStructure(syntax, tenseInfo, verbPhrase, tokens, options = {}) {
  const pattern = (syntax && syntax.pattern) || 'S+V';
  const sentenceType = (tenseInfo && tenseInfo.sentenceType) || 'declarative';

  // 1. Check for Imperatives e.g. "Open the door!", "Please take care of my dog."
  const hasPlease = tokens && tokens.some(t => t.cleanWord === 'please');
  if (sentenceType === 'imperative' || (syntax.subject && syntax.subject.isImplicit)) {
    const impPrefix = hasPlease ? 'xin hãy' : 'hãy';
    const vpRes = translateVerbPhrase(verbPhrase, tenseInfo);

    let objStr = '';
    if (syntax.directObject) {
      const doTokens = syntax.directObject.tokens || (tokens ? tokens.filter(t => t.startIndex >= syntax.directObject.startIndex && t.endIndex <= syntax.directObject.endIndex) : []);
      objStr = translateNounPhrase(doTokens.length > 0 ? doTokens : [{ text: syntax.directObject.text, cleanWord: syntax.directObject.head?.cleanWord || syntax.directObject.text, pos: 'NOUN' }]);
    }

    const parts = [impPrefix, vpRes.verbGloss || vpRes.translated, objStr].filter(Boolean);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  // 2. Check for Interrogatives (Questions) e.g. "Did you see him?", "Where are you going?"
  if (sentenceType === 'interrogative') {
    const firstWord = tokens && tokens.length > 0 ? tokens[0].cleanWord : '';
    const WH_WORDS = {
      'where': 'đâu',
      'what': 'gì',
      'when': 'khi nào',
      'why': 'tại sao',
      'who': 'ai',
      'whom': 'ai',
      'how': 'như thế nào'
    };

    const isWh = WH_WORDS[firstWord];

    if (isWh) {
      // WH-Question: e.g. "Where are you going?" -> "Bạn đang đi đâu?"
      const subjTokens = (syntax.subject && syntax.subject.tokens) || [{ cleanWord: 'you', text: 'you', pos: 'PRONOUN' }];
      const subjStr = translateNounPhrase(subjTokens);
      const vpRes = translateVerbPhrase(verbPhrase, tenseInfo);

      let objStr = '';
      if (syntax.directObject) {
        const doTokens = syntax.directObject.tokens || (tokens ? tokens.filter(t => t.startIndex >= syntax.directObject.startIndex && t.endIndex <= syntax.directObject.endIndex) : []);
        objStr = translateNounPhrase(doTokens.length > 0 ? doTokens : [{ text: syntax.directObject.text, cleanWord: syntax.directObject.head?.cleanWord || syntax.directObject.text, pos: 'NOUN' }]);
      }

      if (firstWord === 'why') {
        return `tại sao ${subjStr} ${vpRes.translated} ${objStr}`.replace(/\s+/g, ' ').trim();
      }

      // Default WH placement: Subject + VP + [Object] + WH particle
      const parts = [subjStr, vpRes.translated, objStr, WH_WORDS[firstWord]].filter(Boolean);
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    } else {
      // Yes/No Question: e.g. "Did you see him?" -> "Bạn có thấy anh ấy không?"
      const subjTokens = (syntax.subject && syntax.subject.tokens) || [{ cleanWord: 'you', text: 'you', pos: 'PRONOUN' }];
      const subjStr = translateNounPhrase(subjTokens);
      const vpRes = translateVerbPhrase(verbPhrase, tenseInfo);

      let objStr = '';
      if (syntax.directObject) {
        const doTokens = syntax.directObject.tokens || (tokens ? tokens.filter(t => t.startIndex >= syntax.directObject.startIndex && t.endIndex <= syntax.directObject.endIndex) : []);
        objStr = translateNounPhrase(doTokens.length > 0 ? doTokens : [{ text: syntax.directObject.text, cleanWord: syntax.directObject.head?.cleanWord || syntax.directObject.text, pos: 'PRONOUN' }]);
      }

      const verbCore = vpRes.verbGloss || vpRes.translated;
      return `${subjStr} có ${verbCore} ${objStr} không`.replace(/\s+/g, ' ').trim();
    }
  }

  // 3. Declarative Sentences

  // A. Subject
  let subjStr = '';
  if (syntax.subject) {
    const sTokens = syntax.subject.tokens || (tokens ? tokens.filter(t => t.startIndex >= syntax.subject.startIndex && t.endIndex <= syntax.subject.endIndex) : []);
    subjStr = translateNounPhrase(sTokens.length > 0 ? sTokens : [{ text: syntax.subject.text, cleanWord: syntax.subject.head?.cleanWord || syntax.subject.text, pos: syntax.subject.isPronoun ? 'PRONOUN' : 'NOUN' }]);
  }

  // B. Verb Phrase
  const isLinkingNoun = Boolean(syntax.subjectComplement && syntax.subjectComplement.type === 'noun');
  const isLinkingAdj = Boolean(syntax.subjectComplement && syntax.subjectComplement.type === 'adjective');
  const vpRes = translateVerbPhrase(verbPhrase, tenseInfo, { isLinkingNoun, isLinkingAdj });

  // C. Find index after verb & core components to capture trailing modifiers
  let lastCoreIndex = 0;
  if (verbPhrase && tokens) {
    lastCoreIndex = tokens.findIndex(t => t.startIndex >= verbPhrase.endIndex);
    if (lastCoreIndex === -1) lastCoreIndex = tokens.length;
  }

  // D. Syntactic Patterns Assembly
  if (pattern === 'S+V+O') {
    // S + V + Direct Object
    let doStr = '';
    if (syntax.directObject) {
      const doTokens = syntax.directObject.tokens || (tokens ? tokens.filter(t => t.startIndex >= syntax.directObject.startIndex && t.endIndex <= syntax.directObject.endIndex) : []);
      doStr = translateNounPhrase(doTokens.length > 0 ? doTokens : [{ text: syntax.directObject.text, cleanWord: syntax.directObject.head?.cleanWord || syntax.directObject.text, pos: 'NOUN' }]);

      // Advance lastCoreIndex past direct object
      if (tokens) {
        const afterDo = tokens.findIndex(t => t.startIndex >= syntax.directObject.endIndex && t.pos !== 'PUNCTUATION');
        lastCoreIndex = afterDo !== -1 ? afterDo : tokens.length;
      }
    }

    const trailingStr = translateTrailingModifiers(tokens, lastCoreIndex);

    // E.g. "I will call you tomorrow" -> "Tôi sẽ gọi bạn vào ngày mai" / "Tôi sẽ gọi cho bạn ngày mai"
    const verbPreposition = (verbPhrase?.headVerb?.lemma === 'call' && doStr) ? 'cho' : '';
    const parts = [subjStr, vpRes.translated, verbPreposition, doStr, trailingStr].filter(Boolean);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  if (pattern === 'S+V+C') {
    // S + V + Subject Complement (Linking verbs: be, taste, seem, become)
    let scStr = '';
    if (syntax.subjectComplement) {
      if (syntax.subjectComplement.type === 'adjective') {
        const scTok = syntax.subjectComplement.head || { text: syntax.subjectComplement.text, cleanWord: syntax.subjectComplement.text, pos: 'ADJECTIVE' };
        scStr = translateWord(scTok, { pos: 'ADJECTIVE' }).translated;
      } else {
        const scTokens = tokens ? tokens.filter(t => t.startIndex >= syntax.subjectComplement.startIndex && t.endIndex <= syntax.subjectComplement.endIndex) : [];
        scStr = translateNounPhrase(scTokens.length > 0 ? scTokens : [{ text: syntax.subjectComplement.text, cleanWord: syntax.subjectComplement.text, pos: 'NOUN' }]);
      }

      if (tokens) {
        const afterSc = tokens.findIndex(t => t.startIndex >= syntax.subjectComplement.endIndex && t.pos !== 'PUNCTUATION');
        lastCoreIndex = afterSc !== -1 ? afterSc : tokens.length;
      }
    }

    const trailingStr = translateTrailingModifiers(tokens, lastCoreIndex);
    const parts = [subjStr, vpRes.translated, scStr, trailingStr].filter(Boolean);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  if (pattern === 'S+V+IO+DO') {
    // S + V + Indirect Object + Direct Object
    // English: "She gave him a book."
    // Vietnamese: "Cô ấy đã cho anh ấy một quyển sách."
    let ioStr = '';
    let doStr = '';

    if (syntax.indirectObject) {
      const ioTokens = tokens ? tokens.filter(t => t.startIndex >= syntax.indirectObject.startIndex && t.endIndex <= syntax.indirectObject.endIndex) : [];
      ioStr = translateNounPhrase(ioTokens.length > 0 ? ioTokens : [{ text: syntax.indirectObject.text, cleanWord: syntax.indirectObject.text, pos: 'PRONOUN' }]);
    }

    if (syntax.directObject) {
      const doTokens = tokens ? tokens.filter(t => t.startIndex >= syntax.directObject.startIndex && t.endIndex <= syntax.directObject.endIndex) : [];
      doStr = translateNounPhrase(doTokens.length > 0 ? doTokens : [{ text: syntax.directObject.text, cleanWord: syntax.directObject.text, pos: 'NOUN' }]);

      if (tokens) {
        const afterDo = tokens.findIndex(t => t.startIndex >= syntax.directObject.endIndex && t.pos !== 'PUNCTUATION');
        lastCoreIndex = afterDo !== -1 ? afterDo : tokens.length;
      }
    }

    const trailingStr = translateTrailingModifiers(tokens, lastCoreIndex);
    const parts = [subjStr, vpRes.translated, ioStr, doStr, trailingStr].filter(Boolean);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  if (pattern === 'S+V+O+C') {
    // S + V + Direct Object + Object Complement
    // e.g. "They made him happy." -> "Họ đã làm cho anh ấy hạnh phúc."
    // e.g. "They made him president." -> "Họ đã bầu anh ấy làm chủ tịch."
    let doStr = '';
    let ocStr = '';

    if (syntax.directObject) {
      const doTokens = tokens ? tokens.filter(t => t.startIndex >= syntax.directObject.startIndex && t.endIndex <= syntax.directObject.endIndex) : [];
      doStr = translateNounPhrase(doTokens.length > 0 ? doTokens : [{ text: syntax.directObject.text, cleanWord: syntax.directObject.text, pos: 'PRONOUN' }]);
    }

    if (syntax.objectComplement) {
      if (syntax.objectComplement.type === 'adjective') {
        const ocTok = syntax.objectComplement.head || { text: syntax.objectComplement.text, cleanWord: syntax.objectComplement.text, pos: 'ADJECTIVE' };
        ocStr = translateWord(ocTok, { pos: 'ADJECTIVE' }).translated;
      } else {
        const ocTokens = tokens ? tokens.filter(t => t.startIndex >= syntax.objectComplement.startIndex && t.endIndex <= syntax.objectComplement.endIndex) : [];
        ocStr = translateNounPhrase(ocTokens.length > 0 ? ocTokens : [{ text: syntax.objectComplement.text, cleanWord: syntax.objectComplement.text, pos: 'NOUN' }]);
      }

      if (tokens) {
        const afterOc = tokens.findIndex(t => t.startIndex >= syntax.objectComplement.endIndex && t.pos !== 'PUNCTUATION');
        lastCoreIndex = afterOc !== -1 ? afterOc : tokens.length;
      }
    }

    const trailingStr = translateTrailingModifiers(tokens, lastCoreIndex);

    // If verb is "make" and complement is adjective: "làm cho [O] [C]"
    let verbPhraseText = vpRes.translated;
    if (verbPhrase?.headVerb?.lemma === 'make') {
      const tensePart = vpRes.tenseParticle ? vpRes.tenseParticle + ' ' : '';
      verbPhraseText = `${tensePart}làm cho`.trim();
    }

    const parts = [subjStr, verbPhraseText, doStr, ocStr, trailingStr].filter(Boolean);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  // Default: S + V (e.g. "The sun shines.", "He works every day.", "The letter was written by Mary.")
  const trailingStr = translateTrailingModifiers(tokens, lastCoreIndex);
  const parts = [subjStr, vpRes.translated, trailingStr].filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

module.exports = {
  translateStructure,
  translateTrailingModifiers
};
