const { contextBridge, ipcRenderer } = require('electron');

/**
 * Secure IPC Context Bridge for Screen Translator.
 * Exposes strictly controlled methods without raw Node.js API access.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Capture actions
  startScreenshot: () => ipcRenderer.invoke('screen:start-snip'),

  // Translation actions
  translate: (payload) => ipcRenderer.invoke('translate:text', payload),

  // OCR actions
  runOcr: (langs) => ipcRenderer.invoke('ocr:retry', langs),
  runOcrSubImage: (subImageDataUrl) => ipcRenderer.invoke('ocr:sub-image', subImageDataUrl),

  // Clipboard actions
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:copy', text),

  // Storage actions
  saveScreenshot: (dataUrl) => ipcRenderer.invoke('storage:save-screenshot', dataUrl),
  saveText: (payload) => ipcRenderer.invoke('storage:save-text', payload),
  getHistory: () => ipcRenderer.invoke('storage:get-history'),
  clearHistory: () => ipcRenderer.invoke('storage:clear-history'),
  openCapturesFolder: () => ipcRenderer.invoke('storage:open-folder'),

  // Window control actions
  closeFloatingWindow: () => ipcRenderer.send('window:close-floating'),

  // Listeners from Main process
  onFloatingSetData: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('floating:set-data', handler);
    return () => ipcRenderer.removeListener('floating:set-data', handler);
  },
  onOcrProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('ocr:progress', handler);
    return () => ipcRenderer.removeListener('ocr:progress', handler);
  },

  // Overlay specific IPC
  onOverlayInit: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('overlay-init', handler);
    return () => ipcRenderer.removeListener('overlay-init', handler);
  },
  confirmOverlay: (rect) => ipcRenderer.send('overlay-confirm', rect),
  cancelOverlay: () => ipcRenderer.send('overlay-cancel')
});
