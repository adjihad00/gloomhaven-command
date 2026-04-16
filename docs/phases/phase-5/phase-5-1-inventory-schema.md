# Phase 5.1: Full Inventory & Schema Design — Claude Code Prompt

## Context

You are working on **Gloomhaven Command** (`adjihad00/gloomhaven-command`), a multi-device companion system for Gloomhaven/Frosthaven tabletop sessions. The repo uses Node.js 20+, TypeScript, Preact, Express, ws, better-sqlite3, esbuild, vanilla CSS.

**Goal of Phase 5:** Build a data import pipeline that extracts ALL game reference data, stores it in a purpose-built SQLite reference database, and exposes it via API endpoints — replacing every placeholder in the app with real data.

**Goal of this prompt (5.1):** Exhaustive inventory of all data sources, identify every gap, design the SQLite reference database schema, and produce a data import plan.

---

## CRITICAL: Codebase Reality Check

The following verified facts about the repo at commit `ec1df71` (batch-18) MUST be used instead of any assumptions:

### 1. No `server/src/dataApi.ts` — routes are inline
All `/api/data/` routes are in `server/src/index.ts` lines 108–162. The server also has `server/src/dataLoader.ts` (implements `FileSystemDataLoader`). When adding new endpoints, extend `index.ts` or extract a new `dataApi.ts` module.

### 2. Data path: server looks for `assets/data/` then `.staging/ghs-client/data/`
`server/src/index.ts` line 27: `resolve(rootDir, 'assets', 'data')` — NOT `assets/ghs/data/`. Falls back to `.staging/ghs-client/data/` at line 28. Kyle's dev setup uses the `.staging/` fallback.

### 3. Monster ability data is PARTIALLY wired — not absent
`app/display/hooks/useDisplayMonsterData.ts` already fetches real ability deck data via `/api/data/{edition}/monster-deck/{name}` and extracts actions. Current limitations:
- **Only 5 of ~20+ action types extracted** (line 76): `move`, `attack`, `range`, `shield`, `heal`
- Missing: `retaliate`, `condition`, `element`, `elementHalf`, `summon`, `target`, `push`, `pull`, `pierce`, `flying`, `jump`, `specialTarget`, `teleport`, `loot`, `suffer`, etc.
- Ability card names show `Card ${card.cardId}` — label data isn't loaded, so real names unavailable
- All types use `MockMonsterAbility`/`MockAbilityAction` from `mockData.ts` — needs decoupling to shared types
- Sub-actions and complex action trees are ignored

### 4. DataManager loads only 5 data categories
`packages/shared/src/data/index.ts` loads: `base.json`, `character/*.json`, `monster/*.json`, `monster/deck/*.json`, `scenarios/*.json`. Does NOT load: labels, sections, items, events, battle goals, campaign, treasures, buildings, personal quests.

### 5. Battle goals endpoint bypasses DataManager
`server/src/index.ts` line 147: reads directly from `stagingDataPath` via `readFileSync`.

### 6. Scenario `rules` and `sections` fields typed as `unknown[]`
`packages/shared/src/data/types.ts` lines 139-140. The JSON data has them, but no typed interface.

### 7. Engine already processes monster ability actions
Batch 18a added: `processMonsterAbilityActions()` (consume elements at activation, infuse at deactivation, summon monsters), `drawAbilitiesForNewMonsters()`, `groupMonstersByDeck()`, `collectActions()`, dead standee cleanup at end-of-round, room reveal mid-round ability draws. The engine uses action types `element`, `elementHalf`, and `summon` from the GHS data.

### 8. DataContext interface (engine's data API)
```typescript
export interface DataContext {
  getCharacterMaxHealth(edition: string, name: string, level: number): number;
  getMonsterMaxHealth(edition: string, name: string, level: number, type: string): number;
  getMonsterStats(edition: string, name: string, level: number, type: string): MonsterLevelStats | null;
  getScenario(edition: string, index: string): ScenarioData | null;
  resolveRoomSpawns(scenario: ScenarioData, roomNumber: number, playerCount: number): ResolvedSpawn[];
  getMonsterDeckForMonster(edition: string, monsterName: string): MonsterAbilityDeckData | null;
  getMonster(edition: string, name: string): MonsterData | null;
}
```

### 9. Mutable game DB at `data/ghs.sqlite`
`server/src/index.ts` line 231. The `data/` directory is gitignored. Reference DB → `data/reference.db`.

