# R1 — Data Layer: GHS Edition File Integration

> Paste into Claude Code. Builds the data layer that reads GHS edition JSON files
> and provides typed lookup functions for characters, monsters, scenarios, and
> ability decks. This is the foundation that unblocks all automation.

---

Read CLAUDE.md, then docs/PROJECT_CONTEXT.md, then docs/GHS_AUDIT.md (the full
audit — especially Section 14: Data File Reference and Section 16: Gap Analysis).

Then read:
- `packages/shared/src/types/gameState.ts` — existing types
- `packages/shared/src/types/commands.ts` — existing commands
- `packages/shared/src/engine/applyCommand.ts` — existing handlers
- `packages/shared/src/utils/ghsCompat.ts` — existing GHS compat utils
- `server/src/staticServer.ts` — how assets are served
- `server/src/index.ts` — server startup

## Context

The GHS data files are at `.staging/ghs-client/data/` locally and served by the
server at `/assets/data/`. They contain per-edition, per-file JSON for:

- Characters: `{edition}/character/{name}.json` — HP by level, perks, hand size
- Character decks: `{edition}/character/deck/{name}.json` — ability cards
- Monsters: `{edition}/monster/{name}.json` — stat table (HP/move/attack/range by level for normal/elite)
- Monster decks: `{edition}/monster/deck/{name}.json` — ability cards with initiative, actions, shuffle flag
- Scenarios: `{edition}/scenarios/{number}.json` — rooms with monster spawns, special rules, treasures
- Sections: `{edition}/sections/{id}.json` — room section data (for FH narrative sections)
- Edition metadata: `{edition}/base.json` — conditions, logo, world map
- Items: `{edition}/items.json`
- Campaign: `{edition}/campaign.json`

The data layer needs to work in two environments:
1. **Server** — loads from filesystem at startup, used by `applyCommand` for auto-spawn
2. **Client (browser)** — loads via fetch from `/assets/data/`, used for dropdowns and stat display

## Architecture

Create a `DataManager` in `packages/shared/src/data/` with an abstract loader interface.
Server and client each provide their own loader implementation.

```
packages/shared/src/data/
├── index.ts              — DataManager class + barrel exports
├── types.ts              — data file type definitions (CharacterData, MonsterData, etc.)
├── loader.ts             — DataLoader interface
├── characterLookup.ts    — character stat lookup functions
├── monsterLookup.ts      — monster stat lookup functions
├── scenarioLookup.ts     — scenario room/spawn resolution
├── abilityLookup.ts      — monster ability deck resolution
└── levelCalculation.ts   — scenario level auto-calculation + derived values

server/src/dataLoader.ts  — filesystem DataLoader implementation
```

The client will get a fetch-based loader later (R2). For R1, focus on the shared
data types, lookup functions, and the server-side filesystem loader.

## STEP 1 — Define data file types

Create `packages/shared/src/data/types.ts`:

Base these on the EXACT structures documented in GHS_AUDIT.md Section 14.
Read the actual data files to verify — the audit quotes may be simplified.

```powershell
# Read a character definition
Get-Content "C:\Projects\gloomhaven-command\.staging\ghs-client\data\gh\character\brute.json" | Out-String
```

```powershell
# Read a monster definition
Get-Content "C:\Projects\gloomhaven-command\.staging\ghs-client\data\gh\monster\bandit-guard.json" | Out-String
```

```powershell
# Read a monster ability deck
Get-Content "C:\Projects\gloomhaven-command\.staging\ghs-client\data\gh\monster\deck\guard.json" | Out-String
```

```powershell
# Read a scenario definition
Get-Content "C:\Projects\gloomhaven-command\.staging\ghs-client\data\gh\scenarios\1.json" | Out-String
```

```powershell
# Read edition base
Get-Content "C:\Projects\gloomhaven-command\.staging\ghs-client\data\gh\base.json" | Out-String
```

```powershell
# Read a FH character for comparison
Get-ChildItem "C:\Projects\gloomhaven-command\.staging\ghs-client\data\fh\character" -Filter "*.json" | Select-Object Name -First 5
# Then read one
```

