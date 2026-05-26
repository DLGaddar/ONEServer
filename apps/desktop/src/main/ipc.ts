import { ipcMain, BrowserWindow, shell } from 'electron';

import { ServerRepository } from './repository/ServerRepository';
import { SSHManager, ServerMonitor, DockerManager, Logger as CoreLogger, PairingManager } from '@oneserver/core';
import log from 'electron-log/main';
import { ZodError } from 'zod';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { getRelayUrl, saveRelayUrl, getPairingCode, savePairingCode } from './settings';
import net from 'net';
import { checkForUpdates } from './updater';
import { BackgroundService } from './BackgroundService';



function pingPort(host: string, port: number, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
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

const bgService = BackgroundService.getInstance();
const repository = bgService.repository;
const sshManager = bgService.sshManager;
const serverMonitor = bgService.serverMonitor;
const dockerManager = bgService.dockerManager;
const pairingManager = bgService.pairingManager;


// ── Active mobile metrics polling tracker ──────────────────────────────────
const mobilePollingActive = new Set<string>(); // serverIds currently being polled for mobile

async function startMobileMetricsPush(): Promise<void> {
  log.info('[MobileSync] 📡 Mobile paired – starting metrics push loop...');
  console.log('DEBUG [MobileSync]: startMobileMetricsPush() called');

  let servers: any[] = [];
  try {
    servers = await repository.getAll();
    console.log(`DEBUG [MobileSync]: Found ${servers.length} server(s) in DB`);
  } catch (err: any) {
    log.error('[MobileSync] Failed to load servers:', err.message);
    return;
  }

  if (servers.length === 0) {
    log.warn('[MobileSync] No servers in database – nothing to poll.');
    return;
  }

  for (const server of servers) {
    if (mobilePollingActive.has(server.id)) {
      log.info(`[MobileSync] Already polling ${server.id}, skipping.`);
      continue;
    }

    // Ensure SSH is connected before we can collect metrics
    const status = sshManager.getConnectionStatus(server.id);
    if (status !== 'connected') {
      try {
        log.info(`[MobileSync] SSH not connected for ${server.id}, connecting now...`);
        console.log(`DEBUG [MobileSync]: Connecting SSH to ${server.nickname} (${server.ip})`);
        await sshManager.connect(server);
      } catch (err: any) {
        log.error(`[MobileSync] SSH connect failed for ${server.id}: ${err.message}`);
        // Push an offline entry so mobile shows the server as offline
        pairingManager.sendMetrics({
          servers: [{
            serverId: server.id,
            nickname: server.nickname,
            ip: server.ip,
            status: 'offline',
            cpu:  { percent: 0 },
            ram:  { percent: 0 },
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
    log.info(`[MobileSync] Starting 30s metrics poll for server ${server.id} (${server.nickname})`);
    console.log(`DEBUG [MobileSync]: serverMonitor.startPolling('${server.id}') called`);

    serverMonitor.startPolling(server.id, async (metrics) => {
      console.log(`DEBUG [MobileSync]: Metrikler toplandı: CPU=${metrics.cpu.percent}% RAM=${metrics.ram.percent}% Disk=${metrics.disk.percent}%`);
      if (pairingManager.isPaired) {
        console.log(`DEBUG [MobileSync]: Mobil bağlı, veri basılıyor...`);
        
        let containers: any[] = [];
        try {
          containers = await dockerManager.containers.listContainers(server.id);
        } catch (dockerErr: any) {
          log.warn(`[MobileSync] Failed to list docker containers for server ${server.id}: ${dockerErr.message}`);
        }

        // Wrap in the envelope format: { servers: [...], timestamp: N }
        // Each server entry uses nested cpu/ram/disk objects to match ServerMetricsModel.fromJson()
        pairingManager.sendMetrics({
          servers: [{
            serverId: metrics.serverId,
            nickname: server.nickname,
            ip: server.ip,
            status: 'online',
            cpu:  { percent: metrics.cpu.percent },
            ram:  { percent: metrics.ram.percent },
            disk: { percent: metrics.disk.percent },
            dockerCount: containers.length,
            containers: containers,
            collectedAt: metrics.collectedAt.toISOString(),
          }],
          timestamp: Date.now(),
        });
        log.info(`[MobileSync] ✅ Metrics pushed to mobile for server ${server.id} (Containers: ${containers.length})`);
      } else {
        console.log('DEBUG [MobileSync]: Mobil bağlı değil, veri atlandı.');
      }
    }, 30000);
  }
}

function stopMobileMetricsPush(): void {
  log.info('[MobileSync] Stopping all mobile metrics polling...');
  for (const serverId of mobilePollingActive) {
    serverMonitor.stopPolling(serverId);
  }
  mobilePollingActive.clear();
}

// ── Relay connection state logging ─────────────────────────────────────────
pairingManager.onConnected = (relayUrl: string) => {
  log.info(`[PairingManager] ✅ Connected to relay: ${relayUrl}`);
  const win = BrowserWindow.getAllWindows()[0];
  win?.webContents.send('pairing:relay-status', { connected: true, relayUrl });
};

pairingManager.onDisconnected = () => {
  log.warn('[PairingManager] 🔌 Disconnected from relay');
  stopMobileMetricsPush();
  const win = BrowserWindow.getAllWindows()[0];
  win?.webContents.send('pairing:relay-status', { connected: false });
};

// ── Mobile paired: start push loop ─────────────────────────────────────────
pairingManager.onMobilePaired = async (deviceId: string) => {
  clearPairingExpiryTimer();
  log.info(`[PairingManager] 📱 Mobile paired: ${deviceId} – initiating metrics push`);
  console.log(`DEBUG [IPC]: Mobile paired event fired for device ${deviceId}`);
  const win = BrowserWindow.getAllWindows()[0];
  win?.webContents.send('pairing:status-change', { paired: true, deviceId });
  await startMobileMetricsPush();
};

pairingManager.onError = (err: Error) => {
  log.error('[PairingManager] ❌ Relay connection error:', err.message);
  const win = BrowserWindow.getAllWindows()[0];
  win?.webContents.send('pairing:relay-status', { connected: false, error: err.message });
};

// Setup mobile command handler for docker/reboot commands
pairingManager.onMobileCommand(async (cmd) => {
  log.info(`[IPC] Received mobile payload: ${JSON.stringify(cmd)}`);
  try {
    // pair:confirm is handled by onMobilePaired — skip here
    if (cmd.action === 'pair:confirm') return;

    if (cmd.action === 'docker:restart' && cmd.containerId) {
      log.info(`[IPC] Restarting container ${cmd.containerId} on ${cmd.serverId} via mobile`);
      await dockerManager.control.restart(cmd.serverId, cmd.containerId);
      log.info(`[IPC] Restart success.`);
    } else if (cmd.action === 'server:reboot') {
      log.info(`[IPC] Rebooting remote host ${cmd.serverId} via mobile`);
      await sshManager.executeCommand(cmd.serverId, 'sudo reboot');
      log.info(`[IPC] Reboot command sent.`);
    }

    // Notify React renderer of executed command
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('pairing:command-executed', cmd);
    }
  } catch (error: any) {
    log.error(`[IPC] Mobile command execution failed:`, error);
  }
});

function generatePairingCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}


// Broadcaster piping core SSH manager logs directly to the active BrowserWindow
CoreLogger.addListener((level, msg) => {
  log.info(`[CoreLogger] [${level}] ${msg}`);
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('ssh:log-event', {
      level,
      msg,
      time: new Date().toLocaleTimeString()
    });
  }
});

let pairingExpiryTimeout: NodeJS.Timeout | null = null;

function startPairingExpiryTimer(): void {
  if (pairingExpiryTimeout) {
    clearTimeout(pairingExpiryTimeout);
  }

  log.info('[PairingExpiry] Starting 5-minute pairing code expiration timer...');
  pairingExpiryTimeout = setTimeout(async () => {
    if (!pairingManager.isPaired) {
      log.warn('[PairingExpiry] ⏳ Pairing code expired (5 minutes reached without mobile scan). Destroying session...');
      pairingManager.disconnect();
      savePairingCode('');
      
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.webContents.send('pairing:status-change', { paired: false, expired: true });
      }
    }
  }, 5 * 60 * 1000); // 5 minutes
}

function clearPairingExpiryTimer(): void {
  if (pairingExpiryTimeout) {
    log.info('[PairingExpiry] Clearing pairing code expiration timer (Pairing successful or manually disconnected).');
    clearTimeout(pairingExpiryTimeout);
    pairingExpiryTimeout = null;
  }
}

export function setupIpc(): void {
  log.info('[IPC] Registering secure IPC handlers for server & SSH operations...');

  // Auto-start pairing session on boot!
  try {
    const url = getRelayUrl();
    let pairingCode = getPairingCode();
    if (!pairingCode) {
      pairingCode = generatePairingCode();
      savePairingCode(pairingCode);
      log.info(`[IPC] No saved pairing code found. Generated persistent code: ${pairingCode}`);
    }
    log.info(`[IPC] Auto-initiating pairing connection to relay: ${url} code: ${pairingCode}`);
    pairingManager.connect(url, pairingCode);
    startPairingExpiryTimer();
  } catch (autoErr: any) {
    log.error('[IPC] Failed to auto-start pairing connection:', autoErr.message);
  }

  // --- SERVERS DATABASE OPERATIONS ---

  // Get All
  ipcMain.handle('servers:getAll', async () => {
    try {
      return await repository.getAll();
    } catch (error: any) {
      log.error('[IPC] Failed to get all servers:', error);
      throw new Error(error.message || 'Failed to fetch servers');
    }
  });

  // Get By ID
  ipcMain.handle('servers:getById', async (_event, id: string) => {
    try {
      return await repository.getById(id);
    } catch (error: any) {
      log.error(`[IPC] Failed to get server by ID ${id}:`, error);
      throw new Error(error.message || `Failed to fetch server with ID ${id}`);
    }
  });

  // Add
  ipcMain.handle('servers:add', async (_event, input: any) => {
    try {
      return await repository.add(input);
    } catch (error: any) {
      log.error('[IPC] Failed to add server:', error);
      if (error instanceof ZodError) {
        throw new Error(JSON.stringify(error.errors));
      }
      throw new Error(error.message || 'Failed to add server');
    }
  });

  // Update
  ipcMain.handle('servers:update', async (_event, input: any) => {
    try {
      return await repository.update(input);
    } catch (error: any) {
      log.error(`[IPC] Failed to update server ${input?.id}:`, error);
      if (error instanceof ZodError) {
        throw new Error(JSON.stringify(error.errors));
      }
      throw new Error(error.message || 'Failed to update server');
    }
  });

  // Delete
  ipcMain.handle('servers:remove', async (_event, id: string) => {
    try {
      return await repository.remove(id);
    } catch (error: any) {
      log.error(`[IPC] Failed to remove server ${id}:`, error);
      throw new Error(error.message || 'Failed to remove server');
    }
  });

  // --- SSH OPERATIONS ---

  // Connect
  ipcMain.handle('ssh:connect', async (_event, config: any) => {
    try {
      log.info(`[IPC] Connecting SSH to server: ${config.id}`);
      return await sshManager.connect(config);
    } catch (error: any) {
      log.error(`[IPC] Connection error:`, error);
      throw new Error(error.message || 'Failed to connect');
    }
  });

  // Disconnect
  ipcMain.handle('ssh:disconnect', async (_event, serverId: string) => {
    try {
      log.info(`[IPC] Disconnecting SSH server: ${serverId}`);
      return sshManager.disconnect(serverId);
    } catch (error: any) {
      log.error(`[IPC] Disconnect error:`, error);
      throw new Error(error.message || 'Failed to disconnect');
    }
  });

  // Execute Command
  ipcMain.handle('ssh:executeCommand', async (_event, serverId: string, command: string) => {
    try {
      log.info(`[IPC] Running command on ${serverId}: ${command}`);
      return await sshManager.executeCommand(serverId, command);
    } catch (error: any) {
      log.error(`[IPC] Command execution error on ${serverId}:`, error);
      throw new Error(error.message || 'Command execution failed');
    }
  });

  // Get Connection Status
  ipcMain.handle('ssh:getStatus', async (_event, serverId: string) => {
    try {
      return sshManager.getConnectionStatus(serverId);
    } catch (error: any) {
      return 'disconnected';
    }
  });

  // Ping server host & port
  ipcMain.handle('ssh:ping', async (_event, host: string, port: number) => {
    try {
      return await pingPort(host, port);
    } catch (error: any) {
      return false;
    }
  });

  // Collect Server metrics
  ipcMain.handle('ssh:collectMetrics', async (_event, serverId: string) => {
    try {
      log.info(`[IPC] Collecting metrics for server: ${serverId}`);
      return await serverMonitor.collectMetrics(serverId);
    } catch (error: any) {
      log.error(`[IPC] Metrics collection failed for ${serverId}:`, error);
      throw new Error(error.message || 'Failed to collect server metrics');
    }
  });

  // List Docker containers
  ipcMain.handle('docker:listContainers', async (_event, serverId: string) => {
    try {
      log.info(`[IPC] Listing docker containers for server: ${serverId}`);
      return await dockerManager.containers.listContainers(serverId);
    } catch (error: any) {
      log.error(`[IPC] Docker list containers failed for ${serverId}:`, error);
      throw new Error(error.message || 'Failed to list docker containers');
    }
  });

  // --- PAIRING OPERATIONS ---

  // Generate pairing code & QR code
  ipcMain.handle('pairing:generate', async () => {
    try {
      const pairingCode = generatePairingCode();
      const url = getRelayUrl();
      savePairingCode(pairingCode);
      // QR encodes JSON with both fields so mobile can auto-fill relay URL
      const qrPayload = JSON.stringify({ pairingCode, relayUrl: url });
      const qrDataUrl = await QRCode.toDataURL(qrPayload);
      log.info(`[IPC] Connecting pairing to relay: ${url} code: ${pairingCode}`);
      pairingManager.connect(url, pairingCode);
      startPairingExpiryTimer();
      return { pairingCode, qrDataUrl, relayUrl: url };
    } catch (error: any) {
      log.error('[IPC] Failed to generate pairing details:', error);
      throw new Error(error.message || 'Failed to generate pairing details');
    }
  });

  // Get pairing status and active details
  ipcMain.handle('pairing:getStatus', async () => {
    const code = getPairingCode();
    const url = getRelayUrl();
    let qrDataUrl: string | undefined;
    if (code) {
      try {
        const qrPayload = JSON.stringify({ pairingCode: code, relayUrl: url });
        qrDataUrl = await QRCode.toDataURL(qrPayload);
      } catch (_) {}
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
  ipcMain.handle('pairing:disconnect', async () => {
    try {
      log.info('[IPC] Disconnecting pairing session.');
      clearPairingExpiryTimer();
      savePairingCode(''); // clear saved pairing code on manual disconnect
      pairingManager.disconnect();
      return { paired: false };
    } catch (error: any) {
      log.error('[IPC] Pairing disconnect failed:', error);
      throw new Error(error.message || 'Failed to disconnect pairing session');
    }
  });

  // Send paired metrics
  ipcMain.handle('pairing:sendMetrics', async (_event, metrics: any) => {
    try {
      pairingManager.sendMetrics(metrics);
    } catch (error: any) {
      log.error('[IPC] Failed to send metrics to paired device:', error);
    }
  });

  // --- SETTINGS OPERATIONS ---

  // Get Relay URL
  ipcMain.handle('settings:getRelayUrl', async () => {
    return getRelayUrl();
  });

  // Save Relay URL
  ipcMain.handle('settings:saveRelayUrl', async (_event, url: string) => {
    saveRelayUrl(url);
    return true;
  });

  // --- APP / UPDATER OPERATIONS ---
  ipcMain.handle('app:checkForUpdates', async () => {
    try {
      await checkForUpdates();
      return null;
    } catch (error: any) {
      log.error('[IPC] Check for updates failed:', error);
      throw new Error(error.message || 'Failed to check for updates');
    }
  });

  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    try {
      log.info(`[IPC] Opening external URL: ${url}`);
      await shell.openExternal(url);
      return true;
    } catch (error: any) {
      log.error('[IPC] Failed to open external URL:', error);
      return false;
    }
  });

  // Get Background Service Status
  ipcMain.handle('service:getStatus', async () => {
    return BackgroundService.getInstance().getStatus();
  });
}



