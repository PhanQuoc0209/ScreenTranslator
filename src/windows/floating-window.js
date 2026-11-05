const { BrowserWindow, screen } = require('electron');
const path = require('path');

let floatingWin = null;

/**
 * Create or reuse the compact floating translator window.
 * @param {Object} [initialData] Optional initial data to send to the window.
 * @param {{ x?: number, y?: number }} [targetCoords] Optional coordinates near capture.
 * @returns {BrowserWindow}
 */
function showFloatingWindow(initialData = null, targetCoords = null) {
  if (floatingWin && !floatingWin.isDestroyed()) {
    floatingWin.show();
    floatingWin.focus();
    if (initialData) {
      floatingWin.webContents.send('floating:set-data', initialData);
    }
    return floatingWin;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

  const winW = 460;
  const winH = 520;

  // Position nicely on screen: near coordinates or near bottom-right
  let posX = Math.round((screenW - winW) / 2);
  let posY = Math.round((screenH - winH) / 2);

  if (targetCoords && typeof targetCoords.x === 'number') {
    posX = Math.min(Math.max(20, targetCoords.x), screenW - winW - 20);
    posY = Math.min(Math.max(20, targetCoords.y), screenH - winH - 20);
  }

  floatingWin = new BrowserWindow({
    width: winW,
    height: winH,
    minWidth: 380,
    minHeight: 420,
    x: posX,
    y: posY,
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