```powershell
# Read a FH scenario for comparison (FH scenarios have sections/lootDeckConfig)
Get-ChildItem "C:\Projects\gloomhaven-command\.staging\ghs-client\data\fh\scenarios" -Filter "*.json" | Select-Object Name -First 5
# Then read one
```

After reading the actual files, define typed interfaces for each:

```typescript
// Edition metadata
export interface EditionData {
  edition: string;
  conditions: string[];
  // ... other fields from base.json
}

// Character class definition
export interface CharacterData {
  name: string;
  edition: string;
  handSize: number;
  color: string;
  stats: CharacterLevelStats[];
  perks: PerkDefinition[];
  // ... other fields
}

export interface CharacterLevelStats {
  level: number;
  health: number;
}

// Monster definition
export interface MonsterData {
  name: string;
  edition: string;
  deck: string;          // shared ability deck name
  count: number;         // max standees
  flying: boolean;
  stats: MonsterLevelStats[];
}

export interface MonsterLevelStats {
  level: number;
  type?: 'elite' | 'boss';  // undefined = normal
  health: number;
  movement: number;
  attack: number;
  range?: number;
  actions?: MonsterStatAction[];  // shield, retaliate, etc.
  immunities?: string[];
  // ... other fields from actual data
}

export interface MonsterStatAction {
  type: string;          // "shield", "retaliate", "heal", etc.
  value: number;
  // ... other fields
}

// Monster ability card
export interface MonsterAbilityCard {
  cardId: number;
  initiative: number;
  shuffle: boolean;
  actions: MonsterAbilityAction[];
}

export interface MonsterAbilityAction {
  type: string;          // "move", "attack", "shield", etc.
  value: number;
  valueType?: string;    // "plus" = add to base stat; absent = absolute
  subActions?: MonsterAbilityAction[];
}

// Monster ability deck
export interface MonsterAbilityDeckData {
  name: string;
  edition: string;
  abilities: MonsterAbilityCard[];
}

// Scenario definition
export interface ScenarioData {
  index: string;
  name: string;
  edition: string;
  initial?: boolean;
  unlocks?: string[];
  links?: string[];
  rewards?: Record<string, unknown>;
  monsters?: string[];       // monster names used in this scenario
  rooms: ScenarioRoom[];
  // FH additions
  lootDeckConfig?: unknown;  // loot deck setup
  sections?: unknown[];
}

export interface ScenarioRoom {
  roomNumber: number;
  ref: string;               // tile reference (e.g., "L1a", "G1b")
  initial?: boolean;         // true = Room 1, auto-revealed
  rooms?: number[];          // connected room numbers (doors lead here)
  marker?: string;           // section marker to read
  treasures?: number[];      // treasure numbers in this room
  monster: ScenarioMonsterSpawn[];
}

export interface ScenarioMonsterSpawn {
  name: string;
  type?: 'normal' | 'elite' | 'boss';  // always-spawn type
  player2?: 'normal' | 'elite';  // spawn at 2+ players
  player3?: 'normal' | 'elite';  // spawn at 3+ players
  player4?: 'normal' | 'elite';  // spawn at 4 players
  marker?: string;
  // ... other fields from actual data
}
```

**CRITICAL**: Read the actual JSON files, not just the audit. The audit provides
the structure overview, but the files may have fields the audit didn't list.
Define types that cover every field present in the real files.

## STEP 2 — Define the DataLoader interface

Create `packages/shared/src/data/loader.ts`:

```typescript
export interface DataLoader {
  // Load a single JSON file by path relative to data root
  // e.g., "gh/character/brute.json"
  loadJson<T>(path: string): Promise<T>;

  // List files in a directory (relative to data root)
  // e.g., "gh/character/" → ["brute.json", "spellweaver.json", ...]
  listFiles(dirPath: string): Promise<string[]>;

  // Check if a file exists
  exists(path: string): Promise<boolean>;
}
```

## STEP 3 — Implement the DataManager

Create `packages/shared/src/data/index.ts`:

