// index.js

import { startServer } from './server/server.js';
import { startDashboard } from './ui/dashboard.js';

/* =====================
   BOOT
===================== */

console.clear();

console.log('[*] Starting server...');
startServer();

console.log('[*] Launching TUI...');
startDashboard();
