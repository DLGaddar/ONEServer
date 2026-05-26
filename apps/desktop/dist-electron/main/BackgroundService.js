"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackgroundService = void 0;
const ServerRepository_1 = require("./repository/ServerRepository");
const core_1 = require("@oneserver/core");
const main_1 = __importDefault(require("electron-log/main"));
const settings_1 = require("./settings");
const net_1 = __importDefault(require("net"));
class BackgroundService {
    static instance = null;
    repository = new ServerRepository_1.ServerRepository();
    sshManager = new core_1.SSHManager();
    serverMonitor = new core_1.ServerMonitor(this.sshManager);
    dockerManager = new core_1.DockerManager(this.sshManager);
    pairingManager = new core_1.PairingManager();
    connectionInterval = null;
    pollingInterval = null;
    lastPollTime = null;
    isRunning = false;
    constructor() {
        // Setup pairing status change listener to start metrics poll immediately when paired
        this.pairingManager.onMobilePaired = (deviceId) => {
            main_1.default.info(`[BackgroundService] Mobile paired (${deviceId}). Triggering immediate metrics poll...`);
            this.pollAndPushMetrics();
        };
    }
    static getInstance() {
        if (!BackgroundService.instance) {
            BackgroundService.instance = new BackgroundService();
        }
        return BackgroundService.instance;
    }
    start() {
        if (this.isRunning) {
            main_1.default.warn('[BackgroundService] Background service is already running.');
            return;
        }
        main_1.default.info('[BackgroundService] Starting background service...');
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
    stop() {
        if (!this.isRunning)
            return;
        main_1.default.info('[BackgroundService] Stopping background service...');
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
    getStatus() {
        return {
            relay: this.pairingManager.isPaired || this.pairingManager.isConnected ? 'connected' : 'disconnected',
            servers: this.sshManager.getConnectedServerIds().length,
            lastPoll: this.lastPollTime
        };
    }
    maintainConnection() {
        try {
            const code = (0, settings_1.getPairingCode)();
            const url = (0, settings_1.getRelayUrl)();
            if (!code || !url) {
                if (this.pairingManager.isPaired || this.pairingManager.isConnected) {
                    main_1.default.info('[BackgroundService] No active pairing code found in settings. Disconnecting pairing connection...');
                    this.pairingManager.disconnect();
                }
                return;
            }
            // If not connected, establish connection
            const isConnected = this.pairingManager.isConnected;
            if (!isConnected) {
                main_1.default.info(`[BackgroundService] Reconnecting to relay url: ${url} with code: ${code}`);
                this.pairingManager.connect(url, code);
            }
        }
        catch (error) {
            main_1.default.error('[BackgroundService] Error maintaining pairing connection:', error.message || error);
        }
    }
    async pollAndPushMetrics() {
        try {
            const servers = await this.repository.getAll();
            this.lastPollTime = new Date();
            if (servers.length === 0) {
                return;
            }
            const serverPayloads = [];
            for (const server of servers) {
                let status = 'offline';
                let cpuPercent = 0;
                let ramPercent = 0;
                let diskPercent = 0;
                let dockerCount = 0;
                let containers = [];
                const isConnected = this.sshManager.getConnectionStatus(server.id) === 'connected';
                if (!isConnected) {
                    // Perform a fast port ping
                    const isReachable = await this.pingPort(server.ip, server.port);
                    if (isReachable && this.pairingManager.isPaired) {
                        // Auto connect so we can pull live metrics for mobile
                        try {
                            main_1.default.info(`[BackgroundService] Auto-connecting SSH for ${server.nickname} to fetch metrics...`);
                            await this.sshManager.connect(server);
                        }
                        catch (_) { }
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
                        }
                        catch (_) {
                            // Docker not running or not installed
                        }
                    }
                    catch (err) {
                        main_1.default.error(`[BackgroundService] Failed to poll metrics for server ${server.nickname}:`, err.message || err);
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
                main_1.default.info(`[BackgroundService] Pushing live metrics for ${servers.length} server(s) to paired mobile client...`);
                this.pairingManager.sendMetrics({
                    servers: serverPayloads,
                    timestamp: Date.now()
                });
            }
        }
        catch (error) {
            main_1.default.error('[BackgroundService] Metrics polling sequence encountered an error:', error.message || error);
        }
    }
    pingPort(host, port, timeoutMs = 5000) {
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
}
exports.BackgroundService = BackgroundService;
