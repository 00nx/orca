// server/config.js

import fs from 'fs';
import path from 'path';


/* global config */


export const VERBOSE = 'off'; // on or off



/* =====================
   PATH SETUP
===================== */

export const DATA_DIR = path.resolve('./data');

// Auto-create /data folder if missing
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const DB_PATH = path.join(DATA_DIR, 'db.sqlite');

/* =====================
   SERVER CONFIG
===================== */

export const PORT = 3010;

export const HEARTBEAT_TIMEOUT_SECONDS = 90;

export const TIMEOUT_CHECK_INTERVAL_MS = 30_000;
