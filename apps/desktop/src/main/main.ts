import { app, BrowserWindow } from 'electron';
import path from 'path';
import log from 'electron-log/main';
import { runMigrations } from './db';
import { setupIpc } from './ipc';
import { checkForUpdates } from './updater';
import { BackgroundService } from './BackgroundService';
import { createTray, destroyTray } from './tray';

// Initialize logging
log.initialize();
log.info('--------------------------------------------');
log.info('ONEServer Desktop Application starting...');

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  log.info('[Main] Creating BrowserWindow...');

  // Set up IPC handles first
  setupIpc();

  // Setup database & migrations
  try {
    await runMigrations();
  } catch (err) {
    log.error('[Main] CRITICAL: Failed to run migrations, database could be locked or corrupted.', err);
  }

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  log.info(`[Main] Running in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

  const preloadPath = path.join(__dirname, '../preload/preload.js');
  log.info(`[Main] Loading preload script from: ${preloadPath}`);

  mainWindow = new BrowserWindow({
    width: 1150,
    height: 780,
    minWidth: 950,
    minHeight: 650,
    title: 'ONEServer',
    frame: true,
    show: false,
    backgroundColor: '#0f172a', // matching deep slate dark theme
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.removeMenu(); // Modern frameless feel (sleek, without browser menu bars)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    log.info('[Main] Main Window ready-to-show. Revealing...');
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow?.hide();
    log.info('[Main] Window minimized to tray.');
  });

  mainWindow.on('closed', () => {
    log.info('[Main] Main Window closed.');
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Set up login item settings for auto-start at startup
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe'),
      args: ['--hidden']
    });
    log.info('[Main] Auto-start at login successfully enabled.');
  } catch (err) {
    log.error('[Main] Failed to set login item settings:', err);
  }

  // Start background service
  BackgroundService.getInstance().start();

  await createWindow();

  // Create System Tray
  createTray(mainWindow);

  // 3 saniye bekle, önce UI açılsın
  setTimeout(() => checkForUpdates(), 3000);
});

// Handle app termination safely
app.on('before-quit', () => {
  log.info('[Main] before-quit event received. Stopping background service.');
  BackgroundService.getInstance().stop();
  destroyTray();
});

// Do NOT quit when windows are closed (keep app running in background tray)
app.on('window-all-closed', () => {
  log.info('[Main] All windows closed. Keeping application alive in background tray.');
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});
