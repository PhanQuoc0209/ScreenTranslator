// Floating Window Renderer Controller
const textOrig = document.getElementById('text-orig');
const textTrans = document.getElementById('text-trans');

const sourceLang = document.getElementById('source-lang');
const targetLang = document.getElementById('target-lang');
const btnSwapLang = document.getElementById('btn-swap-lang');
const btnTranslate = document.getElementById('btn-translate');
const chkAutoCopy = document.getElementById('chk-auto-copy');

const btnToggleImage = document.getElementById('btn-toggle-image');
const lblToggleImage = document.getElementById('lbl-toggle-image');
const imageDrawer = document.getElementById('image-drawer');
const btnResetCrop = document.getElementById('btn-reset-crop');

const canvas = document.getElementById('image-canvas');
const ctx = canvas.getContext('2d');

const btnHeaderSnip = document.getElementById('btn-header-snip');
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
let currentLoadedImage = null;
let toastTimeout = null;
let typingDebounce = null;

// Image selection state
let isDrawingCrop = false;
let startCropX = 0;
let startCropY = 0;
let currentCropX = 0;
let currentCropY = 0;

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

// Close Window (Button & Esc key)
btnClose.addEventListener('click', () => {
  window.electronAPI.closeFloatingWindow();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.electronAPI.closeFloatingWindow();
  }
});

// Header Snip (Ctrl+Shift+S)
btnHeaderSnip.addEventListener('click', () => {
  window.electronAPI.startScreenshot();
});

// Toggle Image Preview Drawer
btnToggleImage.addEventListener('click', () => {
  imageDrawer.classList.toggle('open');
  const isOpen = imageDrawer.classList.contains('open');
  lblToggleImage.textContent = isOpen ? 'Ẩn ảnh' : 'Xem ảnh';
  if (isOpen && currentLoadedImage) {
    drawImageOnCanvas();
  }
});

// Draw image onto canvas
function drawImageOnCanvas() {
  if (!currentLoadedImage) return;
  const wrapper = document.getElementById('canvas-wrapper');
  const maxW = wrapper.clientWidth || 400;
  const maxH = wrapper.clientHeight || 110;

  const imgW = currentLoadedImage.naturalWidth;
  const imgH = currentLoadedImage.naturalHeight;
  const ratio = Math.min(maxW / imgW, maxH / imgH, 1);

  canvas.width = Math.round(imgW * ratio);
  canvas.height = Math.round(imgH * ratio);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentLoadedImage, 0, 0, canvas.width, canvas.height);

  // Draw selection marquee if active
  if (isDrawingCrop) {
    const rx = Math.min(startCropX, currentCropX);
    const ry = Math.min(startCropY, currentCropY);
    const rw = Math.abs(currentCropX - startCropX);
    const rh = Math.abs(currentCropY - startCropY);

    ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx, ry, rw, rh);
  }
}

// Canvas interactions: Bôi đen trên hình ảnh để dịch tức thì
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !currentLoadedImage) return;
  const rect = canvas.getBoundingClientRect();
  isDrawingCrop = true;
  startCropX = e.clientX - rect.left;
  startCropY = e.clientY - rect.top;
  currentCropX = startCropX;
  currentCropY = startCropY;
  drawImageOnCanvas();
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawingCrop) return;
  const rect = canvas.getBoundingClientRect();
  currentCropX = e.clientX - rect.left;
  currentCropY = e.clientY - rect.top;
  drawImageOnCanvas();
});

canvas.addEventListener('mouseup', async () => {
  if (!isDrawingCrop || !currentLoadedImage) return;
  isDrawingCrop = false;

  const rx = Math.min(startCropX, currentCropX);
  const ry = Math.min(startCropY, currentCropY);
  const rw = Math.abs(currentCropX - startCropX);
  const rh = Math.abs(currentCropY - startCropY);

  if (rw > 10 && rh > 10) {
    // Crop sub-area from the natural image
    const scaleX = currentLoadedImage.naturalWidth / canvas.width;
    const scaleY = currentLoadedImage.naturalHeight / canvas.height;

    const cropNaturalX = Math.round(rx * scaleX);
    const cropNaturalY = Math.round(ry * scaleY);
    const cropNaturalW = Math.round(rw * scaleX);
    const cropNaturalH = Math.round(rh * scaleY);

    const subCanvas = document.createElement('canvas');
    subCanvas.width = cropNaturalW;
    subCanvas.height = cropNaturalH;
    const subCtx = subCanvas.getContext('2d');
    subCtx.drawImage(
      currentLoadedImage,
      cropNaturalX, cropNaturalY, cropNaturalW, cropNaturalH,
      0, 0, cropNaturalW, cropNaturalH
    );

    const subDataUrl = subCanvas.toDataURL('image/png');

    setStatus('Đang nhận diện vùng vừa bôi đen...', 'active');
    showToast('Đang dịch vùng ảnh bôi đen...');

    try {
      const ocrRes = await window.electronAPI.runOcrSubImage(subDataUrl);
      if (ocrRes.success && ocrRes.text) {
        textOrig.value = ocrRes.text;
        setStatus('Đang dịch...', 'active');
        await performTranslation();
      } else {
        setStatus('Không tìm thấy chữ trong vùng chọn', 'ready');
        showToast('Vùng chọn không có chữ');
      }
    } catch (err) {
      setStatus('Lỗi nhận diện vùng chọn', 'error');
    }
  }

  drawImageOnCanvas();
});

// Reset Crop / Translate full image
btnResetCrop.addEventListener('click', async () => {
  if (currentScreenshotDataUrl) {
    setStatus('Đang nhận diện toàn bộ ảnh...', 'active');
    const res = await window.electronAPI.runOcr(['eng', 'vie']);
    if (res.success) {
      textOrig.value = res.text || '';
      await performTranslation();
    }
  }
});

