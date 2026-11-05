const { createWorker } = require('tesseract.js');
const path = require('path');

let currentWorker = null;
let currentLangs = '';

/**
 * Get or initialize a Tesseract worker.
 * @param {string|string[]} langs Language code or array of codes, e.g. 'eng', 'vie', or ['eng', 'vie'].
 * @param {Function} [onProgress] Optional callback for OCR progress updates.
 * @returns {Promise<import('tesseract.js').Worker>}
 */
async function getWorker(langs = ['eng', 'vie'], onProgress = null) {
  const langKey = Array.isArray(langs) ? langs.slice().sort().join('+') : langs;

  if (currentWorker && currentLangs === langKey) {
    return currentWorker;
  }

  // If worker exists for different language, terminate it first
  if (currentWorker) {
    try {
      await currentWorker.terminate();
    } catch (e) {
      console.warn('Error terminating previous worker:', e.message);
    }
    currentWorker = null;
  }

  // Traineddata is located in root directory
  const localLangPath = path.join(__dirname, '../../');

  const worker = await createWorker(langs, undefined, {
    langPath: localLangPath,
    logger: m => {
      if (onProgress && m && typeof m.progress === 'number') {
        onProgress(m);
      }
    }
  });

  currentWorker = worker;
  currentLangs = langKey;
  return currentWorker;
}

/**
 * Recognize text from an image (Buffer, file path, or data URL).
 * @param {Buffer|string} imageBufferOrPath Image data or file path.
 * @param {string|string[]} [langs=['eng', 'vie']] Languages to use.
 * @param {Function} [onProgress] Progress reporting callback.
 * @returns {Promise<{ success: boolean, text: string, confidence?: number, error?: string }>}
 */
async function recognizeText(imageBufferOrPath, langs = ['eng', 'vie'], onProgress = null) {
  if (!imageBufferOrPath) {
    return { success: false, text: '', error: 'No image provided for OCR.' };
  }

  try {
    const worker = await getWorker(langs, onProgress);
    const result = await worker.recognize(imageBufferOrPath);

    const rawText = result && result.data && result.data.text ? result.data.text : '';
    const confidence = result && result.data && typeof result.data.confidence === 'number' ? result.data.confidence : 0;

    // Clean up OCR artifacts: trim line ends and excess spaces
    const cleanedText = rawText
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .trim();

    return {
      success: true,
      text: cleanedText,
      confidence
    };
  } catch (err) {
    console.error('OCR recognition error:', err);
    return {
      success: false,
      text: '',
      error: `OCR recognition failed: ${err.message}`
    };
  }
}

/**
 * Terminate worker on app shutdown.
 */
async function terminateWorker() {
  if (currentWorker) {
    try {
      await currentWorker.terminate();
    } catch (e) {
      // ignore
    }
    currentWorker = null;
    currentLangs = '';
  }
}

module.exports = {
  recognizeText,
  getWorker,
  terminateWorker
};
