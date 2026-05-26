"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const main_1 = __importDefault(require("electron-log/main"));
const db_1 = require("./db");
const ipc_1 = require("./ipc");
const updater_1 = require("./updater");
const BackgroundService_1 = require("./BackgroundService");
const tray_1 = require("./tray");
// Initialize logging
main_1.default.initialize();
main_1.default.info('--------------------------------------------');
main_1.default.info('ONEServer Desktop Application starting...');
let mainWindow = null;
async function createWindow() {
    main_1.default.info('[Main] Creating BrowserWindow...');
    // Set up IPC handles first
    (0, ipc_1.setupIpc)();
    // Setup database & migrations
    try {
        await (0, db_1.runMigrations)();
    }
    catch (err) {
        main_1.default.error('[Main] CRITICAL: Failed to run migrations, database could be locked or corrupted.', err);
    }
    const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
    main_1.default.info(`[Main] Running in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
    const preloadPath = path_1.default.join(__dirname, '../preload/preload.js');
    main_1.default.info(`[Main] Loading preload script from: ${preloadPath}`);
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../../dist/index.html'));
    }
    mainWindow.once('ready-to-show', () => {
        main_1.default.info('[Main] Main Window ready-to-show. Revealing...');
        mainWindow?.show();
    });
    mainWindow.on('close', (event) => {
        event.preventDefault();
        mainWindow?.hide();
        main_1.default.info('[Main] Window minimized to tray.');
    });
    mainWindow.on('closed', () => {
        main_1.default.info('[Main] Main Window closed.');
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(async () => {
    // Set up login item settings for auto-start at startup
    try {
        electron_1.app.setLoginItemSettings({
            openAtLogin: true,
            path: electron_1.app.getPath('exe'),
            args: ['--hidden']
        });
        main_1.default.info('[Main] Auto-start at login successfully enabled.');
    }
    catch (err) {
        main_1.default.error('[Main] Failed to set login item settings:', err);
    }
    // Start background service
    BackgroundService_1.BackgroundService.getInstance().start();
    await createWindow();
    // Create System Tray
    (0, tray_1.createTray)(mainWindow);
    // 3 saniye bekle, önce UI açılsın
    setTimeout(() => (0, updater_1.checkForUpdates)(), 3000);
});
// Handle app termination safely
electron_1.app.on('before-quit', () => {
    main_1.default.info('[Main] before-quit event received. Stopping background service.');
    BackgroundService_1.BackgroundService.getInstance().stop();
    (0, tray_1.destroyTray)();
});
// Do NOT quit when windows are closed (keep app running in background tray)
electron_1.app.on('window-all-closed', () => {
    main_1.default.info('[Main] All windows closed. Keeping application alive in background tray.');
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
    else {
        mainWindow.show();
    }
});
