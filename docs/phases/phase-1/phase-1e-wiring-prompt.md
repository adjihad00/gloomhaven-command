# Phase 1E — Command Handler, Import Endpoint, Integration Test

> Paste into Claude Code. Final Phase 1 prompt. Wires the command engine into
> the server, adds the GHS import endpoint, and verifies the full system with
> an end-to-end integration test.

---

Read CLAUDE.md, then docs/PROJECT_CONTEXT.md.

Then read these files in full — you need exact signatures and patterns:
- `server/src/index.ts` (current startup, API route placeholders)
- `server/src/wsHub.ts` (the `onCommand` callback pattern)
- `server/src/gameStore.ts` (load/save methods)
- `server/src/sessionManager.ts` (pushDiff, updateRevision)
- `packages/shared/src/engine/applyCommand.ts`
- `packages/shared/src/engine/validateCommand.ts`
- `packages/shared/src/engine/diffStates.ts`
- `packages/shared/src/utils/ghsCompat.ts` (importGhsState, createEmptyGameState)
- `packages/shared/src/types/protocol.ts` (DiffMessage, CommandMessage, ErrorMessage)
- `packages/shared/src/types/commands.ts` (Command type)

## STEP 1 — Implement `server/src/commandHandler.ts`

This module wires `validateCommand` → `applyCommand` → persist → broadcast.

```typescript
import type { WebSocket } from 'ws';
import type { Command, GameState, DiffMessage, ErrorMessage } from '@gloomhaven-command/shared';
import { validateCommand, applyCommand } from '@gloomhaven-command/shared';
import { GameStore } from './gameStore.js';
import { SessionManager } from './sessionManager.js';
```

### Class: `CommandHandler`

Constructor takes `gameStore: GameStore`, `sessionManager: SessionManager`.

Expose a `broadcastFn` property that the index.ts sets after creating the WsHub:

```typescript
public broadcastFn: ((
  gameCode: string,
  message: DiffMessage,
  excludeSocket?: WebSocket
) => void) | null = null;
```

#### `handleCommand(ws: WebSocket, gameCode: string, command: Command): void`

The core pipeline. This is what gets wired to `wsHub.onCommand`.

1. **Load current state:**
   ```typescript
   const state = this.gameStore.load(gameCode);
   if (!state) { sendError(ws, 'Game not found'); return; }
   ```

2. **Validate:**
   ```typescript
   const validation = validateCommand(state, command);
   if (!validation.valid) {
     sendError(ws, validation.error ?? 'Invalid command');
     return;
   }
   ```

3. **Apply:**
   ```typescript
   const { state: newState, changes } = applyCommand(state, command);
   ```

4. **Persist:**
   ```typescript
   this.gameStore.save(gameCode, newState);
   ```

5. **Build diff message:**
   ```typescript
   const diff: DiffMessage = {
     type: 'diff',
     revision: newState.revision,
     changes,
     action: command.action
   };
   ```

6. **Buffer diff for reconnection:**
   ```typescript
   this.sessionManager.pushDiff(gameCode, diff);
   ```

7. **Broadcast to all clients in this game (including sender):**
   ```typescript
   if (this.broadcastFn) {
     this.broadcastFn(gameCode, diff);
   }
   ```

   Broadcast to ALL clients including the sender. The sender needs the diff too — they sent a command, not a state update. The server is authoritative; the client's local state is stale until it receives the diff back.

8. **Log:**
   ```typescript
   console.log(`[${gameCode}] ${command.action} → rev ${newState.revision} (${changes.length} changes)`);
   ```

#### `sendError(ws: WebSocket, message: string): void`

```typescript
const error: ErrorMessage = { type: 'error', message };
if (ws.readyState === WebSocket.OPEN) {
  ws.send(JSON.stringify(error));
}
```

## STEP 2 — Wire commandHandler into the server

Edit `server/src/index.ts`:

1. Import `CommandHandler`
2. After creating `wsHub`, `gameStore`, and `sessionManager`, instantiate `CommandHandler`
3. Set the broadcast function:
   ```typescript
   commandHandler.broadcastFn = (gameCode, diff, excludeSocket) => {
     wsHub.broadcast(gameCode, diff, excludeSocket);
   };
   ```
4. Wire the onCommand callback:
   ```typescript
   wsHub.onCommand = (ws, gameCode, command) => {
     commandHandler.handleCommand(ws, gameCode, command);
   };
   ```

## STEP 3 — Implement the GHS import endpoint

