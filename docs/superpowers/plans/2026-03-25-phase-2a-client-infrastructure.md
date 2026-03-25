# Phase 2A: Shared Client Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the WebSocket client library, reactive state store, and typed command sender that all three browser clients depend on.

**Architecture:** Three classes — `Connection` (WebSocket lifecycle + reconnect), `StateStore` (reactive state wrapper with derived getters), `CommandSender` (typed method per command action). Browser-only, imports from `@gloomhaven-command/shared`. No UI code.

**Tech Stack:** TypeScript, browser WebSocket API, `@gloomhaven-command/shared` types/engine

---

## File Structure

| File | Responsibility |
|------|---------------|
| `clients/shared/lib/connection.ts` | Replace stub. WebSocket client: connect, reconnect, send commands, localStorage persistence |
| `clients/shared/lib/stateStore.ts` | Replace stub. Reactive state wrapper with subscriptions and derived getters |
| `clients/shared/lib/commandSender.ts` | Replace stub. Typed convenience methods for all 31 command actions |
| `clients/shared/lib/index.ts` | Create. Barrel export for all three modules |
| `clients/shared/tsconfig.json` | Create. TypeScript config for client shared lib |
| `docs/COMMAND_PROTOCOL.md` | Update. Fix stale timeout (5s→20s), update command table to match all 31 commands |
| `docs/ROADMAP.md` | Update. Mark two items complete |

## Key Type References

These are the actual types from the codebase that the implementation must match exactly:

- **`ConnectMessage`**: `{ type: 'connect'; gameCode: string; sessionToken: string | null; lastRevision?: number }`
- **`RegisterMessage`**: `{ type: 'register'; role: ClientRole; characterName?: string }` where `ClientRole = 'display' | 'controller' | 'phone'`
- **`CommandMessage`**: `{ type: 'command'; action: CommandAction; payload: Command['payload'] }` — spread of `Command` works since Command has `{ action, payload }`
- **Server responses**: `'connected'` (full state), `'reconnected'` (diffs array), `'diff'` (single diff), `'error'` (message string), `'ping'`
- **`DiffMessage`**: `{ type: 'diff'; revision: number; changes: StateChange[]; action: CommandAction }`
- **`ReconnectedMessage`**: `{ type: 'reconnected'; sessionToken: string; revision: number; diffs: DiffMessage[] }`
- **`applyDiff(state: GameState, changes: StateChange[]): GameState`** — returns new state, does not mutate
- **`getInitiativeOrder(state: GameState): OrderedFigure[]`**
- **`CommandTarget`**: union of `{ type: 'character'|'monster'|'summon'|'objective', ... }` — monster requires `entityNumber`, summon requires `summonUuid`
- **`FigureIdentifier`**: `{ type: 'character'|'monster'|'objectiveContainer'; name: string; edition: string }`
- **31 CommandAction types** (not 33 as the original prompt claimed)

---

### Task 1: Connection class

**Files:**
- Replace: `clients/shared/lib/connection.ts`

- [ ] **Step 1: Write the Connection class**

Replace the stub entirely with the full implementation:

