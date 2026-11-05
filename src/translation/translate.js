/**
 * Translation service module for Screen Translator.
 * Supports bidirectional translation: English ⇄ Vietnamese.
 * Implements Google Translate Client endpoint with automatic fallback to MyMemory.
 */

/**
 * Translate text between English and Vietnamese.
 * @param {string} text The text to translate.
 * @param {string} sourceLang 'en', 'vi', or 'auto'
 * @param {string} targetLang 'vi' or 'en'
 * @returns {Promise<{ success: boolean, original: string, translated: string, sourceLang: string, targetLang: string, error?: string }>}
 */
async function translateText(text, sourceLang = 'auto', targetLang = 'vi') {
  if (!text || !text.trim()) {
    return {
      success: false,
      original: '',
      translated: '',
      sourceLang,
      targetLang,
      error: 'Text is empty. Nothing to translate.'
    };
  }

  const cleanText = text.trim();

  // If source and target are identical and specified
  if (sourceLang !== 'auto' && sourceLang === targetLang) {
    return {
      success: true,
      original: cleanText,
      translated: cleanText,
      sourceLang,
      targetLang
    };
  }

  // 1. Primary Service: Google Translate Client Endpoint
  try {
    const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
    const tl = targetLang;
    const url = `https://translate.googleapis.com/translate_a/t?client=dict-chrome-ex&sl=${sl}&tl=${tl}&q=${encodeURIComponent(cleanText)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      let translated = '';
      if (Array.isArray(data)) {
        translated = data
          .map(item => (typeof item === 'string' ? item : (Array.isArray(item) ? item[0] : '')))
          .filter(Boolean)
          .join(' ')
          .trim();
      } else if (typeof data === 'string') {
        translated = data;
      }

      if (translated) {
        return {
          success: true,
          original: cleanText,
          translated,
          sourceLang,
          targetLang
        };
      }
    }
  } catch (err) {
    console.warn('Primary translation service unavailable, using fallback:', err.message);
  }

  // 2. Fallback Service: MyMemory Translation API
  try {
    const sl = sourceLang === 'auto' ? (targetLang === 'vi' ? 'en' : 'vi') : sourceLang;
    const tl = targetLang;
    const fallbackUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText.slice(0, 500))}&langpair=${sl}|${tl}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(fallbackUrl, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        return {
          success: true,
          original: cleanText,
          translated: data.responseData.translatedText,
          sourceLang: sl,
          targetLang: tl
        };
      }
    }
  } catch (fallbackErr) {
    console.error('Fallback translation error:', fallbackErr.message);
  }

  return {
    success: false,
    original: cleanText,
    translated: '',
    sourceLang,
    targetLang,
    error: 'Translation request failed. Please check your internet connection and try again.'
  };
}

module.exports = {
  translateText
};