### 10. Existing API endpoints (complete list)
```
GET /api/data/editions
GET /api/data/:edition/characters
GET /api/data/:edition/monsters
GET /api/data/:edition/scenarios
GET /api/data/:edition/character/:name
GET /api/data/:edition/monster/:name
GET /api/data/:edition/scenario/:index
GET /api/data/:edition/monster-deck/:name
GET /api/data/:edition/battle-goals        ← bypasses DataManager
GET /api/data/level-calc
```

### 11. Verified placeholder locations (all say "See Scenario Book")
```
app/display/ScenarioView.tsx:280-282              — footer specialRules, winConditions, lossConditions
app/controller/overlays/SetupPhaseOverlay.tsx:120-121,129
app/controller/overlays/ScenarioSetupOverlay.tsx:54,382,389
app/controller/LobbyView.tsx:45,569
app/phone/overlays/PhoneRulesOverlay.tsx:61-62,69
app/phone/LobbyView.tsx:119
```

---

## Step 1: Inventory `.staging/` Directory

Kyle's local path: `C:\Users\Kyle Diaz\gloomhaven-command\.staging\`

### 1a. GHS Client Data (`.staging/ghs-client/data/`)

For EACH edition directory (gh, fh, jotl, fc, cs, toa, etc.), inventory:

```
base.json                    — exists? fields?
character/*.json             — count, sample structure
character/deck/*.json        — count, does this exist for all editions?
monster/*.json               — count
monster/deck/*.json          — count
scenarios/*.json             — count
sections/                    — exists? file count, naming, JSON structure?
label/en.json                — EXISTS? THIS IS CRITICAL. Document FULL key structure:
                               - scenario names keys?
                               - monster ability card name keys?
                               - scenario rules text keys?
                               - win/loss condition keys?
                               - section book text keys?
label-spoiler/en.json        — exists? what spoiler text does it add?
campaign.json                — exists? structure?
events.json                  — exists? structure?
items.json                   — exists? structure?
treasures.json               — exists? structure?
battle-goals.json            — exists? structure? (currently read raw at line 147)
buildings.json               — exists? (FH)
personal-quests.json         — exists?
favors.json                  — exists?
challenges.json              — exists?
trials.json                  — exists?
pets.json                    — exists?
Any other .json files?
```

**Deep-dive priorities:**

1. **`label/en.json`** — This is likely where ALL human-readable text lives (scenario names, ability card names, scenario rules, win/loss conditions, section book text). Document its complete key namespace with examples.

2. **`sections/`** — FH uses section-based reveals. What's the JSON structure? Does it include narrative text, monster spawns, rule changes?

3. **`scenarios/*.json` → `rules[]` and `sections[]` fields** — Currently typed as `unknown[]`. Open 2-3 scenario files and document the ACTUAL JSON structure of these fields with full examples.

4. **Monster ability deck action types** — Grep across ALL `monster/deck/*.json` files in ALL editions. List EVERY unique `action.type` string value found. This determines the scope of the display component's action renderer. Known so far: `move`, `attack`, `shield`, `retaliate`, `condition`, `element`, `elementHalf`, `summon`, `heal`, `target`, `range`. What else?

5. **Monster ability deck `actions[]` deep structure** — Document the full depth of sub-actions, valueType variants, special value formats (like `elementHalf` using `"fire:ice"` colon-separated format). Show 3-4 complex examples from actual deck files.

### 1b. GHS Client Images (`.staging/ghs-client/src/assets/images/`)
```
List all subdirectories and sample contents:
- condition/        — SVG condition icons (already used)
- element/          — SVG element icons (already used)
- character/        — thumbnails (already used) + what else?
- monster/          — thumbnails (already used) + what else?
- action/           — action type icons? (move, attack, shield, etc.)
- attackModifier/   — AMD card images?
- What else exists?
```

### 1c. Worldhaven (`.staging/worldhaven/`)
```
List all top-level image directories with counts:
- images/art/frosthaven/scenario-layout/    — FH scenario layout images (count?)
- images/monster-stat-cards/                — stat card images (count?)
- images/books/                             — book page images?
- images/map-tiles/                         — map tile images (count?)
- images/overlay-tiles/                     — overlay tiles (count?)
- images/monsters/                          — monster artwork (count?)
- images/characters/                        — character artwork (count?)
- images/items/                             — item cards (count?)
- images/battle-goals/                      — battle goal cards (count?)
- images/events/                            — event cards (count?)
- images/ability-cards/                     — character ability cards (count?)
- images/attack-modifiers/                  — AMD card images (count?)
- images/summons/                           — summon tokens (count?)
- Any data files (JSON/CSV) beyond images?
```