```typescript
export class DataManager {
  private loader: DataLoader;
  private cache: Map<string, unknown> = new Map();

  // Loaded edition registries
  private editions: Map<string, EditionData> = new Map();
  private characters: Map<string, CharacterData> = new Map();   // "edition:name" → data
  private monsters: Map<string, MonsterData> = new Map();       // "edition:name" → data
  private monsterDecks: Map<string, MonsterAbilityDeckData> = new Map(); // "edition:deckName"
  private scenarios: Map<string, ScenarioData> = new Map();     // "edition:index" → data

  constructor(loader: DataLoader) { this.loader = loader; }

  // Load all data for an edition
  async loadEdition(edition: string): Promise<void> { ... }

  // Get loaded editions
  getLoadedEditions(): string[] { ... }

  // Character lookups
  getCharacterList(edition?: string): CharacterData[] { ... }
  getCharacter(edition: string, name: string): CharacterData | null { ... }
  getCharacterMaxHealth(edition: string, name: string, level: number): number { ... }
  getCharacterHandSize(edition: string, name: string): number { ... }

  // Monster lookups
  getMonsterList(edition?: string): MonsterData[] { ... }
  getMonster(edition: string, name: string): MonsterData | null { ... }
  getMonsterStats(edition: string, name: string, level: number, type: 'normal' | 'elite' | 'boss'): MonsterLevelStats | null { ... }
  getMonsterMaxHealth(edition: string, name: string, level: number, type: 'normal' | 'elite' | 'boss'): number { ... }

  // Monster ability deck lookups
  getMonsterDeck(edition: string, deckName: string): MonsterAbilityDeckData | null { ... }
  getMonsterDeckForMonster(edition: string, monsterName: string): MonsterAbilityDeckData | null { ... }

  // Scenario lookups
  getScenarioList(edition?: string): ScenarioData[] { ... }
  getScenario(edition: string, index: string): ScenarioData | null { ... }

  // Resolve monster spawns for a room
  resolveRoomSpawns(scenario: ScenarioData, roomNumber: number, playerCount: number): ResolvedSpawn[] { ... }
}

export interface ResolvedSpawn {
  monsterName: string;
  type: 'normal' | 'elite' | 'boss';
}
```

### `loadEdition(edition)` implementation

1. Load `{edition}/base.json` → store in `editions` map
2. List files in `{edition}/character/` → for each `.json` file (excluding `deck/`), load and store in `characters` map with key `"edition:name"`
3. List files in `{edition}/monster/` → for each `.json` file (excluding `deck/`), load and store in `monsters` map
4. List files in `{edition}/monster/deck/` → load each deck, store in `monsterDecks` map
5. List files in `{edition}/scenarios/` → load each, store in `scenarios` map

Use caching: if an edition is already loaded, skip.

Handle missing files gracefully — not all editions have all subdirectories.

### `resolveRoomSpawns(scenario, roomNumber, playerCount)` implementation

This is the critical automation logic:

```typescript
resolveRoomSpawns(scenario: ScenarioData, roomNumber: number, playerCount: number): ResolvedSpawn[] {
  const room = scenario.rooms.find(r => r.roomNumber === roomNumber);
  if (!room) return [];

  const spawns: ResolvedSpawn[] = [];

  for (const spawn of room.monster) {
    // Always-spawn entries (have a `type` field)
    if (spawn.type) {
      spawns.push({ monsterName: spawn.name, type: spawn.type });
    }

    // Player-count-dependent spawns
    if (spawn.player2 && playerCount >= 2) {
      spawns.push({ monsterName: spawn.name, type: spawn.player2 });
    }
    if (spawn.player3 && playerCount >= 3) {
      spawns.push({ monsterName: spawn.name, type: spawn.player3 });
    }
    if (spawn.player4 && playerCount >= 4) {
      spawns.push({ monsterName: spawn.name, type: spawn.player4 });
    }
  }

  return spawns;
}
```

## STEP 4 — Implement level calculation

Create `packages/shared/src/data/levelCalculation.ts`:

