import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log/main';

const DEFAULT_RELAY_URL = 'ws://212.68.34.55:8080';

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function getRelayUrl(): string {
  try {
    const filePath = getSettingsFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (typeof data.relayUrl === 'string' && data.relayUrl.trim().length > 0) {
        return data.relayUrl.trim();
      }
    }
  } catch (error) {
    log.error('[Settings] Failed to read relayUrl from settings file:', error);
  }
  return DEFAULT_RELAY_URL;
}

export function saveRelayUrl(url: string): void {
  try {
    const filePath = getSettingsFilePath();
    let currentData: any = {};
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      currentData = JSON.parse(content);
    }
    currentData.relayUrl = url.trim();
    fs.writeFileSync(filePath, JSON.stringify(currentData, null, 2), 'utf-8');
    log.info(`[Settings] Relay URL successfully saved: ${url}`);
  } catch (error) {
    log.error('[Settings] Failed to write relayUrl to settings file:', error);
  }
}

export function getPairingCode(): string | null {
  try {
    const filePath = getSettingsFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (typeof data.pairingCode === 'string' && data.pairingCode.trim().length > 0) {
        return data.pairingCode.trim();
      }
    }
  } catch (error) {
    log.error('[Settings] Failed to read pairingCode from settings file:', error);
  }
  return null;
}

export function savePairingCode(code: string): void {
  try {
    const filePath = getSettingsFilePath();
    let currentData: any = {};
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      currentData = JSON.parse(content);
    }
    currentData.pairingCode = code.trim();
    fs.writeFileSync(filePath, JSON.stringify(currentData, null, 2), 'utf-8');
    log.info(`[Settings] Pairing code successfully saved: ${code}`);
  } catch (error) {
    log.error('[Settings] Failed to write pairingCode to settings file:', error);
  }
}