### 1d. Other Sources
```
.staging/ghs-server/    — any data files, schemas, or data processing code?
.staging/creator-pack/  — directory listing, what's useful for the app?
.staging/nerdhaven/     — directory listing, what's useful?
```

---

## Step 2: Gap Analysis

After completing the inventory, produce this gap analysis table. Classify each data need:

- **JSON-ready**: Structured data in GHS JSON, just needs import + proper typing
- **Label-ready**: Text in `label/en.json`, needs key mapping
- **Partial**: Some data exists, needs completion or cross-referencing
- **Image-only**: Only in images (stat cards, layout images) — needs OCR or manual entry
- **PDF-only**: Only in Frosthaven book PDFs — last resort
- **Not available**: No source found

```
| # | Data Need                        | Source(s)                    | Status      | Priority |
|---|----------------------------------|------------------------------|-------------|----------|
| 1 | Monster ability card names       | label/en.json?               | ?           | P1       |
| 2 | Monster ability full actions     | monster/deck/*.json          | Partial     | P1       |
|   | (all action types + sub-actions) |                              | (5/20+ types)          |
| 3 | Scenario special rules text      | label? scenarios? sections?  | ?           | P2       |
| 4 | Scenario win conditions text     | label? scenarios?            | ?           | P2       |
| 5 | Scenario loss conditions text    | label? scenarios?            | ?           | P2       |
| 6 | Monster stat card completeness   | monster/*.json               | Mostly done | P3       |
|   | (flying, shield, retaliate,      |                              |             |          |
|   |  immunities, conditions on atk)  |                              |             |          |
| 7 | Map hex layouts                  | worldhaven images?           | ?           | P4       |
| 8 | Section book text/briefings      | sections/*.json? label?      | ?           | P5       |
| 9 | Item catalog                     | items.json                   | Not loaded  | P6       |
| 10| Event cards                      | events.json                  | Not loaded  | P6       |
| 11| Campaign structure               | campaign.json                | Not loaded  | P6       |
| 12| Personal quests                  | personal-quests.json?        | ?           | P6       |
| 13| FH buildings                     | buildings.json?              | ?           | P6       |
| 14| Treasures                        | treasures.json?              | ?           | P6       |
| 15| Scenario rewards detail          | scenarios/*.json rewards{}   | Partial     | P6       |
```

Update this table with actual findings from the inventory.

---

## Step 3: Design SQLite Reference Database Schema

Create schema for `data/reference.db` (alongside existing `data/ghs.sqlite`).

### Design constraints:
- **Immutable**: Never written during gameplay. Populated by import script only.
- **Edition-aware**: Every table has `edition TEXT NOT NULL`.
- **Level-aware**: Monster stats per level per type.
- **Player-count-aware**: Spawn data per player count.
- **JSON for complex nested data**: Actions, rewards, sub-actions stored as JSON TEXT columns. Use SQLite `json_extract()` for querying when needed.
- **Regenerable**: `scripts/import-data.ts` recreates entire DB from `.staging/` source files.

### Proposed tables — adjust based on inventory findings:

