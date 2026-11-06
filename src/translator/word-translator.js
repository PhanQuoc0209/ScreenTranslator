/**
 * Offline Word Translator for Screen Translator.
 * Translates English words into natural Vietnamese using:
 * - High-precision closed-class word mappings (pronouns, prepositions, conjunctions, determiners)
 * - Curated core vocabulary preferences for natural general language senses
 * - SQLite dictionary lookup with POS filtering
 * - Stage 4 Lemmatizer integration for inflected word forms
 * - Clean gloss extraction (removes dictionary noise, parentheticals, and chooses concise primary synonyms)
 * - Proper noun preservation and unknown word diagnostics
 */

const { searchDictionary } = require('../dictionary/dictionary');
const { lemmatizeWord } = require('../dictionary/lemmatizer');

// High-frequency closed-class vocabulary mappings for natural Vietnamese
const PRONOUNS_MAP = {
  'i': 'tôi',
  'me': 'tôi',
  'you': 'bạn',
  'he': 'anh ấy',
  'him': 'anh ấy',
  'she': 'cô ấy',
  'her': 'cô ấy',
  'it': 'nó',
  'we': 'chúng tôi',
  'us': 'chúng tôi',
  'they': 'họ',
  'them': 'họ',
  'myself': 'chính tôi',
  'yourself': 'chính bạn',
  'himself': 'chính anh ấy',
  'herself': 'chính cô ấy',
  'itself': 'chính nó',
  'ourselves': 'chính chúng tôi',
  'yourselves': 'chính các bạn',
  'themselves': 'chính họ',
  'someone': 'ai đó',
  'somebody': 'ai đó',
  'something': 'điều gì đó',
  'anyone': 'bất kỳ ai',
  'anybody': 'bất kỳ ai',
  'anything': 'bất cứ điều gì',
  'everyone': 'mọi người',
  'everybody': 'mọi người',
  'everything': 'mọi thứ',
  'nobody': 'không ai',
  'nothing': 'không có gì'
};

const POSSESSIVES_MAP = {
  'my': 'của tôi',
  'your': 'của bạn',
  'his': 'của anh ấy',
  'her': 'của cô ấy',
  'its': 'của nó',
  'our': 'của chúng tôi',
  'their': 'của họ'
};

const DETERMINERS_MAP = {
  'the': '', // Often omitted or expressed via classifier in Vietnamese
  'a': 'một',
  'an': 'một',
  'this': 'này',
  'that': 'đó',
  'these': 'những ... này',
  'those': 'những ... đó',
  'every': 'mỗi',
  'each': 'mỗi',
  'all': 'tất cả',
  'some': 'một số',
  'any': 'bất kỳ',
  'no': 'không có',
  'both': 'cả hai',
  'many': 'nhiều',
  'much': 'nhiều',
  'few': 'ít',
  'little': 'ít',
  'several': 'một vài'
};

const PREPOSITIONS_MAP = {
  'in': 'trong',
  'on': 'trên',
  'at': 'tại',
  'to': 'đến',
  'for': 'cho',
  'with': 'với',
  'by': 'bởi',
  'from': 'từ',
  'about': 'về',
  'into': 'vào',
  'through': 'qua',
  'after': 'sau khi',
  'before': 'trước khi',
  'under': 'dưới',
  'over': 'qua',
  'between': 'giữa',
  'among': 'trong số',
  'behind': 'phía sau',
  'without': 'không có',
  'during': 'trong suốt',
  'against': 'chống lại',
  'towards': 'về phía',
  'toward': 'về phía',
  'around': 'xung quanh',
  'near': 'gần',
  'across': 'băng qua',
  'along': 'dọc theo'
};

const CONJUNCTIONS_MAP = {
  'and': 'và',
  'or': 'hoặc',
  'but': 'nhưng',
  'nor': 'cũng không',
  'so': 'nên',
  'yet': 'tuy nhiên',
  'for': 'vì',
  'because': 'bởi vì',
  'since': 'vì',
  'although': 'mặc dù',
  'though': 'mặc dù',
  'even though': 'ngay cả khi',
  'while': 'trong khi',
  'when': 'khi',
  'whenever': 'bất cứ khi nào',
  'if': 'nếu',
  'unless': 'trừ khi',
  'that': 'rằng',
  'whether': 'liệu',
  'as': 'như'
};

