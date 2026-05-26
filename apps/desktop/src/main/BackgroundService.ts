import { ServerRepository } from './repository/ServerRepository';
import { SSHManager, ServerMonitor, DockerManager, PairingManager } from '@oneserver/core';
import log from 'electron-log/main';
import { getRelayUrl, getPairingCode } from './settings';
import net from 'net';

export class BackgroundService {
  private static instance: BackgroundService | null = null;

  public repository = new ServerRepository();
  public sshManager = new SSHManager();
  public serverMonitor = new ServerMonitor(this.sshManager);
  public dockerManager = new DockerManager(this.sshManager);
  public pairingManager = new PairingManager();

  private connectionInterval: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastPollTime: Date | null = null;
  private isRunning: boolean = false;

  private constructor() {
    // Setup pairing status change listener to start metrics poll immediately when paired
    this.pairingManager.onMobilePaired = (deviceId) => {
      log.info(`[BackgroundService] Mobile paired (${deviceId}). Triggering immediate metrics poll...`);
      this.pollAndPushMetrics();
    };
  }

  public static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  public start(): void {
    if (this.isRunning) {
      log.warn('[BackgroundService] Background service is already running.');
      return;
    }

    log.info('[BackgroundService] Starting background service...');
    this.isRunning = true;

    // 1. Maintain WebSocket Pairing connection
    this.maintainConnection(); // Run once immediately
    this.connectionInterval = setInterval(() => {
      this.maintainConnection();
    }, 5000);

    // 2. Poll metrics every 30 seconds
    this.pollAndPushMetrics(); // Run once immediately
    this.pollingInterval = setInterval(() => {
      this.pollAndPushMetrics();
    }, 30000);
  }

  public stop(): void {
    if (!this.isRunning) return;

    log.info('[BackgroundService] Stopping background service...');
    this.isRunning = false;

    if (this.connectionInterval) {
      clearInterval(this.connectionInterval);
      this.connectionInterval = null;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.pairingManager.disconnect();
  }

  public getStatus() {
    return {
      relay: this.pairingManager.isPaired || this.pairingManager.isConnected ? ('connected' as const) : ('disconnected' as const),
      servers: this.sshManager.getConnectedServerIds().length,
      lastPoll: this.lastPollTime
    };
  }

  private maintainConnection(): void {
    try {
      const code = getPairingCode();
      const url = getRelayUrl();

      if (!code || !url) {
        if (this.pairingManager.isPaired || this.pairingManager.isConnected) {
          log.info('[BackgroundService] No active pairing code found in settings. Disconnecting pairing connection...');
          this.pairingManager.disconnect();
        }
        return;
      }

      // If not connected, establish connection
      const isConnected = this.pairingManager.isConnected;
      if (!isConnected) {
        log.info(`[BackgroundService] Reconnecting to relay url: ${url} with code: ${code}`);
        this.pairingManager.connect(url, code);
      }
    } catch (error: any) {
      log.error('[BackgroundService] Error maintaining pairing connection:', error.message || error);
    }
  }

  private async pollAndPushMetrics(): Promise<void> {
    try {
      const servers = await this.repository.getAll();
      this.lastPollTime = new Date();

      if (servers.length === 0) {
        return;
      }

      const serverPayloads: any[] = [];

      for (const server of servers) {
        let status: 'online' | 'offline' = 'offline';
        let cpuPercent = 0;
        let ramPercent = 0;
        let diskPercent = 0;
        let dockerCount = 0;
        let containers: any[] = [];

        const isConnected = this.sshManager.getConnectionStatus(server.id) === 'connected';

        if (!isConnected) {
          // Perform a fast port ping
          const isReachable = await this.pingPort(server.ip, server.port);
          if (isReachable && this.pairingManager.isPaired) {
            // Auto connect so we can pull live metrics for mobile
            try {
              log.info(`[BackgroundService] Auto-connecting SSH for ${server.nickname} to fetch metrics...`);
              await this.sshManager.connect(server);
            } catch (_) {}
          }
        }

        const activeConnection = this.sshManager.getConnectionStatus(server.id) === 'connected';

        if (activeConnection) {
          status = 'online';
          try {
            // Collect live metrics
            const metrics = await this.serverMonitor.collectMetrics(server.id);
            cpuPercent = metrics.cpu.percent;
            ramPercent = metrics.ram.percent;
            diskPercent = metrics.disk.percent;

            // Collect remote docker status
            try {
              const dockerContainers = await this.dockerManager.containers.listContainers(server.id);
              dockerCount = dockerContainers.length;
              containers = dockerContainers;
            } catch (_) {
              // Docker not running or not installed
            }
          } catch (err: any) {
            log.error(`[BackgroundService] Failed to poll metrics for server ${server.nickname}:`, err.message || err);
          }
        }

        serverPayloads.push({
          serverId: server.id,
          nickname: server.nickname,
          ip: server.ip,
          status,
          cpu: { percent: cpuPercent },
          ram: { percent: ramPercent },
          disk: { percent: diskPercent },
          dockerCount,
          containers,
          collectedAt: new Date().toISOString()
        });
      }

      if (this.pairingManager.isPaired) {
        log.info(`[BackgroundService] Pushing live metrics for ${servers.length} server(s) to paired mobile client...`);
        this.pairingManager.sendMetrics({
          servers: serverPayloads,
          timestamp: Date.now()
        });
      }
    } catch (error: any) {
      log.error('[BackgroundService] Metrics polling sequence encountered an error:', error.message || error);
    }
  }

  private pingPort(host: string, port: number, timeoutMs = 5000): Promise<boolean> {
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
}
