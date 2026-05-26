"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRelayUrl = getRelayUrl;
exports.saveRelayUrl = saveRelayUrl;
exports.getPairingCode = getPairingCode;
exports.savePairingCode = savePairingCode;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const main_1 = __importDefault(require("electron-log/main"));
const DEFAULT_RELAY_URL = 'ws://212.68.34.55:8080';
function getSettingsFilePath() {
    return path_1.default.join(electron_1.app.getPath('userData'), 'settings.json');
}
function getRelayUrl() {
    try {
        const filePath = getSettingsFilePath();
        if (fs_1.default.existsSync(filePath)) {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            if (typeof data.relayUrl === 'string' && data.relayUrl.trim().length > 0) {
                return data.relayUrl.trim();
            }
        }
    }
    catch (error) {
        main_1.default.error('[Settings] Failed to read relayUrl from settings file:', error);
    }
    return DEFAULT_RELAY_URL;
}
function saveRelayUrl(url) {
    try {
        const filePath = getSettingsFilePath();
        let currentData = {};
        if (fs_1.default.existsSync(filePath)) {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            currentData = JSON.parse(content);
        }
        currentData.relayUrl = url.trim();
        fs_1.default.writeFileSync(filePath, JSON.stringify(currentData, null, 2), 'utf-8');
        main_1.default.info(`[Settings] Relay URL successfully saved: ${url}`);
    }
    catch (error) {
        main_1.default.error('[Settings] Failed to write relayUrl to settings file:', error);
    }
}
function getPairingCode() {
    try {
        const filePath = getSettingsFilePath();
        if (fs_1.default.existsSync(filePath)) {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            if (typeof data.pairingCode === 'string' && data.pairingCode.trim().length > 0) {
                return data.pairingCode.trim();
            }
        }
    }
    catch (error) {
        main_1.default.error('[Settings] Failed to read pairingCode from settings file:', error);
    }
    return null;
}
function savePairingCode(code) {
    try {
        const filePath = getSettingsFilePath();
        let currentData = {};
        if (fs_1.default.existsSync(filePath)) {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            currentData = JSON.parse(content);
        }
        currentData.pairingCode = code.trim();
        fs_1.default.writeFileSync(filePath, JSON.stringify(currentData, null, 2), 'utf-8');
        main_1.default.info(`[Settings] Pairing code successfully saved: ${code}`);
    }
    catch (error) {
        main_1.default.error('[Settings] Failed to write pairingCode to settings file:', error);
    }
}