```sql
-- ═══════════════════════════════════════════════════════════════════
-- CORE TABLES (P1-P2: Monster abilities + Scenario text)
-- ═══════════════════════════════════════════════════════════════════

-- Monster ability decks (one row per deck)
CREATE TABLE monster_ability_decks (
  edition TEXT NOT NULL,
  deck_name TEXT NOT NULL,
  PRIMARY KEY (edition, deck_name)
);

-- Monster ability cards (one row per card in a deck)
CREATE TABLE monster_ability_cards (
  edition TEXT NOT NULL,
  deck_name TEXT NOT NULL,
  card_id INTEGER NOT NULL,
  name TEXT,                    -- from label/en.json (null if unavailable)
  initiative INTEGER NOT NULL,
  shuffle INTEGER NOT NULL DEFAULT 0,   -- boolean: shuffle deck after round
  actions_json TEXT NOT NULL,   -- full action tree as JSON array
  PRIMARY KEY (edition, deck_name, card_id),
  FOREIGN KEY (edition, deck_name) REFERENCES monster_ability_decks(edition, deck_name)
);

-- Scenario text: rules, win/loss conditions, intro, conclusion
CREATE TABLE scenario_text (
  edition TEXT NOT NULL,
  scenario_index TEXT NOT NULL,
  group_name TEXT DEFAULT '',
  text_type TEXT NOT NULL,      -- 'special_rules', 'win_condition', 'loss_condition', 'introduction', 'conclusion'
  text_content TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (edition, scenario_index, group_name, text_type, sort_order)
);

-- Section book entries (FH section-based reveals, briefings)
CREATE TABLE sections (
  edition TEXT NOT NULL,
  section_id TEXT NOT NULL,
  title TEXT,
  text_content TEXT,
  triggers_json TEXT,           -- what this section triggers (spawns, rules, unlocks)
  PRIMARY KEY (edition, section_id)
);

-- ═══════════════════════════════════════════════════════════════════
-- REFERENCE TABLES (P3-P5: Existing data, normalized for fast lookup)
-- ═══════════════════════════════════════════════════════════════════

-- Editions
CREATE TABLE editions (
  edition TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  conditions_json TEXT NOT NULL,    -- JSON array of condition names
  logo_url TEXT
);

-- Characters
CREATE TABLE characters (
  edition TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT,               -- from label/en.json
  class TEXT,
  color TEXT,
  hand_size INTEGER,
  spoiler INTEGER DEFAULT 0,       -- 1 = locked class (hide name)
  stats_json TEXT NOT NULL,        -- [{level, health}]
  perks_json TEXT,                 -- full perk definitions
  PRIMARY KEY (edition, name)
);

-- Monsters
CREATE TABLE monsters (
  edition TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT,               -- from label/en.json
  deck_name TEXT,                  -- shared ability deck (defaults to name)
  standee_count INTEGER,
  is_boss INTEGER DEFAULT 0,
  is_flying INTEGER DEFAULT 0,
  base_stats_json TEXT,            -- immunities, boss specials
  PRIMARY KEY (edition, name)
);

-- Monster stats per level per type
CREATE TABLE monster_stats (
  edition TEXT NOT NULL,
  monster_name TEXT NOT NULL,
  level INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'normal',   -- 'normal', 'elite', 'boss'
  health INTEGER NOT NULL,               -- or TEXT if boss uses "8xC" formulas
  movement INTEGER NOT NULL,
  attack INTEGER NOT NULL,
  range_val INTEGER,                     -- null = melee
  actions_json TEXT,                     -- shield, retaliate, conditions, immunities
  immunities_json TEXT,
  PRIMARY KEY (edition, monster_name, level, type)
);

-- Scenarios (metadata)
CREATE TABLE scenarios (
  edition TEXT NOT NULL,
  scenario_index TEXT NOT NULL,
  group_name TEXT DEFAULT '',
  name TEXT NOT NULL,
  complexity INTEGER,
  is_initial INTEGER DEFAULT 0,
  unlocks_json TEXT,
  links_json TEXT,
  rewards_json TEXT,
  monsters_json TEXT,               -- list of monster names in scenario
  allies_json TEXT,
  loot_deck_config_json TEXT,
  rules_json TEXT,                  -- structured rules from GHS JSON
  sections_json TEXT,               -- section references from GHS JSON
  PRIMARY KEY (edition, scenario_index, group_name)
);

-- Scenario rooms
CREATE TABLE scenario_rooms (
  edition TEXT NOT NULL,
  scenario_index TEXT NOT NULL,
  group_name TEXT DEFAULT '',
  room_number INTEGER NOT NULL,
  ref TEXT NOT NULL,
  is_initial INTEGER DEFAULT 0,
  connected_rooms_json TEXT,
  marker TEXT,
  treasures_json TEXT,
  PRIMARY KEY (edition, scenario_index, group_name, room_number)
);

-- Scenario monster spawns per room
CREATE TABLE scenario_spawns (
  edition TEXT NOT NULL,
  scenario_index TEXT NOT NULL,
  group_name TEXT DEFAULT '',
  room_number INTEGER NOT NULL,
  spawn_index INTEGER NOT NULL,    -- order within room
  monster_name TEXT NOT NULL,
  always_type TEXT,                 -- 'normal'/'elite'/'boss' if always-spawn
  player2_type TEXT,                -- type at 2+ players
  player3_type TEXT,                -- type at 3+ players
  player4_type TEXT,                -- type at exactly 4 players
  marker TEXT,
  PRIMARY KEY (edition, scenario_index, group_name, room_number, spawn_index)
);

-- ═══════════════════════════════════════════════════════════════════
-- CAMPAIGN TABLES (P6: Town mode / future phases)
-- ═══════════════════════════════════════════════════════════════════

-- Labels (all localized strings, key-value)
CREATE TABLE labels (
  edition TEXT NOT NULL,
  key TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  value TEXT NOT NULL,
  PRIMARY KEY (edition, key, locale)
);

-- Items
CREATE TABLE items (
  edition TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  name TEXT,
  cost INTEGER,
  slot TEXT,
  count INTEGER,
  effects_json TEXT,
  resources_json TEXT,           -- FH crafting costs
  PRIMARY KEY (edition, item_id)
);

-- Battle goals
CREATE TABLE battle_goals (
  edition TEXT NOT NULL,
  card_id INTEGER NOT NULL,
  name TEXT,
  description TEXT,
  checks INTEGER,
  PRIMARY KEY (edition, card_id)
);

-- Events
CREATE TABLE events (
  edition TEXT NOT NULL,
  event_type TEXT NOT NULL,      -- 'road', 'city', 'outpost'
  event_id INTEGER NOT NULL,
  option_a_json TEXT,
  option_b_json TEXT,
  PRIMARY KEY (edition, event_type, event_id)
);

-- Campaign structure (generic key-value for edition-specific data)
CREATE TABLE campaign_data (
  edition TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  PRIMARY KEY (edition, key)
);

-- Asset manifest (maps game concepts to file paths)
CREATE TABLE asset_manifest (
  edition TEXT NOT NULL,
  category TEXT NOT NULL,        -- 'character', 'monster', 'condition', 'element', 'map-tile', etc.
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  PRIMARY KEY (edition, category, name)
);
```

