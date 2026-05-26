"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkForUpdates = checkForUpdates;
const electron_1 = require("electron");
const main_1 = __importDefault(require("electron-log/main"));
async function checkForUpdates() {
    try {
        const res = await fetch('http://212.68.34.55/api/version', {
            signal: AbortSignal.timeout(5000) // 5s timeout
        });
        if (!res.ok)
            return;
        const remote = await res.json();
        const current = electron_1.app.getVersion();
        // Basit versiyon karşılaştırma (major.minor.patch)
        if (isNewer(remote.version, current)) {
            main_1.default.info(`Yeni sürüm mevcut: ${remote.version}`);
            const { response } = await electron_1.dialog.showMessageBox({
                type: 'info',
                title: 'Güncelleme Mevcut',
                message: `ONEServer ${remote.version} yayınlandı!`,
                detail: `Değişiklikler:\n${remote.changelog.map(c => `• ${c}`).join('\n')}`,
                buttons: ['İndir', 'Sonra Hatırlat'],
                defaultId: 0
            });
            if (response === 0) {
                const platform = process.platform === 'win32' ? 'windows' : 'linux';
                electron_1.shell.openExternal(remote.downloads[platform]);
            }
        }
    }
    catch (err) {
        main_1.default.warn('Güncelleme kontrolü başarısız:', err);
        // Sessizce geç, uygulamayı engelleme
    }
}
function isNewer(remote, current) {
    const r = remote.split('.').map(Number);
    const c = current.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((r[i] ?? 0) > (c[i] ?? 0))
            return true;
        if ((r[i] ?? 0) < (c[i] ?? 0))
            return false;
    }
    return false;
}
