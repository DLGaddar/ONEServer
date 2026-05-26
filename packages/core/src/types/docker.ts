export interface Container {
  id: string;
  name: string;
  image: string;
  command: string;
  createdAt: string;
  status: string;
  state: string;
  ports: string;
}

export interface ContainerDetail {
  id: string;
  name: string;
  state: {
    status: string;
    running: boolean;
    paused: boolean;
    restarting: boolean;
    oOMKilled: boolean;
    dead: boolean;
    pid: number;
    exitCode: number;
    error: string;
    startedAt: string;
    finishedAt: string;
  };
  image: string;
  created: string;
  restartPolicy: {
    name: string;
    maximumRetryCount: number;
  };
  config: {
    hostname: string;
    env: string[];
    cmd: string[];
    image: string;
    labels: Record<string, string>;
  };
  networkSettings: {
    bridge: string;
    sandboxID: string;
    ports: Record<string, any>;
    gateway: string;
    iPAddress: string;
  };
  mounts: Array<{
    type: string;
    name?: string;
    source: string;
    destination: string;
    driver?: string;
    mode: string;
    rw: boolean;
    propagation: string;
  }>;
}

export interface ContainerStats {
  container: string;
  name: string;
  cpuPerc: string;
  memUsage: string;
  memPerc: string;
  netIO: string;
  blockIO: string;
  pids: string;
}
