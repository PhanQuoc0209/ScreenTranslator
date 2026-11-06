const { screen, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const screenshot = require('screenshot-desktop');

let overlayWindow = null;

/**
 * Capture full screen snapshot reliably using native Windows capture.
 * @returns {Promise<import('electron').NativeImage|null>}
 */
async function captureFullScreen() {
  try {
    // 1. Primary: Native Windows screen capture (fast, reliable, handles all Windows sessions)
    const imgBuffer = await screenshot({ format: 'png' });
    if (imgBuffer && imgBuffer.length > 0) {
      const nativeImg = nativeImage.createFromBuffer(imgBuffer);
      if (!nativeImg.isEmpty()) {
        return nativeImg;
      }
    }
  } catch (err) {
    console.warn('Native screenshot failed, trying fallback...', err.message);
  }

  // 2. Fallback: Electron desktopCapturer if native fails
  try {
    const { desktopCapturer } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor || 1;
    const { width, height } = primaryDisplay.size;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scaleFactor),
        height: Math.round(height * scaleFactor)
      },
      fetchWindowIcons: false
    });

    if (sources && sources.length > 0) {
      const source = sources.find(s => s.id.startsWith('screen:0')) || sources[0];
      if (source && source.thumbnail && !source.thumbnail.isEmpty()) {
        return source.thumbnail;
      }
    }
  } catch (fallbackErr) {
    console.error('Fallback desktopCapturer failed:', fallbackErr.message);
  }

  return null;
}

/**
 * Crop NativeImage according to selected rectangle coordinates and scaleFactor.
 * @param {import('electron').NativeImage} image
 * @param {{ x: number, y: number, width: number, height: number }} rect
 * @param {number} scaleFactor
 * @returns {import('electron').NativeImage}
 */
function cropImage(image, rect, scaleFactor = 1) {
  if (!image || image.isEmpty()) {
    throw new Error('Cannot crop empty image / Không thể cắt ảnh từ màn hình trống.');
  }

  const imgSize = image.getSize();
  const scaledX = Math.max(0, Math.floor(rect.x * scaleFactor));
  const scaledY = Math.max(0, Math.floor(rect.y * scaleFactor));
  const scaledW = Math.min(imgSize.width - scaledX, Math.round(rect.width * scaleFactor));
  const scaledH = Math.min(imgSize.height - scaledY, Math.round(rect.height * scaleFactor));

  if (scaledW <= 0 || scaledH <= 0) {
    throw new Error('Selection area is too small / Vùng chọn quá nhỏ.');
  }

  return image.crop({
    x: scaledX,
    y: scaledY,
    width: scaledW,
    height: scaledH
  });
}

/**
 * Launch the fullscreen transparent snipping overlay.
 * @param {Function} onCaptured Callback({ buffer, dataUrl, rect })
 * @param {Function} [onCancelled] Callback(reason)
 */
async function startSnippet(onCaptured, onCancelled) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const scaleFactor = primaryDisplay.scaleFactor || 1;
  const fullScreenshot = await captureFullScreen();

  const { x, y, width, height } = primaryDisplay.bounds;

  overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreen: true,
    enableLargerThanScreen: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../../preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const cleanup = () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.destroy();
    }
    overlayWindow = null;
  };

  ipcMain.once('overlay-confirm', async (event, rect) => {
    try {
      if (!rect || rect.width < 5 || rect.height < 5) {
        cleanup();
        if (onCancelled) onCancelled('Vùng chọn quá nhỏ');
        return;
      }

      let croppedImage = null;
      if (fullScreenshot && !fullScreenshot.isEmpty()) {
        // Calculate true scale between natural screenshot pixels and display bounds
        const imgSize = fullScreenshot.getSize();
        const effectiveScaleX = imgSize.width / width;
        const effectiveScaleY = imgSize.height / height;
        const cropX = Math.round(rect.x * effectiveScaleX);
        const cropY = Math.round(rect.y * effectiveScaleY);
        const cropW = Math.round(rect.width * effectiveScaleX);
        const cropH = Math.round(rect.height * effectiveScaleY);

        croppedImage = fullScreenshot.crop({
          x: cropX,
          y: cropY,
          width: Math.min(cropW, imgSize.width - cropX),
          height: Math.min(cropH, imgSize.height - cropY)
        });
      }

      cleanup();

      if (croppedImage && !croppedImage.isEmpty()) {
        const buffer = croppedImage.toPNG();
        const dataUrl = croppedImage.toDataURL();
        if (onCaptured) {
          onCaptured({ buffer, dataUrl, rect });
        }
      } else {
        if (onCancelled) onCancelled('Không thể cắt vùng ảnh đã chọn');
      }
    } catch (err) {
      console.error('Lỗi khi cắt ảnh chụp:', err);
      cleanup();
      if (onCancelled) onCancelled(err.message);
    }
  });

  ipcMain.once('overlay-cancel', () => {
    cleanup();
    if (onCancelled) onCancelled('Người dùng hủy thao tác chụp');
  });

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));

  overlayWindow.webContents.once('did-finish-load', () => {
    if (fullScreenshot && !fullScreenshot.isEmpty()) {
      overlayWindow.webContents.send('overlay-init', {
        screenshotDataUrl: fullScreenshot.toDataURL(),
        width,
        height,
        scaleFactor
      });
    } else {
      overlayWindow.webContents.send('overlay-init', {
        screenshotDataUrl: null,
        width,
        height,
        scaleFactor
      });
    }
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

module.exports = {
  captureFullScreen,
  cropImage,
  startSnippet
};
