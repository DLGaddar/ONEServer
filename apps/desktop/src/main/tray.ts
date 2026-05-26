import { app, Menu, Tray, BrowserWindow, nativeImage } from 'electron';
import path from 'path';
import { BackgroundService } from './BackgroundService';

let tray: Tray | null = null;
let updateInterval: NodeJS.Timeout | null = null;

export function createTray(mainWindow: BrowserWindow | null): Tray {
  if (tray) return tray;

  // Resolve tray icon path. Try public directory first
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  let iconPath = '';
  if (isDev) {
    iconPath = path.join(app.getAppPath(), 'public/icon-tray.png');
  } else {
    // In packaged app, public assets are relative to main or resource folders
    iconPath = path.join(__dirname, '../../public/icon-tray.png');
  }

  let trayIcon = nativeImage.createEmpty();
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch (_) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('ONEServer');

  const updateMenu = () => {
    if (!tray) return;

    const bgService = BackgroundService.getInstance();
    const status = bgService.getStatus();
    const relayStatusText = status.relay === 'connected' ? 'Bağlı' : 'Bağlı Değil';

    bgService.repository.getAll().then((servers) => {
      const serverCount = servers.length;

      const contextMenu = Menu.buildFromTemplate([
        { label: 'ONEServer', enabled: false },
        { type: 'separator' },
        { label: `Durumu: ${serverCount} sunucu izleniyor`, enabled: false },
        { label: `Relay: ${relayStatusText}`, enabled: false },
        { type: 'separator' },
        {
          label: 'Aç',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.show();
              mainWindow.focus();
            }
          }
        },
        {
          label: 'Yeniden Başlat',
          click: () => {
            app.relaunch();
            app.exit(0);
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
            app.quit();
          }
        }
      ]);

      if (tray) {
        tray.setContextMenu(contextMenu);
      }
    }).catch(() => {
      const contextMenu = Menu.buildFromTemplate([
        { label: 'ONEServer', enabled: false },
        { type: 'separator' },
        { label: 'Durum alınamadı', enabled: false },
        { label: `Relay: ${relayStatusText}`, enabled: false },
        { type: 'separator' },
        {
          label: 'Aç',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.show();
              mainWindow.focus();
            }
          }
        },
        {
          label: 'Yeniden Başlat',
          click: () => {
            app.relaunch();
            app.exit(0);
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
            app.quit();
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
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Periodically update context menu every 30s
  updateMenu();
  updateInterval = setInterval(updateMenu, 30000);

  return tray;
}

export function destroyTray(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
