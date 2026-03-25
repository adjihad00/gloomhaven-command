import express from 'express';
import { createServer } from 'http';
import { resolve } from 'path';
import { networkInterfaces } from 'os';
import { GameStore } from './gameStore.js';
import { SessionManager } from './sessionManager.js';
import { WsHub } from './wsHub.js';
import { configureStaticRoutes } from './staticServer.js';
import { CommandHandler } from './commandHandler.js';
import { importGhsState, exportGhsState } from '@gloomhaven-command/shared';

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

app.post('/api/import', (req, res) => {
  try {
    const { gameCode, ghsState } = req.body;

    if (!gameCode || typeof gameCode !== 'string') {
      res.status(400).json({ error: 'gameCode is required' });
      return;
    }

    if (!ghsState || typeof ghsState !== 'object') {
      res.status(400).json({ error: 'ghsState object is required' });
      return;
    }

    const state = importGhsState(ghsState);
    state.gameCode = gameCode;
    gameStore.save(gameCode, state);

    console.log(`[${gameCode}] Imported GHS state (rev ${state.revision})`);

    res.json({
      success: true,
      gameCode,
      revision: state.revision,
      characters: state.characters.length,
      monsters: state.monsters.length,
      round: state.round,
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Failed to import GHS state', details: String(err) });
  }
});

app.get('/api/export/:gameCode', (req, res) => {
  const { gameCode } = req.params;
  const state = gameStore.load(gameCode);
  if (!state) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  const ghsState = exportGhsState(state);
  res.json(ghsState);
});

// HTTP server
const httpServer = createServer(app);

// Services
const gameStore = new GameStore(resolve(rootDir, 'data/ghs.sqlite'));
const sessionManager = new SessionManager();
const wsHub = new WsHub(httpServer, gameStore, sessionManager);
wsHub.init();

// Command handler pipeline
const commandHandler = new CommandHandler(gameStore, sessionManager);
commandHandler.broadcastFn = (gameCode, diff) => {
  wsHub.broadcast(gameCode, diff);
};
wsHub.onCommand = (ws, gameCode, command) => {
  commandHandler.handleCommand(ws, gameCode, command);
};

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
