import express from 'express';
import { createServer } from 'http';
import { resolve } from 'path';
import { networkInterfaces } from 'os';
import { GameStore } from './gameStore.js';
import { SessionManager } from './sessionManager.js';
import { WsHub } from './wsHub.js';
import { configureStaticRoutes } from './staticServer.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const rootDir = resolve(import.meta.dirname, '../../');

// Express app
const app = express();
configureStaticRoutes(app, rootDir);

// API routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', sessions: sessionManager.getSessionCount() });
});

app.get('/api/games', (_req, res) => {
  res.json(gameStore.listGames());
});

app.post('/api/import', (_req, res) => {
  res.status(501).json({ error: 'Not implemented — coming in Phase 1E' });
});

// HTTP server
const httpServer = createServer(app);

// Services
const gameStore = new GameStore(resolve(rootDir, 'data/ghs.sqlite'));
const sessionManager = new SessionManager();
const wsHub = new WsHub(httpServer, gameStore, sessionManager);
wsHub.init();

// Start listening
httpServer.listen(PORT, () => {
  console.log(`Gloomhaven Command server running on port ${PORT}`);
  console.log(`  Controller: http://localhost:${PORT}/controller`);
  console.log(`  Phone:      http://localhost:${PORT}/phone`);
  console.log(`  Display:    http://localhost:${PORT}/display`);

  const lanIp = getLanIp();
  if (lanIp) {
    console.log(`  LAN:        http://${lanIp}:${PORT}`);
  }
});

// Graceful shutdown
function shutdown(): void {
  console.log('Shutting down...');
  wsHub.shutdown();
  gameStore.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// LAN IP detection
function getLanIp(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}
