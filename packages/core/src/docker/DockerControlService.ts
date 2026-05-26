import { SSHManager } from '../ssh/SSHManager';
import { Logger } from '../logging/Logger';

export class DockerControlService {
  constructor(private sshManager: SSHManager) {}

  async start(serverId: string, containerId: string): Promise<void> {
    Logger.info(`[DockerControlService] Starting container ${containerId} on server: ${serverId}`);
    try {
      const result = await this.sshManager.executeCommand(serverId, `docker start "${containerId}"`);
      if (result.exitCode !== 0) {
        throw new Error(`docker start failed with exit code ${result.exitCode}: ${result.stderr}`);
      }
      Logger.info(`[DockerControlService] Container ${containerId} started successfully on server ${serverId}.`);
    } catch (err: any) {
      Logger.error(`[DockerControlService] Failed to start container ${containerId} on server ${serverId}: ${err.message}`);
      throw err;
    }
  }

  async stop(serverId: string, containerId: string): Promise<void> {
    Logger.info(`[DockerControlService] Stopping container ${containerId} on server: ${serverId}`);
    try {
      const result = await this.sshManager.executeCommand(serverId, `docker stop "${containerId}"`);
      if (result.exitCode !== 0) {
        throw new Error(`docker stop failed with exit code ${result.exitCode}: ${result.stderr}`);
      }
      Logger.info(`[DockerControlService] Container ${containerId} stopped successfully on server ${serverId}.`);
    } catch (err: any) {
      Logger.error(`[DockerControlService] Failed to stop container ${containerId} on server ${serverId}: ${err.message}`);
      throw err;
    }
  }

  async restart(serverId: string, containerId: string): Promise<void> {
    Logger.info(`[DockerControlService] Restarting container ${containerId} on server: ${serverId}`);
    try {
      const result = await this.sshManager.executeCommand(serverId, `docker restart "${containerId}"`);
      if (result.exitCode !== 0) {
        throw new Error(`docker restart failed with exit code ${result.exitCode}: ${result.stderr}`);
      }
      Logger.info(`[DockerControlService] Container ${containerId} restarted successfully on server ${serverId}.`);
    } catch (err: any) {
      Logger.error(`[DockerControlService] Failed to restart container ${containerId} on server ${serverId}: ${err.message}`);
      throw err;
    }
  }
}
