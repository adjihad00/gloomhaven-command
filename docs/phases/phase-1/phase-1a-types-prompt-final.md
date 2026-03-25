# Phase 1A — Type Definitions (with GHS Source Investigation)

> Paste into Claude Code. This investigates the installed GHS files to map the
> exact game state model, then implements all shared type definitions.

---

Read CLAUDE.md then docs/PROJECT_CONTEXT.md then docs/COMMAND_PROTOCOL.md.

## STEP 0 — Investigate GHS Source and Data

Three sources of truth exist. Investigate all three BEFORE writing any types.

**Source A:** `C:\Users\Kyle Diaz\.ghs\ghs.sqlite` — the live SQLite database with real game state JSON blobs.

**Source B:** `C:\Projects\gloomhaven-command\.staging\ghs-client\` — the compiled GHS client release. Contains `assets/data/` with character, monster, scenario, and edition JSON files.

**Source C:** The upstream GHS TypeScript source repo — contains the authoritative model class definitions.

### 0a. Survey the .ghs directory

```powershell
Get-ChildItem -Path "C:\Users\Kyle Diaz\.ghs" -Recurse -Depth 2 | Select-Object FullName, Length
```

Note what's there: SQLite DB, client files, application.properties, etc.

### 0b. Extract game state from SQLite

The `ghs.sqlite` file contains persisted game state payloads. Write and run a Node script to dump them.

Install better-sqlite3 in the server workspace if not already present:

```powershell
cd C:\Projects\gloomhaven-command
npm install better-sqlite3 --save-dev --workspace=server
```

Create and run `_investigate.mjs` at the repo root:

```javascript
import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
import { join } from 'path';

const dbPath = join(process.env.USERPROFILE, '.ghs', 'ghs.sqlite');
const db = new Database(dbPath, { readonly: true });

