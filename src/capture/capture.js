const { desktopCapturer, screen, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let overlayWindow = null;

/**
 * Capture full screen snapshot using desktopCapturer.
 * @returns {Promise<import('electron').NativeImage|null>}
 */
async function captureFullScreen() {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor || 1;
    const { width, height } = primaryDisplay.size;

    const targetWidth = Math.round(width * scaleFactor);
    const targetHeight = Math.round(height * scaleFactor);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: targetWidth, height: targetHeight },
      fetchWindowIcons: false
    });

    if (sources && sources.length > 0) {
      const source = sources.find(s => s.id.startsWith('screen:0')) || sources[0];
      if (source && source.thumbnail && !source.thumbnail.isEmpty()) {
        return source.thumbnail;
      }
    }
    return null;
  } catch (err) {
    console.error('Error capturing full screen:', err);
    return null;
  }
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
    throw new Error('Cannot crop empty image.');
  }

  const imgSize = image.getSize();
  const scaledX = Math.max(0, Math.floor(rect.x * scaleFactor));
  const scaledY = Math.max(0, Math.floor(rect.y * scaleFactor));
  const scaledW = Math.min(imgSize.width - scaledX, Math.round(rect.width * scaleFactor));
  const scaledH = Math.min(imgSize.height - scaledY, Math.round(rect.height * scaleFactor));

  if (scaledW <= 0 || scaledH <= 0) {
    throw new Error('Selection area is too small.');
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
        if (onCancelled) onCancelled('Selection too small');
        return;
      }

      let croppedImage = null;
      if (fullScreenshot && !fullScreenshot.isEmpty()) {
        croppedImage = cropImage(fullScreenshot, rect, scaleFactor);
      }

      cleanup();

      if (croppedImage) {
        const buffer = croppedImage.toPNG();
        const dataUrl = croppedImage.toDataURL();
        if (onCaptured) {
          onCaptured({ buffer, dataUrl, rect });
        }
      } else {
        if (onCancelled) onCancelled('Captured buffer empty');
      }
    } catch (err) {
      console.error('Failed processing crop:', err);
      cleanup();
      if (onCancelled) onCancelled(err.message);
    }
  });

  ipcMain.once('overlay-cancel', () => {
    cleanup();
    if (onCancelled) onCancelled('User cancelled screenshot');
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
