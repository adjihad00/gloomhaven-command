# Phase 2A — Shared Client Infrastructure

> Paste into Claude Code. Implements the WebSocket client library, reactive
> state store, and typed command sender that all three client apps depend on.
> No UI in this prompt — just the plumbing.

---

Read CLAUDE.md, then docs/PROJECT_CONTEXT.md, then docs/COMMAND_PROTOCOL.md.

Then read these files in full:
- `packages/shared/src/types/protocol.ts` (message types, ClientMessage, ServerMessage, StateChange)
- `packages/shared/src/types/commands.ts` (Command union, CommandTarget)
- `packages/shared/src/types/gameState.ts` (GameState)
- `packages/shared/src/engine/diffStates.ts` (applyDiff)
- `packages/shared/src/engine/turnOrder.ts` (getInitiativeOrder, OrderedFigure)
- `server/src/wsHub.ts` (understand the server-side message handling — connect, reconnect, command, register)
- `clients/shared/styles/theme.css` (existing CSS vars)

Also read the current stub files in `clients/shared/lib/` to understand what exists.

## Context

All three clients (controller, phone, display) need the same connection logic:
1. Connect to the server via WebSocket (same-origin, so just `ws://` + `location.host`)
2. Send `ConnectMessage` with game code and optional session token
3. Receive full state or reconnection diffs
4. Send commands, receive diffs, keep local state in sync
5. Auto-reconnect on disconnect with exponential backoff
6. Expose a reactive interface so UI code can subscribe to state changes

These clients run in the browser. They use the browser's native `WebSocket` API (not the `ws` npm library). They import from `@gloomhaven-command/shared` which gets bundled by esbuild.

The key design goal: UI code should never touch WebSocket directly. It calls `sendCommand(...)` and subscribes to state changes. The connection layer handles everything.

## STEP 1 — Implement `clients/shared/lib/connection.ts`

Replace the stub. This is the browser WebSocket client.

### Class: `Connection`

```typescript
import type {
  ClientMessage, ServerMessage, ConnectMessage,
  GameState, DiffMessage, Command
} from '@gloomhaven-command/shared';
import { applyDiff } from '@gloomhaven-command/shared';
```

#### Constructor

```typescript
constructor(options: ConnectionOptions)
```

```typescript
export interface ConnectionOptions {
  gameCode: string;
  onStateUpdate: (state: GameState) => void;
  onConnectionChange: (status: ConnectionStatus) => void;
  onError: (message: string) => void;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
```

The `onStateUpdate` callback fires every time the game state changes — on initial connect, on reconnection, and on every diff received. UI code subscribes here.

#### Internal State

```typescript
private ws: WebSocket | null = null;
private state: GameState | null = null;
private sessionToken: string | null = null;
private lastRevision: number = 0;
private gameCode: string;
private status: ConnectionStatus = 'disconnected';
private reconnectAttempts: number = 0;
private maxReconnectAttempts: number = 20;
private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
private manualDisconnect: boolean = false;
private options: ConnectionOptions;
```

Persist `sessionToken` and `gameCode` to `localStorage` so reconnection survives page refreshes:
- Key: `gc_sessionToken` → session token
- Key: `gc_gameCode` → game code
- Key: `gc_lastRevision` → last known revision

Load these in the constructor if they match the provided `gameCode`.

#### `connect(): void`

1. Set status to `'connecting'`, fire `onConnectionChange`
2. Determine WebSocket URL: `const wsUrl = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/';`
3. Create `new WebSocket(wsUrl)`
4. Set up event handlers:

**`onopen`:**
```typescript
this.ws.onopen = () => {
  const msg: ConnectMessage = {
    type: 'connect',
    gameCode: this.gameCode,
    sessionToken: this.sessionToken,
    lastRevision: this.sessionToken ? this.lastRevision : null
  };
  this.ws!.send(JSON.stringify(msg));
};
```

