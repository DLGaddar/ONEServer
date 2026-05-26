export interface MobileCommand {
  action: 'docker:restart' | 'server:reboot' | 'pair:confirm';
  serverId: string;
  containerId?: string;
  deviceId?: string;
}

export interface RelayPayload {
  servers: any[]; // Matches ServerMetrics[] structure
  timestamp: number;
}