```typescript
export interface LevelDerivedValues {
  scenarioLevel: number;
  monsterLevel: number;
  goldConversion: number;
  trapDamage: number;
  hazardousTerrain: number;
  bonusXP: number;
}

// Auto-calculate scenario level from character levels
export function calculateScenarioLevel(
  characterLevels: number[],
  adjustment: number = 0,
  solo: boolean = false
): number {
  if (characterLevels.length === 0) return 1;

  const avg = characterLevels.reduce((a, b) => a + b, 0) / characterLevels.length;
  let level = Math.ceil(avg / 2);

  if (solo) {
    // Solo: use average level (rounded up), no halving
    level = Math.ceil(avg);
  }

  level += adjustment;
  return Math.max(0, Math.min(7, level));
}

// Derive all level-dependent values
export function deriveLevelValues(scenarioLevel: number): LevelDerivedValues {
  const goldTable = [2, 2, 3, 3, 4, 4, 5, 6];
  const hazardTable = [1, 2, 2, 2, 3, 3, 3, 4];

  return {
    scenarioLevel,
    monsterLevel: scenarioLevel,
    goldConversion: goldTable[scenarioLevel] ?? 2,
    trapDamage: 2 + scenarioLevel,
    hazardousTerrain: hazardTable[scenarioLevel] ?? 1,
    bonusXP: 4 + (2 * scenarioLevel),
  };
}

// Get player count from characters (non-absent, non-exhausted)
export function getPlayerCount(characters: { absent?: boolean; exhausted?: boolean }[]): number {
  return characters.filter(c => !c.absent && !c.exhausted).length;
}
```

## STEP 5 — Implement the server-side filesystem DataLoader

Create `server/src/dataLoader.ts`:

```typescript
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import type { DataLoader } from '@gloomhaven-command/shared';

export class FileSystemDataLoader implements DataLoader {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = resolve(basePath);
  }

  async loadJson<T>(path: string): Promise<T> {
    const fullPath = join(this.basePath, path);
    const content = readFileSync(fullPath, 'utf8');
    return JSON.parse(content) as T;
  }

  async listFiles(dirPath: string): Promise<string[]> {
    const fullPath = join(this.basePath, dirPath);
    if (!existsSync(fullPath)) return [];
    return readdirSync(fullPath, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.json'))
      .map(e => e.name);
  }

  async exists(path: string): Promise<boolean> {
    return existsSync(join(this.basePath, path));
  }
}
```

## STEP 6 — Wire DataManager into the server

Edit `server/src/index.ts`:

1. Import `DataManager` from `@gloomhaven-command/shared`
2. Import `FileSystemDataLoader` from `./dataLoader.js`
3. At startup, determine the data path:
   ```typescript
   const dataPath = resolve(rootDir, 'assets', 'data');
   // Fallback: check .staging
   const stagingDataPath = resolve(rootDir, '.staging', 'ghs-client', 'data');
   const actualDataPath = existsSync(dataPath) ? dataPath : stagingDataPath;
   ```
4. Create `FileSystemDataLoader` and `DataManager`
5. Load available editions at startup:
   ```typescript
   const dataManager = new DataManager(new FileSystemDataLoader(actualDataPath));
   // Detect available editions by looking for base.json files
   const editionDirs = readdirSync(actualDataPath, { withFileTypes: true })
     .filter(e => e.isDirectory())
     .map(e => e.name);
   for (const ed of editionDirs) {
     if (existsSync(join(actualDataPath, ed, 'base.json'))) {
       await dataManager.loadEdition(ed);
       console.log(`Loaded edition: ${ed}`);
     }
   }
   ```
6. Pass `dataManager` to the command handler (so `applyCommand` can use it for auto-spawn)
7. Add API endpoints for the client to query data:
   ```typescript
   // Edition list
   app.get('/api/data/editions', (req, res) => {
     res.json(dataManager.getLoadedEditions());
   });

   // Character list for an edition
   app.get('/api/data/:edition/characters', (req, res) => {
     res.json(dataManager.getCharacterList(req.params.edition));
   });

   // Monster list for an edition
   app.get('/api/data/:edition/monsters', (req, res) => {
     res.json(dataManager.getMonsterList(req.params.edition));
   });

   // Scenario list for an edition
   app.get('/api/data/:edition/scenarios', (req, res) => {
     res.json(dataManager.getScenarioList(req.params.edition));
   });

   // Single character
   app.get('/api/data/:edition/character/:name', (req, res) => {
     const data = dataManager.getCharacter(req.params.edition, req.params.name);
     data ? res.json(data) : res.status(404).json({ error: 'Character not found' });
   });

   // Single monster
   app.get('/api/data/:edition/monster/:name', (req, res) => {
     const data = dataManager.getMonster(req.params.edition, req.params.name);
     data ? res.json(data) : res.status(404).json({ error: 'Monster not found' });
   });

   // Single scenario
   app.get('/api/data/:edition/scenario/:index', (req, res) => {
     const data = dataManager.getScenario(req.params.edition, req.params.index);
     data ? res.json(data) : res.status(404).json({ error: 'Scenario not found' });
   });

   // Monster deck
   app.get('/api/data/:edition/monster-deck/:name', (req, res) => {
     const data = dataManager.getMonsterDeck(req.params.edition, req.params.name);
     data ? res.json(data) : res.status(404).json({ error: 'Deck not found' });
   });

   // Level calculation
   app.get('/api/data/level-calc', (req, res) => {
     const levels = (req.query.levels as string || '').split(',').map(Number).filter(n => !isNaN(n));
     const adj = parseInt(req.query.adjustment as string) || 0;
     const solo = req.query.solo === 'true';
     const level = calculateScenarioLevel(levels, adj, solo);
     res.json({ ...deriveLevelValues(level), characterLevels: levels, adjustment: adj });
   });
   ```