**`onmessage`:**
Parse JSON. Switch on `type`:
- `'connected'`: Store `sessionToken`, set `state` from message, set `lastRevision` from `revision`. Save to localStorage. Set status `'connected'`. Reset `reconnectAttempts` to 0. Fire `onStateUpdate(state)` and `onConnectionChange('connected')`.
- `'reconnected'`: Store `sessionToken`. Apply each diff in `diffs` array to current state using `applyDiff()`. Update `lastRevision` to the final diff's revision. Save to localStorage. Set status `'connected'`. Fire `onStateUpdate(state)`.
- `'diff'`: Apply via `applyDiff()` to current state. Update `lastRevision`. Save revision to localStorage. Fire `onStateUpdate(state)`.
- `'error'`: Fire `onError(message)`.

**`onclose`:**
If not `manualDisconnect`, set status to `'reconnecting'`, fire callback, call `scheduleReconnect()`.

**`onerror`:**
Log to console. The `onclose` handler will fire after this — don't double-handle.

#### `disconnect(): void`

Set `manualDisconnect = true`. Close WebSocket. Clear reconnect timeout. Set status `'disconnected'`. Fire callback.

#### `sendCommand(command: Command): void`

```typescript
if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
  this.options.onError('Not connected');
  return;
}
const msg: ClientMessage = {
  type: 'command',
  ...command  // spread action + payload
};
this.ws.send(JSON.stringify(msg));
```

Wait — check the actual `CommandMessage` type in protocol.ts. If it's `{ type: 'command', command: Command }` then wrap accordingly. If 1E adjusted it to `{ type: 'command', action, payload }` (which it did per the Phase 1E adjustments), then spread the command directly. Read the actual type and match it.

#### `register(role: string, characterName?: string): void`

Send a `RegisterMessage` after connecting:
```typescript
this.ws?.send(JSON.stringify({
  type: 'register',
  role,
  characterName
}));
```

#### `getState(): GameState | null`

Return the current state.

#### `getStatus(): ConnectionStatus`

Return the current connection status.

#### `getRevision(): number`

Return `lastRevision`.

#### `scheduleReconnect(): void` (private)

Exponential backoff: `delay = min(1000 * 2^attempts, 15000)`. After `maxReconnectAttempts`, stop and fire `onError('Connection lost after max retries')`.

```typescript
if (this.reconnectAttempts >= this.maxReconnectAttempts) {
  this.setStatus('disconnected');
  this.options.onError('Connection lost. Please reconnect manually.');
  return;
}
this.reconnectAttempts++;
const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 15000);
this.reconnectTimeout = setTimeout(() => this.connect(), delay);
```

#### Visibility change handler

Register in constructor:
```typescript
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && this.status !== 'connected' && !this.manualDisconnect) {
    this.reconnectAttempts = 0;
    this.connect();
  }
});
```

This handles mobile backgrounding — when the user returns to the tab, immediately reconnect instead of waiting for the backoff timer.

## STEP 2 — Implement `clients/shared/lib/stateStore.ts`

Replace the stub. A lightweight reactive state wrapper that provides fine-grained subscriptions.

```typescript
import type { GameState } from '@gloomhaven-command/shared';
import { getInitiativeOrder, type OrderedFigure } from '@gloomhaven-command/shared';
```

### Class: `StateStore`

#### Internal State

```typescript
private state: GameState | null = null;
private listeners: Map<string, Set<(value: any) => void>> = new Map();
private globalListeners: Set<(state: GameState) => void> = new Set();
```

#### `setState(newState: GameState): void`

Replace the internal state. Notify all global listeners. Then, for each registered path listener, check if the value at that path changed and notify if so.

#### `getState(): GameState | null`

Return current state.

#### `subscribe(callback: (state: GameState) => void): () => void`

Add a global listener that fires on every state update. Return an unsubscribe function.

```typescript
this.globalListeners.add(callback);
return () => this.globalListeners.delete(callback);
```

#### `select<T>(selector: (state: GameState) => T): T | undefined`

Run a selector function against current state. Returns undefined if state is null.

