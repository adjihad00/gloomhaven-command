# Phase 1D — Server: Express, WebSocket Hub, Sessions, SQLite

> Paste into Claude Code. Implements the full server — after this prompt the
> server boots, accepts connections, and persists game state. Phase 1E wires
> the command handler and adds the integration test.

---

Read CLAUDE.md, then docs/PROJECT_CONTEXT.md, then docs/COMMAND_PROTOCOL.md.

Then read these files in full — you need exact types and function signatures:
- `packages/shared/src/types/protocol.ts`
- `packages/shared/src/types/gameState.ts`
- `packages/shared/src/types/commands.ts`
- `packages/shared/src/utils/ghsCompat.ts` (for `createEmptyGameState`)
- `server/package.json` (confirm dependencies)
- `server/tsconfig.json`

## Architecture Recap

Single Node.js process. One port (default 3000). Express serves:
- Static files for each client at `/display`, `/controller`, `/phone`
- Shared CSS at `/shared/styles/`
- Game assets at `/assets/`
- API endpoints at `/api/`

The `ws` library attaches to the same HTTP server for WebSocket upgrade on the root path `/`. No separate WS port.

Client flow:
1. Client opens WebSocket to `ws://host:3000/`
2. Client sends `ConnectMessage` with `gameCode` and optional `sessionToken`
3. Server loads/creates game state for that `gameCode`
4. Server responds with `ConnectedMessage` (full state) or `ReconnectedMessage` (missed diffs)
5. Client sends `CommandMessage` — server validates, applies, persists, broadcasts diff
6. Server pings every 15s, disconnects stale clients after 5s

## STEP 1 — Implement `server/src/gameStore.ts`

SQLite persistence layer using `better-sqlite3`.

```typescript
import Database from 'better-sqlite3';
import type { GameState } from '@gloomhaven-command/shared';
```

### Class: `GameStore`

Constructor takes an optional `dbPath` (default: `./data/ghs.sqlite`). Creates the `data/` directory if it doesn't exist. Opens the database and runs migrations.

#### Schema

```sql
CREATE TABLE IF NOT EXISTS games (
  game_code TEXT PRIMARY KEY,
  state TEXT NOT NULL,          -- JSON serialized GameState
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

One table, one row per game code. `state` column holds the full `JSON.stringify(gameState)`.

#### Methods

**`load(gameCode: string): GameState | null`**
Query by game_code. Parse the JSON. Return null if not found.

**`save(gameCode: string, state: GameState): void`**
Upsert: INSERT OR REPLACE into games. Serialize state as JSON. Set revision from `state.revision`.

**`listGames(): Array<{ gameCode: string; revision: number; updatedAt: string }>`**
Return all game codes with metadata. Used by future admin UI.

**`deleteGame(gameCode: string): boolean`**
Delete a game. Return true if it existed.

**`close(): void`**
Close the database connection. Called on server shutdown.

Use `better-sqlite3` synchronous API — it runs in the same thread and is faster than async alternatives for SQLite. Wrap in try/catch for DB errors.

## STEP 2 — Implement `server/src/sessionManager.ts`

Manages client sessions, tokens, and the diff replay buffer.

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { ClientSession, ClientRole, DiffMessage } from '@gloomhaven-command/shared';
```

### Class: `SessionManager`

In-memory storage. No persistence needed — sessions are transient.

#### Internal State

```typescript
private sessions: Map<string, ClientSession>;          // sessionToken → session
private diffBuffer: Map<string, DiffMessage[]>;        // gameCode → bounded ring buffer
private readonly maxDiffBuffer = 100;                   // max diffs stored per game
```

#### Methods

**`createSession(role: ClientRole, characterName?: string): ClientSession`**
Generate UUID v4 token. Create session with `connectedAt: Date.now()`, `lastPong: Date.now()`, `lastRevision: 0`. Store in map. Return the session.

**`getSession(token: string): ClientSession | null`**
Lookup by token.

**`updateRevision(token: string, revision: number): void`**
Update `lastRevision` on the session.

**`updatePong(token: string): void`**
Update `lastPong` to `Date.now()`.

**`removeSession(token: string): void`**
Delete from map.

**`getStaleTokens(timeoutMs: number): string[]`**
Return tokens where `Date.now() - lastPong > timeoutMs`.

**`pushDiff(gameCode: string, diff: DiffMessage): void`**
Append diff to the buffer for that game code. If buffer exceeds `maxDiffBuffer`, shift the oldest entry off.

**`getDiffsSince(gameCode: string, revision: number): DiffMessage[] | null`**
Return all diffs with `revision > revision` argument. If the requested revision is older than the oldest buffered diff, return `null` (caller should send full state instead).

**`getSessionCount(): number`**
Return total active sessions. For logging.

## STEP 3 — Implement `server/src/wsHub.ts`