```typescript
// WebSocket client — connect, reconnect, send commands, localStorage persistence
import type {
  ServerMessage, ConnectMessage, CommandMessage,
  ConnectedMessage, ReconnectedMessage, DiffMessage, ErrorMessage,
  GameState, Command, ClientRole,
} from '@gloomhaven-command/shared';
import { applyDiff } from '@gloomhaven-command/shared';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ConnectionOptions {
  gameCode: string;
  onStateUpdate: (state: GameState) => void;
  onConnectionChange: (status: ConnectionStatus) => void;
  onError: (message: string) => void;
}

export class Connection {
  private ws: WebSocket | null = null;
  private state: GameState | null = null;
  private sessionToken: string | null = null;
  private lastRevision: number = 0;
  private gameCode: string;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 20;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect: boolean = false;
  private options: ConnectionOptions;

  constructor(options: ConnectionOptions) {
    this.options = options;
    this.gameCode = options.gameCode;

    // Restore session from localStorage if it matches the game code
    const storedCode = localStorage.getItem('gc_gameCode');
    if (storedCode === this.gameCode) {
      this.sessionToken = localStorage.getItem('gc_sessionToken');
      const storedRevision = localStorage.getItem('gc_lastRevision');
      if (storedRevision) {
        this.lastRevision = parseInt(storedRevision, 10) || 0;
      }
    }

    // Reconnect when returning from background
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.status !== 'connected' && !this.manualDisconnect) {
        this.reconnectAttempts = 0;
        this.connect();
      }
    });
  }

  connect(): void {
    // Clean up any existing connection
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
    }

    this.manualDisconnect = false;
    this.setStatus('connecting');

    const wsUrl = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      const msg: ConnectMessage = {
        type: 'connect',
        gameCode: this.gameCode,
        sessionToken: this.sessionToken,
        ...(this.sessionToken && this.lastRevision > 0 ? { lastRevision: this.lastRevision } : {}),
      };
      this.ws!.send(JSON.stringify(msg));
    };

    this.ws.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data as string) as ServerMessage;

      switch (message.type) {
        case 'connected': {
          const msg = message as ConnectedMessage;
          this.sessionToken = msg.sessionToken;
          this.state = msg.state;
          this.lastRevision = msg.revision;
          this.persistToStorage();
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          this.options.onStateUpdate(this.state);
          break;
        }
        case 'reconnected': {
          const msg = message as ReconnectedMessage;
          this.sessionToken = msg.sessionToken;
          if (this.state) {
            for (const diff of msg.diffs) {
              this.state = applyDiff(this.state, diff.changes);
            }
          }
          this.lastRevision = msg.revision;
          this.persistToStorage();
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          if (this.state) {
            this.options.onStateUpdate(this.state);
          }
          break;
        }
        case 'diff': {
          const msg = message as DiffMessage;
          if (this.state) {
            this.state = applyDiff(this.state, msg.changes);
            this.lastRevision = msg.revision;
            localStorage.setItem('gc_lastRevision', String(this.lastRevision));
            this.options.onStateUpdate(this.state);
          }
          break;
        }
        case 'error': {
          const msg = message as ErrorMessage;
          this.options.onError(msg.message);
          break;
        }
        case 'ping': {
          // Respond with pong
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'pong' }));
          }
          break;
        }
      }
    };

    this.ws.onclose = () => {
      if (!this.manualDisconnect) {
        this.setStatus('reconnecting');
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose fires after onerror — don't double-handle
      console.error('WebSocket error');
    };
  }

  disconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  sendCommand(command: Command): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.options.onError('Not connected');
      return;
    }
    const msg: CommandMessage = {
      type: 'command',
      action: command.action,
      payload: command.payload,
    };
    this.ws.send(JSON.stringify(msg));
  }

  register(role: ClientRole, characterName?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.options.onError('Not connected');
      return;
    }
    this.ws.send(JSON.stringify({
      type: 'register',
      role,
      ...(characterName ? { characterName } : {}),
    }));
  }

  getState(): GameState | null {
    return this.state;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getRevision(): number {
    return this.lastRevision;
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.options.onConnectionChange(status);
  }

  private persistToStorage(): void {
    localStorage.setItem('gc_gameCode', this.gameCode);
    localStorage.setItem('gc_sessionToken', this.sessionToken ?? '');
    localStorage.setItem('gc_lastRevision', String(this.lastRevision));
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('disconnected');
      this.options.onError('Connection lost. Please reconnect manually.');
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 15000);
    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `npx tsc --noEmit --project clients/shared/tsconfig.json` (after tsconfig is created in Task 4)

---

### Task 2: StateStore class

**Files:**
- Replace: `clients/shared/lib/stateStore.ts`

- [ ] **Step 1: Write the StateStore class**

Replace the stub entirely:

```typescript
// Reactive state wrapper with subscriptions and derived getters
import type { GameState, GamePhase, Character, Monster, ElementModel, LootDeck, ScenarioModel } from '@gloomhaven-command/shared';
import { getInitiativeOrder, type OrderedFigure } from '@gloomhaven-command/shared';

export class StateStore {
  private state: GameState | null = null;
  private globalListeners: Set<(state: GameState) => void> = new Set();

  setState(newState: GameState): void {
    this.state = newState;
    for (const listener of this.globalListeners) {
      listener(newState);
    }
  }

  getState(): GameState | null {
    return this.state;
  }

  subscribe(callback: (state: GameState) => void): () => void {
    this.globalListeners.add(callback);
    return () => { this.globalListeners.delete(callback); };
  }

  select<T>(selector: (state: GameState) => T): T | undefined {
    if (!this.state) return undefined;
    return selector(this.state);
  }

  // Derived getters for UI convenience
  get characters(): Character[] { return this.state?.characters ?? []; }
  get monsters(): Monster[] { return this.state?.monsters ?? []; }
  get elementBoard(): ElementModel[] { return this.state?.elementBoard ?? []; }
  get round(): number { return this.state?.round ?? 0; }
  get phase(): GamePhase { return this.state?.state ?? 'draw'; }
  get level(): number { return this.state?.level ?? 0; }
  get figures(): string[] { return this.state?.figures ?? []; }
  get lootDeck(): LootDeck | null { return this.state ? this.state.lootDeck : null; }
  get scenario(): ScenarioModel | undefined { return this.state?.scenario; }

