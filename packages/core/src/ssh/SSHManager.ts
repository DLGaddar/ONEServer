import { Client, SFTPWrapper } from 'ssh2';
import fs from 'fs';
import { ServerConfig, CommandResult, ConnectionStatus } from './types';
import { Logger } from '../logging/Logger';

export class SSHManager {
  private pool = new Map<string, Client>();
  private statuses = new Map<string, ConnectionStatus>();
  private workingDirs = new Map<string, string>();
  private maxPoolSize = 10;

  async connect(server: ServerConfig): Promise<void> {
    Logger.info(`[SSHManager] Initializing connection request for server: ${server.id} (${server.ip})`);

    // Enforce key-based or password-based authorization
    if (!server.keyPath && !server.password) {
      const err = new Error(`Authentication failed: Either Private Key or Password is required.`);
      Logger.error(`[SSHManager] Connection failed: ${err.message}`);
      throw err;
    }

    // Check if already in active pool
    if (this.pool.has(server.id)) {
      Logger.warn(`[SSHManager] Server ${server.id} already has active connection in pool. Disconnecting old session...`);
      this.disconnect(server.id);
    }

    // Enforce pool bounds
    if (this.pool.size >= this.maxPoolSize) {
      const err = new Error(`Connection pool is full. Maximum concurrent connections limit reached (${this.maxPoolSize}).`);
      Logger.error(`[SSHManager] Connection failed: ${err.message}`);
      throw err;
    }

    try {
      await this.connectWithRetry(server);
    } catch (err: any) {
      this.statuses.set(server.id, 'error');
      throw err;
    }
  }

  disconnect(serverId: string): void {
    Logger.info(`[SSHManager] Disconnecting server: ${serverId}`);
    const client = this.pool.get(serverId);
    if (client) {
      try {
        client.end();
      } catch (err) {
        // Safe end
      }
      this.pool.delete(serverId);
    }
    this.statuses.set(serverId, 'disconnected');
    this.workingDirs.delete(serverId);
    Logger.info(`[SSHManager] Server ${serverId} disconnected and removed from pool.`);
  }

  getConnectionStatus(serverId: string): ConnectionStatus {
    return this.statuses.get(serverId) || 'disconnected';
  }

  getConnectedServerIds(): string[] {
    return Array.from(this.pool.keys());
  }

  async executeCommand(serverId: string, command: string): Promise<CommandResult> {
    Logger.info(`[SSHManager] Executing command on server ${serverId}: ${command}`);
    const client = this.pool.get(serverId);
    if (!client) {
      const err = new Error(`Server ${serverId} is not connected. Connect first.`);
      Logger.error(`[SSHManager] Command execution failed: ${err.message}`);
      throw err;
    }

    const currentDir = this.workingDirs.get(serverId) || '~';
    const wrappedCommand = `cd "${currentDir}" && ${command} ; echo "___PWD___" ; pwd`;

    const start = Date.now();
    
    return new Promise<CommandResult>((resolve, reject) => {
      client.exec(wrappedCommand, (err, stream) => {
        if (err) {
          Logger.error(`[SSHManager] Exec failed on server ${serverId}: ${err.message}`);
          return reject(err);
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('close', (code: number) => {
          const duration = Date.now() - start;
          
          let finalStdout = stdout;
          const pwdMarker = '___PWD___';
          const markerIndex = stdout.lastIndexOf(pwdMarker);
          if (markerIndex !== -1) {
            finalStdout = stdout.substring(0, markerIndex);
            const afterMarker = stdout.substring(markerIndex + pwdMarker.length).trim();
            const lines = afterMarker.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length > 0) {
              const newDir = lines[lines.length - 1];
              this.workingDirs.set(serverId, newDir);
            }
          }

          Logger.info(`[SSHManager] Command completed on ${serverId} in ${duration}ms with exit code ${code}`);
          resolve({
            stdout: finalStdout,
            stderr,
            exitCode: code ?? 0,
            duration
          });
        });

        stream.on('error', (streamErr: any) => {
          Logger.error(`[SSHManager] Stream error on server ${serverId}: ${streamErr.message}`);
          reject(streamErr);
        });
      });
    });
  }

  async uploadFile(serverId: string, localPath: string, remotePath: string): Promise<void> {
    Logger.info(`[SSHManager] [SFTP] Uploading ${localPath} to ${remotePath} on server ${serverId}`);
    const client = this.pool.get(serverId);
    if (!client) {
      const err = new Error(`Server ${serverId} is not connected.`);
      Logger.error(`[SSHManager] Upload failed: ${err.message}`);
      throw err;
    }

    // Verify local file exists
    if (!fs.existsSync(localPath)) {
      const err = new Error(`Local file not found: ${localPath}`);
      Logger.error(`[SSHManager] Upload failed: ${err.message}`);
      throw err;
    }

    try {
      const sftp = await this.getSftpSession(client, serverId);
      
      await new Promise<void>((resolve, reject) => {
        sftp.fastPut(localPath, remotePath, (err) => {
          if (err) {
            Logger.error(`[SSHManager] [SFTP] Put failed on server ${serverId}: ${err.message}`);
            return reject(err);
          }
          resolve();
        });
      });

      Logger.info(`[SSHManager] [SFTP] Upload completed successfully for server ${serverId}.`);
    } catch (err: any) {
      Logger.error(`[SSHManager] [SFTP] Upload failed on server ${serverId}:`, err);
      throw err;
    }
  }

