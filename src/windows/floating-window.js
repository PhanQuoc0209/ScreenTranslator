const { BrowserWindow, screen } = require('electron');
const path = require('path');

let floatingWin = null;

/**
 * Calculate optimal window coordinates near the captured rectangle.
 */
function calculateOptimalPosition(targetCoords, winW, winH) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

  if (!targetCoords || typeof targetCoords.x !== 'number') {
    return {
      x: Math.round((screenW - winW) / 2),
      y: Math.round((screenH - winH) / 2)
    };
  }

  // Try placing to the right of selection
  let posX = targetCoords.x + 12;
  let posY = targetCoords.y;

  // If overflowing right, place to the left of selection if rect bounds were provided
  if (posX + winW > screenW - 12) {
    if (typeof targetCoords.rectX === 'number' && targetCoords.rectX - winW - 12 > 10) {
      posX = targetCoords.rectX - winW - 12;
    } else {
      posX = screenW - winW - 14;
    }
  }

  // Ensure window is within horizontal bounds
  posX = Math.max(10, Math.min(posX, screenW - winW - 10));

  // Ensure window is within vertical bounds
  if (posY + winH > screenH - 12) {
    posY = Math.max(10, screenH - winH - 14);
  }
  posY = Math.max(10, posY);

  return { x: posX, y: posY };
}

/**
 * Create or reuse the compact floating translator window.
 * @param {Object} [initialData] Optional initial data to send to the window.
 * @param {{ x?: number, y?: number, rectX?: number }} [targetCoords] Optional coordinates near capture.
 * @returns {BrowserWindow}
 */
function showFloatingWindow(initialData = null, targetCoords = null) {
  const winW = 470;
  const winH = 540;
  const pos = calculateOptimalPosition(targetCoords, winW, winH);

  if (floatingWin && !floatingWin.isDestroyed()) {
    floatingWin.setPosition(pos.x, pos.y);
    floatingWin.show();
    floatingWin.focus();
    if (initialData) {
      floatingWin.webContents.send('floating:set-data', initialData);
    }
    return floatingWin;
  }

  floatingWin = new BrowserWindow({
    width: winW,
    height: winH,
    minWidth: 380,
    minHeight: 440,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    title: 'Screen Translator',
    webPreferences: {
      preload: path.join(__dirname, '../../preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  floatingWin.loadFile(path.join(__dirname, '../../renderer/index.html'));

  floatingWin.webContents.once('did-finish-load', () => {
    if (initialData && floatingWin && !floatingWin.isDestroyed()) {
      floatingWin.webContents.send('floating:set-data', initialData);
    }
  });

  floatingWin.on('closed', () => {
    floatingWin = null;
  });

  return floatingWin;
}

function closeFloatingWindow() {
  if (floatingWin && !floatingWin.isDestroyed()) {
    floatingWin.hide();
  }
}

function getFloatingWindow() {
  return floatingWin;
}

module.exports = {
  showFloatingWindow,
  closeFloatingWindow,
  getFloatingWindow
};