### Index strategy:
```sql
CREATE INDEX idx_monster_stats_lookup ON monster_stats(edition, monster_name, level, type);
CREATE INDEX idx_ability_cards_deck ON monster_ability_cards(edition, deck_name);
CREATE INDEX idx_scenario_rooms ON scenario_rooms(edition, scenario_index, room_number);
CREATE INDEX idx_scenario_text ON scenario_text(edition, scenario_index, text_type);
CREATE INDEX idx_labels_lookup ON labels(edition, key);
CREATE INDEX idx_spawns_room ON scenario_spawns(edition, scenario_index, room_number);
```

---

## Step 4: Data Import Plan

Produce a prioritized import plan with dependencies:

### Phase 5.2: GHS JSON Import (highest priority)
1. **Monster ability cards** — Parse all `monster/deck/*.json`, cross-reference with `label/en.json` for card names, store complete action trees as JSON
2. **Scenario rules/conditions** — Parse `scenarios/*.json` `rules[]` field, cross-reference with `label/en.json` for text, extract win/loss/special rules
3. **Section book data** — Parse `sections/*.json` if they exist, store narrative text
4. **Labels** — Bulk import `label/en.json` into labels table for runtime lookup
5. **All existing data** — Re-import characters, monsters, monster stats, scenarios into normalized tables (currently only in DataManager memory)

### Phase 5.3: Asset Migration
6. **Image manifest** — Catalog all images from worldhaven, GHS client, creator pack
7. **Asset path mapping** — Build asset_manifest table

### Phase 5.4: Scenario Enrichment
8. **Map layouts** — If structured data exists in JSON, import it. If image-only, defer
9. **Rewards detail** — Extract from scenarios + labels

### Phase 5.5: API + Integration
10. **New API endpoints** — Extend `/api/data/` for all new tables
11. **Wire consumers** — Replace all "See Scenario Book" placeholders
12. **Decouple mock types** — Replace `MockMonsterAbility`/`MockAbilityAction` with proper shared types

---

## Deliverables

At the end of this prompt, produce:

1. **Complete inventory report** — every file type, count, and sample structure found in `.staging/`
2. **Gap analysis table** — updated with real findings, classified by source availability
3. **Final schema SQL** — adjusted based on what the inventory reveals
4. **Import plan** — ordered steps with file counts, estimated complexity, and dependencies
5. **Action type catalog** — every unique `action.type` string across all monster ability decks, with examples of how each is structured in the JSON

---

## DO NOT

- Modify game state or the mutable SQLite database (`data/ghs.sqlite`)
- Break existing API endpoints
- Hard-code data that should be in the database
- Skip the inventory step
- Assume GHS JSON is complete without checking
- Parse PDFs unless JSON/label sources are insufficient
- Import spoiler content without flagging it
