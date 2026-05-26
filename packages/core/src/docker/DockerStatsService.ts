import { SSHManager } from '../ssh/SSHManager';
import { ContainerStats } from '../types/docker';
import { Logger } from '../logging/Logger';

export class DockerStatsService {
  constructor(private sshManager: SSHManager) {}

  async getStats(serverId: string, containerId: string): Promise<ContainerStats> {
    Logger.info(`[DockerStatsService] Fetching resource stats for container ${containerId} on server: ${serverId}`);
    
    try {
      const result = await this.sshManager.executeCommand(serverId, `docker stats --no-stream --format "{{json .}}" "${containerId}"`);
      if (result.exitCode !== 0) {
        throw new Error(`docker stats failed with exit code ${result.exitCode}: ${result.stderr}`);
      }

      const parsed = JSON.parse(result.stdout.trim());
      return {
        container: parsed.Container || parsed.ID || containerId,
        name: parsed.Name || '',
        cpuPerc: parsed.CPUPerc || '0.00%',
        memUsage: parsed.MemUsage || '0B / 0B',
        memPerc: parsed.MemPerc || '0.00%',
        netIO: parsed.NetIO || '0B / 0B',
        blockIO: parsed.BlockIO || '0B / 0B',
        pids: parsed.PIDs || '0'
      };
    } catch (err: any) {
      Logger.error(`[DockerStatsService] Failed to fetch stats for container ${containerId} on server ${serverId}: ${err.message}`);
      throw err;
    }
  }
}