  getInitiativeOrder(): OrderedFigure[] {
    if (!this.state) return [];
    return getInitiativeOrder(this.state);
  }

  getCharacter(name: string): Character | null {
    return this.state?.characters.find(c => c.name === name) ?? null;
  }

  getMonster(name: string): Monster | null {
    return this.state?.monsters.find(m => m.name === name) ?? null;
  }
}
```

---

### Task 3: CommandSender class

**Files:**
- Replace: `clients/shared/lib/commandSender.ts`

- [ ] **Step 1: Write the CommandSender class**

Replace the stub. One method per each of the 31 actual `CommandAction` types from `commands.ts`. Every payload shape matches the actual interface exactly.

```typescript
// Typed convenience methods for all 31 command actions
import type { Connection } from './connection.js';
import type {
  Command, CommandTarget, ConditionName,
  ElementType, ElementState, MonsterType, SummonColor,
  FigureIdentifier, ClientRole,
} from '@gloomhaven-command/shared';

type ModifierDeck = 'monster' | 'ally' | { character: string; edition: string };

export class CommandSender {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  // ── Health & Conditions ──

  changeHealth(target: CommandTarget, delta: number): void {
    this.send({ action: 'changeHealth', payload: { target, delta } });
  }

  changeMaxHealth(target: CommandTarget, delta: number): void {
    this.send({ action: 'changeMaxHealth', payload: { target, delta } });
  }

  toggleCondition(target: CommandTarget, condition: ConditionName, value?: number): void {
    this.send({ action: 'toggleCondition', payload: { target, condition, value } });
  }

  // ── Initiative & Turns ──

  setInitiative(characterName: string, edition: string, value: number): void {
    this.send({ action: 'setInitiative', payload: { characterName, edition, value } });
  }

  advancePhase(): void {
    this.send({ action: 'advancePhase', payload: {} as Record<string, never> });
  }

  toggleTurn(figure: FigureIdentifier): void {
    this.send({ action: 'toggleTurn', payload: { figure } });
  }

  // ── Monster Entities ──

  addEntity(monsterName: string, edition: string, entityNumber: number, type: MonsterType): void {
    this.send({ action: 'addEntity', payload: { monsterName, edition, entityNumber, type } });
  }

  removeEntity(monsterName: string, edition: string, entityNumber: number, type: MonsterType): void {
    this.send({ action: 'removeEntity', payload: { monsterName, edition, entityNumber, type } });
  }

  // ── Elements ──

  moveElement(element: ElementType, newState: ElementState): void {
    this.send({ action: 'moveElement', payload: { element, newState } });
  }

  // ── Loot ──

  drawLootCard(): void {
    this.send({ action: 'drawLootCard', payload: {} as Record<string, never> });
  }

  assignLoot(cardIndex: number, characterName: string, edition: string): void {
    this.send({ action: 'assignLoot', payload: { cardIndex, characterName, edition } });
  }

  // ── Monster Abilities ──

  drawMonsterAbility(monsterName: string, edition: string): void {
    this.send({ action: 'drawMonsterAbility', payload: { monsterName, edition } });
  }

  shuffleMonsterAbilities(monsterName: string, edition: string): void {
    this.send({ action: 'shuffleMonsterAbilities', payload: { monsterName, edition } });
  }

  // ── Modifier Decks ──

  shuffleModifierDeck(deck: ModifierDeck): void {
    this.send({ action: 'shuffleModifierDeck', payload: { deck } });
  }

  drawModifierCard(deck: ModifierDeck): void {
    this.send({ action: 'drawModifierCard', payload: { deck } });
  }

  // ── Scenario ──

  revealRoom(roomId: number): void {
    this.send({ action: 'revealRoom', payload: { roomId } });
  }

  setScenario(scenarioIndex: string, edition: string, group?: string): void {
    this.send({ action: 'setScenario', payload: { scenarioIndex, edition, ...(group ? { group } : {}) } });
  }

  setLevel(level: number): void {
    this.send({ action: 'setLevel', payload: { level } });
  }

  setRound(round: number): void {
    this.send({ action: 'setRound', payload: { round } });
  }

  // ── Characters ──

  addCharacter(name: string, edition: string, level: number, player?: string): void {
    this.send({ action: 'addCharacter', payload: { name, edition, level, ...(player ? { player } : {}) } });
  }

  removeCharacter(name: string, edition: string): void {
    this.send({ action: 'removeCharacter', payload: { name, edition } });
  }

  setExperience(characterName: string, edition: string, value: number): void {
    this.send({ action: 'setExperience', payload: { characterName, edition, value } });
  }

  setLoot(characterName: string, edition: string, value: number): void {
    this.send({ action: 'setLoot', payload: { characterName, edition, value } });
  }

