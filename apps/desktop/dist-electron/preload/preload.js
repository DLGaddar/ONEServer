"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    servers: {
        getAll: () => electron_1.ipcRenderer.invoke('servers:getAll'),
        getById: (id) => electron_1.ipcRenderer.invoke('servers:getById', id),
        add: (input) => electron_1.ipcRenderer.invoke('servers:add', input),
        update: (input) => electron_1.ipcRenderer.invoke('servers:update', input),
        remove: (id) => electron_1.ipcRenderer.invoke('servers:remove', id),
    },
    ssh: {
        connect: (config) => electron_1.ipcRenderer.invoke('ssh:connect', config),
        disconnect: (serverId) => electron_1.ipcRenderer.invoke('ssh:disconnect', serverId),
        executeCommand: (serverId, command) => electron_1.ipcRenderer.invoke('ssh:executeCommand', serverId, command),
        getStatus: (serverId) => electron_1.ipcRenderer.invoke('ssh:getStatus', serverId),
        ping: (host, port) => electron_1.ipcRenderer.invoke('ssh:ping', host, port),
        collectMetrics: (serverId) => electron_1.ipcRenderer.invoke('ssh:collectMetrics', serverId),
        listContainers: (serverId) => electron_1.ipcRenderer.invoke('docker:listContainers', serverId),
        onLog: (callback) => {
            const listener = (_event, data) => callback(data);
            electron_1.ipcRenderer.on('ssh:log-event', listener);
            return () => {
                electron_1.ipcRenderer.removeListener('ssh:log-event', listener);
            };
        }
    },
    pairing: {
        generate: () => electron_1.ipcRenderer.invoke('pairing:generate'),
        getStatus: () => electron_1.ipcRenderer.invoke('pairing:getStatus'),
        disconnect: () => electron_1.ipcRenderer.invoke('pairing:disconnect'),
        sendMetrics: (metrics) => electron_1.ipcRenderer.invoke('pairing:sendMetrics', metrics),
        onStatusChange: (callback) => {
            const listener = (_event, status) => callback(status);
            electron_1.ipcRenderer.on('pairing:status-change', listener);
            return () => {
                electron_1.ipcRenderer.removeListener('pairing:status-change', listener);
            };
        },
        onCommandExecuted: (callback) => {
            const listener = (_event, cmd) => callback(cmd);
            electron_1.ipcRenderer.on('pairing:command-executed', listener);
            return () => {
                electron_1.ipcRenderer.removeListener('pairing:command-executed', listener);
            };
        }
    },
    settings: {
        getRelayUrl: () => electron_1.ipcRenderer.invoke('settings:getRelayUrl'),
        saveRelayUrl: (url) => electron_1.ipcRenderer.invoke('settings:saveRelayUrl', url)
    },
    app: {
        checkForUpdates: () => electron_1.ipcRenderer.invoke('app:checkForUpdates'),
        openExternal: (url) => electron_1.ipcRenderer.invoke('app:openExternal', url),
        onUpdateAvailable: (callback) => {
            const listener = (_event, info) => callback(info);
            electron_1.ipcRenderer.on('update:available', listener);
            return () => {
                electron_1.ipcRenderer.removeListener('update:available', listener);
            };
        }
    },
    service: {
        getStatus: () => electron_1.ipcRenderer.invoke('service:getStatus')
    }
});
