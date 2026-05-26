"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupIpc = setupIpc;
const electron_1 = require("electron");
const core_1 = require("@oneserver/core");
const main_1 = __importDefault(require("electron-log/main"));
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const qrcode_1 = __importDefault(require("qrcode"));
const settings_1 = require("./settings");
const net_1 = __importDefault(require("net"));
const updater_1 = require("./updater");
const BackgroundService_1 = require("./BackgroundService");
function pingPort(host, port, timeoutMs = 5000) {
    return new Promise((resolve) => {
        const socket = new net_1.default.Socket();
        let resolved = false;
        socket.setTimeout(timeoutMs);
        socket.on('connect', () => {
            if (!resolved) {
                resolved = true;
                resolve(true);
                socket.destroy();
            }
        });
        socket.on('timeout', () => {
            if (!resolved) {
                resolved = true;
                resolve(false);
                socket.destroy();
            }
        });
        socket.on('error', () => {
            if (!resolved) {
                resolved = true;
                resolve(false);
                socket.destroy();
            }
        });
        socket.connect(port, host);
    });
}
const bgService = BackgroundService_1.BackgroundService.getInstance();
const repository = bgService.repository;
const sshManager = bgService.sshManager;
const serverMonitor = bgService.serverMonitor;
const dockerManager = bgService.dockerManager;
const pairingManager = bgService.pairingManager;
// ── Active mobile metrics polling tracker ──────────────────────────────────
const mobilePollingActive = new Set(); // serverIds currently being polled for mobile
async function startMobileMetricsPush() {
    main_1.default.info('[MobileSync] 📡 Mobile paired – starting metrics push loop...');
    console.log('DEBUG [MobileSync]: startMobileMetricsPush() called');
    let servers = [];
    try {
        servers = await repository.getAll();
        console.log(`DEBUG [MobileSync]: Found ${servers.length} server(s) in DB`);
    }
    catch (err) {
        main_1.default.error('[MobileSync] Failed to load servers:', err.message);
        return;
    }
    if (servers.length === 0) {
        main_1.default.warn('[MobileSync] No servers in database – nothing to poll.');
        return;
    }
    for (const server of servers) {
        if (mobilePollingActive.has(server.id)) {
            main_1.default.info(`[MobileSync] Already polling ${server.id}, skipping.`);
            continue;
        }
        // Ensure SSH is connected before we can collect metrics
        const status = sshManager.getConnectionStatus(server.id);
        if (status !== 'connected') {
            try {
                main_1.default.info(`[MobileSync] SSH not connected for ${server.id}, connecting now...`);
                console.log(`DEBUG [MobileSync]: Connecting SSH to ${server.nickname} (${server.ip})`);
                await sshManager.connect(server);
            }
            catch (err) {
                main_1.default.error(`[MobileSync] SSH connect failed for ${server.id}: ${err.message}`);
                // Push an offline entry so mobile shows the server as offline
                pairingManager.sendMetrics({
                    servers: [{
                            serverId: server.id,
                            nickname: server.nickname,
                            ip: server.ip,
                            status: 'offline',
                            cpu: { percent: 0 },
                            ram: { percent: 0 },
                            disk: { percent: 0 },
                            dockerCount: 0,
                            containers: [],
                            collectedAt: new Date().toISOString(),
                        }],
                    timestamp: Date.now(),
                });
                continue;
            }
        }
        mobilePollingActive.add(server.id);
        main_1.default.info(`[MobileSync] Starting 30s metrics poll for server ${server.id} (${server.nickname})`);
        console.log(`DEBUG [MobileSync]: serverMonitor.startPolling('${server.id}') called`);
        serverMonitor.startPolling(server.id, async (metrics) => {
            console.log(`DEBUG [MobileSync]: Metrikler toplandı: CPU=${metrics.cpu.percent}% RAM=${metrics.ram.percent}% Disk=${metrics.disk.percent}%`);
            if (pairingManager.isPaired) {
                console.log(`DEBUG [MobileSync]: Mobil bağlı, veri basılıyor...`);
                let containers = [];
                try {
                    containers = await dockerManager.containers.listContainers(server.id);
                }
                catch (dockerErr) {
                    main_1.default.warn(`[MobileSync] Failed to list docker containers for server ${server.id}: ${dockerErr.message}`);
                }
                // Wrap in the envelope format: { servers: [...], timestamp: N }
                // Each server entry uses nested cpu/ram/disk objects to match ServerMetricsModel.fromJson()
                pairingManager.sendMetrics({
                    servers: [{
                            serverId: metrics.serverId,
                            nickname: server.nickname,
                            ip: server.ip,
                            status: 'online',
                            cpu: { percent: metrics.cpu.percent },
                            ram: { percent: metrics.ram.percent },
                            disk: { percent: metrics.disk.percent },
                            dockerCount: containers.length,
                            containers: containers,
                            collectedAt: metrics.collectedAt.toISOString(),
                        }],
                    timestamp: Date.now(),
                });
                main_1.default.info(`[MobileSync] ✅ Metrics pushed to mobile for server ${server.id} (Containers: ${containers.length})`);
            }
            else {
                console.log('DEBUG [MobileSync]: Mobil bağlı değil, veri atlandı.');
            }
        }, 30000);
    }
}
function stopMobileMetricsPush() {
    main_1.default.info('[MobileSync] Stopping all mobile metrics polling...');
    for (const serverId of mobilePollingActive) {
        serverMonitor.stopPolling(serverId);
    }
    mobilePollingActive.clear();
}
// ── Relay connection state logging ─────────────────────────────────────────
pairingManager.onConnected = (relayUrl) => {
    main_1.default.info(`[PairingManager] ✅ Connected to relay: ${relayUrl}`);
    const win = electron_1.BrowserWindow.getAllWindows()[0];
    win?.webContents.send('pairing:relay-status', { connected: true, relayUrl });
};
pairingManager.onDisconnected = () => {
    main_1.default.warn('[PairingManager] 🔌 Disconnected from relay');
    stopMobileMetricsPush();
    const win = electron_1.BrowserWindow.getAllWindows()[0];
    win?.webContents.send('pairing:relay-status', { connected: false });
};
// ── Mobile paired: start push loop ─────────────────────────────────────────
pairingManager.onMobilePaired = async (deviceId) => {
    clearPairingExpiryTimer();
    main_1.default.info(`[PairingManager] 📱 Mobile paired: ${deviceId} – initiating metrics push`);
    console.log(`DEBUG [IPC]: Mobile paired event fired for device ${deviceId}`);
    const win = electron_1.BrowserWindow.getAllWindows()[0];
    win?.webContents.send('pairing:status-change', { paired: true, deviceId });
    await startMobileMetricsPush();
};
pairingManager.onError = (err) => {
    main_1.default.error('[PairingManager] ❌ Relay connection error:', err.message);
    const win = electron_1.BrowserWindow.getAllWindows()[0];
    win?.webContents.send('pairing:relay-status', { connected: false, error: err.message });
};
// Setup mobile command handler for docker/reboot commands
pairingManager.onMobileCommand(async (cmd) => {
    main_1.default.info(`[IPC] Received mobile payload: ${JSON.stringify(cmd)}`);
    try {
        // pair:confirm is handled by onMobilePaired — skip here
        if (cmd.action === 'pair:confirm')
            return;
        if (cmd.action === 'docker:restart' && cmd.containerId) {
            main_1.default.info(`[IPC] Restarting container ${cmd.containerId} on ${cmd.serverId} via mobile`);
            await dockerManager.control.restart(cmd.serverId, cmd.containerId);
            main_1.default.info(`[IPC] Restart success.`);
        }
        else if (cmd.action === 'server:reboot') {
            main_1.default.info(`[IPC] Rebooting remote host ${cmd.serverId} via mobile`);
            await sshManager.executeCommand(cmd.serverId, 'sudo reboot');
            main_1.default.info(`[IPC] Reboot command sent.`);
        }
        // Notify React renderer of executed command
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (win) {
            win.webContents.send('pairing:command-executed', cmd);
        }
    }
    catch (error) {
        main_1.default.error(`[IPC] Mobile command execution failed:`, error);
    }
});
function generatePairingCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        if (i === 4)
            code += '-';
        code += chars.charAt(crypto_1.default.randomInt(chars.length));
    }
    return code;
}
// Broadcaster piping core SSH manager logs directly to the active BrowserWindow
core_1.Logger.addListener((level, msg) => {
    main_1.default.info(`[CoreLogger] [${level}] ${msg}`);
    const win = electron_1.BrowserWindow.getAllWindows()[0];
    if (win) {
        win.webContents.send('ssh:log-event', {
            level,
            msg,
            time: new Date().toLocaleTimeString()
        });
    }
});
let pairingExpiryTimeout = null;
function startPairingExpiryTimer() {
    if (pairingExpiryTimeout) {
        clearTimeout(pairingExpiryTimeout);
    }
    main_1.default.info('[PairingExpiry] Starting 5-minute pairing code expiration timer...');
    pairingExpiryTimeout = setTimeout(async () => {
        if (!pairingManager.isPaired) {
            main_1.default.warn('[PairingExpiry] ⏳ Pairing code expired (5 minutes reached without mobile scan). Destroying session...');
            pairingManager.disconnect();
            (0, settings_1.savePairingCode)('');
            const win = electron_1.BrowserWindow.getAllWindows()[0];
            if (win) {
                win.webContents.send('pairing:status-change', { paired: false, expired: true });
            }
        }
    }, 5 * 60 * 1000); // 5 minutes
}
function clearPairingExpiryTimer() {
    if (pairingExpiryTimeout) {
        main_1.default.info('[PairingExpiry] Clearing pairing code expiration timer (Pairing successful or manually disconnected).');
        clearTimeout(pairingExpiryTimeout);
        pairingExpiryTimeout = null;
    }
}
function setupIpc() {
    main_1.default.info('[IPC] Registering secure IPC handlers for server & SSH operations...');
    // Auto-start pairing session on boot!
    try {
        const url = (0, settings_1.getRelayUrl)();
        let pairingCode = (0, settings_1.getPairingCode)();
        if (!pairingCode) {
            pairingCode = generatePairingCode();
            (0, settings_1.savePairingCode)(pairingCode);
            main_1.default.info(`[IPC] No saved pairing code found. Generated persistent code: ${pairingCode}`);
        }
        main_1.default.info(`[IPC] Auto-initiating pairing connection to relay: ${url} code: ${pairingCode}`);
        pairingManager.connect(url, pairingCode);
        startPairingExpiryTimer();
    }
    catch (autoErr) {
        main_1.default.error('[IPC] Failed to auto-start pairing connection:', autoErr.message);
    }
    // --- SERVERS DATABASE OPERATIONS ---
    // Get All
    electron_1.ipcMain.handle('servers:getAll', async () => {
        try {
            return await repository.getAll();
        }
        catch (error) {
            main_1.default.error('[IPC] Failed to get all servers:', error);
            throw new Error(error.message || 'Failed to fetch servers');
        }
    });
    // Get By ID
    electron_1.ipcMain.handle('servers:getById', async (_event, id) => {
        try {
            return await repository.getById(id);
        }
        catch (error) {
            main_1.default.error(`[IPC] Failed to get server by ID ${id}:`, error);
            throw new Error(error.message || `Failed to fetch server with ID ${id}`);
        }
    });
    // Add
    electron_1.ipcMain.handle('servers:add', async (_event, input) => {
        try {
            return await repository.add(input);
        }
        catch (error) {
            main_1.default.error('[IPC] Failed to add server:', error);
            if (error instanceof zod_1.ZodError) {
                throw new Error(JSON.stringify(error.errors));
            }
            throw new Error(error.message || 'Failed to add server');
        }
    });
    // Update
    electron_1.ipcMain.handle('servers:update', async (_event, input) => {
        try {
            return await repository.update(input);
        }
        catch (error) {
            main_1.default.error(`[IPC] Failed to update server ${input?.id}:`, error);
            if (error instanceof zod_1.ZodError) {
                throw new Error(JSON.stringify(error.errors));
            }
            throw new Error(error.message || 'Failed to update server');
        }
    });
    // Delete
    electron_1.ipcMain.handle('servers:remove', async (_event, id) => {
        try {
            return await repository.remove(id);
        }
        catch (error) {
            main_1.default.error(`[IPC] Failed to remove server ${id}:`, error);
            throw new Error(error.message || 'Failed to remove server');
        }
    });
    // --- SSH OPERATIONS ---
    // Connect
    electron_1.ipcMain.handle('ssh:connect', async (_event, config) => {
        try {
            main_1.default.info(`[IPC] Connecting SSH to server: ${config.id}`);
            return await sshManager.connect(config);
        }
        catch (error) {
            main_1.default.error(`[IPC] Connection error:`, error);
            throw new Error(error.message || 'Failed to connect');
        }
    });
    // Disconnect
    electron_1.ipcMain.handle('ssh:disconnect', async (_event, serverId) => {
        try {
            main_1.default.info(`[IPC] Disconnecting SSH server: ${serverId}`);
            return sshManager.disconnect(serverId);
        }
        catch (error) {
            main_1.default.error(`[IPC] Disconnect error:`, error);
            throw new Error(error.message || 'Failed to disconnect');
        }
    });
    // Execute Command
    electron_1.ipcMain.handle('ssh:executeCommand', async (_event, serverId, command) => {
        try {
            main_1.default.info(`[IPC] Running command on ${serverId}: ${command}`);
            return await sshManager.executeCommand(serverId, command);
        }
        catch (error) {
            main_1.default.error(`[IPC] Command execution error on ${serverId}:`, error);
            throw new Error(error.message || 'Command execution failed');
        }
    });
    // Get Connection Status
    electron_1.ipcMain.handle('ssh:getStatus', async (_event, serverId) => {
        try {
            return sshManager.getConnectionStatus(serverId);
        }
        catch (error) {
            return 'disconnected';
        }
    });
    // Ping server host & port
    electron_1.ipcMain.handle('ssh:ping', async (_event, host, port) => {
        try {
            return await pingPort(host, port);
        }
        catch (error) {
            return false;
        }
    });
    // Collect Server metrics
    electron_1.ipcMain.handle('ssh:collectMetrics', async (_event, serverId) => {
        try {
            main_1.default.info(`[IPC] Collecting metrics for server: ${serverId}`);
            return await serverMonitor.collectMetrics(serverId);
        }
        catch (error) {
            main_1.default.error(`[IPC] Metrics collection failed for ${serverId}:`, error);
            throw new Error(error.message || 'Failed to collect server metrics');
        }
    });
    // List Docker containers
    electron_1.ipcMain.handle('docker:listContainers', async (_event, serverId) => {
        try {
            main_1.default.info(`[IPC] Listing docker containers for server: ${serverId}`);
            return await dockerManager.containers.listContainers(serverId);
        }
        catch (error) {
            main_1.default.error(`[IPC] Docker list containers failed for ${serverId}:`, error);
            throw new Error(error.message || 'Failed to list docker containers');
        }
    });
    // --- PAIRING OPERATIONS ---
    // Generate pairing code & QR code
    electron_1.ipcMain.handle('pairing:generate', async () => {
        try {
            const pairingCode = generatePairingCode();
            const url = (0, settings_1.getRelayUrl)();
            (0, settings_1.savePairingCode)(pairingCode);
            // QR encodes JSON with both fields so mobile can auto-fill relay URL
            const qrPayload = JSON.stringify({ pairingCode, relayUrl: url });
            const qrDataUrl = await qrcode_1.default.toDataURL(qrPayload);
            main_1.default.info(`[IPC] Connecting pairing to relay: ${url} code: ${pairingCode}`);
            pairingManager.connect(url, pairingCode);
            startPairingExpiryTimer();
            return { pairingCode, qrDataUrl, relayUrl: url };
        }
        catch (error) {
            main_1.default.error('[IPC] Failed to generate pairing details:', error);
            throw new Error(error.message || 'Failed to generate pairing details');
        }
    });
    // Get pairing status and active details
    electron_1.ipcMain.handle('pairing:getStatus', async () => {
        const code = (0, settings_1.getPairingCode)();
        const url = (0, settings_1.getRelayUrl)();
        let qrDataUrl;
        if (code) {
            try {
                const qrPayload = JSON.stringify({ pairingCode: code, relayUrl: url });
                qrDataUrl = await qrcode_1.default.toDataURL(qrPayload);
            }
            catch (_) { }
        }
        return {
            paired: pairingManager.isPaired,
            deviceId: pairingManager.pairedDeviceId || undefined,
            pairingCode: code || undefined,
            qrDataUrl,
            relayUrl: url
        };
    });
    // Disconnect pairing
    electron_1.ipcMain.handle('pairing:disconnect', async () => {
        try {
            main_1.default.info('[IPC] Disconnecting pairing session.');
            clearPairingExpiryTimer();
            (0, settings_1.savePairingCode)(''); // clear saved pairing code on manual disconnect
            pairingManager.disconnect();
            return { paired: false };
        }
        catch (error) {
            main_1.default.error('[IPC] Pairing disconnect failed:', error);
            throw new Error(error.message || 'Failed to disconnect pairing session');
        }
    });
    // Send paired metrics
    electron_1.ipcMain.handle('pairing:sendMetrics', async (_event, metrics) => {
        try {
            pairingManager.sendMetrics(metrics);
        }
        catch (error) {
            main_1.default.error('[IPC] Failed to send metrics to paired device:', error);
        }
    });
    // --- SETTINGS OPERATIONS ---
    // Get Relay URL
    electron_1.ipcMain.handle('settings:getRelayUrl', async () => {
        return (0, settings_1.getRelayUrl)();
    });
    // Save Relay URL
    electron_1.ipcMain.handle('settings:saveRelayUrl', async (_event, url) => {
        (0, settings_1.saveRelayUrl)(url);
        return true;
    });
    // --- APP / UPDATER OPERATIONS ---
    electron_1.ipcMain.handle('app:checkForUpdates', async () => {
        try {
            await (0, updater_1.checkForUpdates)();
            return null;
        }
        catch (error) {
            main_1.default.error('[IPC] Check for updates failed:', error);
            throw new Error(error.message || 'Failed to check for updates');
        }
    });
    electron_1.ipcMain.handle('app:openExternal', async (_event, url) => {
        try {
            main_1.default.info(`[IPC] Opening external URL: ${url}`);
            await electron_1.shell.openExternal(url);
            return true;
        }
        catch (error) {
            main_1.default.error('[IPC] Failed to open external URL:', error);
            return false;
        }
    });
    // Get Background Service Status
    electron_1.ipcMain.handle('service:getStatus', async () => {
        return BackgroundService_1.BackgroundService.getInstance().getStatus();
    });
}
