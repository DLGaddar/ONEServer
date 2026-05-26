import { Server, CreateServerInput, UpdateServerInput } from '@oneserver/core';

declare global {
  interface Window {
    electronAPI: {
      servers: {
        getAll: () => Promise<Server[]>;
        getById: (id: string) => Promise<Server | null>;
        add: (input: CreateServerInput) => Promise<Server>;
        update: (input: UpdateServerInput) => Promise<Server>;
        remove: (id: string) => Promise<boolean>;
      };
      ssh: {
        connect: (config: any) => Promise<void>;
        disconnect: (serverId: string) => Promise<void>;
        executeCommand: (serverId: string, command: string) => Promise<{ stdout: string; stderr: string; exitCode: number; duration: number }>;
        getStatus: (serverId: string) => Promise<string>;
        ping: (host: string, port: number) => Promise<boolean>;
        collectMetrics: (serverId: string) => Promise<any>;
        listContainers: (serverId: string) => Promise<any[]>;
        onLog: (callback: (data: { level: string; msg: string; time: string }) => void) => () => void;
      };
      pairing: {
        generate: () => Promise<{ pairingCode: string; qrDataUrl: string }>;
        getStatus: () => Promise<{ paired: boolean; deviceId?: string; pairingCode?: string; qrDataUrl?: string; relayUrl?: string }>;
        disconnect: () => Promise<{ paired: false }>;
        sendMetrics: (metrics: any) => Promise<void>;
        onStatusChange: (callback: (status: { paired: boolean; deviceId?: string }) => void) => () => void;
        onCommandExecuted: (callback: (cmd: any) => void) => () => void;
      };
      settings: {
        getRelayUrl: () => Promise<string>;
        saveRelayUrl: (url: string) => Promise<boolean>;
      };
      app: {
        checkForUpdates: () => Promise<null>;
        openExternal: (url: string) => Promise<boolean>;
        onUpdateAvailable: (callback: (info: { version: string; downloadUrl: string; changelog: string[] }) => void) => () => void;
      };
      service: {
        getStatus: () => Promise<{ relay: 'connected' | 'disconnected'; servers: number; lastPoll: string | null }>;
      };
    };
  }
}
export {};