## STEP 7 — Wire DataManager into applyCommand for auto-spawn

This is where the data layer starts fixing Critical gaps #1-3.

Edit `server/src/commandHandler.ts` to accept and store a `DataManager` reference.

Then edit `packages/shared/src/engine/applyCommand.ts`:

The `applyCommand` function needs access to data for:
- `addCharacter` — look up maxHealth from character data by level
- `setScenario` — auto-spawn Room 1 monsters
- `revealRoom` — auto-spawn room monsters
- `addEntity` — look up maxHealth from monster stats by level/type

Two approaches:

**Option A (recommended):** Add an optional `dataContext` parameter to `applyCommand`:

```typescript
export interface DataContext {
  getCharacterMaxHealth(edition: string, name: string, level: number): number;
  getMonsterMaxHealth(edition: string, name: string, level: number, type: 'normal' | 'elite' | 'boss'): number;
  getMonsterStats(edition: string, name: string, level: number, type: string): MonsterLevelStats | null;
  getScenario(edition: string, index: string): ScenarioData | null;
  resolveRoomSpawns(scenario: ScenarioData, roomNumber: number, playerCount: number): ResolvedSpawn[];
  getMonsterDeckForMonster(edition: string, monsterName: string): MonsterAbilityDeckData | null;
  getMonster(edition: string, name: string): MonsterData | null;
}

export function applyCommand(
  state: GameState,
  command: Command,
  dataContext?: DataContext
): { state: GameState; changes: StateChange[] }
```

**Option B:** Pass resolved data in the command payload (e.g., `addCharacter` payload includes `maxHealth`). This keeps `applyCommand` pure but pushes data lookup to the caller.

Go with **Option A** — it keeps the command payloads simple and the automation logic centralized.

### Update `addCharacter` handler

When `dataContext` is available:
```typescript
const charData = dataContext.getCharacterMaxHealth(payload.edition, payload.name, payload.level);
// Use charData for maxHealth instead of hardcoded 10
```

When `dataContext` is null, fall back to payload values or defaults.

### Update `setScenario` handler

When `dataContext` is available:
```typescript
const scenario = dataContext.getScenario(payload.edition, payload.scenarioIndex);
if (scenario) {
  // Auto-spawn Room 1 monsters
  const playerCount = getPlayerCount(state.characters);
  const initialRoom = scenario.rooms.find(r => r.initial);
  if (initialRoom) {
    const spawns = dataContext.resolveRoomSpawns(scenario, initialRoom.roomNumber, playerCount);
    // For each spawn, create monster group if not exists, add entity
    for (const spawn of spawns) {
      // Find or create monster group
      let group = state.monsters.find(m => m.name === spawn.monsterName && m.edition === payload.edition);
      if (!group) {
        const monsterData = dataContext.getMonster(payload.edition, spawn.monsterName);
        group = createMonsterGroup(spawn.monsterName, payload.edition, state.level, monsterData);
        state.monsters.push(group);
        state.figures.push(`${payload.edition}-${spawn.monsterName}`);
      }
      // Add entity to group
      const stats = dataContext.getMonsterStats(payload.edition, spawn.monsterName, state.level, spawn.type);
      const nextNumber = getNextStandeeNumber(group);
      group.entities.push(createMonsterEntity(nextNumber, spawn.type, stats));
    }
    // Set up ability decks for all monster groups
    // Mark Room 1 as revealed in scenario state
  }
  // Auto-calculate scenario level if not manually overridden
  // Set scenario name, edition, etc.
}
```

