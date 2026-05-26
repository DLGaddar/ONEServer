import { WebSocket, WebSocketServer } from 'ws';

interface Pair {
  desktop?: WebSocket;
  mobile?: WebSocket;
}

const PORT = parseInt(process.env.PORT || '8080', 10);

const wss = new WebSocketServer({ port: PORT });

// In-memory pairings
const pairs = new Map<string, Pair>();

// Connection tracking maps
const socketToPairingCode = new Map<WebSocket, string>();
const socketToType = new Map<WebSocket, 'desktop' | 'mobile'>();
const activeSockets = new Map<WebSocket, boolean>();

function handleDisconnect(ws: WebSocket): void {
  activeSockets.delete(ws);
  const code = socketToPairingCode.get(ws);
  const type = socketToType.get(ws);

  if (code && type) {
    socketToPairingCode.delete(ws);
    socketToType.delete(ws);

    const pair = pairs.get(code);
    if (pair) {
      if (type === 'desktop') {
        pair.desktop = undefined;
        // If desktop disconnects, force-close mobile socket to clean up zombie session
        if (pair.mobile && pair.mobile.readyState === WebSocket.OPEN) {
          pair.mobile.close(1000, 'Desktop disconnected');
        }
      } else {
        pair.mobile = undefined;
      }

      // Completely remove map entry if both devices are disconnected
      if (!pair.desktop && !pair.mobile) {
        pairs.delete(code);
      }
    }
  }
}

wss.on('connection', (ws: WebSocket) => {
  activeSockets.set(ws, true);

  // Set pairing timeout: disconnect if pairing message doesn't arrive in 5 seconds
  const pairingTimeout = setTimeout(() => {
    if (!socketToPairingCode.has(ws)) {
      ws.close(1008, 'Pairing timeout');
    }
  }, 5000);

  ws.on('pong', () => {
    activeSockets.set(ws, true);
  });

  ws.on('ping', () => {
    activeSockets.set(ws, true);
  });

  ws.on('message', (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
    // Client is not paired yet; expect pairing payload
    if (!socketToPairingCode.has(ws)) {
      clearTimeout(pairingTimeout);
      try {
        const msg = JSON.parse(data.toString());
        if (
          (msg.type === 'desktop' || msg.type === 'mobile') &&
          typeof msg.pairingCode === 'string' &&
          msg.pairingCode.trim().length > 0
        ) {
          const code = msg.pairingCode.trim();
          const type = msg.type as 'desktop' | 'mobile';

          let pair = pairs.get(code);
          if (!pair) {
            pair = {};
            pairs.set(code, pair);
          }

          // Enforce 1-desktop and 1-mobile slot occupation per code
          if (type === 'desktop') {
            if (pair.desktop && pair.desktop.readyState === WebSocket.OPEN) {
              ws.close(1008, 'Desktop slot occupied');
              return;
            }
            pair.desktop = ws;
          } else {
            if (pair.mobile && pair.mobile.readyState === WebSocket.OPEN) {
              ws.close(1008, 'Mobile slot occupied');
              return;
            }
            pair.mobile = ws;
          }

          socketToPairingCode.set(ws, code);
          socketToType.set(ws, type);
        } else {
          ws.close(1008, 'Invalid pairing format');
        }
      } catch {
        ws.close(1008, 'Invalid JSON payload');
      }
      return;
    }

    // Client is paired; execute zero-knowledge payload relay
    const code = socketToPairingCode.get(ws)!;
    const type = socketToType.get(ws)!;
    const pair = pairs.get(code);

    if (pair) {
      const target = type === 'desktop' ? pair.mobile : pair.desktop;
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(data, { binary: isBinary });
      }
    }
  });

  ws.on('close', () => {
    clearTimeout(pairingTimeout);
    handleDisconnect(ws);
  });

  ws.on('error', () => {
    ws.close();
  });
});

// Heartbeat ping/pong routine (every 30 seconds)
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (activeSockets.get(ws) === false) {
      ws.terminate();
      return;
    }
    activeSockets.set(ws, false);
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});