The WebSocket connection manager. Handles connect/disconnect, message routing, heartbeat, and broadcasting.

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type {
  ClientMessage, ServerMessage, ConnectMessage,
  CommandMessage, DiffMessage, GameState
} from '@gloomhaven-command/shared';
import { GameStore } from './gameStore.js';
import { SessionManager } from './sessionManager.js';
import { createEmptyGameState } from '@gloomhaven-command/shared';
```

### Class: `WsHub`

Constructor takes `httpServer: HttpServer`, `gameStore: GameStore`, `sessionManager: SessionManager`.

#### Internal State

```typescript
private wss: WebSocketServer;
private clients: Map<WebSocket, { sessionToken: string; gameCode: string }>;
private heartbeatInterval: NodeJS.Timeout;
```

#### Setup (`init()`)

1. Create `WebSocketServer` attached to `httpServer` at path `/`
2. Set up `wss.on('connection', ...)` handler
3. Start heartbeat interval (every 15s)

#### Connection handler

On new WebSocket connection:
1. Store the socket in `clients` map (initially no session — wait for `ConnectMessage`)
2. Set up `ws.on('message', ...)` — parse JSON, dispatch to `handleMessage()`
3. Set up `ws.on('close', ...)` — clean up from `clients` map, log disconnect
4. Set up `ws.on('error', ...)` — log, close socket
5. Set up `ws.on('pong', ...)` — call `sessionManager.updatePong(token)`

#### `handleMessage(ws: WebSocket, raw: string)`

Parse JSON as `ClientMessage`. Switch on `type`:

**`'connect'`**: Handle connection/reconnection.
1. Load game state from `gameStore.load(gameCode)`. If not found, create via `createEmptyGameState()` and save it.
2. If `sessionToken` is provided and session exists in sessionManager:
   - Check `getDiffsSince(gameCode, lastRevision)`
   - If diffs available: send `ReconnectedMessage` with the diffs
   - If diffs not available (too far behind): send `ConnectedMessage` with full state
   - Reuse the existing session, update `lastPong`
3. If no sessionToken or session not found:
   - Create new session via `sessionManager.createSession(role, characterName)`
   - Send `ConnectedMessage` with full state and new token
4. Store `{ sessionToken, gameCode }` in `clients` map for this socket

**`'command'`**: Delegate to command handler (placeholder for now — 1E wires this).
Store a callback: `this.onCommand?: (ws, gameCode, command) => void`. If set, call it. If not, send error.

**`'pong'`**: Update session pong timestamp.

#### `broadcast(gameCode: string, message: ServerMessage, excludeSocket?: WebSocket)`

Send a JSON message to all connected clients in that game code, optionally excluding the sender.

Iterate `clients` map. For each socket where `gameCode` matches and `readyState === WebSocket.OPEN`, call `ws.send(JSON.stringify(message))`.

#### `sendTo(ws: WebSocket, message: ServerMessage)`

Send a JSON message to a specific client. Check `readyState` before sending.

#### `getGameState(gameCode: string): GameState | null`

Convenience: load from gameStore.

#### Heartbeat

Every 15 seconds:
1. Get stale tokens via `sessionManager.getStaleTokens(20000)` (20s = missed at least one ping cycle)
2. For each stale token, find the socket in `clients`, terminate it, remove session
3. For all active sockets, call `ws.ping()` (the `ws` library sends native ping frames)

The browser WebSocket API automatically responds to ping with pong. The `ws` library emits `'pong'` events on the server side.

#### `shutdown()`

Clear heartbeat interval. Close all sockets. Close WebSocketServer.

#### Public callback property

```typescript
public onCommand: ((
  ws: WebSocket,
  gameCode: string,
  command: Command
) => void) | null = null;
```

Phase 1E sets this callback to wire the command handler.

## STEP 4 — Implement `server/src/staticServer.ts`

Express setup for serving static files.

```typescript
import express, { Express } from 'express';
import { join, resolve } from 'path';
```

### `configureStaticRoutes(app: Express, rootDir: string): void`

`rootDir` is the repo root (resolved at startup).

Routes:
- `/display` → serve `clients/display/index.html` and `clients/display/dist/`
- `/controller` → serve `clients/controller/index.html` and `clients/controller/dist/`
- `/phone` → serve `clients/phone/index.html` and `clients/phone/dist/`
- `/shared/styles/` → serve `clients/shared/styles/`
- `/assets/` → serve `assets/` directory (game images, data JSONs)
- `/` → redirect to `/controller` (default landing page)

Use `express.static()` for each. Set appropriate cache headers:
- HTML files: `no-cache` (always get latest)
- CSS/JS: `max-age=3600` (1 hour)
- Assets (images): `max-age=86400` (1 day)

Also configure:
- `express.json({ limit: '10mb' })` for the import endpoint (large GHS saves)
- CORS headers: allow all origins (LAN use case — devices on same network)

## STEP 5 — Implement `server/src/index.ts`

The entry point. Boots everything.

```typescript
import express from 'express';
import { createServer } from 'http';
import { resolve } from 'path';
import { GameStore } from './gameStore.js';
import { SessionManager } from './sessionManager.js';
import { WsHub } from './wsHub.js';
import { configureStaticRoutes } from './staticServer.js';
```

### Startup sequence

1. Read `PORT` from env or default to `3000`
2. Resolve `rootDir` to repo root (from server/src, that's `../../`)
3. Create Express app
4. Configure static routes via `configureStaticRoutes(app, rootDir)`
5. Create HTTP server from Express app
6. Instantiate `GameStore` (database at `{rootDir}/data/ghs.sqlite`)
7. Instantiate `SessionManager`
8. Instantiate `WsHub(httpServer, gameStore, sessionManager)`
9. Call `wsHub.init()`
10. Start listening on PORT

Log on startup:
```
Gloomhaven Command server running on port 3000
  Controller: http://localhost:3000/controller
  Phone:      http://localhost:3000/phone
  Display:    http://localhost:3000/display