  toggleExhausted(characterName: string, edition: string): void {
    this.send({ action: 'toggleExhausted', payload: { characterName, edition } });
  }

  toggleAbsent(characterName: string, edition: string): void {
    this.send({ action: 'toggleAbsent', payload: { characterName, edition } });
  }

  // ── Summons ──

  addSummon(characterName: string, edition: string, summonName: string, cardId: string, number: number, color: SummonColor): void {
    this.send({ action: 'addSummon', payload: { characterName, edition, summonName, cardId, number, color } });
  }

  removeSummon(characterName: string, edition: string, summonUuid: string): void {
    this.send({ action: 'removeSummon', payload: { characterName, edition, summonUuid } });
  }

  // ── Monster Groups ──

  addMonsterGroup(name: string, edition: string): void {
    this.send({ action: 'addMonsterGroup', payload: { name, edition } });
  }

  removeMonsterGroup(name: string, edition: string): void {
    this.send({ action: 'removeMonsterGroup', payload: { name, edition } });
  }

  setMonsterLevel(name: string, edition: string, level: number): void {
    this.send({ action: 'setMonsterLevel', payload: { name, edition, level } });
  }

  // ── Undo ──

  undoAction(): void {
    this.send({ action: 'undoAction', payload: {} as Record<string, never> });
  }

  // ── GHS Compat ──

  importGhsState(ghsJson: string): void {
    this.send({ action: 'importGhsState', payload: { ghsJson } });
  }

  // ── Campaign ──

  updateCampaign(field: string, value: string | number | boolean): void {
    this.send({ action: 'updateCampaign', payload: { field, value } });
  }

  // ── Internal ──

  private send(command: Command): void {
    this.connection.sendCommand(command);
  }
}
```

---

### Task 4: Barrel export and tsconfig

**Files:**
- Create: `clients/shared/lib/index.ts`
- Create: `clients/shared/tsconfig.json`

- [ ] **Step 1: Create barrel export**

```typescript
export { Connection, type ConnectionOptions, type ConnectionStatus } from './connection.js';
export { StateStore } from './stateStore.js';
export { CommandSender } from './commandSender.js';
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./lib",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "declaration": false,
    "declarationMap": false,
    "lib": ["ES2022", "DOM"]
  },
  "include": ["lib/**/*.ts"]
}
```

Note: `"lib": ["ES2022", "DOM"]` is required because the code uses browser APIs (`WebSocket`, `localStorage`, `document`, `location`, `MessageEvent`). Uses npm workspace symlinks for `@gloomhaven-command/shared` resolution (no `paths` needed).

---

### Task 5: Type-check verification

- [ ] **Step 1: Build the shared package**

Run: `npm run build --workspace=packages/shared`
Expected: clean compilation

- [ ] **Step 2: Type-check client shared lib**

Run: `npx tsc --noEmit --project clients/shared/tsconfig.json`
Expected: no errors

If path resolution is problematic, fallback to esbuild:
```bash
npx esbuild clients/shared/lib/index.ts --bundle --outfile=_test_bundle.js --format=esm --external:@gloomhaven-command/shared --platform=browser
```
Delete `_test_bundle.js` after.

- [ ] **Step 3: Fix any type errors found**

Iterate until clean.

---

### Task 6: Update COMMAND_PROTOCOL.md

**Files:**
- Modify: `docs/COMMAND_PROTOCOL.md`

- [ ] **Step 1: Fix heartbeat timeout**

Line 86: Change `"stale after 5s"` to `"stale after 20s"` (matches `wsHub.ts` implementation of 20000ms).

- [ ] **Step 2: Update command actions table**

Replace the command table (lines 49-67) with a table covering all 31 actual commands and their correct payload shapes, matching `commands.ts` exactly.

---

### Task 7: Update ROADMAP.md

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Mark completed items**

Change these two lines from `- [ ]` to `- [x]`:
- `Implement shared WebSocket client (clients/shared/lib/connection.ts)`
- `Implement client-side state store with diff application`

---

### Task 8: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add clients/shared/lib/connection.ts clients/shared/lib/stateStore.ts clients/shared/lib/commandSender.ts clients/shared/lib/index.ts clients/shared/tsconfig.json docs/COMMAND_PROTOCOL.md docs/ROADMAP.md
git commit -m "feat(clients): implement shared client infrastructure

- Connection: WebSocket client with connect/reconnect/visibility handling
- StateStore: reactive state wrapper with derived getters
- CommandSender: typed convenience methods for all 31 command actions
- localStorage persistence for session token and revision
- Barrel export from clients/shared/lib/
- Fixed COMMAND_PROTOCOL.md stale timeout and command table drift"
```