#### Derived getters (convenience methods for UI code)

```typescript
get characters() { return this.state?.characters ?? []; }
get monsters() { return this.state?.monsters ?? []; }
get elementBoard() { return this.state?.elementBoard ?? []; }
get round() { return this.state?.round ?? 0; }
get phase() { return this.state?.state ?? 'draw'; }
get revision() { return this.state?.revision ?? 0; }
get figures() { return this.state?.figures ?? []; }
get lootDeck() { return this.state?.lootDeck ?? null; }
get scenario() { return this.state?.scenario ?? null; }

getInitiativeOrder(): OrderedFigure[] {
  if (!this.state) return [];
  return getInitiativeOrder(this.state);
}

getCharacter(name: string) {
  return this.state?.characters.find(c => c.name === name) ?? null;
}

getMonster(name: string) {
  return this.state?.monsters.find(m => m.name === name) ?? null;
}
```

## STEP 3 — Implement `clients/shared/lib/commandSender.ts`

Replace the stub. A typed convenience layer over `Connection.sendCommand()` that provides one method per command action. UI code calls these instead of building command objects manually.

```typescript
import type { Connection } from './connection.js';
import type {
  Command, CommandTarget, ConditionName,
  ElementType, ElementState, MonsterEntityType, SummonColor
} from '@gloomhaven-command/shared';
```

### Class: `CommandSender`

Constructor takes a `Connection` instance.

Methods — one per command action. Each builds the typed `Command` object and calls `connection.sendCommand()`:

```typescript
changeHealth(target: CommandTarget, delta: number): void {
  this.send({ action: 'changeHealth', payload: { target, delta } });
}

toggleCondition(target: CommandTarget, condition: ConditionName): void {
  this.send({ action: 'toggleCondition', payload: { target, condition } });
}

setInitiative(characterName: string, edition: string, value: number): void {
  this.send({ action: 'setInitiative', payload: { characterName, edition, value } });
}

advancePhase(): void {
  this.send({ action: 'advancePhase', payload: {} });
}

toggleTurn(figureId: string, summonIndex?: number): void {
  this.send({ action: 'toggleTurn', payload: { figureId, summonIndex } });
}

addEntity(monsterName: string, edition: string, number: number, type: MonsterEntityType, health?: number, maxHealth?: number): void {
  this.send({ action: 'addEntity', payload: { monsterName, edition, number, type, health, maxHealth } });
}

removeEntity(monsterName: string, edition: string, entityNumber: number): void {
  this.send({ action: 'removeEntity', payload: { monsterName, edition, entityNumber } });
}

moveElement(element: ElementType, newState: ElementState): void {
  this.send({ action: 'moveElement', payload: { element, newState } });
}

drawLootCard(): void {
  this.send({ action: 'drawLootCard', payload: {} });
}

assignLoot(cardIndex: number, characterName: string): void {
  this.send({ action: 'assignLoot', payload: { cardIndex, characterName } });
}

drawMonsterAbility(monsterName: string, edition: string): void {
  this.send({ action: 'drawMonsterAbility', payload: { monsterName, edition } });
}

shuffleModifierDeck(deck: string): void {
  this.send({ action: 'shuffleModifierDeck', payload: { deck } });
}

revealRoom(roomId: number): void {
  this.send({ action: 'revealRoom', payload: { roomId } });
}

undoAction(): void {
  this.send({ action: 'undoAction', payload: {} });
}

setScenario(scenarioIndex: string, edition: string, level?: number): void {
  this.send({ action: 'setScenario', payload: { scenarioIndex, edition, level } });
}

addCharacter(name: string, edition: string, level: number): void {
  this.send({ action: 'addCharacter', payload: { name, edition, level } });
}

removeCharacter(name: string, edition: string): void {
  this.send({ action: 'removeCharacter', payload: { name, edition } });
}

changeStat(characterName: string, edition: string, stat: 'experience' | 'gold' | 'loot', delta: number): void {
  this.send({ action: 'changeStat', payload: { characterName, edition, stat, delta } });
}

toggleLongRest(characterName: string, edition: string): void {
  this.send({ action: 'toggleLongRest', payload: { characterName, edition } });
}

toggleCharacterAbsent(characterName: string, edition: string): void {
  this.send({ action: 'toggleCharacterAbsent', payload: { characterName, edition } });
}

toggleCharacterExhausted(characterName: string, edition: string): void {
  this.send({ action: 'toggleCharacterExhausted', payload: { characterName, edition } });
}

setScenarioLevel(level: number): void {
  this.send({ action: 'setScenarioLevel', payload: { level } });
}

drawModifierCard(deck: string): void {
  this.send({ action: 'drawModifierCard', payload: { deck } });
}

addModifierCard(deck: string, cardType: 'bless' | 'curse'): void {
  this.send({ action: 'addModifierCard', payload: { deck, cardType } });
}

removeModifierCard(deck: string, cardType: 'bless' | 'curse'): void {
  this.send({ action: 'removeModifierCard', payload: { deck, cardType } });
}
```

