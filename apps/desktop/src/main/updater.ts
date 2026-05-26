import { app, dialog, shell } from 'electron';
import log from 'electron-log/main';

interface VersionInfo {
  version: string;
  downloads: { windows: string; linux: string };
  changelog: string[];
}

export async function checkForUpdates(): Promise<void> {
  try {
    const res = await fetch('http://212.68.34.55/api/version', {
      signal: AbortSignal.timeout(5000) // 5s timeout
    });
    if (!res.ok) return;

    const remote: VersionInfo = await res.json();
    const current = app.getVersion();

    // Basit versiyon karşılaştırma (major.minor.patch)
    if (isNewer(remote.version, current)) {
      log.info(`Yeni sürüm mevcut: ${remote.version}`);

      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'Güncelleme Mevcut',
        message: `ONEServer ${remote.version} yayınlandı!`,
        detail: `Değişiklikler:\n${remote.changelog.map(c => `• ${c}`).join('\n')}`,
        buttons: ['İndir', 'Sonra Hatırlat'],
        defaultId: 0
      });

      if (response === 0) {
        const platform = process.platform === 'win32' ? 'windows' : 'linux';
        shell.openExternal(remote.downloads[platform]);
      }
    }
  } catch (err) {
    log.warn('Güncelleme kontrolü başarısız:', err);
    // Sessizce geç, uygulamayı engelleme
  }
}

function isNewer(remote: string, current: string): boolean {
  const r = remote.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((r[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((r[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}