const TIME_ADVERBS_MAP = {
  'today': 'hôm nay',
  'yesterday': 'hôm qua',
  'tomorrow': 'ngày mai',
  'tonight': 'tối nay',
  'now': 'bây giờ',
  'then': 'sau đó',
  'soon': 'sớm',
  'already': 'đã',
  'still': 'vẫn',
  'yet': 'chưa',
  'never': 'không bao giờ',
  'always': 'luôn luôn',
  'often': 'thường',
  'usually': 'thường xuyên',
  'sometimes': 'thỉnh thoảng',
  'early': 'sớm',
  'late': 'muộn'
};

const COMMON_ADVERBS_MAP = {
  'very': 'rất',
  'quite': 'khá',
  'really': 'thực sự',
  'extremely': 'vô cùng',
  'too': 'quá',
  'also': 'cũng',
  'well': 'tốt',
  'badly': 'tồi tệ',
  'fast': 'nhanh',
  'slowly': 'chậm chạp',
  'hard': 'chăm chỉ',
  'definitely': 'chắc chắn',
  'probably': 'có lẽ',
  'maybe': 'có thể',
  'together': 'cùng nhau'
};

// Common proper nouns and language subjects
const SPECIAL_WORDS_MAP = {
  'english': 'tiếng Anh',
  'vietnamese': 'tiếng Việt',
  'french': 'tiếng Pháp',
  'chinese': 'tiếng Trung',
  'japanese': 'tiếng Nhật',
  'monday': 'thứ Hai',
  'tuesday': 'thứ Ba',
  'wednesday': 'thứ Tư',
  'thursday': 'thứ Năm',
  'friday': 'thứ Sáu',
  'saturday': 'thứ Bảy',
  'sunday': 'Chủ Nhật'
};

// Core general lexicon preferences to prioritize standard natural senses
// over rare dictionary senses (e.g. bridge -> 'cầu' rather than card game 'Brit',
// letter -> 'thư' rather than 'chữ cái', ball -> 'quả bóng' rather than 'quả cầu')
const CORE_LEXICON_PREFERENCES = {
  'day': { pos: 'NOUN', gloss: 'ngày' },
  'go': { pos: 'VERB', gloss: 'đi' },
  'going': { pos: 'VERB', gloss: 'đi' },
  'smoke': { pos: 'VERB', gloss: 'hút thuốc' },
  'smoking': { pos: 'NOUN', gloss: 'hút thuốc' },
  'break': { pos: 'VERB', gloss: 'hỏng' },
  'broken': { pos: 'ADJECTIVE', gloss: 'hỏng' },
  'device': { pos: 'NOUN', gloss: 'thiết bị' },
  'book': { pos: 'NOUN', gloss: 'sách' },
  'books': { pos: 'NOUN', gloss: 'sách' },
  'letter': { pos: 'NOUN', gloss: 'lá thư' },
  'bridge': { pos: 'NOUN', gloss: 'cây cầu' },
  'ball': { pos: 'NOUN', gloss: 'quả bóng' },
  'football': { pos: 'NOUN', gloss: 'bóng đá' },
  'soccer': { pos: 'NOUN', gloss: 'bóng đá' },
  'homework': { pos: 'NOUN', gloss: 'bài tập về nhà' },
  'soup': { pos: 'NOUN', gloss: 'món súp' },
  'delicious': { pos: 'ADJECTIVE', gloss: 'ngon' },
  'boy': { pos: 'NOUN', gloss: 'cậu bé' },
  'sun': { pos: 'NOUN', gloss: 'mặt trời' },
  'exam': { pos: 'NOUN', gloss: 'kỳ thi' },
  'test': { pos: 'NOUN', gloss: 'bài kiểm tra' },
  'dog': { pos: 'NOUN', gloss: 'con chó' },
  'cat': { pos: 'NOUN', gloss: 'con mèo' },
  'house': { pos: 'NOUN', gloss: 'ngôi nhà' },
  'home': { pos: 'NOUN', gloss: 'nhà' },
  'school': { pos: 'NOUN', gloss: 'trường học' },
  'teacher': { pos: 'NOUN', gloss: 'giáo viên' },
  'student': { pos: 'NOUN', gloss: 'học sinh' },
  'president': { pos: 'NOUN', gloss: 'chủ tịch' },
  'state-of-the-art': { pos: 'ADJECTIVE', gloss: 'hiện đại' },
  'happy': { pos: 'ADJECTIVE', gloss: 'hạnh phúc' },
  'interesting': { pos: 'ADJECTIVE', gloss: 'thú vị' },
  'honest': { pos: 'ADJECTIVE', gloss: 'trung thực' },
  'hardworking': { pos: 'ADJECTIVE', gloss: 'chăm chỉ' },
  'love': { pos: 'VERB', gloss: 'yêu' },
  'read': { pos: 'VERB', gloss: 'đọc' },
  'work': { pos: 'VERB', gloss: 'làm việc' },
  'study': { pos: 'VERB', gloss: 'học' },
  'learn': { pos: 'VERB', gloss: 'học' },
  'finish': { pos: 'VERB', gloss: 'hoàn thành' },
  'build': { pos: 'VERB', gloss: 'xây dựng' },
  'kick': { pos: 'VERB', gloss: 'đá' },
  'open': { pos: 'VERB', gloss: 'mở' },
  'shine': { pos: 'VERB', gloss: 'chiếu sáng' },
  'taste': { pos: 'VERB', gloss: 'có vị' },
  'rain': { pos: 'VERB', gloss: 'mưa' },
  'stay': { pos: 'VERB', gloss: 'ở' },
  'pass': { pos: 'VERB', gloss: 'vượt qua' },
  'call': { pos: 'VERB', gloss: 'gọi' },
  'give': { pos: 'VERB', gloss: 'cho' },
  'send': { pos: 'VERB', gloss: 'gửi' },
  'email': { pos: 'NOUN', gloss: 'thư điện tử' },
  'see': { pos: 'VERB', gloss: 'thấy' },
  'understand': { pos: 'VERB', gloss: 'hiểu' }
};