```

Also log the local network IP so LAN devices can connect. Use `os.networkInterfaces()` to find the first non-internal IPv4 address:
```
  LAN:        http://192.168.x.x:3000
```

### Graceful shutdown

Handle `SIGINT` and `SIGTERM`:
1. Log "Shutting down..."
2. `wsHub.shutdown()`
3. `gameStore.close()`
4. `process.exit(0)`

### API routes (placeholders for 1E)

Register these on the Express app before starting:
- `POST /api/import` — placeholder that returns 501 for now
- `GET /api/games` — list games from gameStore
- `GET /api/health` — returns `{ status: 'ok', sessions: sessionManager.getSessionCount() }`

## STEP 6 — Ensure the server compiles and boots

Update `server/tsconfig.json` if needed to resolve `@gloomhaven-command/shared` imports correctly. The shared package should be referenced as a workspace dependency.

Verify the dependency chain:
```powershell
cd C:\Projects\gloomhaven-command
npm install
```

Build the shared package first (server imports from it):
```powershell
npm run build --workspace=packages/shared
```

Then verify the server compiles:
```powershell
npx tsc --noEmit --project server/tsconfig.json
```

Fix any import path or module resolution issues. Common problems:
- `@gloomhaven-command/shared` may need to resolve to `packages/shared/dist/` or `packages/shared/src/` depending on tsconfig paths
- `better-sqlite3` needs `@types/better-sqlite3` in devDependencies
- The `ws` library needs `@types/ws`
- `uuid` needs `@types/uuid`

If workspace resolution is problematic, use relative imports as a fallback: `import { ... } from '../../packages/shared/src/index.js'`.

Test that the server boots:
```powershell
npx tsx server/src/index.ts
```

It should print the startup message and listen on port 3000. Hit `GET http://localhost:3000/api/health` with curl or a browser to confirm.

```powershell
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok","sessions":0}`

Kill the server (Ctrl+C) after confirming.

## STEP 7 — Update ROADMAP.md

Mark these items as complete:
- [x] Build Express static server (staticServer.ts)
- [x] Build WebSocket hub (wsHub.ts) — connect, broadcast, heartbeat
- [x] Build session manager — tokens, revision tracking, replay buffer
- [x] Build game store — SQLite persistence, load/save

## STEP 8 — Add DESIGN_DECISIONS.md entry

Append:

```markdown
### 2025-03-25 — Synchronous SQLite via better-sqlite3
**Decision:** Use better-sqlite3 (synchronous API) instead of async sqlite3.
**Rationale:** Game state saves happen on every command (low frequency, ~1/sec max).
Synchronous writes are simpler, faster for single-writer scenarios, and avoid
callback/promise complexity. The server is single-threaded by design.

### 2025-03-25 — Heartbeat at 15s with 20s stale threshold
**Decision:** Server pings every 15s, marks clients stale after 20s without pong.
**Rationale:** Mobile devices (phones at the table) aggressively kill background
WebSocket connections. 15s keeps NAT mappings alive on most consumer routers.
20s threshold gives one missed cycle before disconnect — avoids false positives
from momentary network hiccups while still catching dead connections quickly.
```

## STEP 9 — Commit

```powershell
git add -A
git commit -m "feat(server): implement Express server, WebSocket hub, sessions, SQLite store

- gameStore: SQLite persistence with load/save/list/delete
- sessionManager: UUID tokens, diff replay buffer (100 entries), stale detection
- wsHub: WebSocket connection handling, heartbeat ping/pong, broadcast
- staticServer: serves client apps, shared styles, game assets
- index.ts: startup with LAN IP detection, graceful shutdown
- API: /api/health, /api/games, /api/import (placeholder)
- Server boots and responds on port 3000"
git push
```

Report: commit hash, tsc output, and whether `GET /api/health` returns successfully when the server boots.
