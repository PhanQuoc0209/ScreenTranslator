const { BrowserWindow, dialog } = require('electron');
const path = require('path');
const { getStorageDir } = require('../storage/storage');

let settingsWin = null;

function openSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return settingsWin;
  }

  // Show a clean native dialog or window for settings
  dialog.showMessageBox({
    type: 'info',
    title: 'Screen Translator - Settings',
    message: 'Screen Translator Background Utility',
    detail: `• Global Shortcut: Ctrl + Shift + S\n• Captures Folder: ${getStorageDir()}\n• Default Languages: English → Vietnamese\n• OCR Engine: Tesseract.js (Local)\n\nThe application runs in your Windows System Tray. Click the tray icon or press Ctrl + Shift + S anytime to capture.`,
    buttons: ['OK']
  });

  return null;
}

module.exports = {
  openSettingsWindow
};
