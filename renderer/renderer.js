// Floating Window Renderer Script
const textOrig = document.getElementById('text-orig');
const textTrans = document.getElementById('text-trans');

const sourceLang = document.getElementById('source-lang');
const targetLang = document.getElementById('target-lang');
const btnSwapLang = document.getElementById('btn-swap-lang');
const btnTranslate = document.getElementById('btn-translate');

const btnHeaderSnip = document.getElementById('btn-header-snip');
const btnSaveAll = document.getElementById('btn-save-all');
const btnClose = document.getElementById('btn-close');

const btnCopyOrig = document.getElementById('btn-copy-orig');
const btnSaveOrigTxt = document.getElementById('btn-save-orig-txt');
const btnRetryOcr = document.getElementById('btn-retry-ocr');

const btnCopyTrans = document.getElementById('btn-copy-trans');
const btnSaveTransTxt = document.getElementById('btn-save-trans-txt');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const toast = document.getElementById('toast');

let currentScreenshotDataUrl = null;
let toastTimeout = null;

// Toast helper
function showToast(message) {
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// Status helper
function setStatus(text, state = 'ready') {
  statusText.textContent = text;
  statusDot.className = 'status-dot';
  if (state === 'active') statusDot.classList.add('active');
  else if (state === 'success') statusDot.classList.add('success');
  else if (state === 'error') statusDot.classList.add('error');
}

// Close Window
btnClose.addEventListener('click', () => {
  window.electronAPI.closeFloatingWindow();
});

// Header Snip (Ctrl+Shift+S)
btnHeaderSnip.addEventListener('click', () => {
  window.electronAPI.startScreenshot();
});

// Receive data from Main process
window.electronAPI.onFloatingSetData((data) => {
  if (data.screenshotDataUrl) {
    currentScreenshotDataUrl = data.screenshotDataUrl;
  }

  if (data.isRunningOcr) {
    setStatus('Running OCR recognition...', 'active');
    textOrig.value = '';
    textTrans.value = '';
    return;
  }

  if (typeof data.originalText === 'string') {
    textOrig.value = data.originalText;
  }

  if (typeof data.translatedText === 'string') {
    textTrans.value = data.translatedText;
  }

  if (data.error) {
    setStatus(`OCR Error: ${data.error}`, 'error');
  } else if (data.originalText) {
    const conf = data.confidence ? ` (${Math.round(data.confidence)}%)` : '';
    setStatus(`Recognized${conf}`, 'success');
  } else {
    setStatus('No text recognized. Try retrying or typing.', 'ready');
  }
});

// Receive OCR Progress
window.electronAPI.onOcrProgress((prog) => {
  if (prog && prog.status) {
    const p = typeof prog.progress === 'number' ? ` ${prog.progress}%` : '';
    setStatus(`${prog.status}${p}`, 'active');
  }
});

// Perform Translation
async function performTranslation() {
  const text = textOrig.value.trim();
  if (!text) {
    showToast('Original text is empty');
    return;
  }

  const sLang = sourceLang.value;
  const tLang = targetLang.value;

  btnTranslate.disabled = true;
  setStatus(`Translating (${sLang} → ${tLang})...`, 'active');

  try {
    const res = await window.electronAPI.translate({
      text,
      sourceLang: sLang,
      targetLang: tLang
    });

    if (res.success && res.translated) {
      textTrans.value = res.translated;
      setStatus('Translated', 'success');
      showToast('Translation completed');
    } else {
      setStatus('Translation failed', 'error');
      showToast(res.error || 'Failed to translate');
    }
  } catch (err) {
    setStatus('Translation error', 'error');
    showToast(err.message || 'Error occurred');
  } finally {
    btnTranslate.disabled = false;
  }
}

btnTranslate.addEventListener('click', performTranslation);

// Swap Languages
btnSwapLang.addEventListener('click', () => {
  const s = sourceLang.value;
  const t = targetLang.value;

  sourceLang.value = t;
  targetLang.value = s === 'auto' ? 'en' : s;

  // Swap text areas
  const temp = textOrig.value;
  textOrig.value = textTrans.value;
  textTrans.value = temp;

  showToast('Languages swapped');
});

// Retry OCR
btnRetryOcr.addEventListener('click', async () => {
  setStatus('Retrying OCR...', 'active');
  const langs = ['eng', 'vie'];
  const res = await window.electronAPI.runOcr(langs);
  if (res.success) {
    textOrig.value = res.text || '';
    setStatus('OCR complete', 'success');
    showToast('OCR retried');
    if (res.text) performTranslation();
  } else {
    setStatus(`OCR Error: ${res.error}`, 'error');
    showToast('OCR retry failed');
  }
});

// Copy Buttons
btnCopyOrig.addEventListener('click', async () => {
  const text = textOrig.value;
  if (!text) {
    showToast('Original text is empty');
    return;
  }
  const res = await window.electronAPI.copyToClipboard(text);
  if (res.success) {
    showToast('Copied original text to clipboard');
  }
});

btnCopyTrans.addEventListener('click', async () => {
  const text = textTrans.value;
  if (!text) {
    showToast('Translation is empty');
    return;
  }
  const res = await window.electronAPI.copyToClipboard(text);
  if (res.success) {
    showToast('Copied translation to clipboard');
  }
});

// Save Buttons
btnSaveOrigTxt.addEventListener('click', async () => {
  const text = textOrig.value;
  if (!text.trim()) {
    showToast('Original text is empty');
    return;
  }
  const res = await window.electronAPI.saveText({ text, defaultName: 'original_text' });
  if (res && res.success) {
    showToast('Saved original text (.txt)');
  }
});

btnSaveTransTxt.addEventListener('click', async () => {
  const text = textTrans.value;
  if (!text.trim()) {
    showToast('Translation is empty');
    return;
  }
  const res = await window.electronAPI.saveText({ text, defaultName: 'translated_text' });
  if (res && res.success) {
    showToast('Saved translation (.txt)');
  }
});

btnSaveAll.addEventListener('click', async () => {
  if (currentScreenshotDataUrl) {
    const res = await window.electronAPI.saveScreenshot(currentScreenshotDataUrl);
    if (res && res.success) {
      showToast('Saved screenshot (.png)');
    }
  } else {
    // If no screenshot image is loaded, save text
    const text = textTrans.value || textOrig.value;
    if (text) {
      await window.electronAPI.saveText({ text, defaultName: 'screen_translation' });
      showToast('Saved text file');
    } else {
      showToast('Nothing to save yet');
    }
  }
});
