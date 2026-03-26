import express from 'express';
import { createServer } from 'http';
import { resolve, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { networkInterfaces } from 'os';
import { GameStore } from './gameStore.js';
import { SessionManager } from './sessionManager.js';
import { WsHub } from './wsHub.js';
import { configureStaticRoutes } from './staticServer.js';
import { CommandHandler } from './commandHandler.js';
import { FileSystemDataLoader } from './dataLoader.js';
import {
  importGhsState, exportGhsState,
  DataManager, calculateScenarioLevel, deriveLevelValues,
} from '@gloomhaven-command/shared';

const PORT = parseInt(process.env.PORT || '3000', 10);
const rootDir = resolve(import.meta.dirname, '../../');

// Express app
const app = express();
configureStaticRoutes(app, rootDir);

// ── Data layer ────────────────────────────────────────────────────────────────

const dataPath = resolve(rootDir, 'assets', 'data');
const stagingDataPath = resolve(rootDir, '.staging', 'ghs-client', 'data');
const actualDataPath = existsSync(dataPath) ? dataPath : stagingDataPath;

const dataManager = new DataManager(new FileSystemDataLoader(actualDataPath));

async function loadEditions(): Promise<void> {
  if (!existsSync(actualDataPath)) {
    console.warn('Data directory not found:', actualDataPath);
    return;
  }
  const editionDirs = readdirSync(actualDataPath, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const ed of editionDirs) {
    if (existsSync(join(actualDataPath, ed, 'base.json'))) {
      await dataManager.loadEdition(ed);
      const chars = dataManager.getCharacterList(ed).length;
      const monsters = dataManager.getMonsterList(ed).length;
      const scenarios = dataManager.getScenarioList(ed).length;
      console.log(`  Loaded edition: ${ed} (${chars} chars, ${monsters} monsters, ${scenarios} scenarios)`);
    }
  }
}

// ── API routes ────────────────────────────────────────────────────────────────

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

// ── Data API endpoints ────────────────────────────────────────────────────────

app.get('/api/data/editions', (_req, res) => {
  res.json(dataManager.getLoadedEditions());
});

app.get('/api/data/:edition/characters', (req, res) => {
  res.json(dataManager.getCharacterList(req.params.edition));
});

app.get('/api/data/:edition/monsters', (req, res) => {
  res.json(dataManager.getMonsterList(req.params.edition));
});

app.get('/api/data/:edition/scenarios', (req, res) => {
  res.json(dataManager.getScenarioList(req.params.edition));
});

app.get('/api/data/:edition/character/:name', (req, res) => {
  const data = dataManager.getCharacter(req.params.edition, req.params.name);
  data ? res.json(data) : res.status(404).json({ error: 'Character not found' });
});

app.get('/api/data/:edition/monster/:name', (req, res) => {
  const data = dataManager.getMonster(req.params.edition, req.params.name);
  data ? res.json(data) : res.status(404).json({ error: 'Monster not found' });
});

app.get('/api/data/:edition/scenario/:index', (req, res) => {
  const data = dataManager.getScenario(req.params.edition, req.params.index);
  data ? res.json(data) : res.status(404).json({ error: 'Scenario not found' });
});

app.get('/api/data/:edition/monster-deck/:name', (req, res) => {
  const data = dataManager.getMonsterDeck(req.params.edition, req.params.name);
  data ? res.json(data) : res.status(404).json({ error: 'Deck not found' });
});

app.get('/api/data/level-calc', (req, res) => {
  const levels = (req.query.levels as string || '').split(',').map(Number).filter((n) => !isNaN(n));
  const adj = parseInt(req.query.adjustment as string) || 0;
  const solo = req.query.solo === 'true';
  const level = calculateScenarioLevel(levels, adj, solo);
  res.json({ ...deriveLevelValues(level), characterLevels: levels, adjustment: adj });
});

// ── HTTP server ───────────────────────────────────────────────────────────────

const httpServer = createServer(app);

// Services
const gameStore = new GameStore(resolve(rootDir, 'data/ghs.sqlite'));
const sessionManager = new SessionManager();
const wsHub = new WsHub(httpServer, gameStore, sessionManager);
wsHub.init();

// Command handler pipeline (with data manager for auto-spawn)
const commandHandler = new CommandHandler(gameStore, sessionManager, dataManager);
commandHandler.broadcastFn = (gameCode, diff) => {
  wsHub.broadcast(gameCode, diff);
};
wsHub.onCommand = (ws, gameCode, command) => {
  commandHandler.handleCommand(ws, gameCode, command);
};

// Start listening (load editions first)
loadEditions().then(() => {
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
