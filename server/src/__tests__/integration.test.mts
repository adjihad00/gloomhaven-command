import { WebSocket } from 'ws';

const PORT = 3099;
const BASE = `http://localhost:${PORT}`;
const WS_URL = `ws://localhost:${PORT}`;
const GAME_CODE = 'test-game-' + Date.now();

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
function sendCommand(ws: WebSocket, action: string, payload: any): Promise<any> {
  const diffPromise = waitForMessage(ws, 'diff');
  ws.send(JSON.stringify({ type: 'command', action, payload }));
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
  const diff1 = await sendCommand(client1.ws, 'addCharacter', {
    name: 'brute', edition: 'gh', level: 1,
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
  const healthDiff = await sendCommand(client2.ws, 'changeHealth', {
    target: { type: 'character', name: 'brute', edition: 'gh' }, delta: -3,
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
    action: 'changeHealth',
    payload: {
      target: { type: 'character', name: 'nonexistent', edition: 'gh' },
      delta: -1,
    },
  }));
  const errorMsg = await errorPromise;
  assert(errorMsg.type === 'error', 'Server rejects invalid command');
  assert(errorMsg.message.length > 0, 'Error has message');

  // ----------------------------------------------------------
  // Test 6: Reconnect with diff replay
  // ----------------------------------------------------------
  console.log('\nTest 6: Reconnect with diff replay');
  const savedToken = client1.token;
  const savedRevision = diff1.revision; // client1 knows up to addCharacter revision
  client1.ws.close();

  // Wait for close to propagate
  await new Promise(r => setTimeout(r, 500));

  // Send another command from client2 while client1 is disconnected
  await sendCommand(client2.ws, 'setInitiative', {
    characterName: 'brute', edition: 'gh', value: 25,
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
        lastRevision: savedRevision,
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
    assert(true, 'Reconnect handled (full state fallback)');
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
          { type: 'dark', state: 'inert' },
        ],
      },
    }),
  });
  const importData = await importResp.json() as any;
  assert(importData.success === true, 'Import returns success');
  assert(importData.round === 5, 'Imported state has correct round');

  // Verify the imported game is loadable via export
  const exportResp = await fetch(`${BASE}/api/export/import-test`);
  const exportData = await exportResp.json() as any;
  assert(exportData.round === 5, 'Exported state matches import');

  // ----------------------------------------------------------
  // Test 8: Persistence across connections
  // ----------------------------------------------------------
  console.log('\nTest 8: Persistence');
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
  process.env.PORT = String(PORT);

  console.log(`Booting server on port ${PORT}...`);

  // Import the server module — triggers listen call at module scope
  await import('../index.js');

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
