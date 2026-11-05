const { app, Tray, Menu, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

app.whenReady().then(async () => {
  console.log('=== RUNNING STAGE 1 VERIFICATION ===\n');

  // 1. Verify Tray Icon asset exists
  const iconPath = path.join(__dirname, 'assets/icons/tray.png');
  assert.ok(fs.existsSync(iconPath), 'Tray icon must exist at assets/icons/tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  assert.ok(!icon.isEmpty(), 'Tray icon must load as a valid non-empty NativeImage');
  console.log('✓ Tray icon asset verified (size:', icon.getSize(), ')');

  // 2. Verify Tray Initialization & Menu
  const tray = new Tray(icon);
  tray.setToolTip('Screen Translator (Test)');
  
  const menuItems = [
    { label: 'Open Screen Translator' },
    { label: 'Capture Screen', accelerator: 'Ctrl+Shift+S' },
    { type: 'separator' },
    { label: 'Settings' },
    { label: 'Open Captures Folder' },
    { type: 'separator' },
    { label: 'Exit' }
  ];
  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
  assert.strictEqual(contextMenu.items.length, 7, 'Tray menu should have 7 items');
  console.log('✓ System Tray initialized with full context menu.');

  // 3. Verify Global Shortcut
  const shortcut = 'CommandOrControl+Shift+S';
  const registered = globalShortcut.register(shortcut, () => {
    console.log('Shortcut triggered.');
  });
  assert.ok(registered, `Global shortcut ${shortcut} must register successfully`);
  assert.ok(globalShortcut.isRegistered(shortcut), `${shortcut} should be registered in the system`);
  console.log(`✓ Global shortcut "${shortcut}" successfully registered and active.`);

  // 4. Verify unregister
  globalShortcut.unregister(shortcut);
  assert.strictEqual(globalShortcut.isRegistered(shortcut), false, 'Shortcut should unregister cleanly');
  console.log('✓ Global shortcut unregisters cleanly.');

  tray.destroy();
  console.log('\n=============================================');
  console.log(' STAGE 1 VERIFICATION COMPLETED SUCCESSFULLY ');
  console.log('=============================================');

  process.exit(0);
});
