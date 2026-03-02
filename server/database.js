// server/database.js

import Database from 'better-sqlite3';
import {
  DB_PATH,
  HEARTBEAT_TIMEOUT_SECONDS,
  VERBOSE
} from '../config.js';

let db;
if ( VERBOSE === 'on' ){
 db = new Database(DB_PATH, { verbose: console.log });
} else {
 db = new Database(DB_PATH);
}

db.pragma('journal_mode = WAL');

/* =====================
   INIT
===================== */

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      uuid TEXT PRIMARY KEY,
      hostname TEXT NOT NULL,
      last_ip TEXT,
      status TEXT DEFAULT 'offline',
      last_seen INTEGER,
      last_heartbeat INTEGER,
      first_seen INTEGER,
      connection_count INTEGER DEFAULT 0
    )
  `);
}

/* =====================
   OPERATIONS
===================== */

export function registerOrUpdateDevice({ uuid, hostname, ip }) {
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO devices
    (uuid, hostname, last_ip, status, last_seen, last_heartbeat, first_seen, connection_count)
    VALUES (@uuid, @hostname, @ip, 'online', @now, @now, @now, 1)

    ON CONFLICT(uuid) DO UPDATE SET
      hostname = excluded.hostname,
      last_ip = excluded.last_ip,
      status = 'online',
      last_seen = excluded.last_seen,
      last_heartbeat = excluded.last_heartbeat,
      connection_count = connection_count + 1
  `).run({ uuid, hostname, ip, now });
}

export function updateHeartbeat({ uuid, ip }) {
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE devices
    SET
      last_ip = @ip,
      status = 'online',
      last_seen = @now,
      last_heartbeat = @now
    WHERE uuid = @uuid
  `).run({ uuid, ip, now });
}

export function markOffline(uuid) {
  if (!uuid) return;

  db.prepare(`
    UPDATE devices
    SET status = 'offline'
    WHERE uuid = @uuid AND status = 'online'
  `).run({ uuid });
}

export function markOfflineByTimeout() {
  const threshold =
    Math.floor(Date.now() / 1000) - HEARTBEAT_TIMEOUT_SECONDS;

  db.prepare(`
    UPDATE devices
    SET status = 'offline'
    WHERE status = 'online'
      AND last_heartbeat < @threshold
  `).run({ threshold });
}

export function getAllDevices() {
  return db
    .prepare('SELECT * FROM devices ORDER BY last_seen DESC')
    .all();
}

export { HEARTBEAT_TIMEOUT_SECONDS };