Replace the `/api/import` placeholder in `server/src/index.ts`:

```typescript
app.post('/api/import', (req, res) => {
  try {
    const { gameCode, ghsState } = req.body;

    if (!gameCode || typeof gameCode !== 'string') {
      return res.status(400).json({ error: 'gameCode is required' });
    }

    if (!ghsState || typeof ghsState !== 'object') {
      return res.status(400).json({ error: 'ghsState object is required' });
    }

    const state = importGhsState(ghsState);
    gameStore.save(gameCode, state);

    console.log(`[${gameCode}] Imported GHS state (rev ${state.revision})`);

    // Broadcast full state to any connected clients for this game
    // (they'll get a full state refresh on next connect anyway)

    res.json({
      success: true,
      gameCode,
      revision: state.revision,
      characters: state.characters.length,
      monsters: state.monsters.length,
      round: state.round
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Failed to import GHS state', details: String(err) });
  }
});
```

Import `importGhsState` from `@gloomhaven-command/shared`.

Also add an export endpoint for completeness:

```typescript
app.get('/api/export/:gameCode', (req, res) => {
  const { gameCode } = req.params;
  const state = gameStore.load(gameCode);
  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }
  const ghsState = exportGhsState(state);
  res.json(ghsState);
});
```

Import `exportGhsState` from `@gloomhaven-command/shared`.

## STEP 4 — Write the integration test

Create `server/src/_integration_test.mts` (temporary, deleted after verification).

This test boots the actual server, connects two WebSocket clients, sends commands, and verifies synchronization.

```typescript
import { WebSocket } from 'ws';

const PORT = 3099; // Use a different port to avoid conflict with running server
const BASE = `http://localhost:${PORT}`;
const WS_URL = `ws://localhost:${PORT}`;
const GAME_CODE = 'test-game-' + Date.now();

let serverProcess: any;

// Helper: wait for condition
function waitFor(conditionFn: () => boolean, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (conditionFn()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('Timeout'));
      setTimeout(check, 50);
    };
    check();
  });
}

