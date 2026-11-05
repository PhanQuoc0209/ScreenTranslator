const { clipboard } = require('electron');

/**
 * Copy text directly to the Windows clipboard.
 * @param {string} text Text to write to clipboard.
 * @returns {{ success: boolean, length: number, error?: string }}
 */
function copyToClipboard(text) {
  try {
    if (typeof text !== 'string') {
      text = String(text || '');
    }
    clipboard.writeText(text);
    return { success: true, length: text.length };
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Read current text from the clipboard.
 * @returns {string} Text currently in clipboard.
 */
function readFromClipboard() {
  try {
    return clipboard.readText();
  } catch (err) {
    console.error('Failed to read from clipboard:', err);
    return '';
  }
}

module.exports = {
  copyToClipboard,
  readFromClipboard
};
