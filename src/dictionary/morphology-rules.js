/**
 * Morphology rules engine for regular English inflections.
 * Generates candidate base lemmas with expected POS constraints.
 */

// Consonants that can be doubled before -ed, -ing, -er, -est in English
const DOUBLE_CONSONANTS = new Set([
  'b', 'c', 'd', 'f', 'g', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z'
]);

/**
 * Check if word ends with a doubled consonant (e.g. "stopp", "runn", "bigg")
 * @param {string} stem
 * @returns {boolean}
 */
function endsWithDoubleConsonant(stem) {
  if (stem.length < 2) return false;
  const c1 = stem[stem.length - 1];
  const c2 = stem[stem.length - 2];
  return c1 === c2 && DOUBLE_CONSONANTS.has(c1);
}

/**
 * Check if character is a vowel.
 * @param {string} char
 * @returns {boolean}
 */
function isVowel(char) {
  return 'aeiou'.includes(char.toLowerCase());
}

/**
 * Generate candidate lemmas from regular morphological inflection rules.
 * @param {string} word Normalized lowercase word
 * @returns {Array<{ candidate: string, pos: 'N' | 'V' | 'A' | 'D', rule: string }>}
 */
function generateMorphologyCandidates(word) {
  if (!word || typeof word !== 'string' || word.length < 3) {
    return [];
  }

  const candidates = [];

  // Helper to add candidate
  function add(candidate, pos, rule) {
    if (candidate && candidate.length >= 2 && candidate !== word) {
      if (!candidates.some(c => c.candidate === candidate && c.pos === pos)) {
        candidates.push({ candidate, pos, rule });
      }
    }
  }

  // =========================================================================
  // 1. Present Participle / Gerund (-ing)
  // =========================================================================
  if (word.endsWith('ing') && word.length >= 5) {
    const stem = word.slice(0, -3);

    // Rule: -ying -> -ie (lying -> lie, dying -> die, tying -> tie)
    if (word.endsWith('ying') && word.length >= 5) {
      const yStem = word.slice(0, -4);
      add(yStem + 'ie', 'V', 'ying_to_ie');
      // Also studying -> study, carrying -> carry, flying -> fly
      add(yStem + 'y', 'V', 'ying_to_y');
    }

    // Rule: Doubled consonant + -ing -> single consonant (running -> run, stopping -> stop, swimming -> swim)
    if (endsWithDoubleConsonant(stem) && stem.length >= 3) {
      add(stem.slice(0, -1), 'V', 'undouble_consonant_ing');
      // Also words where base naturally ends in double consonant: passing -> pass, falling -> fall
      add(stem, 'V', 'double_consonant_stay_ing');
    }

    // Rule: Silent -e dropped (making -> make, taking -> take, writing -> write, hoping -> hope)
    add(stem + 'e', 'V', 'add_silent_e_ing');

    // Rule: Regular -ing removal (walking -> walk, playing -> play, reading -> read)
    add(stem, 'V', 'strip_ing');

    // Rule: -cking -> -c (panicking -> panic, picnicking -> picnic)
    if (stem.endsWith('ck') && stem.length >= 4) {
      add(stem.slice(0, -1), 'V', 'cking_to_c');
    }
  }

  // =========================================================================
  // 2. Past Tense and Past Participle (-ed)
  // =========================================================================
  if (word.endsWith('ed') && word.length >= 4) {
    const stem = word.slice(0, -2);

    // Rule: -ied -> -y (studied -> study, carried -> carry, worried -> worry)
    if (word.endsWith('ied') && word.length >= 4) {
      const iStem = word.slice(0, -3);
      add(iStem + 'y', 'V', 'ied_to_y');
      // Also died -> die, tied -> tie, lied -> lie
      add(iStem + 'ie', 'V', 'ied_to_ie');
    }

    // Words ending in -eed (e.g. seed, feed, weed, need, bleed, breed, speed):
    // In English, only verbs ending in -ee take -d (agree -> agreed, free -> freed, decree -> decreed, guarantee -> guaranteed)
    if (word.endsWith('eed')) {
      if (['agreed', 'freed', 'decreed', 'guaranteed', 'disagreed'].includes(word)) {
        add(word.slice(0, -1), 'V', 'strip_d_ee');
      }
      // For other -eed words, do not strip -d or -ed
    } else {
      // Rule: Doubled consonant + -ed (stopped -> stop, planned -> plan, begged -> beg)
      if (endsWithDoubleConsonant(stem) && stem.length >= 3) {
        add(stem.slice(0, -1), 'V', 'undouble_consonant_ed');
        // Base ends with double consonant: passed -> pass, stalled -> stall
        add(stem, 'V', 'double_consonant_stay_ed');
      }

      // Rule: Silent -e + -d (baked -> bake, loved -> love, decided -> decide)
      // Preceding letter must be a consonant
      if (stem.length >= 2 && !isVowel(stem[stem.length - 1])) {
        add(word.slice(0, -1), 'V', 'strip_d');
      }

      // Rule: Regular -ed removal (walked -> walk, looked -> look, turned -> turn)
      add(stem, 'V', 'strip_ed');
    }
  }

  // =========================================================================
  // 3. Plurals and 3rd-Person Singular (-s, -es, -ies, -ves)
  // =========================================================================
  if (word.endsWith('s') && !word.endsWith('ss') && word.length >= 3) {
    // Rule: -ies -> -y (cities -> city, studies -> study, stories -> story, flies -> fly)
    if (word.endsWith('ies') && word.length >= 4) {
      const iStem = word.slice(0, -3);
      add(iStem + 'y', 'N', 'ies_to_y_noun');
      add(iStem + 'y', 'V', 'ies_to_y_verb');
      // pies -> pie, ties -> tie, lies -> lie
      add(iStem + 'ie', 'N', 'ies_to_ie_noun');
      add(iStem + 'ie', 'V', 'ies_to_ie_verb');
    }

    // Rule: -ves -> -f / -fe (leaves -> leaf / leave, knives -> knife, wives -> wife, wolves -> wolf)
    if (word.endsWith('ves') && word.length >= 4) {
      const vStem = word.slice(0, -3);
      add(vStem + 'f', 'N', 'ves_to_f_noun');
      add(vStem + 'fe', 'N', 'ves_to_fe_noun');
      add(vStem + 've', 'V', 'ves_to_ve_verb');
      add(vStem + 've', 'N', 'ves_to_ve_noun');
    }

    // Rule: -shes, -ches, -sses, -xes, -zes, -oes -> remove -es
    // (boxes -> box, watches -> watch, dishes -> dish, classes -> class, buzzes -> buzz, potatoes -> potato)
    if (word.endsWith('es') && word.length >= 4) {
      const esStem = word.slice(0, -2);
      if (
        esStem.endsWith('sh') ||
        esStem.endsWith('ch') ||
        esStem.endsWith('ss') ||
        esStem.endsWith('x') ||
        esStem.endsWith('z') ||
        esStem.endsWith('o')
      ) {
        add(esStem, 'N', 'strip_es_sibilant_noun');
        add(esStem, 'V', 'strip_es_sibilant_verb');
      }

      // Quizzes -> quiz (double z)
      if (esStem.endsWith('zz') && esStem.length >= 3) {
        add(esStem.slice(0, -1), 'N', 'undouble_z_es');
        add(esStem.slice(0, -1), 'V', 'undouble_z_es');
      }

      // Also general -es stripping (e.g. loves -> love, makes -> make, plates -> plate)
      add(word.slice(0, -1), 'V', 'strip_s_after_e_verb');
      add(word.slice(0, -1), 'N', 'strip_s_after_e_noun');
    }

    // Rule: Regular -s removal (books -> book, works -> work, cats -> cat, dogs -> dog)
    const singleStem = word.slice(0, -1);
    add(singleStem, 'N', 'strip_s_noun');
    add(singleStem, 'V', 'strip_s_verb');
  }

  // =========================================================================
  // 4. Comparative (-er) and Superlative (-est)
  // =========================================================================
  if (word.endsWith('er') && word.length >= 4) {
    const stem = word.slice(0, -2);

    // Rule: -ier -> -y (happier -> happy, busier -> busy, easier -> easy)
    if (word.endsWith('ier') && word.length >= 4) {
      add(word.slice(0, -3) + 'y', 'A', 'ier_to_y');
      add(word.slice(0, -3) + 'y', 'D', 'ier_to_y');
    }

    // Rule: Doubled consonant + -er (bigger -> big, hotter -> hot, sadder -> sad)
    if (endsWithDoubleConsonant(stem) && stem.length >= 3) {
      add(stem.slice(0, -1), 'A', 'undouble_consonant_er');
      add(stem.slice(0, -1), 'D', 'undouble_consonant_er');
    }

    // Rule: Silent -e + -r (larger -> large, wider -> wide, finer -> fine, later -> late)
    add(word.slice(0, -1), 'A', 'strip_r_adj');
    add(word.slice(0, -1), 'D', 'strip_r_adv');

    // Rule: Regular -er removal (faster -> fast, slower -> slow, colder -> cold)
    add(stem, 'A', 'strip_er_adj');
    add(stem, 'D', 'strip_er_adv');
  }

  if (word.endsWith('est') && word.length >= 5) {
    const stem = word.slice(0, -3);

    // Rule: -iest -> -y (happiest -> happy, busiest -> busy, easiest -> easy)
    if (word.endsWith('iest') && word.length >= 5) {
      add(word.slice(0, -4) + 'y', 'A', 'iest_to_y');
      add(word.slice(0, -4) + 'y', 'D', 'iest_to_y');
    }

    // Rule: Doubled consonant + -est (biggest -> big, hottest -> hot, fattest -> fat)
    if (endsWithDoubleConsonant(stem) && stem.length >= 3) {
      add(stem.slice(0, -1), 'A', 'undouble_consonant_est');
      add(stem.slice(0, -1), 'D', 'undouble_consonant_est');
    }

    // Rule: Silent -e + -st (largest -> large, widest -> wide, finest -> fine, latest -> late)
    add(word.slice(0, -2), 'A', 'strip_st_adj');
    add(word.slice(0, -2), 'D', 'strip_st_adv');

    // Rule: Regular -est removal (fastest -> fast, slowest -> slow, coldest -> cold)
    add(stem, 'A', 'strip_est_adj');
    add(stem, 'D', 'strip_est_adv');
  }

  return candidates;
}

