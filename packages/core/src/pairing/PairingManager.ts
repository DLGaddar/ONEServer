import crypto from 'crypto';
import { WebSocket, RawData } from 'ws';
import { MobileCommand, RelayPayload } from './types';

export class PairingManager {
  private ws: WebSocket | null = null;
  private aesKey: Buffer | null = null;
  private commandCallback: ((cmd: MobileCommand) => void) | null = null;
  private currentPairingCode: string | null = null;

  // Connection state callbacks – wired up by ipc.ts for logging/UI updates
  public onConnected: ((relayUrl: string) => void) | null = null;
  public onDisconnected: (() => void) | null = null;
  public onError: ((err: Error) => void) | null = null;
  public onMobilePaired: ((deviceId: string) => void) | null = null;

  public isPaired: boolean = false;
  public pairedDeviceId: string | null = null;

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  connect(relayUrl: string, pairingCode: string): void {
    this.disconnect();
    this.currentPairingCode = pairingCode;

    // Derive a strict 256-bit AES key using PBKDF2 with 100k iterations
    const salt = Buffer.from('oneserver-pairing-salt', 'utf8');
    this.aesKey = crypto.pbkdf2Sync(pairingCode, salt, 100000, 32, 'sha256');

    this.ws = new WebSocket(relayUrl);

    this.ws.on('open', () => {
      // Send the initial pairing code registration payload
      const payload = JSON.stringify({ type: 'desktop', pairingCode });
      this.ws?.send(payload);
      this.onConnected?.(relayUrl);
      this.startPingInterval();
    });

    this.ws.on('message', (data: RawData) => {
      try {
        const encrypted = JSON.parse(data.toString());
        if (encrypted.iv && encrypted.ciphertext && encrypted.tag) {
          const decrypted = this.decrypt(encrypted.iv, encrypted.ciphertext, encrypted.tag);
          if (decrypted) {
            const cmd = JSON.parse(decrypted) as MobileCommand;

            // Handle pairing confirmation message directly
            if (cmd.action === 'pair:confirm' && cmd.deviceId) {
              this.isPaired = true;
              this.pairedDeviceId = cmd.deviceId;
              // Fire the hook so ipc.ts can start the metrics push loop
              this.onMobilePaired?.(cmd.deviceId);
            }

            if (this.commandCallback) {
              this.commandCallback(cmd);
            }
          }
        }
      } catch {
        // Fail-silent, ignore malformed/unauthorized messages
      }
    });

    this.ws.on('close', () => {
      this.clearPingInterval();
      this.ws = null;
      this.isPaired = false;
      this.pairedDeviceId = null;
      this.onDisconnected?.();
    });

    this.ws.on('error', (err: Error) => {
      this.clearPingInterval();
      this.onError?.(err);
      this.disconnect();
    });
  }

  onMobileCommand(callback: (cmd: MobileCommand) => void): void {
    this.commandCallback = callback;
  }

  sendMetrics(metrics: RelayPayload): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.aesKey) {
      return;
    }

    try {
      const plaintext = JSON.stringify(metrics);
      const encrypted = this.encrypt(plaintext);
      if (encrypted) {
        this.ws.send(JSON.stringify(encrypted));
      }
    } catch {
      // Fail-silent
    }
  }

  disconnect(): void {
    this.clearPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.aesKey = null;
    this.currentPairingCode = null;
    this.isPaired = false;
    this.pairedDeviceId = null;
  }

  private pingInterval: NodeJS.Timeout | null = null;

  private startPingInterval(): void {
    this.clearPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 10000);
  }

  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private encrypt(plaintext: string): { iv: string; ciphertext: string; tag: string } | null {
    if (!this.aesKey) return null;
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.aesKey, iv);
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');
      return {
        iv: iv.toString('hex'),
        ciphertext,
        tag
      };
    } catch {
      return null;
    }
  }

  private decrypt(ivHex: string, ciphertextHex: string, tagHex: string): string | null {
    if (!this.aesKey) return null;
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.aesKey, iv);
      decipher.setAuthTag(tag);
      let plaintext = decipher.update(ciphertextHex, 'hex', 'utf8');
      plaintext += decipher.final('utf8');
      return plaintext;
    } catch {
      return null;
    }
  }
}