Write helper functions: `createMonsterGroup()`, `createMonsterEntity()`, `getNextStandeeNumber()`.

### Update `revealRoom` handler

Same spawn logic but for the revealed room, using player count at time of reveal.

### Update `addEntity` handler

When `dataContext` is available, auto-fill `maxHealth` from monster stats:
```typescript
if (!payload.maxHealth && dataContext) {
  const stats = dataContext.getMonsterStats(edition, monsterName, state.level, payload.type);
  entity.maxHealth = stats?.health ?? 0;
  entity.health = entity.maxHealth;
}
```

## STEP 8 — Update the server's commandHandler to pass DataContext

Edit `server/src/commandHandler.ts`:

```typescript
class CommandHandler {
  private dataManager: DataManager;

  constructor(gameStore: GameStore, sessionManager: SessionManager, dataManager: DataManager) {
    this.dataManager = dataManager;
  }

  handleCommand(ws: WebSocket, gameCode: string, command: Command): void {
    // ... existing load/validate logic ...

    const dataContext: DataContext = {
      getCharacterMaxHealth: (ed, name, level) => this.dataManager.getCharacterMaxHealth(ed, name, level),
      getMonsterMaxHealth: (ed, name, level, type) => this.dataManager.getMonsterMaxHealth(ed, name, level, type),
      getMonsterStats: (ed, name, level, type) => this.dataManager.getMonsterStats(ed, name, level, type),
      getScenario: (ed, index) => this.dataManager.getScenario(ed, index),
      resolveRoomSpawns: (scenario, room, count) => this.dataManager.resolveRoomSpawns(scenario, room, count),
      getMonsterDeckForMonster: (ed, name) => this.dataManager.getMonsterDeckForMonster(ed, name),
      getMonster: (ed, name) => this.dataManager.getMonster(ed, name),
    };

    const { state: newState, changes } = applyCommand(state, command, dataContext);
    // ... rest of pipeline unchanged
  }
}
```

## STEP 9 — Verification

### 9a. Data loading test

Create and run `_test_data.mts` at repo root:

```typescript
import { DataManager } from './packages/shared/src/data/index.js';
import { FileSystemDataLoader } from './server/src/dataLoader.js';
import { existsSync } from 'fs';

const dataPath = existsSync('./assets/data') ? './assets/data' : './.staging/ghs-client/data';
const dm = new DataManager(new FileSystemDataLoader(dataPath));

// Load GH edition
await dm.loadEdition('gh');
console.log('Loaded editions:', dm.getLoadedEditions());

// Character lookups
const chars = dm.getCharacterList('gh');
console.log(`GH characters: ${chars.length} — ${chars.map(c => c.name).join(', ')}`);

const bruteHP = dm.getCharacterMaxHealth('gh', 'brute', 3);
console.assert(bruteHP === 14, `Brute L3 HP should be 14, got ${bruteHP}`);
console.log(`✓ Brute L3 HP: ${bruteHP}`);

// Monster lookups
const monsters = dm.getMonsterList('gh');
console.log(`GH monsters: ${monsters.length}`);

const guardStats = dm.getMonsterStats('gh', 'bandit-guard', 1, 'normal');
console.assert(guardStats !== null, 'Bandit guard L1 normal stats should exist');
console.log(`✓ Bandit Guard L1 normal: HP=${guardStats?.health}, ATK=${guardStats?.attack}, MOV=${guardStats?.movement}`);

const guardElite = dm.getMonsterStats('gh', 'bandit-guard', 1, 'elite');
console.log(`✓ Bandit Guard L1 elite: HP=${guardElite?.health}, ATK=${guardElite?.attack}`);

// Monster deck lookup
const guardDeck = dm.getMonsterDeckForMonster('gh', 'bandit-guard');
console.assert(guardDeck !== null, 'Guard deck should exist');
console.log(`✓ Guard ability deck: ${guardDeck?.abilities.length} cards`);

// Scenario lookup
const scenario1 = dm.getScenario('gh', '1');
console.assert(scenario1 !== null, 'Scenario 1 should exist');
console.log(`✓ Scenario 1: "${scenario1?.name}", ${scenario1?.rooms.length} rooms`);

// Room spawn resolution
import { getPlayerCount } from './packages/shared/src/data/levelCalculation.js';
const spawns = dm.resolveRoomSpawns(scenario1!, 1, 3);
console.log(`✓ Room 1 spawns (3 players): ${spawns.length} standees`);
spawns.forEach(s => console.log(`    ${s.monsterName} (${s.type})`));

// Level calculation
import { calculateScenarioLevel, deriveLevelValues } from './packages/shared/src/data/levelCalculation.js';
const level = calculateScenarioLevel([3, 3, 4], 0, false);
console.log(`✓ Scenario level for L3/L3/L4: ${level}`);
const values = deriveLevelValues(level);
console.log(`  Trap: ${values.trapDamage}, Gold: ${values.goldConversion}, Bonus XP: ${values.bonusXP}`);

// Try loading FH if available
try {
  await dm.loadEdition('fh');
  const fhChars = dm.getCharacterList('fh');
  console.log(`✓ FH characters: ${fhChars.length}`);
  const fhMonsters = dm.getMonsterList('fh');
  console.log(`✓ FH monsters: ${fhMonsters.length}`);
} catch {
  console.log('FH edition not available');
}

console.log('\n✓ All data layer tests passed');
```

