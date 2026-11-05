const fs = require('fs');
const path = require('path');
const { app, dialog, shell } = require('electron');

/**
 * Base user data directory for Screen Translator.
 */
function getBaseDir() {
  const baseDir = (app && typeof app.getPath === 'function')
    ? app.getPath('userData')
    : path.join(process.cwd(), 'data');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

/**
 * Captures storage directory.
 */
function getStorageDir() {
  const baseDir = getBaseDir();
  const capturesDir = path.join(baseDir, 'captures');
  if (!fs.existsSync(capturesDir)) {
    fs.mkdirSync(capturesDir, { recursive: true });
  }
  return capturesDir;
}

/**
 * History JSON file path.
 */
function getHistoryFilePath() {
  const baseDir = getBaseDir();
  return path.join(baseDir, 'history.json');
}

/**
 * Read local history.
 * @returns {Array<Object>}
 */
function getHistory() {
  try {
    const file = getHistoryFilePath();
    if (!fs.existsSync(file)) {
      return [];
    }
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data) || [];
  } catch (err) {
    console.error('Failed to read history:', err);
    return [];
  }
}

/**
 * Add history record.
 * @param {Object} item
 */
function addHistoryItem(item) {
  try {
    const history = getHistory();
    history.unshift(item);
    const trimmed = history.slice(0, 50); // limit to 50 items
    fs.writeFileSync(getHistoryFilePath(), JSON.stringify(trimmed, null, 2), 'utf-8');
    return trimmed;
  } catch (err) {
    console.error('Failed to save history item:', err);
    return [];
  }
}

/**
 * Clear history.
 */
function clearHistory() {
  try {
    fs.writeFileSync(getHistoryFilePath(), JSON.stringify([], null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to clear history:', err);
    return false;
  }
}

/**
 * Auto-save screenshot buffer locally.
 * @param {Buffer} buffer
 * @returns {string} File path
 */
function saveScreenshotAuto(buffer) {
  const storageDir = getStorageDir();
  const filename = `screenshot_${Date.now()}.png`;
  const filePath = path.join(storageDir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Save screenshot via Save Dialog.
 * @param {BrowserWindow} window
 * @param {Buffer} buffer
 * @returns {Promise<string|null>}
 */
async function saveScreenshotAs(window, buffer) {
  const defaultDir = app ? app.getPath('pictures') : process.cwd();
  const result = await dialog.showSaveDialog(window, {
    title: 'Save Screenshot as PNG',
    defaultPath: path.join(defaultDir, `screenshot_${Date.now()}.png`),
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, buffer);
    return result.filePath;
  }
  return null;
}

/**
 * Save text via Save Dialog.
 * @param {BrowserWindow} window
 * @param {string} text
 * @param {string} defaultName
 * @returns {Promise<string|null>}
 */
async function saveTextAs(window, text, defaultName = 'extracted_text') {
  const defaultDir = app ? app.getPath('documents') : process.cwd();
  const result = await dialog.showSaveDialog(window, {
    title: 'Save Text as TXT',
    defaultPath: path.join(defaultDir, `${defaultName}_${Date.now()}.txt`),
    filters: [{ name: 'Text File', extensions: ['txt'] }]
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, text, 'utf-8');
    return result.filePath;
  }
  return null;
}

/**
 * Open file in default system viewer.
 * @param {string} filePath
 */
async function openFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    return await shell.openPath(filePath);
  }
  return 'File does not exist';
}

/**
 * Show file in explorer.
 * @param {string} filePath
 */
function showInFolder(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
}

module.exports = {
  getBaseDir,
  getStorageDir,
  getHistory,
  addHistoryItem,
  clearHistory,
  saveScreenshotAuto,
  saveScreenshotAs,
  saveTextAs,
  openFile,
  showInFolder
};
