import express from 'express';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { resolve, join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
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

app.get('/api/data/:edition/battle-goals', (req, res) => {
  const bgPath = join(stagingDataPath, req.params.edition, 'battle-goals.json');
  try {
    const data = JSON.parse(readFileSync(bgPath, 'utf-8'));
    res.json(data);
  } catch {
    res.json([]);
  }
});

app.get('/api/data/level-calc', (req, res) => {
  const levels = (req.query.levels as string || '').split(',').map(Number).filter((n) => !isNaN(n));
  const adj = parseInt(req.query.adjustment as string) || 0;
  const solo = req.query.solo === 'true';
  const level = calculateScenarioLevel(levels, adj, solo);
  res.json({ ...deriveLevelValues(level), characterLevels: levels, adjustment: adj });
});

// ── HTTP/HTTPS server ────────────────────────────────────────────────────────

// Certificate search order:
// 1. Let's Encrypt (certbot): SSL_CERT_PATH + SSL_KEY_PATH env vars
// 2. Let's Encrypt default: /etc/letsencrypt/live/ or C:\Certbot\live\ (first match)
// 3. Local mkcert: certs/ directory in project root
// 4. No certs found → plain HTTP

function findCerts(): { cert: string; key: string } | null {
  // Env vars (highest priority)
  if (process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
    if (existsSync(process.env.SSL_CERT_PATH) && existsSync(process.env.SSL_KEY_PATH)) {
      return { cert: process.env.SSL_CERT_PATH, key: process.env.SSL_KEY_PATH };
    }
  }

  // Certbot default paths (scan for first domain)
  const certbotDirs = [
    'C:\\Certbot\\live',
    '/etc/letsencrypt/live',
  ];
  for (const base of certbotDirs) {
    if (existsSync(base)) {
      const dirs = readdirSync(base, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== 'README')
        .map(d => d.name);
      for (const dir of dirs) {
        const cert = join(base, dir, 'fullchain.pem');
        const key = join(base, dir, 'privkey.pem');
        if (existsSync(cert) && existsSync(key)) {
          return { cert, key };
        }
      }
    }
  }

  // Local mkcert certs
  const localCert = resolve(rootDir, 'certs');
  if (existsSync(localCert)) {
    const files = readdirSync(localCert);
    const certFile = files.find(f => f.endsWith('.pem') && !f.includes('-key') && !f.includes('rootCA'));
    const keyFile = files.find(f => f.endsWith('-key.pem'));
    if (certFile && keyFile) {
      return { cert: join(localCert, certFile), key: join(localCert, keyFile) };
    }
  }

  return null;
}

const certs = findCerts();
const useHttps = !!certs;

const httpServer = certs
  ? createHttpsServer({ cert: readFileSync(certs.cert), key: readFileSync(certs.key) }, app)
  : createServer(app);

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
  const proto = useHttps ? 'https' : 'http';
  httpServer.listen(PORT, () => {
    console.log(`Gloomhaven Command server running on port ${PORT} (${useHttps ? 'HTTPS' : 'HTTP'})`);
    console.log(`  Controller: ${proto}://localhost:${PORT}/controller`);
    console.log(`  Phone:      ${proto}://localhost:${PORT}/phone`);
    console.log(`  Display:    ${proto}://localhost:${PORT}/display`);

    const lanIp = getLanIp();
    if (lanIp) {
      console.log(`  LAN:        ${proto}://${lanIp}:${PORT}`);
    }
    if (certs) {
      console.log(`  Cert:       ${certs.cert}`);
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
