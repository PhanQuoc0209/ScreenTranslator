# Screen Translator (Windows Desktop Application)

A lightweight, secure, and fast desktop application built with Electron and Node.js for screen text capture, local OCR (Optical Character Recognition), and instant English-Vietnamese translation.

---

## 1. Features

- **Rectangular Region Snipping**:
  - Global shortcut: `Ctrl + Shift + S`.
  - Also triggered directly via the "Take Screenshot" button.
  - Interactive snipping overlay with crosshair cursor, real-time bounding box, dimension badge, and Confirm / Cancel controls (`Enter` / `Esc`).
- **Local OCR Recognition**:
  - Powered locally by `Tesseract.js` (no screenshots or images leave the machine).
  - Bilingual support: English and Vietnamese (`eng + vie`), with selective language filtering.
  - Editable text area with character counter and OCR confidence reporting.
- **Instant Translation**:
  - Bidirectional English ⇄ Vietnamese translation.
  - Fast primary endpoint with fallback translation service and graceful offline error handling.
  - One-click swap button (⇄) and auto-detection support.
- **Clipboard & Export**:
  - Copy recognized or translated text directly to Windows clipboard with visual toast feedback.
  - Save cropped screenshot as `.png` file.
  - Save extracted or translated text as `.txt` file.
- **Local History**:
  - Keeps recent capture history (timestamp, original text, translated text).
  - One-click restore from history back into the workspace.

---

## 2. Project Structure & Purpose of Files

```
ScreenTranslator/
├── package.json        # Dependencies (electron, tesseract.js) and start scripts
├── main.js             # Electron main process: lifecycle, global shortcuts, window management, IPC handlers
├── preload.js          # Secure ContextBridge exposing strictly scoped IPC APIs (no raw Node in renderer)
├── index.html          # Lightweight, clean UI for main window
├── styles.css          # Modern native styling (light & dark mode support)
├── overlay.html        # Frameless full-screen interactive snipping overlay canvas
├── test.js             # Automated unit and integration test suite
└── src/
    ├── screenshot.js   # Screen capture via desktopCapturer, DPI-aware cropping & overlay orchestration
    ├── ocr.js          # Local Tesseract.js worker management, recognition, and text cleanup
    ├── translate.js    # Translation engine (EN ⇄ VI) with primary & fallback providers
    ├── clipboard.js    # Windows clipboard read/write operations via Electron native clipboard API
    └── storage.js      # PNG/TXT export dialogs, automated captures storage, and JSON history
```

---

## 3. Security Architecture

- **`contextIsolation: true`**: Renderer JavaScript cannot access Node.js runtime or Electron internals.
- **`nodeIntegration: false`**: Node globals (`require`, `process`, `Buffer`) are disabled in renderer.
- **`sandbox: true`**: Renderer runs in Chromium's sandboxed environment.
- **Secure IPC**: Renderer communicates solely through defined handlers in `preload.js`.
- **Zero hardcoded credentials**: No sensitive keys or external credentials stored on the client.

---

## 4. Running the Application

To run the application:

```bash
cd "C:\Users\Lenovo\.gemini\antigravity\scratch\ScreenTranslator"
npm start
```

To run the automated test suite:

```bash
npm test
```
"# ScreenTranslator" 
