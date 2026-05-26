import { contextBridge, ipcRenderer } from 'electron';
import { CreateServerInput, UpdateServerInput } from '@oneserver/core';

contextBridge.exposeInMainWorld('electronAPI', {
  servers: {
    getAll: () => ipcRenderer.invoke('servers:getAll'),
    getById: (id: string) => ipcRenderer.invoke('servers:getById', id),
    add: (input: CreateServerInput) => ipcRenderer.invoke('servers:add', input),
    update: (input: UpdateServerInput) => ipcRenderer.invoke('servers:update', input),
    remove: (id: string) => ipcRenderer.invoke('servers:remove', id),
  },
  ssh: {
    connect: (config: any) => ipcRenderer.invoke('ssh:connect', config),
    disconnect: (serverId: string) => ipcRenderer.invoke('ssh:disconnect', serverId),
    executeCommand: (serverId: string, command: string) => ipcRenderer.invoke('ssh:executeCommand', serverId, command),
    getStatus: (serverId: string) => ipcRenderer.invoke('ssh:getStatus', serverId),
    ping: (host: string, port: number) => ipcRenderer.invoke('ssh:ping', host, port),
    collectMetrics: (serverId: string) => ipcRenderer.invoke('ssh:collectMetrics', serverId),
    listContainers: (serverId: string) => ipcRenderer.invoke('docker:listContainers', serverId),
    onLog: (callback: (data: { level: string; msg: string; time: string }) => void) => {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on('ssh:log-event', listener);
      return () => {
        ipcRenderer.removeListener('ssh:log-event', listener);
      };
    }
  },
  pairing: {
    generate: () => ipcRenderer.invoke('pairing:generate'),
    getStatus: () => ipcRenderer.invoke('pairing:getStatus'),
    disconnect: () => ipcRenderer.invoke('pairing:disconnect'),
    sendMetrics: (metrics: any) => ipcRenderer.invoke('pairing:sendMetrics', metrics),
    onStatusChange: (callback: (status: { paired: boolean; deviceId?: string }) => void) => {
      const listener = (_event: any, status: any) => callback(status);
      ipcRenderer.on('pairing:status-change', listener);
      return () => {
        ipcRenderer.removeListener('pairing:status-change', listener);
      };
    },
    onCommandExecuted: (callback: (cmd: any) => void) => {
      const listener = (_event: any, cmd: any) => callback(cmd);
      ipcRenderer.on('pairing:command-executed', listener);
      return () => {
        ipcRenderer.removeListener('pairing:command-executed', listener);
      };
    }
  },
  settings: {
    getRelayUrl: () => ipcRenderer.invoke('settings:getRelayUrl'),
    saveRelayUrl: (url: string) => ipcRenderer.invoke('settings:saveRelayUrl', url)
  },
  app: {
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
    onUpdateAvailable: (callback: (info: { version: string; downloadUrl: string; changelog: string[] }) => void) => {
      const listener = (_event: any, info: any) => callback(info);
      ipcRenderer.on('update:available', listener);
      return () => {
        ipcRenderer.removeListener('update:available', listener);
      };
    }
  },
  service: {
    getStatus: () => ipcRenderer.invoke('service:getStatus')
  }
});