Run: `npx tsx _test_data.mts`

Delete after: `Remove-Item _test_data.mts -ErrorAction SilentlyContinue`

### 9b. Auto-spawn integration test

Test that `setScenario` now auto-spawns monsters. Extend or create a test:

```typescript
import { applyCommand, createEmptyGameState } from './packages/shared/src/index.js';
import { DataManager } from './packages/shared/src/data/index.js';
import { FileSystemDataLoader } from './server/src/dataLoader.js';

const dm = new DataManager(new FileSystemDataLoader('./.staging/ghs-client/data'));
await dm.loadEdition('gh');

const dataContext = {
  getCharacterMaxHealth: (ed, name, level) => dm.getCharacterMaxHealth(ed, name, level),
  getMonsterMaxHealth: (ed, name, level, type) => dm.getMonsterMaxHealth(ed, name, level, type),
  getMonsterStats: (ed, name, level, type) => dm.getMonsterStats(ed, name, level, type),
  getScenario: (ed, index) => dm.getScenario(ed, index),
  resolveRoomSpawns: (scenario, room, count) => dm.resolveRoomSpawns(scenario, room, count),
  getMonsterDeckForMonster: (ed, name) => dm.getMonsterDeckForMonster(ed, name),
  getMonster: (ed, name) => dm.getMonster(ed, name),
};

// Create game, add characters, set scenario
let state = createEmptyGameState('gh');

// Add 3 characters
const { state: s1 } = applyCommand(state, { action: 'addCharacter', payload: { name: 'brute', edition: 'gh', level: 3 } }, dataContext);
const { state: s2 } = applyCommand(s1, { action: 'addCharacter', payload: { name: 'spellweaver', edition: 'gh', level: 3 } }, dataContext);
const { state: s3 } = applyCommand(s2, { action: 'addCharacter', payload: { name: 'cragheart', edition: 'gh', level: 4 } }, dataContext);

console.assert(s3.characters[0].maxHealth > 10, `Brute should have real HP, got ${s3.characters[0].maxHealth}`);
console.log(`✓ Brute maxHealth: ${s3.characters[0].maxHealth} (from data, not hardcoded 10)`);

// Set scenario 1
const { state: s4 } = applyCommand(s3, { action: 'setScenario', payload: { scenarioIndex: '1', edition: 'gh' } }, dataContext);

console.assert(s4.monsters.length > 0, 'Should have auto-spawned monsters');
console.log(`✓ Auto-spawned ${s4.monsters.length} monster groups:`);
s4.monsters.forEach(m => {
  const liveEntities = m.entities.filter(e => !e.dead);
  console.log(`  ${m.name}: ${liveEntities.length} standees`);
  liveEntities.forEach(e => console.log(`    #${e.number} ${e.type} HP:${e.health}/${e.maxHealth}`));
});

