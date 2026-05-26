export interface ServerMetrics {
  serverId: string;
  cpu: { percent: number };
  ram: { used: number; total: number; percent: number };
  disk: { used: string; total: string; percent: number };
  loadAverage: [number, number, number];
  network: { rx: number; tx: number };
  collectedAt: Date;
}