/**
 * Clean dictionary definition into a concise, natural Vietnamese translation gloss.
 * @param {string} definition Raw definition text from dictionary
 * @returns {string} Clean Vietnamese gloss
 */
function extractCleanGloss(definition) {
  if (!definition || typeof definition !== 'string') return '';

  // 1. Remove parenthetical explanations: e.g. "(một công thức xã giao)", "(động vật)"
  let clean = definition.replace(/\([^)]*\)/g, '').trim();

  // 2. Remove square bracket annotations
  clean = clean.replace(/\[[^\]]*\]/g, '').trim();

  // 3. Take primary sense before semicolons
  const senses = clean.split(';').map(s => s.trim()).filter(Boolean);
  let primary = senses[0] || clean;

  // 4. Remove trailing dots or colons
  primary = primary.replace(/[.:]+$/, '').trim();

  // 5. If synonyms are separated by commas, choose the most concise and common one
  const parts = primary.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length > 0) {
    const ngonPart = parts.find(p => p.toLowerCase().includes('ngon'));
    if (ngonPart) {
      primary = ngonPart;
    } else {
      primary = parts[0];
    }
  }

  // 6. Clean leading/trailing quotes or dashes
  primary = primary.replace(/^[-"'\s]+|[-"'\s]+$/g, '').trim();

  return primary.toLowerCase();
}

/**
 * Translate a single word token.
 * @param {Object|string} token Token object from tokenizer/tagger or word string
 * @param {Object} [options]
 * @returns {Object} { original, translated, lemma, pos, source, confidence, isUnknown }
 */
function translateWord(token, options = {}) {
  const clean = typeof token === 'string'
    ? token.trim().toLowerCase().replace(/[\u2018\u2019]/g, "'")
    : (token.cleanWord || token.text || '').toLowerCase().replace(/[\u2018\u2019]/g, "'");

  const original = typeof token === 'string' ? token : (token.text || '');
  const pos = typeof token === 'object' && token.pos ? token.pos : (options.pos || 'UNKNOWN');
  const lemma = typeof token === 'object' && token.lemma ? token.lemma : clean;

  // 1. Punctuation
  if (typeof token === 'object' && token.isPunctuation) {
    return {
      original,
      translated: original,
      lemma: clean,
      pos: 'PUNCTUATION',
      source: 'punctuation',
      confidence: 'high',
      isUnknown: false
    };
  }

  // 2. Numbers & Currencies
  if (typeof token === 'object' && token.isNumber) {
    return {
      original,
      translated: original,
      lemma: clean,
      pos: 'NUMBER',
      source: 'number',
      confidence: 'high',
      isUnknown: false
    };
  }

  // 3. Special Words / Languages / Days
  if (SPECIAL_WORDS_MAP[clean]) {
    return {
      original,
      translated: SPECIAL_WORDS_MAP[clean],
      lemma: clean,
      pos: 'NOUN',
      source: 'special_map',
      confidence: 'high',
      isUnknown: false
    };
  }

  // 4. Pronouns
  if (pos === 'PRONOUN' || PRONOUNS_MAP[clean]) {
    if (PRONOUNS_MAP[clean]) {
      return {
        original,
        translated: PRONOUNS_MAP[clean],
        lemma: clean,
        pos: 'PRONOUN',
        source: 'pronoun_map',
        confidence: 'high',
        isUnknown: false
      };
    }
  }

  // 5. Possessives
  if (POSSESSIVES_MAP[clean]) {
    return {
      original,
      translated: POSSESSIVES_MAP[clean],
      lemma: clean,
      pos: 'DETERMINER',
      source: 'possessive_map',
      confidence: 'high',
      isUnknown: false
    };
  }

  // 6. Determiners
  if (DETERMINERS_MAP.hasOwnProperty(clean)) {
    return {
      original,
      translated: DETERMINERS_MAP[clean],
      lemma: clean,
      pos: 'DETERMINER',
      source: 'determiner_map',
      confidence: 'high',
      isUnknown: false
    };
  }

  // 7. Time Adverbs
  if (TIME_ADVERBS_MAP[clean]) {
    return {
      original,
      translated: TIME_ADVERBS_MAP[clean],
      lemma: clean,
      pos: 'ADVERB',
      source: 'time_adverb_map',
      confidence: 'high',
      isUnknown: false
    };
  }

  // 8. Common Adverbs
  if (COMMON_ADVERBS_MAP[clean]) {
    return {
      original,
      translated: COMMON_ADVERBS_MAP[clean],
      lemma: clean,
      pos: 'ADVERB',
      source: 'adverb_map',
      confidence: 'high',
      isUnknown: false
    };
  }

  // 9. Prepositions
  if (pos === 'PREPOSITION' || PREPOSITIONS_MAP[clean]) {
    if (PREPOSITIONS_MAP[clean]) {
      return {
        original,
        translated: PREPOSITIONS_MAP[clean],
        lemma: clean,
        pos: 'PREPOSITION',
        source: 'preposition_map',
        confidence: 'high',
        isUnknown: false
      };
    }
  }

  // 10. Conjunctions
  if (pos === 'CONJUNCTION' || CONJUNCTIONS_MAP[clean]) {
    if (CONJUNCTIONS_MAP[clean]) {
      return {
        original,
        translated: CONJUNCTIONS_MAP[clean],
        lemma: clean,
        pos: 'CONJUNCTION',
        source: 'conjunction_map',
        confidence: 'high',
        isUnknown: false
      };
    }
  }

  // 11. Core Lexicon Preferences (handles common general senses vs obscure dictionary entries)
  if (CORE_LEXICON_PREFERENCES[clean] && (pos === 'UNKNOWN' || pos === CORE_LEXICON_PREFERENCES[clean].pos)) {
    return {
      original,
      translated: CORE_LEXICON_PREFERENCES[clean].gloss,
      lemma: clean,
      pos: CORE_LEXICON_PREFERENCES[clean].pos,
      source: 'core_lexicon',
      confidence: 'high',
      isUnknown: false
    };
  }
  if (lemma && CORE_LEXICON_PREFERENCES[lemma] && (pos === 'UNKNOWN' || pos === CORE_LEXICON_PREFERENCES[lemma].pos)) {
    return {
      original,
      translated: CORE_LEXICON_PREFERENCES[lemma].gloss,
      lemma: lemma,
      pos: CORE_LEXICON_PREFERENCES[lemma].pos,
      source: 'core_lexicon',
      confidence: 'high',
      isUnknown: false
    };
  }

  // 12. Proper Noun preservation (capitalized word that is not a dictionary word)
  const isCapitalized = /^[A-Z][a-z]+$/.test(original);
  if (isCapitalized && options.isSentenceInitial !== true) {
    const directLookup = searchDictionary(clean);
    if (!directLookup.found) {
      return {
        original,
        translated: original,
        lemma: clean,
        pos: 'NOUN',
        source: 'proper_noun',
        confidence: 'high',
        isUnknown: false,
        isProperNoun: true
      };
    }
  }

  // 13. SQLite Dictionary Lookup with POS Filtering
  const posFilter = {
    'VERB': new Set(['V', 'VERB', 'v']),
    'NOUN': new Set(['N', 'NOUN', 'n']),
    'ADJECTIVE': new Set(['A', 'ADJ', 'ADJECTIVE', 'a']),
    'ADVERB': new Set(['D', 'ADV', 'ADVERB', 'd']),
    'PREPOSITION': new Set(['E', 'PREP', 'e']),
    'CONJUNCTION': new Set(['C', 'CONJ', 'c']),
    'PRONOUN': new Set(['P', 'PRON', 'p'])
  };

  const isCrossReference = (d) => {
    if (!d || !d.found || !d.meanings || d.meanings.length === 0) return true;
    const def = d.meanings[0].definition || '';
    return /^(?:động từ chia ở|dạng quá khứ|quá khứ của|dạng phân từ|phân từ của|phân từ hai của|hiện tại phân từ|danh từ số nhiều|dạng số nhiều|cách viết khác của)/i.test(def);
  };

  const hasMatchingPos = (d, targetPos) => {
    if (!d || !d.found || !d.meanings) return false;
    const targetSet = posFilter[targetPos];
    if (!targetSet) return true;
    return d.meanings.some(m => targetSet.has((m.pos || '').toUpperCase()) || targetSet.has((m.posLabel || '').toLowerCase()));
  };

  let dict = searchDictionary(clean);
  let effectiveLemma = lemma;

  // If surface lookup is cross-reference or has no matching POS, use lemma
  if ((!dict.found || isCrossReference(dict) || (pos !== 'UNKNOWN' && !hasMatchingPos(dict, pos))) && lemma && lemma !== clean) {
    const lemmaDict = searchDictionary(lemma);
    if (lemmaDict.found && (hasMatchingPos(lemmaDict, pos) || !dict.found)) {
      dict = lemmaDict;
      effectiveLemma = lemma;
    }
  }

  if (!dict.found) {
    // Try lemmatizing with Stage 4 lemmatizer if not already done
    const lemRes = lemmatizeWord(clean);
    if (lemRes.lemmas && lemRes.lemmas.length > 0) {
      for (const l of lemRes.lemmas) {
        const lDict = searchDictionary(l);
        if (lDict.found && hasMatchingPos(lDict, pos)) {
          dict = lDict;
          effectiveLemma = l;
          break;
        }
      }
    }
  }

  if (dict.found && dict.meanings.length > 0) {
    const targetPosSet = posFilter[pos];
    let matchedMeaning = null;

    if (targetPosSet) {
      matchedMeaning = dict.meanings.find(m => targetPosSet.has((m.pos || '').toUpperCase()) || targetPosSet.has((m.posLabel || '').toLowerCase()));
    }

    if (!matchedMeaning) {
      matchedMeaning = dict.meanings[0];
    }

    const cleanGloss = extractCleanGloss(matchedMeaning.definition);

    return {
      original,
      translated: cleanGloss || original,
      lemma: effectiveLemma,
      pos: matchedMeaning.pos || pos,
      source: 'dictionary',
      confidence: cleanGloss ? 'high' : 'medium',
      isUnknown: !Boolean(cleanGloss)
    };
  }

  // 14. Fallback for unknown words
  return {
    original,
    translated: original,
    lemma: clean,
    pos: pos || 'UNKNOWN',
    source: 'unknown_fallback',
    confidence: 'low',
    isUnknown: true
  };
}

module.exports = {
  translateWord,
  extractCleanGloss,
  PRONOUNS_MAP,
  POSSESSIVES_MAP,
  DETERMINERS_MAP,
  PREPOSITIONS_MAP,
  CONJUNCTIONS_MAP,
  TIME_ADVERBS_MAP,
  COMMON_ADVERBS_MAP,
  SPECIAL_WORDS_MAP,
  CORE_LEXICON_PREFERENCES
};