console.assert(s4.monsters.some(m => m.entities.some(e => e.maxHealth > 0)), 'Monsters should have real HP from data');
console.log('\n✓ Scenario auto-spawn integration test passed');
```

Run: `npx tsx _test_autospawn.mts`

Delete after: `Remove-Item _test_autospawn.mts -ErrorAction SilentlyContinue`

### 9c. API endpoints test

Boot the server and test the data API:

```powershell
npx tsx server/src/index.ts
# In another terminal:
curl http://localhost:3000/api/data/editions
curl http://localhost:3000/api/data/gh/characters
curl http://localhost:3000/api/data/gh/monsters
curl http://localhost:3000/api/data/gh/scenarios
curl "http://localhost:3000/api/data/gh/character/brute"
curl "http://localhost:3000/api/data/gh/monster/bandit-guard"
curl "http://localhost:3000/api/data/gh/scenario/1"
curl "http://localhost:3000/api/data/level-calc?levels=3,3,4&adjustment=0"
```

## STEP 10 — Update documentation

### ROADMAP.md

Add a new section between Phase 1 and Phase 2:

```markdown
## Phase R: Controller Rebuild (replaces original Phase 2)
- [x] R1: Data layer — edition file loading, stat lookups, scenario auto-spawn
- [ ] R2: Preact app scaffold with role routing
- [ ] R3: Core shared components
- [ ] R4: Controller single-screen view
- [ ] R5: Scenario automation
- [ ] R6: Round flow automation
```

### DESIGN_DECISIONS.md

Append:

```markdown
### 2026-03-25 — Data layer with abstract loader interface
**Decision:** DataManager in shared package with DataLoader interface. Server uses
filesystem loader; client will use fetch loader. Data API endpoints for client queries.
**Rationale:** GHS edition files contain all character stats, monster stats, scenario
room layouts, and ability decks. Without loading these, the controller can't auto-set
HP, auto-spawn monsters, resolve ability cards, or calculate scenario level. The
abstract loader lets the same lookup code work server-side (for applyCommand automation)
and client-side (for UI dropdowns and stat display).

### 2026-03-25 — DataContext parameter on applyCommand
**Decision:** applyCommand takes an optional DataContext for data-driven automation.
**Rationale:** Commands like setScenario and addCharacter need data lookups (scenario
rooms, character HP tables) but applyCommand must remain a pure function. DataContext
is an interface injected by the server — the engine doesn't know about files or HTTP.
When DataContext is null, commands fall back to payload values or defaults.

### 2026-03-25 — Preact single-app rebuild replacing vanilla 5-tab controller
**Decision:** Rebuild all three clients as one Preact app with role-based rendering.
**Rationale:** GHS audit revealed the 5-tab controller violates GHS's core UX: single
screen with everything visible, overlays for detail. The vanilla DOM approach produced
4,455 lines of string-template rendering with no component reuse. Preact (3KB) gives
components, reactive state, and efficient diffing. One app with role routing
(/controller, /phone, /display) shares 80% of components across all three views.
```

## STEP 11 — Commit

```powershell
git add -A
git commit -m "feat: data layer — GHS edition file loading, stat lookups, scenario auto-spawn

- DataManager with abstract DataLoader interface (shared package)
- FileSystemDataLoader for server-side file access
- Character lookups: class list, HP by level, hand size
- Monster lookups: stat tables (normal/elite/boss by level), max standees
- Monster ability deck lookups with shared deck resolution
- Scenario lookups: room layout, monster spawn resolution by player count
- Level auto-calculation: avg party level / 2, derived values (trap, gold, XP)
- DataContext wired into applyCommand for:
  - addCharacter: auto-set maxHealth from edition data
  - setScenario: auto-spawn Room 1 monsters with correct HP/stats
  - revealRoom: auto-spawn room monsters at reveal time
  - addEntity: auto-fill maxHealth from monster stats
- Data API endpoints: /api/data/editions, characters, monsters, scenarios
- Integration tests: data loading, auto-spawn, level calculation"
git push
```

Report: commit hash, number of editions loaded, character/monster/scenario counts
per edition, and the auto-spawn test results (how many monsters spawn for Scenario 1
with 3 players, and their HP values).
