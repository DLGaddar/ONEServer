import { SSHManager } from '../ssh/SSHManager';
import { Container, ContainerDetail } from '../types/docker';
import { Logger } from '../logging/Logger';

export class DockerContainerService {
  constructor(private sshManager: SSHManager) {}

  async listContainers(serverId: string): Promise<Container[]> {
    Logger.info(`[DockerContainerService] Listing containers for server: ${serverId}`);
    try {
      const result = await this.sshManager.executeCommand(serverId, 'docker ps -a --format "{{json .}}"');
      if (result.exitCode !== 0) {
        throw new Error(`docker ps failed with exit code ${result.exitCode}: ${result.stderr}`);
      }
      
      const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
      const containers: Container[] = [];
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          containers.push({
            id: parsed.ID || '',
            name: parsed.Names || '',
            image: parsed.Image || '',
            command: parsed.Command || '',
            createdAt: parsed.CreatedAt || '',
            status: parsed.Status || '',
            state: parsed.State || '',
            ports: parsed.Ports || ''
          });
        } catch (parseErr: any) {
          Logger.warn(`[DockerContainerService] Failed to parse container line: ${line}. Error: ${parseErr.message}`);
        }
      }
      
      return containers;
    } catch (err: any) {
      Logger.error(`[DockerContainerService] Failed to list containers on server ${serverId}: ${err.message}`);
      throw err;
    }
  }

  async inspectContainer(serverId: string, containerId: string): Promise<ContainerDetail> {
    Logger.info(`[DockerContainerService] Inspecting container ${containerId} on server: ${serverId}`);
    try {
      const result = await this.sshManager.executeCommand(serverId, `docker inspect "${containerId}"`);
      if (result.exitCode !== 0) {
        throw new Error(`docker inspect failed with exit code ${result.exitCode}: ${result.stderr}`);
      }

      const parsed = JSON.parse(result.stdout);
      const raw = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!raw) {
        throw new Error(`Container metadata not found in docker inspect output for ID: ${containerId}`);
      }

      return {
        id: raw.Id || '',
        name: raw.Name?.replace(/^\//, '') || '',
        state: {
          status: raw.State?.Status || '',
          running: !!raw.State?.Running,
          paused: !!raw.State?.Paused,
          restarting: !!raw.State?.Restarting,
          oOMKilled: !!raw.State?.OOMKilled,
          dead: !!raw.State?.Dead,
          pid: Number(raw.State?.Pid || 0),
          exitCode: Number(raw.State?.ExitCode || 0),
          error: raw.State?.Error || '',
          startedAt: raw.State?.StartedAt || '',
          finishedAt: raw.State?.FinishedAt || ''
        },
        image: raw.Image || '',
        created: raw.Created || '',
        restartPolicy: {
          name: raw.HostConfig?.RestartPolicy?.Name || '',
          maximumRetryCount: Number(raw.HostConfig?.RestartPolicy?.MaximumRetryCount || 0)
        },
        config: {
          hostname: raw.Config?.Hostname || '',
          env: raw.Config?.Env || [],
          cmd: raw.Config?.Cmd || [],
          image: raw.Config?.Image || '',
          labels: raw.Config?.Labels || {}
        },
        networkSettings: {
          bridge: raw.NetworkSettings?.Bridge || '',
          sandboxID: raw.NetworkSettings?.SandboxID || '',
          ports: raw.NetworkSettings?.Ports || {},
          gateway: raw.NetworkSettings?.Gateway || '',
          iPAddress: raw.NetworkSettings?.IPAddress || ''
        },
        mounts: (raw.Mounts || []).map((m: any) => ({
          type: m.Type || '',
          name: m.Name,
          source: m.Source || '',
          destination: m.Destination || '',
          driver: m.Driver,
          mode: m.Mode || '',
          rw: !!m.RW,
          propagation: m.Propagation || ''
        }))
      };
    } catch (err: any) {
      Logger.error(`[DockerContainerService] Failed to inspect container ${containerId} on server ${serverId}: ${err.message}`);
      throw err;
    }
  }
}