// Helper: connect a WebSocket client and wait for connected message
function connectClient(gameCode: string): Promise<{ ws: WebSocket; state: any; token: string }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'connect',
        gameCode,
        sessionToken: null,
        lastRevision: null
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'connected') {
        clearTimeout(timeout);
        resolve({ ws, state: msg.state, token: msg.sessionToken });
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// Helper: collect next message of a given type
function waitForMessage(ws: WebSocket, type: string, timeoutMs = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeoutMs);
    const handler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === type) {
        clearTimeout(timeout);
        ws.removeListener('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

// Helper: send a command and wait for the diff back
function sendCommand(ws: WebSocket, command: any): Promise<any> {
  const diffPromise = waitForMessage(ws, 'diff');
  ws.send(JSON.stringify({ type: 'command', command }));
  return diffPromise;
}

async function runTests() {
  console.log('Starting integration tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.log(`  ✗ ${label}`);
      failed++;
    }
  }

  // ----------------------------------------------------------
  // Test 1: Health check endpoint
  // ----------------------------------------------------------
  console.log('Test 1: Health check');
  const healthResp = await fetch(`${BASE}/api/health`);
  const healthData = await healthResp.json();
  assert(healthData.status === 'ok', '/api/health returns ok');

  // ----------------------------------------------------------
  // Test 2: Connect two clients to same game
  // ----------------------------------------------------------
  console.log('\nTest 2: Two clients connect');
  const client1 = await connectClient(GAME_CODE);
  assert(client1.token.length > 0, 'Client 1 gets session token');
  assert(client1.state.revision !== undefined, 'Client 1 gets game state');
  assert(client1.state.state === 'draw', 'Initial phase is draw');

  const client2 = await connectClient(GAME_CODE);
  assert(client2.token !== client1.token, 'Client 2 gets different token');
  assert(client2.state.revision === client1.state.revision, 'Both see same revision');

  // ----------------------------------------------------------
  // Test 3: Add a character from client 1, client 2 receives diff
  // ----------------------------------------------------------
  console.log('\nTest 3: Add character (client 1 → broadcast)');
  const diffPromise2 = waitForMessage(client2.ws, 'diff');
  const diff1 = await sendCommand(client1.ws, {
    action: 'addCharacter',
    payload: { name: 'brute', edition: 'gh', level: 1 }
  });
  assert(diff1.action === 'addCharacter', 'Client 1 receives diff back');
  assert(diff1.revision > client1.state.revision, 'Revision incremented');

  const diff2 = await diffPromise2;
  assert(diff2.action === 'addCharacter', 'Client 2 receives same diff');
  assert(diff2.revision === diff1.revision, 'Same revision number');

  // ----------------------------------------------------------
  // Test 4: Change health from client 2
  // ----------------------------------------------------------
  console.log('\nTest 4: Change health (client 2 → broadcast)');
  const diffPromise1b = waitForMessage(client1.ws, 'diff');
  const healthDiff = await sendCommand(client2.ws, {
    action: 'changeHealth',
    payload: { target: { type: 'character', name: 'brute' }, delta: -3 }
  });
  assert(healthDiff.changes.length > 0, 'Health diff has changes');

  const healthDiff1 = await diffPromise1b;
  assert(healthDiff1.revision === healthDiff.revision, 'Client 1 gets same revision');

  // ----------------------------------------------------------
  // Test 5: Validate rejection
  // ----------------------------------------------------------
  console.log('\nTest 5: Invalid command rejection');
  const errorPromise = waitForMessage(client1.ws, 'error');
  client1.ws.send(JSON.stringify({
    type: 'command',
    command: {
      action: 'changeHealth',
      payload: { target: { type: 'character', name: 'nonexistent' }, delta: -1 }
    }
  }));
  const errorMsg = await errorPromise;
  assert(errorMsg.type === 'error', 'Server rejects invalid command');
  assert(errorMsg.message.length > 0, 'Error has message');

  // ----------------------------------------------------------
  // Test 6: Reconnect with diff replay
  // ----------------------------------------------------------
  console.log('\nTest 6: Reconnect with diff replay');
  const savedToken = client1.token;
  const savedRevision = diff1.revision; // client1 knows up to this revision
  client1.ws.close();

  // Wait for close to propagate
  await new Promise(r => setTimeout(r, 500));

  // Send another command from client2 while client1 is disconnected
  await sendCommand(client2.ws, {
    action: 'setInitiative',
    payload: { characterName: 'brute', value: 25 }
  });

  // Reconnect client1 with saved token
  const reconnectWs = new WebSocket(WS_URL);
  const reconnectResult = await new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Reconnect timeout')), 5000);
    reconnectWs.on('open', () => {
      reconnectWs.send(JSON.stringify({
        type: 'connect',
        gameCode: GAME_CODE,
        sessionToken: savedToken,
        lastRevision: savedRevision
      }));
    });
    reconnectWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'reconnected' || msg.type === 'connected') {
        clearTimeout(timeout);
        resolve(msg);
      }
    });
    reconnectWs.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });

  if (reconnectResult.type === 'reconnected') {
    assert(true, 'Server sends reconnected with missed diffs');
    assert(reconnectResult.diffs.length > 0, `Replayed ${reconnectResult.diffs.length} missed diff(s)`);
  } else {
    // Full state is also acceptable if diff buffer was cleared
    assert(reconnectResult.type === 'connected', 'Server sends full state on reconnect (diff buffer cleared)');
  }

  // ----------------------------------------------------------
  // Test 7: Import GHS state via API
  // ----------------------------------------------------------
  console.log('\nTest 7: GHS import endpoint');
  const importResp = await fetch(`${BASE}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameCode: 'import-test',
      ghsState: {
        revision: 0,
        state: 'draw',
        round: 5,
        level: 3,
        figures: [],
        characters: [],
        monsters: [],
        elementBoard: [
          { type: 'fire', state: 'inert' },
          { type: 'ice', state: 'strong' },
          { type: 'air', state: 'inert' },
          { type: 'earth', state: 'inert' },
          { type: 'light', state: 'inert' },
          { type: 'dark', state: 'inert' }
        ]
      }
    })
  });
  const importData = await importResp.json();
  assert(importData.success === true, 'Import returns success');
  assert(importData.round === 5, 'Imported state has correct round');

  // Verify the imported game is loadable
  const exportResp = await fetch(`${BASE}/api/export/import-test`);
  const exportData = await exportResp.json();
  assert(exportData.round === 5, 'Exported state matches import');

  // ----------------------------------------------------------
  // Test 8: Persistence across connections
  // ----------------------------------------------------------
  console.log('\nTest 8: Persistence');
  // Close all clients
  client2.ws.close();
  reconnectWs.close();
  await new Promise(r => setTimeout(r, 300));

  // Reconnect to the same game — state should be persisted
  const client3 = await connectClient(GAME_CODE);
  const bruteChar = client3.state.characters?.find((c: any) => c.name === 'brute');
  assert(bruteChar !== undefined, 'Character persisted across reconnection');
  assert(bruteChar?.initiative === 25, 'Initiative value persisted');
  client3.ws.close();

  // ----------------------------------------------------------
  // Results
  // ----------------------------------------------------------
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}\n`);

  return failed === 0;
}

