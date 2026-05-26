import { SSHManager } from '../ssh/SSHManager';
import { Logger } from '../logging/Logger';

export class DockerLogService {
  constructor(private sshManager: SSHManager) {}

  async getLogs(serverId: string, containerId: string, lines?: number): Promise<string> {
    const tailCount = lines && lines > 0 ? lines : 100;
    Logger.info(`[DockerLogService] Fetching last ${tailCount} log lines for container ${containerId} on server: ${serverId}`);
    
    try {
      const result = await this.sshManager.executeCommand(serverId, `docker logs --tail ${tailCount} "${containerId}"`);
      // Combine stdout and stderr as docker logs prints container stdout/stderr to matching streams.
      let logs = result.stdout;
      if (result.stderr) {
        logs = logs ? `${logs}\n${result.stderr}` : result.stderr;
      }
      return logs;
    } catch (err: any) {
      Logger.error(`[DockerLogService] Failed to get logs for container ${containerId} on server ${serverId}: ${err.message}`);
      throw err;
    }
  }
}
