import React, { useState, useEffect, useRef } from 'react';
import { 
  Server as ServerIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  Terminal, 
  Search, 
  Copy, 
  Key, 
  Database, 
  FileText, 
  X, 
  Check, 
  AlertCircle,
  Activity,
  User,
  Hash,
  Globe,
  Lock,
  Smartphone,
  QrCode,
  Wifi,
  WifiOff,
  RefreshCw,
  Link2,
  Link2Off
} from 'lucide-react';
import { Server, CreateServerInput } from '@oneserver/core';

// Safe wrapper for copy to clipboard
function copyToClipboard(text: string, onCopied: () => void) {
  navigator.clipboard.writeText(text).then(onCopied);
}

function formatRelativeTime(dateString: string | Date | undefined): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

export default function App() {
  const [servers, setServers] = useState<Server[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'servers' | 'pairing' | 'logs'>('servers');
  const [logs, setLogs] = useState<{ time: string; type: 'info' | 'error' | 'success'; msg: string }[]>([]);

  // ── Pairing state ───────────────────────────────────────────────────────────
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pairingRelayUrl, setPairingRelayUrl] = useState<string | null>(null);
  const [relayConnected, setRelayConnected] = useState(false);
  const [isPaired, setIsPaired] = useState(false);
  const [pairedDeviceId, setPairedDeviceId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  // Configure Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [authType, setAuthType] = useState<'password' | 'key'>('password');
  const [formData, setFormData] = useState<CreateServerInput>({
    nickname: '',
    ip: '',
    port: 22,
    username: 'root',
    password: '',
    keyPath: ''
  });

  // Custom Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingServer, setDeletingServer] = useState<{ id: string; nickname: string } | null>(null);
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // SSH Console / Terminal state
  const [connectedServer, setConnectedServer] = useState<Server | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [sshLogs, setSshLogs] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [commandResults, setCommandResults] = useState<{ id: string; command: string; stdout: string; stderr: string; exitCode: number; duration: number }[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const terminalInputRef = useRef<HTMLInputElement>(null);

  // --- SERVER MONITORING & DOCKER POLLING STATES ---
  const [serverStatuses, setServerStatuses] = useState<Record<string, 'online' | 'offline' | 'warning' | 'connecting'>>({});
  const [serverMetrics, setServerMetrics] = useState<Record<string, any>>({});
  const [dockerCounts, setDockerCounts] = useState<Record<string, number>>({});
  const [lastMetricsUpdated, setLastMetricsUpdated] = useState<Record<string, Date>>({});
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'error' | 'info' }[]>([]);

  // ── Auto-Updater States ──────────────────────────────────────────────────────
  const [updateInfo, setUpdateInfo] = useState<{ version: string; downloadUrl: string; changelog: string[] } | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<{ relay: 'connected' | 'disconnected'; servers: number; lastPoll: string | null } | null>(null);

  const addToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Add system logs
  const addLog = (type: 'info' | 'error' | 'success', msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ time, type, msg }, ...prev].slice(0, 100));
  };

  // Load servers from SQLite via IPC
  const loadServers = async () => {
    try {
      addLog('info', 'Loading servers from SQLite...');
      const list = await window.electronAPI.servers.getAll();
      setServers(list);
      addLog('success', `Successfully loaded ${list.length} servers.`);
    } catch (err: any) {
      addLog('error', `Failed to load servers: ${err.message}`);
      setGlobalError('Unable to connect to the database.');
    }
  };

  useEffect(() => {
    loadServers();
    
    // Load saved settings & pairing details
    const loadSettings = async () => {
      try {
        const url = await (window.electronAPI as any).settings?.getRelayUrl?.();
        if (url) {
          setPairingRelayUrl(url);
        }

        const status = await window.electronAPI.pairing.getStatus();
        setIsPaired(status.paired);
        setPairedDeviceId(status.deviceId || null);
        if (status.pairingCode) {
          setPairingCode(status.pairingCode);
          setQrDataUrl(status.qrDataUrl || null);
          setPairingRelayUrl(status.relayUrl || null);
          addLog('info', `Active pairing session loaded: ${status.pairingCode}`);
        }
      } catch (err: any) {
        addLog('error', `Failed to load settings: ${err.message}`);
      }
    };
    loadSettings();

    // Subscribe to Auto-Updater Event from Main Process
    const unsubscribeUpdate = window.electronAPI.app.onUpdateAvailable((info) => {
      addLog('success', `Yeni güncelleme bulundu: v${info.version}`);
      setUpdateInfo(info);
      setIsUpdateDialogOpen(true);
      addToast(`🎉 Yeni sürüm mevcut: v${info.version}!`, 'info');
    });

    // Check for updates on boot
    const checkUpdates = async () => {
      try {
        addLog('info', 'Otomatik güncelleme kontrolü yapılıyor...');
        await window.electronAPI.app.checkForUpdates();
      } catch (err: any) {
        addLog('error', `Güncelleme kontrolü başarısız: ${err.message}`);
      }
    };
    checkUpdates();

    addLog('info', 'ONEServer GUI initialized.');

    // Subscribe to SSH Log Events from Main Process
    const unsubscribeLog = window.electronAPI.ssh.onLog((data: any) => {
      const logLine = `[${data.time}] [${data.level.toUpperCase()}] ${data.msg}`;
      setSshLogs(prev => [...prev, logLine]);
    });

    // Relay connection status (fired by PairingManager.onConnected/onDisconnected/onError)
    const unsubscribeRelay = (window.electronAPI as any).pairing?.onRelayStatus?.((data: any) => {
      setRelayConnected(!!data.connected);
      if (!data.connected && data.error) {
        addToast(`Relay bağlantı hatası: ${data.error}`, 'error');
        addLog('error', `Relay error: ${data.error}`);
      }
    });

    // Mobile pairing confirmation
    const unsubscribePairing = (window.electronAPI as any).pairing?.onStatusChange?.((data: any) => {
      if (data.paired) {
        setIsPaired(true);
        setPairedDeviceId(data.deviceId ?? null);
        addToast('📱 Mobil cihaz eşleştirildi!', 'success');
        addLog('success', `Mobile paired: ${data.deviceId}`);
      } else if (data.expired) {
        setIsPaired(false);
        setPairedDeviceId(null);
        setPairingCode(null);
        setQrDataUrl(null);
        addToast('⏳ Eşleşme süresi doldu. Lütfen yeni bir kod üretin.', 'error');
        addLog('error', 'Pairing session expired (5 minutes timeout reached).');
      }
    });

    // Poll Background Service Status every 15s
    const pollServiceStatus = async () => {
      try {
        const status = await window.electronAPI.service.getStatus();
        setServiceStatus(status);
      } catch (err) {
        console.error('Failed to poll background service status:', err);
      }
    };
    pollServiceStatus();
    const serviceStatusInterval = setInterval(pollServiceStatus, 15000);

    return () => {
      if (unsubscribeLog) unsubscribeLog();
      if (unsubscribeRelay) unsubscribeRelay?.();
      if (unsubscribePairing) unsubscribePairing?.();
      if (unsubscribeUpdate) unsubscribeUpdate();
      clearInterval(serviceStatusInterval);
    };
  }, []);

  // Scroll terminal to bottom
  useEffect(() => {
    if (terminalOpen) {
      const el = document.getElementById('terminal-scroll-anchor');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [sshLogs, terminalOpen]);

  // Keep terminal input focused when connection finishes or execution completes
  useEffect(() => {
    if (!isExecuting && !isConnecting && terminalOpen && connectedServer) {
      const timer = setTimeout(() => {
        terminalInputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isExecuting, isConnecting, terminalOpen, connectedServer]);

  const pollServerData = async (server: Server) => {
    try {
      const status = await window.electronAPI.ssh.getStatus(server.id);
      
      let mappedStatus: 'online' | 'offline' | 'warning' | 'connecting' = 'offline';
      if (status === 'connected') {
        mappedStatus = 'online';
      } else if (status === 'connecting') {
        mappedStatus = 'connecting';
      } else if (status === 'error') {
        mappedStatus = 'warning';
      } else {
        // Not connected via SSH. Do a fast TCP ping to see if the host is active & reachable!
        const isReachable = await window.electronAPI.ssh.ping(server.ip, server.port);
        mappedStatus = isReachable ? 'online' : 'offline';
      }

      setServerStatuses(prev => ({ ...prev, [server.id]: mappedStatus }));

      if (status === 'connected') {
        // Collect metrics
        try {
          const metrics = await window.electronAPI.ssh.collectMetrics(server.id);
          setServerMetrics(prev => ({ ...prev, [server.id]: metrics }));
          setLastMetricsUpdated(prev => ({ ...prev, [server.id]: new Date() }));
          setServerStatuses(prev => ({ ...prev, [server.id]: 'online' }));
        } catch (metricsErr: any) {
          console.error(`[Monitor Polling] Failed for ${server.nickname}:`, metricsErr);
          if (metricsErr.message.includes('timeout') || metricsErr.message.includes('time out') || metricsErr.message.includes('handshake')) {
            addToast(`Connection ready timeout (10 seconds reached) for ${server.nickname}`, 'error');
            setServerStatuses(prev => ({ ...prev, [server.id]: 'offline' }));
          } else {
            setServerStatuses(prev => ({ ...prev, [server.id]: 'warning' }));
          }
        }

        // Poll container counts
        try {
          const containers = await window.electronAPI.ssh.listContainers(server.id);
          setDockerCounts(prev => ({ ...prev, [server.id]: containers.length }));
        } catch (dockerErr: any) {
          console.error(`[Docker Polling] Failed for ${server.nickname}:`, dockerErr);
        }
      }
    } catch (err: any) {
      console.error(`[Polling Orchestration] Failed for ${server.nickname}:`, err);
    }
  };

  const refreshAllServersMetrics = async () => {
    if (servers.length === 0) return;
    await Promise.all(servers.map(pollServerData));
  };

  useEffect(() => {
    if (servers.length > 0) {
      refreshAllServersMetrics();
      const intervalId = setInterval(refreshAllServersMetrics, 15000);
      return () => clearInterval(intervalId);
    }
  }, [servers]);

  // Connect to SSH
  const handleConnect = async (server: Server) => {
    if (isConnecting) return;

    setConnectionError(null);
    setIsConnecting(true);
    setTerminalOpen(true);
    setConnectedServer(server);
    setSshLogs([]);
    setCommandResults([]);
    
    addLog('info', `Connecting to SSH server: ${server.nickname} (${server.ip})...`);

    try {
      let passwordToUse = server.password || '';
      
      if (!server.keyPath && !server.password) {
        const pass = prompt(`Enter SSH Password for ${server.username}@${server.ip}:`);
        if (pass === null) {
          setIsConnecting(false);
          setTerminalOpen(false);
          setConnectedServer(null);
          addLog('error', `Connection cancelled by user.`);
          return;
        }
        passwordToUse = pass;
      }

      await window.electronAPI.ssh.connect({
        id: server.id,
        ip: server.ip,
        port: server.port,
        username: server.username,
        keyPath: server.keyPath || null,
        password: passwordToUse || null
      });

      addLog('success', `Connected successfully to ${server.nickname}`);
      setSshLogs(prev => [...prev, `[System] Connected to ${server.username}@${server.ip}:${server.port}`]);
      pollServerData(server);
    } catch (err: any) {
      setConnectionError(err.message);
      addLog('error', `SSH Connection failed: ${err.message}`);
      setSshLogs(prev => [...prev, `[Error] Connection failed: ${err.message}`]);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect SSH
  const handleDisconnect = async () => {
    if (!connectedServer) return;
    try {
      await window.electronAPI.ssh.disconnect(connectedServer.id);
      addLog('info', `Disconnected from ${connectedServer.nickname}`);
      setSshLogs(prev => [...prev, `[System] Disconnected from session.`]);
    } catch (err: any) {
      addLog('error', `Disconnect failed: ${err.message}`);
    } finally {
      setConnectedServer(null);
      setTerminalOpen(false);
    }
  };

  // Execute Command via SSH
  const handleExecuteCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!connectedServer || !command.trim() || isExecuting) return;

    const cmdToRun = command.trim();
    setCommand('');
    setIsExecuting(true);
    setSshLogs(prev => [...prev, `${connectedServer.username}@${connectedServer.ip}:~$ ${cmdToRun}`]);

    try {
      const result = await window.electronAPI.ssh.executeCommand(connectedServer.id, cmdToRun);
      
      // Append output to results
      setCommandResults(prev => [...prev, {
        id: Math.random().toString(),
        command: cmdToRun,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: result.duration
      }]);

      if (result.stdout) {
        setSshLogs(prev => [...prev, result.stdout]);
      }
      if (result.stderr) {
        setSshLogs(prev => [...prev, `[Error] ${result.stderr}`]);
      }
      setSshLogs(prev => [...prev, `[Exit Code: ${result.exitCode}] (took ${result.duration}ms)`]);
    } catch (err: any) {
      addLog('error', `Command execution failed: ${err.message}`);
      setSshLogs(prev => [...prev, `[Error] Command execution failed: ${err.message}`]);
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle open modal for create
  const handleOpenAdd = () => {
    setEditingId(null);
    setAuthType('password');
    setFormData({
      nickname: '',
      ip: '',
      port: 22,
      username: 'root',
      password: '',
      keyPath: ''
    });
    setFormErrors({});
    setGlobalError(null);
    setIsModalOpen(true);
  };

  // Handle open modal for edit
  const handleOpenEdit = (server: Server) => {
    setEditingId(server.id);
    setAuthType(server.keyPath ? 'key' : 'password');
    setFormData({
      nickname: server.nickname,
      ip: server.ip,
      port: server.port,
      username: server.username,
      password: server.password || '',
      keyPath: server.keyPath || ''
    });
    setFormErrors({});
    setGlobalError(null);
    setIsModalOpen(true);
  };

  // Trigger custom delete modal
  const handleTriggerDelete = (id: string, name: string) => {
    setDeletingServer({ id, nickname: name });
    setIsDeleteModalOpen(true);
  };

  // Handle custom delete confirmation
  const handleConfirmDelete = async () => {
    if (!deletingServer) return;
    const { id, nickname } = deletingServer;
    
    try {
      addLog('info', `Deleting server: ${nickname}...`);
      const success = await window.electronAPI.servers.remove(id);
      if (success) {
        addLog('success', `Deleted server "${nickname}" from database.`);
        loadServers();
      } else {
        addLog('error', `Server "${nickname}" was not found or could not be deleted.`);
      }
    } catch (err: any) {
      addLog('error', `Failed to delete: ${err.message}`);
      alert(`Error deleting server: ${err.message}`);
    } finally {
      setIsDeleteModalOpen(false);
      setDeletingServer(null);
    }
  };

  // Handle submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setGlobalError(null);
    
    // Clean up fields based on auth type choice
    const cleanPassword = authType === 'password' && formData.password ? formData.password.trim() : null;
    const cleanKeyPath = authType === 'key' && formData.keyPath ? formData.keyPath.trim() : null;

    const parsedData = {
      ...formData,
      port: Number(formData.port),
      password: cleanPassword,
      keyPath: cleanKeyPath
    };

    addLog('info', editingId ? `Updating server "${parsedData.nickname}"...` : `Adding server "${parsedData.nickname}"...`);

    try {
      if (editingId) {
        await window.electronAPI.servers.update({
          id: editingId,
          ...parsedData
        });
        addLog('success', `Successfully updated server: ${parsedData.nickname}`);
      } else {
        const added = await window.electronAPI.servers.add(parsedData);
        addLog('success', `Successfully added server: ${added.nickname} (ID: ${added.id})`);
      }
      
      setIsModalOpen(false);
      loadServers();
    } catch (err: any) {
      try {
        const zodErrors = JSON.parse(err.message);
        if (Array.isArray(zodErrors)) {
          const errorsMap: Record<string, string> = {};
          zodErrors.forEach((zError: any) => {
            const field = zError.path[0];
            errorsMap[field] = zError.message;
          });
          setFormErrors(errorsMap);
          addLog('error', `Validation failed: ${zodErrors.length} schema fields invalid.`);
          return;
        }
      } catch (parseErr) {
        // Not a JSON Zod validation error
      }
      
      setGlobalError(err.message.replace('Error: ', ''));
      addLog('error', `Database/Repository error: ${err.message}`);
    }
  };

  // ── Pairing: Generate ──────────────────────────────────────────────────────
  const handleGeneratePairing = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setRelayConnected(false);
    setIsPaired(false);
    setPairedDeviceId(null);
    try {
      const result = await (window.electronAPI as any).pairing.generate();
      setPairingCode(result.pairingCode);
      setQrDataUrl(result.qrDataUrl);
      setPairingRelayUrl(result.relayUrl ?? null);
      addLog('info', `Pairing code: ${result.pairingCode} → relay: ${result.relayUrl}`);
    } catch (err: any) {
      addToast(`Pairing oluşturulamadı: ${err.message}`, 'error');
      addLog('error', `Pairing generate failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Pairing: Disconnect ────────────────────────────────────────────────────
  const handleDisconnectPairing = async () => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);
    try {
      await (window.electronAPI as any).pairing.disconnect();
      setPairingCode(null);
      setQrDataUrl(null);
      setPairingRelayUrl(null);
      setRelayConnected(false);
      setIsPaired(false);
      setPairedDeviceId(null);
      addLog('info', 'Pairing session disconnected.');
    } catch (err: any) {
      addToast(`Disconnect hatası: ${err.message}`, 'error');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Filter servers
  const filteredServers = servers.filter(s => 
    s.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="app-container">
      
      {/* SIDEBAR PANEL */}
      <aside className="sidebar">
        <div>
          {/* Logo */}
          <div className="sidebar-header">
            <div className="logo-container">
              <Database className="logo-icon" />
            </div>
            <div>
              <h1 className="logo-text-title">ONEServer</h1>
              <span className="logo-text-sub">Control Panel</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="nav-list">
            <button 
              onClick={() => setActiveTab('servers')}
              className={`nav-item ${activeTab === 'servers' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ServerIcon style={{ height: '16px', width: '16px' }} />
                <span>My Servers</span>
              </div>
              <span className="nav-item-badge">
                {servers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('pairing')}
              className={`nav-item ${activeTab === 'pairing' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Smartphone style={{ height: '16px', width: '16px' }} />
                <span>Mobile Pair</span>
              </div>
              {isPaired
                ? <span className="nav-item-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>Paired</span>
                : relayConnected
                  ? <span className="nav-item-badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>Live</span>
                  : null}
            </button>

            <button 
              onClick={() => setActiveTab('logs')}
              className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText style={{ height: '16px', width: '16px' }} />
                <span>System Logs</span>
              </div>
              {logs.filter(l => l.type === 'error').length > 0 && (
                <span className="nav-item-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                  {logs.filter(l => l.type === 'error').length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer" style={{ gap: '8px', display: 'flex', flexDirection: 'column' }}>
          <div className="connection-status-card">
            <Activity style={{ height: '16px', width: '16px', color: 'var(--success)' }} />
            <div style={{ fontSize: '11px' }}>
              <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>SQLite Connected</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>WAL Mode Active</div>
            </div>
          </div>

          {/* Background Service Status Bar */}
          {serviceStatus && (
            <div className="connection-status-card" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px' }}>
              <div className="status-indicator-dot" style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: serviceStatus.relay === 'connected' ? '#22c55e' : '#ef4444',
                boxShadow: serviceStatus.relay === 'connected' ? '0 0 8px #22c55e' : '0 0 8px #ef4444',
                flexShrink: 0
              }} />
              <div style={{ fontSize: '11px' }}>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                  {serviceStatus.relay === 'connected' ? 'Relay Bağlı' : 'Relay Bağlantısı Yok'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {serviceStatus.servers} sunucu izleniyor
                </div>
                {serviceStatus.lastPoll && (
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Son Güncelleme: {new Date(serviceStatus.lastPoll).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            v1.0.0 Stable
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="main-content">
        
        {/* TOP BAR / HEADER */}
        <header className="header">
          <div className="header-title-container">
            <h2 className="header-title">
              {activeTab === 'servers' ? 'Servers Dashboard' : activeTab === 'pairing' ? 'Mobile Pairing' : 'Console System Logs'}
            </h2>
            
            {activeTab === 'servers' && (
              <div className="search-container">
                <Search className="search-icon" />
                <input 
                  type="text"
                  placeholder="Search servers by nickname or IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            )}
          </div>

          <button onClick={handleOpenAdd} className="btn-primary">
            <Plus style={{ height: '14px', width: '14px' }} />
            Add Server
          </button>
        </header>

        {/* CONTENT PANELS */}
        <div className="content-viewport">
          
          {/* TAB 1: SERVERS GRID */}
          {activeTab === 'servers' && (
            <div className="animate-fade-in">
              
              {filteredServers.length === 0 ? (
                <div className="empty-state-panel animate-fade-in">
                  <div className="empty-state-icon-container">
                    <ServerIcon className="empty-state-icon" />
                  </div>
                  <div>
                    <h3 className="empty-state-title">No servers found</h3>
                    <p className="empty-state-desc">
                      {searchQuery ? 'Try adjusting your search criteria.' : 'Get started by configuring your very first SQLite-backed SSH server.'}
                    </p>
                  </div>
                  {!searchQuery && (
                    <button onClick={handleOpenAdd} className="btn-primary" style={{ marginTop: '8px' }}>
                      Configure Server
                    </button>
                  )}
                </div>
              ) : (
                <div className="dashboard-grid animate-fade-in">
                  {filteredServers.map((server) => {
                    const status = serverStatuses[server.id] || 'offline';
                    const metrics = serverMetrics[server.id];
                    const count = dockerCounts[server.id];
                    const lastUpdatedDate = lastMetricsUpdated[server.id];
                    
                    return (
                      <div key={server.id} className="server-card" style={{ position: 'relative' }}>
                        
                        {/* Offline Card Overlay */}
                        {status === 'offline' && (
                          <div className="offline-card-overlay">
                            <div className="offline-text-title">
                              <AlertCircle style={{ height: '16px', width: '16px' }} />
                              Sunucu Offline
                            </div>
                            <div className="offline-text-desc">Bağlantı sağlanamadı</div>
                          </div>
                        )}

                        {/* Card Header */}
                        <div className="card-header" style={{ position: 'relative', zIndex: 20 }}>
                          <div className="card-title-block">
                            <div className="card-icon-container">
                              <Terminal className="card-icon" />
                            </div>
                            <div>
                              <h4 className="card-title">{server.nickname}</h4>
                              <span className="card-subtitle">{server.id}</span>
                            </div>
                          </div>
                          
                          {/* Authentication and Status Badges */}
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span className={`card-badge ${status}`}>
                              {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : status === 'warning' ? 'Warning' : 'Connecting'}
                            </span>
                            <span className={`card-badge ${server.keyPath ? 'key-auth' : ''}`}>
                              {server.keyPath ? 'SSH Key' : 'Password'}
                            </span>
                          </div>
                        </div>

                        {/* Connection Details */}
                        <div className="card-details-list">
                          <div className="card-detail-item">
                            <span className="card-detail-label">
                              <Globe className="card-detail-label-icon" /> IP Address:
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="card-detail-value code">{server.ip}</span>
                              <button 
                                onClick={() => copyToClipboard(server.ip, () => {
                                  setCopiedId(server.id);
                                  addLog('info', `Copied IP for ${server.nickname} to clipboard.`);
                                  setTimeout(() => setCopiedId(null), 1500);
                                })}
                                className="copy-btn"
                              >
                                {copiedId === server.id ? <Check style={{ height: '12px', width: '12px', color: 'var(--success)' }} /> : <Copy style={{ height: '12px', width: '12px' }} />}
                              </button>
                            </div>
                          </div>

                          <div className="card-detail-item">
                            <span className="card-detail-label">
                              <Hash className="card-detail-label-icon" /> Port:
                            </span>
                            <span className="card-detail-value code">{server.port}</span>
                          </div>

                          <div className="card-detail-item">
                            <span className="card-detail-label">
                              <User className="card-detail-label-icon" /> Username:
                            </span>
                            <span className="card-detail-value code">{server.username}</span>
                          </div>
                        </div>

                        {/* LIVE METRICS SECTION */}
                        {status === 'online' && metrics && (
                          <div className="metrics-block animate-fade-in">
                            {/* CPU Progress */}
                            <div className="metric-row">
                              <div className="metric-label-container">
                                <span className="metric-label-text">
                                  <Activity style={{ height: '12px', width: '12px', color: 'var(--accent-primary)' }} />
                                  CPU
                                </span>
                                <span className="metric-value">{metrics.cpu.percent}%</span>
                              </div>
                              <div className="progress-bar-bg">
                                <div 
                                  className={`progress-bar-fill ${metrics.cpu.percent > 85 ? 'error' : metrics.cpu.percent > 70 ? 'warning' : ''}`}
                                  style={{ width: `${metrics.cpu.percent}%` }}
                                />
                              </div>
                            </div>

                            {/* RAM Progress */}
                            <div className="metric-row">
                              <div className="metric-label-container">
                                <span className="metric-label-text">
                                  <Database style={{ height: '12px', width: '12px', color: 'var(--accent-primary)' }} />
                                  RAM
                                </span>
                                <span className="metric-value">
                                  {metrics.ram.percent}% ({Math.round(metrics.ram.used / 1024 * 10) / 10}GB / {Math.round(metrics.ram.total / 1024 * 10) / 10}GB)
                                </span>
                              </div>
                              <div className="progress-bar-bg">
                                <div 
                                  className={`progress-bar-fill ${metrics.ram.percent > 85 ? 'error' : metrics.ram.percent > 70 ? 'warning' : ''}`}
                                  style={{ width: `${metrics.ram.percent}%` }}
                                />
                              </div>
                            </div>

                            {/* Docker count & Volume metrics */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginTop: '4px', color: 'var(--text-secondary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ height: '6px', width: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
                                <span>Containers: <strong style={{ color: 'var(--text-primary)' }}>{count !== undefined ? count : 0} active</strong></span>
                              </div>
                              <span>Disk: <strong style={{ color: 'var(--text-primary)' }}>{metrics.disk.percent}%</strong></span>
                            </div>
                          </div>
                        )}

                        {/* Footer Actions */}
                        <div className="card-footer" style={{ position: 'relative', zIndex: 20 }}>
                          <span className="card-footer-date">
                            {lastUpdatedDate ? `Updated: ${formatRelativeTime(lastUpdatedDate)}` : `Updated: ${new Date(server.updatedAt).toLocaleDateString()}`}
                          </span>
                          
                          <div className="card-actions">
                            <button 
                              onClick={() => handleOpenEdit(server)}
                              className="btn-icon"
                              title="Edit Server"
                            >
                              <Edit3 style={{ height: '14px', width: '14px' }} />
                            </button>
                            
                            <button 
                              onClick={() => handleTriggerDelete(server.id, server.nickname)}
                              className="btn-icon delete"
                              title="Delete Server"
                            >
                              <Trash2 style={{ height: '14px', width: '14px' }} />
                            </button>

                            <button 
                              onClick={() => handleConnect(server)}
                              className="btn-connect"
                            >
                              <Terminal style={{ height: '11px', width: '11px' }} />
                              Connect
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 1.5: MOBILE PAIRING PANEL */}
          {activeTab === 'pairing' && (
            <div className="pairing-panel animate-fade-in">
              <div className="pairing-header">
                <div className="pairing-title-container">
                  <Smartphone style={{ height: '18px', width: '18px', color: 'var(--accent-primary)' }} />
                  <h3 className="pairing-title">Mobile App Integration</h3>
                </div>
                
                <div className="pairing-status-badge-container">
                  {isPaired ? (
                    <span className="pairing-status-badge paired">
                      <Link2 style={{ height: '12px', width: '12px' }} />
                      Paired
                    </span>
                  ) : relayConnected ? (
                    <span className="pairing-status-badge live">
                      <Wifi style={{ height: '12px', width: '12px' }} />
                      Relay Connected
                    </span>
                  ) : (
                    <span className="pairing-status-badge disconnected">
                      <WifiOff style={{ height: '12px', width: '12px' }} />
                      Disconnected
                    </span>
                  )}
                </div>
              </div>

              <div className="pairing-grid">
                {/* Info / Instructions Section */}
                <div className="pairing-info-section">
                  <div className="pairing-card">
                    <h4 className="pairing-card-title">
                      <Smartphone style={{ height: '16px', width: '16px', color: 'var(--accent-primary)' }} />
                      Monitor & Control from your Phone
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      ONEServer supports real-time mobile push integration. Pair your iOS/Android device to monitor server CPU/RAM/Disk usage, list running Docker containers, and trigger secure container or server reboot commands.
                    </p>
                  </div>

                  <div className="pairing-card">
                    <h4 className="pairing-card-title">
                      <Key style={{ height: '16px', width: '16px', color: 'var(--accent-primary)' }} />
                      How to Pair your Device
                    </h4>
                    <div className="pairing-steps">
                      <div className="pairing-step">
                        <div className="pairing-step-number">1</div>
                        <div>Open the **ONEServer** app on your mobile device.</div>
                      </div>
                      <div className="pairing-step">
                        <div className="pairing-step-number">2</div>
                        <div>Tap on **Scan QR** or choose **Manual Pairing**.</div>
                      </div>
                      <div className="pairing-step">
                        <div className="pairing-step-number">3</div>
                        <div>Scan the QR code on the right or manually enter the 8-character pairing code and Relay URL.</div>
                      </div>
                      <div className="pairing-step">
                        <div className="pairing-step-number">4</div>
                        <div>Your mobile device will securely establish an end-to-end encrypted session.</div>
                      </div>
                    </div>
                  </div>

                  <div className="pairing-card">
                    <h4 className="pairing-card-title">
                      <Globe style={{ height: '16px', width: '16px', color: 'var(--accent-primary)' }} />
                      Relay Settings
                    </h4>
                    <div className="pairing-setup-form" style={{ marginTop: '4px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '10px' }}>WebSocket Relay Server IP / URL</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            className="form-input" 
                            style={{ fontFamily: 'JetBrains Mono, monospace' }}
                            value={pairingRelayUrl || ''}
                            onChange={async (e) => {
                              const newUrl = e.target.value;
                              setPairingRelayUrl(newUrl);
                              await (window.electronAPI as any).settings.saveRelayUrl(newUrl);
                              addLog('info', `Saved relay URL configuration: ${newUrl}`);
                            }}
                            placeholder="ws://212.68.34.55:8080"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generate / QR Code Action Section */}
                <div className="pairing-qr-section">
                  {pairingCode && qrDataUrl ? (
                    <>
                      <div className="pairing-qr-wrapper">
                        <img src={qrDataUrl} className="pairing-qr-image" alt="Pairing QR Code" />
                      </div>
                      
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                        Pairing Code
                      </div>
                      
                      <div className="pairing-code-display">
                        <span>{pairingCode}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(pairingCode);
                            addToast('Pairing code copied to clipboard!', 'success');
                          }}
                          className="pairing-code-btn"
                          title="Copy Pairing Code"
                        >
                          <Copy style={{ height: '16px', width: '16px' }} />
                        </button>
                      </div>

                      {isPaired && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '12px', fontWeight: '600', marginBottom: '16px' }}>
                          <Smartphone style={{ height: '14px', width: '14px' }} />
                          <span>Connected: {pairedDeviceId || 'Remote Mobile'}</span>
                        </div>
                      )}

                      <button 
                        onClick={handleDisconnectPairing}
                        className="btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center', borderColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                        disabled={isDisconnecting}
                      >
                        <Link2Off style={{ height: '14px', width: '14px' }} />
                        {isDisconnecting ? 'Disconnecting...' : 'Disconnect Session'}
                      </button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px 0' }}>
                      <QrCode style={{ height: '64px', width: '64px', color: 'var(--text-muted)', opacity: 0.4 }} />
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>No Active Pairing Session</h4>
                        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', maxWidth: '280px', lineHeight: '1.5', margin: '0 auto' }}>
                          Click the button below to connect to the Relay server and generate a secure pairing session.
                        </p>
                      </div>
                      
                      <button 
                        onClick={handleGeneratePairing}
                        className="btn-primary"
                        style={{ padding: '12px 24px', fontSize: '12.5px', marginTop: '8px' }}
                        disabled={isGenerating}
                      >
                        <RefreshCw style={{ height: '14px', width: '14px', animation: isGenerating ? 'spin 1s linear infinite' : 'none' }} />
                        {isGenerating ? 'Connecting to Relay...' : 'Generate Pairing Session'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SYSTEM LOGS PANEL */}
          {activeTab === 'logs' && (
            <div className="logs-panel animate-fade-in">
              <div className="logs-panel-header">
                <div className="logs-panel-title-container">
                  <FileText style={{ height: '18px', width: '18px', color: 'var(--accent-primary)' }} />
                  <h3 className="logs-panel-title">System Event Console</h3>
                </div>
                <button 
                  onClick={() => {
                    setLogs([]);
                    addLog('success', 'Cleared logging console window.');
                  }}
                  className="logs-clear-btn"
                >
                  Clear Console
                </button>
              </div>

              {/* Logs Stream */}
              <div className="logs-stream">
                {logs.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '140px' }}>
                    Console stream is empty. Perform CRUD operations to trigger events.
                  </div>
                ) : (
                  logs.map((logItem, idx) => (
                    <div key={idx} className="log-row">
                      <span className="log-timestamp">[{logItem.time}]</span>
                      <span className={`log-badge ${logItem.type}`}>
                        {logItem.type}
                      </span>
                      <span className={`log-text ${logItem.type === 'error' ? 'error' : logItem.type === 'success' ? 'success' : ''}`}>
                        {logItem.msg}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="logs-panel-footer">
                <AlertCircle className="logs-footer-icon" />
                Persistent logs written to userData/logs/main.log
              </div>
            </div>
          )}

        </div>
      </main>

      {/* CONFIGURATION MODAL */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content animate-fade-in">
            
            {/* Modal Header */}
            <div className="modal-header">
              <h3 className="modal-title">
                {editingId ? 'Edit Server Configuration' : 'Configure New Remote Server'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="modal-close-btn"
              >
                <X style={{ height: '16px', width: '16px' }} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="modal-form">
              
              {globalError && (
                <div className="form-alert">
                  <AlertCircle style={{ height: '16px', width: '16px', flexShrink: 0 }} />
                  <span>{globalError}</span>
                </div>
              )}

              {/* Nickname */}
              <div className="form-group">
                <label className="form-label">
                  Nickname <span style={{ color: 'var(--accent-primary)' }}>*</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Production Database"
                  value={formData.nickname}
                  onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                  className={`form-input ${formErrors.nickname ? 'error' : ''}`}
                />
                {formErrors.nickname && (
                  <p className="form-error-msg">{formErrors.nickname}</p>
                )}
              </div>

              {/* Host IP and Port */}
              <div className="form-row-grid">
                {/* IP Address */}
                <div className="form-group">
                  <label className="form-label">
                    Host IP / Domain <span style={{ color: 'var(--accent-primary)' }}>*</span>
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. 192.168.1.100"
                    value={formData.ip}
                    onChange={(e) => setFormData(prev => ({ ...prev, ip: e.target.value }))}
                    className={`form-input ${formErrors.ip ? 'error' : ''}`}
                  />
                  {formErrors.ip && (
                    <p className="form-error-msg">{formErrors.ip}</p>
                  )}
                </div>

                {/* Port */}
                <div className="form-group">
                  <label className="form-label">
                    Port <span style={{ color: 'var(--accent-primary)' }}>*</span>
                  </label>
                  <input 
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={formData.port}
                    onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 22 }))}
                    className={`form-input ${formErrors.port ? 'error' : ''}`}
                  />
                  {formErrors.port && (
                    <p className="form-error-msg">{formErrors.port}</p>
                  )}
                </div>
              </div>

              {/* Username */}
              <div className="form-group">
                <label className="form-label">
                  SSH Username <span style={{ color: 'var(--accent-primary)' }}>*</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. root"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  className={`form-input ${formErrors.username ? 'error' : ''}`}
                />
                {formErrors.username && (
                  <p className="form-error-msg">{formErrors.username}</p>
                )}
              </div>

              {/* AUTH TYPE SELECTOR TAB */}
              <div className="form-group">
                <label className="form-label">Authentication Method</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setAuthType('password')}
                    className="btn-secondary"
                    style={{ 
                      flex: 1, 
                      padding: '10px', 
                      background: authType === 'password' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      borderColor: authType === 'password' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.04)',
                      color: authType === 'password' ? '#a5b4fc' : 'var(--text-secondary)'
                    }}
                  >
                    <Lock style={{ height: '12px', width: '12px', marginRight: '6px', verticalAlign: 'middle' }} />
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthType('key')}
                    className="btn-secondary"
                    style={{ 
                      flex: 1, 
                      padding: '10px', 
                      background: authType === 'key' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      borderColor: authType === 'key' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.04)',
                      color: authType === 'key' ? '#a5b4fc' : 'var(--text-secondary)'
                    }}
                  >
                    <Key style={{ height: '12px', width: '12px', marginRight: '6px', verticalAlign: 'middle' }} />
                    SSH Private Key
                  </button>
                </div>
              </div>

              {/* CONDITIONAL INPUT FIELDS */}
              {authType === 'password' ? (
                <div className="form-group">
                  <label className="form-label">SSH Password</label>
                  <input 
                    type="password"
                    placeholder="Enter SSH password..."
                    value={formData.password || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className={`form-input ${formErrors.password ? 'error' : ''}`}
                  />
                  {formErrors.password && (
                    <p className="form-error-msg">{formErrors.password}</p>
                  )}
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">
                    <span>SSH Key File Path</span>
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. C:\Users\user\.ssh\id_rsa"
                    value={formData.keyPath || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, keyPath: e.target.value }))}
                    className={`form-input ${formErrors.keyPath ? 'error' : ''}`}
                  />
                  {formErrors.keyPath && (
                    <p className="form-error-msg">{formErrors.keyPath}</p>
                  )}
                </div>
              )}

              {/* Form Actions */}
              <div className="form-actions">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                >
                  {editingId ? 'Save Changes' : 'Initialize Server'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && deletingServer && (
        <div className="modal-backdrop">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '400px' }}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0' }}>
              <h3 className="modal-title" style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle style={{ height: '20px', width: '20px' }} />
                Remove Server
              </h3>
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setDeletingServer(null); }}
                className="modal-close-btn"
              >
                <X style={{ height: '16px', width: '16px' }} />
              </button>
            </div>
            
            <div style={{ padding: '18px 24px 24px', color: 'var(--text-secondary)', fontSize: '12.5px', lineHeight: '1.6' }}>
              Are you sure you want to delete server <strong style={{ color: 'var(--text-primary)' }}>"{deletingServer.nickname}"</strong>? This configuration will be permanently erased from SQLite database.
            </div>

            <div className="form-actions" style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.15)', margin: '0' }}>
              <button 
                type="button" 
                onClick={() => { setIsDeleteModalOpen(false); setDeletingServer(null); }} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleConfirmDelete} 
                className="btn-primary"
                style={{ background: 'var(--error)', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}
              >
                Delete Server
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO-UPDATER MODAL DIALOG */}
      {isUpdateDialogOpen && updateInfo && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '480px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-primary)' }}>
                <RefreshCw style={{ height: '18px', width: '18px' }} />
                Yeni Sürüm Mevcut!
              </div>
              <button 
                onClick={() => { setIsUpdateDialogOpen(false); setUpdateInfo(null); }} 
                className="btn-icon"
              >
                <X style={{ height: '18px', width: '18px' }} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '16px' }}>
                Yeni bir ONEServer sürümü mevcut: <strong style={{ color: 'var(--text-primary)' }}>v{updateInfo.version}</strong>. İndirilmesini ister misiniz?
              </p>
              {updateInfo.changelog && updateInfo.changelog.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px 16px', marginTop: '12px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sürüm Notları:</div>
                  <ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: 0, fontSize: '13px' }}>
                    {updateInfo.changelog.map((note, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="form-actions" style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.15)', margin: '0' }}>
              <button 
                type="button" 
                onClick={() => { setIsUpdateDialogOpen(false); setUpdateInfo(null); }} 
                className="btn-secondary"
              >
                İptal
              </button>
              <button 
                type="button" 
                onClick={async () => {
                  setIsUpdateDialogOpen(false);
                  if (updateInfo.downloadUrl) {
                    await window.electronAPI.app.openExternal(updateInfo.downloadUrl);
                  }
                  setUpdateInfo(null);
                }} 
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Check style={{ height: '14px', width: '14px' }} />
                Evet, İndir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SSH TERMINAL DOCK */}
      {terminalOpen && connectedServer && (
        <div className="terminal-dock">
          {/* Header */}
          <div className="terminal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal style={{ height: '16px', width: '16px', color: 'var(--accent-primary)' }} />
              <span className="terminal-title">
                SSH Console: <strong>{connectedServer.nickname}</strong> ({connectedServer.username}@{connectedServer.ip})
              </span>
              {isConnecting && <span className="terminal-status-badge connecting">Connecting...</span>}
              {!isConnecting && !connectionError && <span className="terminal-status-badge connected">Connected</span>}
              {connectionError && <span className="terminal-status-badge error">Failed</span>}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                onClick={() => setSshLogs([])}
                className="btn-icon" 
                title="Clear Terminal Screen"
                style={{ padding: '4px' }}
              >
                <Trash2 style={{ height: '14px', width: '14px' }} />
              </button>
              <button 
                onClick={handleDisconnect}
                className="btn-icon delete" 
                title="Close Session"
                style={{ padding: '4px' }}
              >
                <X style={{ height: '14px', width: '14px' }} />
              </button>
            </div>
          </div>

          {/* Terminal Output Body */}
          <div className="terminal-body">
            {sshLogs.map((logLine, idx) => (
              <div key={idx} className="terminal-log-line">
                {logLine}
              </div>
            ))}
            {isExecuting && (
              <div className="terminal-log-line loading-indicator">
                <span className="cursor-pulse">▋</span> Executing remote command...
              </div>
            )}
            {/* Connection error helper */}
            {connectionError && (
              <div className="terminal-log-line error-text" style={{ color: 'var(--error)', marginTop: '8px' }}>
                <strong>Connection Error:</strong> {connectionError}
                <div style={{ marginTop: '8px' }}>
                  <button 
                    onClick={() => handleConnect(connectedServer)}
                    className="btn-primary" 
                    style={{ padding: '6px 12px', fontSize: '11px', background: 'var(--accent-primary)' }}
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            )}
            <div id="terminal-scroll-anchor" />
          </div>

          {/* Terminal Input Bar */}
          {!isConnecting && !connectionError && (
            <form onSubmit={handleExecuteCommand} className="terminal-input-row">
              <span className="terminal-prompt">
                {connectedServer.username}@{connectedServer.ip}:~$
              </span>
              <input 
                ref={terminalInputRef}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Type your bash command and press Enter..."
                className="terminal-input"
                disabled={isExecuting}
                autoFocus
              />
              <button 
                type="submit" 
                className="terminal-send-btn"
                disabled={isExecuting || !command.trim()}
              >
                Execute
              </button>
            </form>
          )}
        </div>
      )}

      {/* TOAST NOTIFICATIONS OVERLAY */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item ${toast.type}`}>
            <AlertCircle style={{ height: '16px', width: '16px', flexShrink: 0, marginTop: '2px', color: toast.type === 'error' ? 'var(--error)' : toast.type === 'success' ? 'var(--success)' : 'var(--accent-primary)' }} />
            <div className="toast-message">{toast.msg}</div>
          </div>
        ))}
      </div>

    </div>
  );
}