// ----------------------------------------------------------
// Boot server and run tests
// ----------------------------------------------------------
async function main() {
  // Set PORT env for the server
  process.env.PORT = String(PORT);

  // Dynamically import the server to boot it
  // The server's index.ts should start listening when imported
  console.log(`Booting server on port ${PORT}...`);

  // Import the server module — this triggers the listen call
  await import('./index.js');

  // Give it a moment to bind
  await new Promise(r => setTimeout(r, 1000));

  try {
    const success = await runTests();
    process.exit(success ? 0 : 1);
  } catch (err) {
    console.error('Test runner error:', err);
    process.exit(1);
  }
}

main();
```

**Important:** The integration test imports the server's `index.ts` directly to boot it in-process. If `index.ts` calls `listen()` at module scope, this works. If it uses a `main()` function or conditional startup, adjust accordingly — read `index.ts` to understand the boot pattern and adapt.

If in-process import is problematic (e.g. `index.ts` doesn't export anything and just runs), use `child_process.spawn` instead:

```typescript
import { spawn } from 'child_process';

const serverProcess = spawn('npx', ['tsx', 'server/src/index.ts'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'pipe'
});

// Wait for "running on port" log line
await new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Server boot timeout')), 10000);
  serverProcess.stdout?.on('data', (data) => {
    const line = data.toString();
    process.stdout.write(`  [server] ${line}`);
    if (line.includes('running on port') || line.includes(String(PORT))) {
      clearTimeout(timeout);
      resolve();
    }
  });
  serverProcess.stderr?.on('data', (data) => {
    process.stderr.write(`  [server-err] ${data}`);
  });
});
```

And kill it at the end: `serverProcess.kill('SIGTERM');`

Choose whichever approach works with the actual `index.ts` structure. The test must:
1. Boot the server
2. Run all 8 test groups
3. Print pass/fail counts
4. Exit 0 on all pass, 1 on any failure

Run the test:
```powershell
npx tsx server/src/_integration_test.mts
```

## STEP 5 — Verification

1. `npx tsc --noEmit` from both `packages/shared/` and `server/` — zero errors
2. Integration test: all 8 test groups pass (health check, two-client connect, add character broadcast, change health broadcast, validation rejection, reconnect with diff replay, GHS import, persistence)
3. Server boots clean with no warnings

## STEP 6 — Update ROADMAP.md

Mark these items as complete:
- [x] Build command handler — validate → apply → persist → broadcast
- [x] Integration test: connect two clients, send commands, verify sync
- [x] GHS JSON import endpoint — POST /api/import

All Phase 1 items should now be [x].

## STEP 7 — Update PROJECT_CONTEXT.md

Change:
```
## Current Phase
Phase 1 — Server + Shared Library (see ROADMAP.md)
```
To:
```
## Current Phase
Phase 1 COMPLETE. Phase 2 — Controller Client (see ROADMAP.md)
```

## STEP 8 — Commit

```powershell
git add -A
git commit -m "feat(server): wire command handler, GHS import/export endpoints, integration test

- commandHandler: validate → apply → persist → broadcast pipeline
- POST /api/import: accepts GHS JSON, converts via importGhsState, saves
- GET /api/export/:gameCode: exports game state as GHS-compatible JSON
- Integration test: 8 test groups covering connect, broadcast, reconnect,
  validation rejection, import/export, and persistence
- All Phase 1 roadmap items complete"
git push
```

## STEP 9 — Cleanup

Delete the integration test file (it's a one-time verification, not a persistent test suite):

Actually — keep it. Rename it to `server/src/__tests__/integration.test.mts` (or similar) so we can re-run it after future changes. Create the `__tests__` directory if needed.

```powershell
mkdir -p server/src/__tests__
Move-Item server/src/_integration_test.mts server/src/__tests__/integration.test.mts
git add -A
git commit -m "test: move integration test to server/__tests__"
git push
```

Report: commit hash(es), tsc output, integration test results (pass/fail counts), and the full server startup log.