// Receive data from Main process
window.electronAPI.onFloatingSetData((data) => {
  if (data.screenshotDataUrl) {
    currentScreenshotDataUrl = data.screenshotDataUrl;
    const img = new Image();
    img.onload = () => {
      currentLoadedImage = img;
      if (imageDrawer.classList.contains('open')) {
        drawImageOnCanvas();
      }
    };
    img.src = data.screenshotDataUrl;
  }

  if (data.isRunningOcr) {
    setStatus('Đang quét chữ & dịch tức thì...', 'active');
    textOrig.value = '';
    textTrans.value = '';
    return;
  }

  if (typeof data.originalText === 'string') {
    textOrig.value = data.originalText;
  }

  if (typeof data.translatedText === 'string') {
    textTrans.value = data.translatedText;

    // Auto-copy to clipboard if enabled
    if (chkAutoCopy.checked && data.translatedText) {
      window.electronAPI.copyToClipboard(data.translatedText);
      showToast('Đã tự động sao chép bản dịch');
    }
  }

  if (data.error) {
    setStatus(`Lỗi: ${data.error}`, 'error');
  } else if (data.translatedText) {
    const s = sourceLang.value.toUpperCase();
    const t = targetLang.value.toUpperCase();
    setStatus(`Đã dịch xong (${s} → ${t})`, 'success');
  } else if (data.originalText) {
    setStatus('Đã nhận diện chữ', 'success');
  } else {
    setStatus('Không phát hiện chữ. Hãy thử bôi đen lại.', 'ready');
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
async function performTranslation(customText = null) {
  const text = (customText !== null ? customText : textOrig.value).trim();
  if (!text) {
    return;
  }

  const sLang = sourceLang.value;
  const tLang = targetLang.value;

  btnTranslate.disabled = true;
  setStatus(`Đang dịch (${sLang} → ${tLang})...`, 'active');

  try {
    const res = await window.electronAPI.translate({
      text,
      sourceLang: sLang,
      targetLang: tLang
    });

    if (res.success && res.translated) {
      textTrans.value = res.translated;
      const s = sLang.toUpperCase();
      const t = tLang.toUpperCase();
      setStatus(`Đã dịch xong (${s} → ${t})`, 'success');

      if (chkAutoCopy.checked) {
        window.electronAPI.copyToClipboard(res.translated);
        showToast('Đã tự động sao chép');
      }
    } else {
      setStatus('Lỗi dịch', 'error');
      showToast(res.error || 'Dịch không thành công');
    }
  } catch (err) {
    setStatus('Lỗi dịch', 'error');
    showToast(err.message || 'Lỗi mạng');
  } finally {
    btnTranslate.disabled = false;
  }
}

btnTranslate.addEventListener('click', () => performTranslation());

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

  showToast('Đã đổi chiều dịch');
  performTranslation();
});

// Change Language Selectors -> Re-translate immediately
sourceLang.addEventListener('change', () => performTranslation());
targetLang.addEventListener('change', () => performTranslation());

// Bôi đen chữ bất kỳ trong văn bản gốc -> Dịch riêng cụm đó ngay lập tức!
textOrig.addEventListener('mouseup', () => {
  const start = textOrig.selectionStart;
  const end = textOrig.selectionEnd;
  if (start !== end) {
    const selected = textOrig.value.substring(start, end).trim();
    if (selected.length > 1) {
      showToast(`Đang dịch đoạn bôi đen: "${selected.slice(0, 20)}..."`);
      performTranslation(selected);
    }
  }
});

// Auto-translate on typing after 350ms
textOrig.addEventListener('input', () => {
  if (typingDebounce) clearTimeout(typingDebounce);
  typingDebounce = setTimeout(() => {
    performTranslation();
  }, 350);
});

// Retry OCR
btnRetryOcr.addEventListener('click', async () => {
  setStatus('Đang quét lại chữ...', 'active');
  const langs = ['eng', 'vie'];
  const res = await window.electronAPI.runOcr(langs);
  if (res.success) {
    textOrig.value = res.text || '';
    showToast('Đã quét lại ảnh');
    if (res.text) performTranslation();
  } else {
    setStatus(`Lỗi: ${res.error}`, 'error');
    showToast('Quét lại thất bại');
  }
});

// Copy Buttons
btnCopyOrig.addEventListener('click', async () => {
  const text = textOrig.value;
  if (!text) {
    showToast('Văn bản gốc trống');
    return;
  }
  const res = await window.electronAPI.copyToClipboard(text);
  if (res.success) {
    showToast('Đã sao chép văn bản gốc');
  }
});

btnCopyTrans.addEventListener('click', async () => {
  const text = textTrans.value;
  if (!text) {
    showToast('Bản dịch trống');
    return;
  }
  const res = await window.electronAPI.copyToClipboard(text);
  if (res.success) {
    showToast('Đã sao chép bản dịch');
  }
});

// Save Buttons
btnSaveOrigTxt.addEventListener('click', async () => {
  const text = textOrig.value;
  if (!text.trim()) {
    showToast('Văn bản gốc trống');
    return;
  }
  const res = await window.electronAPI.saveText({ text, defaultName: 'van_ban_goc' });
  if (res && res.success) {
    showToast('Đã lưu văn bản gốc (.txt)');
  }
});

btnSaveTransTxt.addEventListener('click', async () => {
  const text = textTrans.value;
  if (!text.trim()) {
    showToast('Bản dịch trống');
    return;
  }
  const res = await window.electronAPI.saveText({ text, defaultName: 'ban_dich' });
  if (res && res.success) {
    showToast('Đã lưu bản dịch (.txt)');
  }
});
