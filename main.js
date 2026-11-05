const { app, Tray, Menu, globalShortcut, ipcMain, nativeImage, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const { startSnippet } = require('./src/capture/capture');
const { recognizeText, terminateWorker } = require('./src/ocr/ocr');
const { translateText } = require('./src/translation/translate');
const { copyToClipboard } = require('./src/clipboard/clipboard');
const {
  saveScreenshotAuto,
  saveScreenshotAs,
  saveTextAs,
  getHistory,
  addHistoryItem,
  clearHistory,
  getStorageDir
} = require('./src/storage/storage');
const { showFloatingWindow, closeFloatingWindow, getFloatingWindow } = require('./src/windows/floating-window');
const { openSettingsWindow } = require('./src/windows/settings-window');

let tray = null;
let lastCapturedBuffer = null;
let lastCapturedDataUrl = null;

// Ensure single instance lock so background processes don't conflict
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // When a second instance is launched, trigger capture or show window
    triggerScreenCapture();
  });
}

/**
 * Create and configure the Windows System Tray icon.
 */
function createTray() {
  const iconPath = path.join(__dirname, 'assets/icons/tray.png');
  let icon = null;

  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    // Fallback: create an empty 16x16 icon
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('Screen Translator (Press Ctrl + Shift + S)');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Screen Translator',
      click: () => {
        showFloatingWindow();
      }
    },
    {
      label: 'Capture Screen',
      accelerator: 'Ctrl+Shift+S',
      click: () => {
        triggerScreenCapture();
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        openSettingsWindow();
      }
    },
    {
      label: 'Open Captures Folder',
      click: () => {
        shell.openPath(getStorageDir());
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Left click on tray triggers capture or window
  tray.on('click', () => {
    showFloatingWindow();
  });

  // Double click triggers capture
  tray.on('double-click', () => {
    triggerScreenCapture();
  });
}

/**
 * Register global shortcut: Ctrl + Shift + S
 */
function registerShortcuts() {
  try {
    const registered = globalShortcut.register('CommandOrControl+Shift+S', () => {
      triggerScreenCapture();
    });

    if (!registered) {
      console.warn('Warning: Failed to register global shortcut CommandOrControl+Shift+S (may already be in use).');
    } else {
      console.log('Registered global shortcut: CommandOrControl+Shift+S');
    }
  } catch (err) {
    console.error('Error registering global shortcut:', err);
  }
}

/**
 * Execute the full screen capture -> local OCR -> floating window workflow.
 */
function triggerScreenCapture() {
  // If floating window is open, close or hide it during capture
  closeFloatingWindow();

  startSnippet(
    async ({ buffer, dataUrl, rect }) => {
      try {
        lastCapturedBuffer = buffer;
        lastCapturedDataUrl = dataUrl;

        // Auto-save screenshot locally
        const savedPath = saveScreenshotAuto(buffer);

        // Open floating window positioned near the capture selection
        const targetCoords = {
          x: rect ? rect.x + 20 : undefined,
          y: rect ? rect.y + 20 : undefined
        };

        const floating = showFloatingWindow({
          screenshotDataUrl: dataUrl,
          originalText: '',
          translatedText: '',
          isRunningOcr: true
        }, targetCoords);

        // Run OCR locally
        const ocrResult = await recognizeText(buffer, ['eng', 'vie'], progressInfo => {
          if (floating && !floating.isDestroyed()) {
            const p = progressInfo && typeof progressInfo.progress === 'number' ? progressInfo.progress : 0.5;
            floating.webContents.send('ocr:progress', {
              status: progressInfo.status || 'Extracting text...',
              progress: Math.round(p * 100)
            });
          }
        });

        const extractedText = ocrResult.success ? ocrResult.text : '';

        // Auto-translate if text is present
        let translatedText = '';
        if (extractedText) {
          const transResult = await translateText(extractedText, 'auto', 'vi');
          if (transResult.success) {
            translatedText = transResult.translated;
          }
        }

        // Send completed data to floating window
        if (floating && !floating.isDestroyed()) {
          floating.webContents.send('floating:set-data', {
            screenshotDataUrl: dataUrl,
            originalText: extractedText,
            translatedText: translatedText,
            confidence: ocrResult.confidence || 0,
            isRunningOcr: false,
            error: ocrResult.error
          });
        }

        // Save to local history
        if (extractedText) {
          addHistoryItem({
            id: `hist_${Date.now()}`,
            timestamp: new Date().toISOString(),
            imagePath: savedPath,
            originalText: extractedText,
            translatedText: translatedText
          });
        }
      } catch (err) {
        console.error('Error during capture workflow:', err);
      }
    },
    (reason) => {
      console.log('Capture cancelled or dismissed:', reason);
    }
  );
}

// App Ready Lifecycle
app.whenReady().then(() => {
  createTray();
  registerShortcuts();

  // If launched with notification support, inform user that app is running in tray
  if (Notification.isSupported()) {
    try {
      new Notification({
        title: 'Screen Translator',
        body: 'Running in the background. Press Ctrl + Shift + S anytime to translate.'
      }).show();
    } catch (e) {
      // ignore
    }
  }

  console.log('Screen Translator background utility initialized.');
});

// App Quit Handling
app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  await terminateWorker();
});

// Do NOT quit when windows close — stay active in system tray
app.on('window-all-closed', () => {
  // Keep running in background tray
});

// IPC: Close floating window
ipcMain.on('window:close-floating', () => {
  closeFloatingWindow();
});

// IPC: Start Snippet
ipcMain.handle('screen:start-snip', async () => {
  triggerScreenCapture();
  return { status: 'started' };
});

// IPC: Retry OCR with specific languages
ipcMain.handle('ocr:retry', async (event, langs) => {
  if (!lastCapturedBuffer) {
    return { success: false, text: '', error: 'No screenshot available.' };
  }
  return await recognizeText(lastCapturedBuffer, langs || ['eng', 'vie']);
});

// IPC: Translate Text
ipcMain.handle('translate:text', async (event, { text, sourceLang, targetLang }) => {
  return await translateText(text, sourceLang, targetLang);
});

// IPC: Clipboard Copy
ipcMain.handle('clipboard:copy', (event, text) => {
  return copyToClipboard(text);
});

// IPC: Save Screenshot via Dialog
ipcMain.handle('storage:save-screenshot', async (event, dataUrl) => {
  const win = getFloatingWindow();
  let buf = lastCapturedBuffer;
  if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image')) {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    buf = Buffer.from(base64, 'base64');
  }
  if (!buf) {
    return { success: false, error: 'No screenshot available.' };
  }
  const filePath = await saveScreenshotAs(win, buf);
  return { success: !!filePath, filePath };
});

// IPC: Save Text via Dialog
ipcMain.handle('storage:save-text', async (event, { text, defaultName }) => {
  const win = getFloatingWindow();
  if (!text || !text.trim()) {
    return { success: false, error: 'Text is empty.' };
  }
  const filePath = await saveTextAs(win, text, defaultName);
  return { success: !!filePath, filePath };
});

// IPC: History
ipcMain.handle('storage:get-history', () => {
  return getHistory();
});

ipcMain.handle('storage:clear-history', () => {
  return clearHistory();
});

ipcMain.handle('storage:open-folder', () => {
  shell.openPath(getStorageDir());
  return true;
});
