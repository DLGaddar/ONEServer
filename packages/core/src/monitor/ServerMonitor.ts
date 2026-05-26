import { SSHManager } from '../ssh/SSHManager';
import { ServerMetrics } from '../types/monitor';
import { Logger } from '../logging/Logger';

export class ServerMonitor {
  private activePolls = new Map<string, NodeJS.Timeout>();

  constructor(private sshManager: SSHManager) {}

  async collectMetrics(serverId: string): Promise<ServerMetrics> {
    Logger.info(`[ServerMonitor] Collecting server metrics for: ${serverId}`);

    // Combined command optimization
    const combinedCommand = `top -bn1 | grep "Cpu(s)" ; echo "___DELIMITER___" ; free -m ; echo "___DELIMITER___" ; df -h / ; echo "___DELIMITER___" ; uptime ; echo "___DELIMITER___" ; ip -s link`;

    try {
      const result = await this.sshManager.executeCommand(serverId, combinedCommand);
      if (result.exitCode !== 0) {
        throw new Error(`Metrics collection command failed with exit code ${result.exitCode}: ${result.stderr}`);
      }

      const parts = result.stdout.split('___DELIMITER___');
      if (parts.length < 5) {
        throw new Error(`Incomplete metrics output. Received ${parts.length} / 5 metrics blocks.`);
      }

      const cpuOutput = parts[0];
      const ramOutput = parts[1];
      const diskOutput = parts[2];
      const uptimeOutput = parts[3];
      const netOutput = parts[4];

      // 1. CPU PARSING
      // Example: "%Cpu(s):  3.3 us,  0.5 sy,  0.0 ni, 95.8 id,  0.0 wa,  0.0 hi,  0.4 si,  0.0 st"
      const idleMatch = cpuOutput.match(/(\d+(?:\.\d+)?)\s*id/);
      const idle = idleMatch ? parseFloat(idleMatch[1]) : 100;
      const cpuPercent = parseFloat((100 - idle).toFixed(2));

      // 2. RAM PARSING
      // Example:
      //               total        used        free      shared  buff/cache   available
      // Mem:            7930        1500        3000         200        3430        5900
      const ramLines = ramOutput.split(/\r?\n/);
      const memLine = ramLines.find(line => line.trim().startsWith('Mem:'));
      let ramUsed = 0;
      let ramTotal = 0;
      let ramPercent = 0;

      if (memLine) {
        const memParts = memLine.split(/\s+/).filter(Boolean);
        if (memParts.length >= 3) {
          ramTotal = parseInt(memParts[1], 10) || 0;
          ramUsed = parseInt(memParts[2], 10) || 0;
          ramPercent = ramTotal > 0 ? parseFloat(((ramUsed / ramTotal) * 100).toFixed(2)) : 0;
        }
      }

      // 3. DISK PARSING
      // Example:
      // Filesystem      Size  Used Avail Use% Mounted on
      // /dev/sda1        40G   15G   23G  40% /
      const diskLines = diskOutput.split(/\r?\n/).filter(Boolean);
      let diskUsed = '0G';
      let diskTotal = '0G';
      let diskPercent = 0;

      // The line we need is usually index 1, but let's check for / mount just in case
      const rootLine = diskLines.find(line => line.trim().endsWith(' /')) || diskLines[1];
      if (rootLine) {
        const diskParts = rootLine.split(/\s+/).filter(Boolean);
        if (diskParts.length >= 5) {
          diskTotal = diskParts[1] || '0G';
          diskUsed = diskParts[2] || '0G';
          const percentStr = diskParts[4].replace('%', '');
          diskPercent = parseFloat(percentStr) || 0;
        }
      }

      // 4. LOAD AVERAGE PARSING
      // Example: " 18:50:00 up  2:30,  1 user,  load average: 0.05, 0.12, 0.15"
      const loadMatch = uptimeOutput.match(/load average[s]?:\s*(\d+(?:\.\d+)?),?\s*(\d+(?:\.\d+)?),?\s*(\d+(?:\.\d+)?)/i);
      const loadAverage: [number, number, number] = loadMatch
        ? [parseFloat(loadMatch[1]), parseFloat(loadMatch[2]), parseFloat(loadMatch[3])]
        : [0.00, 0.00, 0.00];

      // 5. NETWORK PARSING
      // Accumulate RX/TX link packets, excluding loopback interface 'lo'
      const netLines = netOutput.split(/\r?\n/);
      let rxBytes = 0;
      let txBytes = 0;
      let isRxLine = false;
      let isTxLine = false;
      let currentInterface = '';

      for (const line of netLines) {
        const trimmed = line.trim();
        const ifaceMatch = line.match(/^\d+:\s+([^:]+):/);
        if (ifaceMatch) {
          currentInterface = ifaceMatch[1].trim();
          isRxLine = false;
          isTxLine = false;
          continue;
        }

        if (currentInterface === 'lo') {
          continue;
        }

        if (trimmed.startsWith('RX:')) {
          isRxLine = true;
          isTxLine = false;
          continue;
        }

        if (trimmed.startsWith('TX:')) {
          isTxLine = true;
          isRxLine = false;
          continue;
        }

        if (isRxLine) {
          const partsRx = trimmed.split(/\s+/).filter(Boolean);
          if (partsRx.length > 0) {
            rxBytes += parseInt(partsRx[0], 10) || 0;
          }
          isRxLine = false;
        }

        if (isTxLine) {
          const partsTx = trimmed.split(/\s+/).filter(Boolean);
          if (partsTx.length > 0) {
            txBytes += parseInt(partsTx[0], 10) || 0;
          }
          isTxLine = false;
        }
      }

      return {
        serverId,
        cpu: { percent: Math.max(0, Math.min(100, cpuPercent)) },
        ram: { used: ramUsed, total: ramTotal, percent: ramPercent },
        disk: { used: diskUsed, total: diskTotal, percent: diskPercent },
        loadAverage,
        network: { rx: rxBytes, tx: txBytes },
        collectedAt: new Date()
      };
    } catch (err: any) {
      Logger.error(`[ServerMonitor] Failed to collect metrics for ${serverId}: ${err.message}`);
      throw err;
    }
  }

  startPolling(serverId: string, callback: (m: ServerMetrics) => void, intervalMs?: number): void {
    const interval = intervalMs && intervalMs > 0 ? intervalMs : 30000; // default 30 seconds
    Logger.info(`[ServerMonitor] Starting metrics polling for server ${serverId} every ${interval}ms`);

    // Clean up existing polling for this server ID
    this.stopPolling(serverId);

    // Initial collection
    this.collectMetrics(serverId)
      .then(callback)
      .catch((err) => {
        Logger.error(`[ServerMonitor] Initial polling metrics collection failed for ${serverId}: ${err.message}`);
      });

    const intervalId = setInterval(() => {
      this.collectMetrics(serverId)
        .then(callback)
        .catch((err) => {
          Logger.error(`[ServerMonitor] Polling metrics collection failed for ${serverId}: ${err.message}`);
        });
    }, interval);

    this.activePolls.set(serverId, intervalId);
  }

  stopPolling(serverId: string): void {
    const activeId = this.activePolls.get(serverId);
    if (activeId) {
      clearInterval(activeId);
      this.activePolls.delete(serverId);
      Logger.info(`[ServerMonitor] Stopped metrics polling for server ${serverId}`);
    }
  }
}