/**
 * Check if dictionary result contains meanings matching the target POS category.
 * @param {Object} dictResult Output from searchDictionary
 * @param {'N' | 'V' | 'A' | 'D' | string} targetPos
 * @returns {boolean}
 */
function matchesPos(dictResult, targetPos) {
  if (!dictResult || !dictResult.found || !Array.isArray(dictResult.meanings) || dictResult.meanings.length === 0) {
    return false;
  }

  if (!targetPos) {
    return true;
  }

  const normTarget = targetPos.toUpperCase();

  return dictResult.meanings.some(m => {
    const p = (m.pos || '').toUpperCase();
    const pLabel = (m.posLabel || '').toLowerCase();

    if (normTarget === 'N' || normTarget === 'NOUN') {
      return p === 'N' || p === 'NOUN' || pLabel === 'noun';
    }
    if (normTarget === 'V' || normTarget === 'VERB') {
      return p === 'V' || p === 'VERB' || pLabel === 'verb';
    }
    if (normTarget === 'A' || normTarget === 'ADJ' || normTarget === 'ADJECTIVE') {
      return p === 'A' || p === 'ADJ' || p === 'ADJECTIVE' || pLabel === 'adjective';
    }
    if (normTarget === 'D' || normTarget === 'ADV' || normTarget === 'ADVERB') {
      return p === 'D' || p === 'ADV' || p === 'ADVERB' || pLabel === 'adverb';
    }

    return p === normTarget;
  });
}

module.exports = {
  generateMorphologyCandidates,
  matchesPos,
  endsWithDoubleConsonant,
  DOUBLE_CONSONANTS
};