**IMPORTANT**: Read the actual `Command` union type in `commands.ts` to verify every payload shape. The method signatures above are approximations. If a command payload requires `edition` on the target, include it. If `CommandTarget` requires `edition`, include it in every method that takes a target. Match exactly.

Private helper:
```typescript
private send(command: Command): void {
  this.connection.sendCommand(command);
}
```

## STEP 4 — Create barrel export

Create `clients/shared/lib/index.ts`:

```typescript
export { Connection, type ConnectionOptions, type ConnectionStatus } from './connection.js';
export { StateStore } from './stateStore.js';
export { CommandSender } from './commandSender.js';
```

## STEP 5 — Fix COMMAND_PROTOCOL.md drift

Update `docs/COMMAND_PROTOCOL.md`:
1. Line 86: change "stale after 5s" to "stale after 20s" (matches actual implementation)
2. Update the Command Actions table to include all 33 commands from `commands.ts`, not just the original 17

## STEP 6 — Verification

Since these are browser-side modules, `tsc --noEmit` won't work directly (they import from `@gloomhaven-command/shared` which is a workspace package). Verify by:

1. Ensure the shared package is built: `npm run build --workspace=packages/shared`
2. Attempt to compile the client shared lib in isolation. Create a temporary `clients/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./lib",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "paths": {
      "@gloomhaven-command/shared": ["../../packages/shared/src/index.ts"]
    }
  },
  "include": ["lib/**/*.ts"]
}
```
3. Run `npx tsc --noEmit --project clients/shared/tsconfig.json`
4. Fix any type errors

Alternatively, if path resolution is problematic, use esbuild to verify the bundle compiles:
```powershell
npx esbuild clients/shared/lib/index.ts --bundle --outfile=_test_bundle.js --format=esm --external:@gloomhaven-command/shared --platform=browser
```
Delete `_test_bundle.js` after.

Verify:
- `Connection` handles all `ServerMessage` types in the onmessage switch
- `CommandSender` has a method for every action in the `Command` union
- `StateStore` derived getters match GameState field names
- No `any` types anywhere
- localStorage keys are prefixed with `gc_` to avoid collisions

## STEP 7 — Update ROADMAP.md

Mark complete:
- [x] Implement shared WebSocket client (clients/shared/lib/connection.ts)
- [x] Implement client-side state store with diff application

## STEP 8 — Commit

```powershell
git add -A
git commit -m "feat(clients): implement shared client infrastructure

- Connection: WebSocket client with connect/reconnect/visibility handling
- StateStore: reactive state wrapper with derived getters
- CommandSender: typed convenience methods for all 33 command actions
- localStorage persistence for session token and revision
- Barrel export from clients/shared/lib/
- Fixed COMMAND_PROTOCOL.md stale timeout and command table drift"
git push
```

Report: commit hash, compilation result, and the number of command methods on CommandSender.
