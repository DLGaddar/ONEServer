import { SSHManager } from '../ssh/SSHManager';
import { DockerContainerService } from './DockerContainerService';
import { DockerLogService } from './DockerLogService';
import { DockerStatsService } from './DockerStatsService';
import { DockerControlService } from './DockerControlService';

export class DockerManager {
  public readonly containers: DockerContainerService;
  public readonly logs: DockerLogService;
  public readonly stats: DockerStatsService;
  public readonly control: DockerControlService;

  constructor(sshManager: SSHManager) {
    this.containers = new DockerContainerService(sshManager);
    this.logs = new DockerLogService(sshManager);
    this.stats = new DockerStatsService(sshManager);
    this.control = new DockerControlService(sshManager);
  }
}
