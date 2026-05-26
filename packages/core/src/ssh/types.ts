export interface ServerConfig {
  id: string;
  ip: string;
  port: number;
  username: string;
  keyPath?: string | null;
  password?: string | null;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number; // Execution time in milliseconds
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