// List all tables and schemas
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));
tables.forEach(t => {
  const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE name='${t.name}'`).get();
  console.log(`\nSchema for ${t.name}:`, schema.sql);
});

// Dump game state rows
const games = db.prepare("SELECT * FROM game LIMIT 3").all();
games.forEach((game, i) => {
  console.log(`\n=== Game ${i} ===`);
  console.log('Columns:', Object.keys(game));
  Object.entries(game).forEach(([key, val]) => {
    if (typeof val === 'string' && val.startsWith('{')) {
      const parsed = JSON.parse(val);
      writeFileSync(`_ghs_state_${i}.json`, JSON.stringify(parsed, null, 2));
      console.log(`Wrote ${key} to _ghs_state_${i}.json (${val.length} chars)`);
      console.log('\nTop-level keys:');
      Object.entries(parsed).forEach(([k, v]) => {
        const type = Array.isArray(v) ? `array[${v.length}]` : typeof v;
        console.log(`  ${k}: ${type}`);
      });
    } else {
      console.log(`${key}: ${JSON.stringify(val).substring(0, 200)}`);
    }
  });
});

db.close();
```

Run: `node _investigate.mjs`

### 0c. Deep-dive the dumped game state JSON

After `_ghs_state_0.json` exists, recursively document its structure. Create and run `_map_structure.mjs`:

```javascript
import { readFileSync } from 'fs';

function mapStructure(obj, path = '', depth = 0) {
  if (depth > 4) return;
  if (obj === null || obj === undefined) { console.log(`${path}: null`); return; }
  if (Array.isArray(obj)) {
    console.log(`${path}: array[${obj.length}]`);
    if (obj.length > 0) mapStructure(obj[0], `${path}[0]`, depth + 1);
    return;
  }
  if (typeof obj === 'object') {
    Object.entries(obj).forEach(([k, v]) => {
      const cp = path ? `${path}.${k}` : k;
      if (typeof v === 'object' && v !== null) { mapStructure(v, cp, depth + 1); }
      else { console.log(`${cp}: ${typeof v} = ${JSON.stringify(v).substring(0, 80)}`); }
    });
    return;
  }
  console.log(`${path}: ${typeof obj} = ${JSON.stringify(obj).substring(0, 80)}`);
}

const state = JSON.parse(readFileSync('_ghs_state_0.json', 'utf8'));
mapStructure(state);
```

Run: `node _map_structure.mjs`

### 0d. Examine the GHS data JSONs from .staging

```powershell
Get-ChildItem -Path "C:\Projects\gloomhaven-command\.staging\ghs-client\assets\data" -Recurse -Depth 1 | Select-Object FullName, Length | Format-Table -AutoSize
```

Find and read one character data file and one monster data file:

```powershell
Get-ChildItem -Path "C:\Projects\gloomhaven-command\.staging\ghs-client\assets\data" -Recurse -Filter "*.json" | Where-Object { $_.Name -match "brute|hatchet|banner|guard" } | Select-Object FullName -First 3
```

Read each to understand the stat/data structure (these are the static game data files, separate from the runtime game state).

### 0e. Clone upstream GHS source for TypeScript model files

The compiled client in .staging has no .ts files. Clone the upstream repo (shallow) to read the authoritative TypeScript model definitions:

```powershell
git clone --depth 1 https://github.com/Lurkars/gloomhavensecretariat.git C:\Projects\gloomhaven-command\_ghs_source
```

Read these model files — they are the definitive type definitions for GHS game state:

```
_ghs_source/src/app/game/model/Game.ts
_ghs_source/src/app/game/model/Character.ts
_ghs_source/src/app/game/model/Monster.ts
_ghs_source/src/app/game/model/MonsterEntity.ts  (or similar)
_ghs_source/src/app/game/model/Summon.ts
_ghs_source/src/app/game/model/Figure.ts
_ghs_source/src/app/game/model/Entity.ts
_ghs_source/src/app/game/model/Condition.ts
_ghs_source/src/app/game/model/Element.ts
_ghs_source/src/app/game/model/AttackModifier.ts
_ghs_source/src/app/game/model/Loot.ts
_ghs_source/src/app/game/model/Scenario.ts
_ghs_source/src/app/game/model/Party.ts
_ghs_source/src/app/game/model/Campaign.ts
```

Not all filenames may match exactly. Find them:

```powershell
Get-ChildItem -Path "C:\Projects\gloomhaven-command\_ghs_source\src\app\game\model" -Recurse -Filter "*.ts" | Select-Object FullName
```

Read every `.ts` file in that model directory. These define every enum, interface, and class used in the game state. Pay special attention to:
- Enum values for conditions, elements, game phases, entity types
- All properties on each class (many have defaults that won't appear in JSON if unchanged)
- Any inheritance hierarchy (Figure base class, etc.)

Also check the server interaction code:
```powershell
Get-ChildItem -Path "C:\Projects\gloomhaven-command\_ghs_source\src\app" -Recurse -Filter "*.ts" | Where-Object { $_.Name -match "server|websocket|sync|socket" } | Select-Object FullName
```

Read those files to understand the message protocol GHS uses — this confirms the `type: 'game'` and `type: 'game-update'` message formats.

### 0f. Document findings

Create `docs/GHS_STATE_MAP.md`. Must contain:

1. Every top-level key in the real game state JSON, its type, and one-line description
2. Full nested structure for: Character, Monster, MonsterEntity, Summon, EntityCondition, Element, AttackModifierDeck/Card, LootDeck/Card, ScenarioInfo, Party
3. All enum values found (game phases, condition names, element states, entity types, summon colors, attack modifier types, loot card types, etc.)
4. Fields found in GHS TypeScript source that are NOT present in the current save (they appear in other game states or editions)
5. Fields in the JSON dump not covered by our COMMAND_PROTOCOL.md

Keep ≤150 lines. Use compact formatting — tables where possible.

## STEP 1 — Write Type Definitions

Now implement the three type files in `packages/shared/src/types/`. Replace the stubs entirely. Base everything on Step 0 findings.

### `packages/shared/src/types/gameState.ts`

Model every field from the GHS TypeScript source AND the real JSON dump. Include:
- Every top-level GameState field
- Every nested type (Character, Monster, MonsterEntity, Summon, EntityCondition, Element, AttackModifierDeck/Card, LootDeck/Card, ScenarioInfo, PartyInfo, etc.)
- Accurate string literal union types for all enums (use exact values from GHS source)
- Include all GHS fields for compatibility even if we won't use them immediately
- Add `UndoEntry` type for our undo stack (not in GHS, our addition)
- If GHS uses a class hierarchy (Figure → Character), flatten into interfaces but preserve every field

Rules:
- No `any` types
- `unknown` only for genuinely polymorphic fields
- Comment every field whose purpose isn't obvious from the name
- Use exact GHS field names for import/export compatibility

### `packages/shared/src/types/commands.ts`

Define the discriminated command union. Base the command list on every mutation operation possible per the GHS source. At minimum include all 27 from COMMAND_PROTOCOL.md, plus any the investigation reveals.

Include:
- `CommandTarget` discriminated union
- `Command` union of all command types
- `CommandPayload<A>` helper type
- `CommandAction` union of all action string literals

### `packages/shared/src/types/protocol.ts`

WebSocket message envelopes per COMMAND_PROTOCOL.md:
- `ClientMessage` union: ConnectMessage, CommandMessage, PongMessage
- `ServerMessage` union: ConnectedMessage, ReconnectedMessage, DiffMessage, ErrorMessage, PingMessage
- `ClientRole`, `ClientSession`, `StateChange` types

## STEP 2 — Update barrel exports and stubs

Update `packages/shared/src/index.ts` to barrel-export everything.

Update engine stubs (`applyCommand.ts`, `validateCommand.ts`, `turnOrder.ts`) with real types. Each throws `new Error('Not implemented — Phase 1C')`. Correct signatures:

- `applyCommand(state: GameState, command: Command): { state: GameState; changes: StateChange[] }`
- `validateCommand(state: GameState, command: Command): { valid: boolean; error?: string }`
- `getInitiativeOrder(state: GameState): FigureIdentifier[]`
- `getNextFigure(state: GameState): FigureIdentifier | null`

Update utilities:
- `conditions.ts` — FULLY IMPLEMENT using every condition name from the GHS `Condition.ts` source. Export `NEGATIVE_CONDITIONS`, `POSITIVE_CONDITIONS`, `ALL_CONDITIONS`, `isNegativeCondition()`, `isPositiveCondition()`.
- `elements.ts` — Stub `decayElements()` and `createDefaultElementBoard()` with correct types from GHS `Element.ts`.
- `ghsCompat.ts` — Stub `importGhsState()` and `exportGhsState()`.

## STEP 3 — Verification

1. `npx tsc --noEmit` from `packages/shared/` — zero errors
2. No `any` types in gameState.ts or commands.ts
3. Every Command union member has a unique `action` string literal
4. Types align with the real GHS database dump and TypeScript source
5. `docs/GHS_STATE_MAP.md` exists and is ≤150 lines
6. Conditions utility is fully implemented (not stubbed), values match GHS source

## STEP 4 — Commit

```powershell
git add -A
git commit -m "feat(shared): implement type definitions from GHS source investigation

- Investigated GHS SQLite database for actual game state structure
- Read GHS Angular TypeScript model source (Game.ts, Character.ts, etc.)
- Examined GHS data JSONs for character/monster stat structures
- Created docs/GHS_STATE_MAP.md documenting all discovered fields
- GameState types matching real GHS structure exactly
- 27+ Command types covering all gameplay mutations
- WebSocket protocol message envelopes
- Condition constants implemented from GHS Condition.ts source
- Engine and utility stubs with correct type signatures"
git push
```

## STEP 5 — Cleanup

```powershell
Remove-Item _investigate.mjs -ErrorAction SilentlyContinue
Remove-Item _map_structure.mjs -ErrorAction SilentlyContinue
Remove-Item _ghs_state_*.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "C:\Projects\gloomhaven-command\_ghs_source" -ErrorAction SilentlyContinue
```

Report: commit hash, tsc output, total exported type/interface count, and a summary of GHS fields discovered that were NOT in our original architecture docs.
