"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTray = createTray;
exports.destroyTray = destroyTray;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const BackgroundService_1 = require("./BackgroundService");
let tray = null;
let updateInterval = null;
function createTray(mainWindow) {
    if (tray)
        return tray;
    // Resolve tray icon path. Try public directory first
    const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
    let iconPath = '';
    if (isDev) {
        iconPath = path_1.default.join(electron_1.app.getAppPath(), 'public/icon-tray.png');
    }
    else {
        // In packaged app, public assets are relative to main or resource folders
        iconPath = path_1.default.join(__dirname, '../../public/icon-tray.png');
    }
    let trayIcon = electron_1.nativeImage.createEmpty();
    try {
        trayIcon = electron_1.nativeImage.createFromPath(iconPath);
        if (trayIcon.isEmpty()) {
            trayIcon = electron_1.nativeImage.createEmpty();
        }
    }
    catch (_) {
        trayIcon = electron_1.nativeImage.createEmpty();
    }
    tray = new electron_1.Tray(trayIcon);
    tray.setToolTip('ONEServer');
    const updateMenu = () => {
        if (!tray)
            return;
        const bgService = BackgroundService_1.BackgroundService.getInstance();
        const status = bgService.getStatus();
        const relayStatusText = status.relay === 'connected' ? 'Bağlı' : 'Bağlı Değil';
        bgService.repository.getAll().then((servers) => {
            const serverCount = servers.length;
            const contextMenu = electron_1.Menu.buildFromTemplate([
                { label: 'ONEServer', enabled: false },
                { type: 'separator' },
                { label: `Durumu: ${serverCount} sunucu izleniyor`, enabled: false },
                { label: `Relay: ${relayStatusText}`, enabled: false },
                { type: 'separator' },
                {
                    label: 'Aç',
                    click: () => {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            if (mainWindow.isMinimized())
                                mainWindow.restore();
                            mainWindow.show();
                            mainWindow.focus();
                        }
                    }
                },
                {
                    label: 'Yeniden Başlat',
                    click: () => {
                        electron_1.app.relaunch();
                        electron_1.app.exit(0);
                    }
                },
                { type: 'separator' },
                {
                    label: 'Çıkış',
                    click: () => {
                        bgService.stop();
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.destroy();
                        }
                        electron_1.app.quit();
                    }
                }
            ]);
            if (tray) {
                tray.setContextMenu(contextMenu);
            }
        }).catch(() => {
            const contextMenu = electron_1.Menu.buildFromTemplate([
                { label: 'ONEServer', enabled: false },
                { type: 'separator' },
                { label: 'Durum alınamadı', enabled: false },
                { label: `Relay: ${relayStatusText}`, enabled: false },
                { type: 'separator' },
                {
                    label: 'Aç',
                    click: () => {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            if (mainWindow.isMinimized())
                                mainWindow.restore();
                            mainWindow.show();
                            mainWindow.focus();
                        }
                    }
                },
                {
                    label: 'Yeniden Başlat',
                    click: () => {
                        electron_1.app.relaunch();
                        electron_1.app.exit(0);
                    }
                },
                { type: 'separator' },
                {
                    label: 'Çıkış',
                    click: () => {
                        bgService.stop();
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.destroy();
                        }
                        electron_1.app.quit();
                    }
                }
            ]);
            if (tray) {
                tray.setContextMenu(contextMenu);
            }
        });
    };
    // Double click tray to open window
    tray.on('double-click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
    // Periodically update context menu every 30s
    updateMenu();
    updateInterval = setInterval(updateMenu, 30000);
    return tray;
}
function destroyTray() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    if (tray) {
        tray.destroy();
        tray = null;
    }
}