  async downloadFile(serverId: string, remotePath: string, localPath: string): Promise<void> {
    Logger.info(`[SSHManager] [SFTP] Downloading ${remotePath} to ${localPath} from server ${serverId}`);
    const client = this.pool.get(serverId);
    if (!client) {
      const err = new Error(`Server ${serverId} is not connected.`);
      Logger.error(`[SSHManager] Download failed: ${err.message}`);
      throw err;
    }

    try {
      const sftp = await this.getSftpSession(client, serverId);

      await new Promise<void>((resolve, reject) => {
        sftp.fastGet(remotePath, localPath, (err) => {
          if (err) {
            Logger.error(`[SSHManager] [SFTP] Get failed on server ${serverId}: ${err.message}`);
            return reject(err);
          }
          resolve();
        });
      });

      Logger.info(`[SSHManager] [SFTP] Download completed successfully for server ${serverId}.`);
    } catch (err: any) {
      Logger.error(`[SSHManager] [SFTP] Download failed on server ${serverId}:`, err);
      throw err;
    }
  }

  // --- PRIVATE HELPERS ---

  private async connectWithRetry(server: ServerConfig, attempt = 1): Promise<Client> {
    this.statuses.set(server.id, 'connecting');
    Logger.info(`[SSHManager] Attempting connection to ${server.ip}:${server.port} (Attempt ${attempt}/3)...`);

    try {
      const client = await this.singleConnectAttempt(server);
      this.pool.set(server.id, client);
      this.statuses.set(server.id, 'connected');
      
      try {
        const homeDir = await this.queryHomeDirectory(client);
        this.workingDirs.set(server.id, homeDir);
      } catch (homeErr) {
        this.workingDirs.set(server.id, '~');
      }

      Logger.info(`[SSHManager] Server ${server.id} successfully connected and pooled.`);

      // Wire up state updates on dynamic network loss / socket dropouts
      client.on('close', () => {
        Logger.info(`[SSHManager] Connection closed on server socket: ${server.id}`);
        this.pool.delete(server.id);
        this.statuses.set(server.id, 'disconnected');
        this.workingDirs.delete(server.id);
      });

      client.on('error', (err) => {
        Logger.error(`[SSHManager] Connection error on active socket ${server.id}: ${err.message}`);
        this.statuses.set(server.id, 'error');
      });

      return client;
    } catch (err: any) {
      Logger.warn(`[SSHManager] Connection attempt ${attempt} failed: ${err.message}`);

      if (attempt < 3) {
        Logger.info(`[SSHManager] Waiting 2 seconds before retry attempt ${attempt + 1}...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return this.connectWithRetry(server, attempt + 1);
      } else {
        Logger.error(`[SSHManager] All 3 attempts failed to connect to ${server.ip}. Connection rejected.`);
        this.statuses.set(server.id, 'error');
        throw new Error(`Failed to connect to SSH server after 3 attempts. Error: ${err.message}`);
      }
    }
  }

  private singleConnectAttempt(server: ServerConfig): Promise<Client> {
    return new Promise<Client>((resolve, reject) => {
      const client = new Client();
      let hasFinished = false;

      // Configure a safety 10 seconds manual timeout callback
      const timeoutId = setTimeout(() => {
        if (!hasFinished) {
          hasFinished = true;
          client.destroy();
          reject(new Error(`Connection ready timeout (10 seconds reached)`));
        }
      }, 10000);

      client.on('ready', () => {
        if (!hasFinished) {
          hasFinished = true;
          clearTimeout(timeoutId);
          resolve(client);
        }
      });

      client.on('error', (err) => {
        if (!hasFinished) {
          hasFinished = true;
          clearTimeout(timeoutId);
          reject(err);
        }
      });

      client.on('end', () => {
        if (!hasFinished) {
          hasFinished = true;
          clearTimeout(timeoutId);
          reject(new Error('Connection ended prematurely during handshake'));
        }
      });

      try {
        const connectConfig: any = {
          host: server.ip,
          port: server.port,
          username: server.username,
          readyTimeout: 10000 // ssh2 native ready timeout
        };

        if (server.keyPath) {
          if (!fs.existsSync(server.keyPath)) {
            clearTimeout(timeoutId);
            return reject(new Error(`SSH private key file not found at: ${server.keyPath}`));
          }
          let privateKey: Buffer;
          try {
            privateKey = fs.readFileSync(server.keyPath);
          } catch (keyErr: any) {
            clearTimeout(timeoutId);
            return reject(new Error(`Failed to read SSH private key file: ${keyErr.message}`));
          }
          connectConfig.privateKey = privateKey;
          if (server.password) {
            connectConfig.passphrase = server.password;
          }
        } else if (server.password) {
          connectConfig.password = server.password;
        } else {
          clearTimeout(timeoutId);
          return reject(new Error(`No authentication method provided. Please provide either a Private Key or Password.`));
        }

        client.connect(connectConfig);
      } catch (connErr: any) {
        clearTimeout(timeoutId);
        reject(connErr);
      }
    });
  }

  private getSftpSession(client: Client, serverId: string): Promise<SFTPWrapper> {
    return new Promise<SFTPWrapper>((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          Logger.error(`[SSHManager] [SFTP] Session creation failed on ${serverId}: ${err.message}`);
          return reject(err);
        }
        resolve(sftp);
      });
    });
  }

  private queryHomeDirectory(client: Client): Promise<string> {
    return new Promise<string>((resolve) => {
      client.exec('pwd', (err, stream) => {
        if (err) return resolve('~');
        let stdout = '';
        stream.on('data', (data: Buffer) => { stdout += data.toString(); });
        stream.on('close', () => {
          resolve(stdout.trim() || '~');
        });
      });
    });
  }
}
