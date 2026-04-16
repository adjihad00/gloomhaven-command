# Phase 5: Data Import Pipeline — New Conversation Handoff

## For Claude (new conversation context)

You are continuing work on **Gloomhaven Command**, a multi-device companion system for Gloomhaven/Frosthaven tabletop sessions. The codebase is at `https://github.com/adjihad00/gloomhaven-command`.

### What Exists

The system has three working clients (controller on iPad, phone for each player, display on portrait monitor), a Node.js/Express/WebSocket server, and a shared TypeScript game engine. 18 batches of development are complete spanning scenario play, lobby mode, multi-phase setup, phone companion, and a visually rich display client.

**Tech stack:** Node.js 20+, TypeScript, Preact, Express, ws, better-sqlite3, esbuild, vanilla CSS.

**Current data situation:** The app relies on GHS JSON edition files (already populated at `assets/ghs/data/`) for basic monster stats, character data, scenario metadata, and condition definitions. These are consumed via a `/api/data/` REST layer. However, large categories of game data are NOT yet available:
- Monster ability card action text (only card index + initiative are used)
- Scenario special rules, win conditions, loss conditions
- Section book story text and briefings
- Map hex layouts (room shapes, monster positions, overlay tile positions)
- Scenario reward details
- Overlay tile inventories per scenario
- Many visual assets from the physical game components

All of these currently show placeholder text like "See Scenario Book" in the app.

### What You're Building

**Phase 5** is a dedicated data import pipeline phase. The goal is to inventory every data source available, extract and normalize ALL game reference data, store it in a purpose-built SQLite reference database, and expose it via API endpoints — so every placeholder in the app can be replaced with real data.

---

## Data Sources Available

All source material lives in `.staging/` (gitignored, local only). Kyle's local path is `C:\Users\Kyle Diaz\gloomhaven-command\.staging\`.

### 1. `.staging/ghs-client/` — GHS Client Source
The Angular-based Gloomhaven Secretariat app. Key data directories:
- `src/assets/data/{edition}/` — Edition JSON files (already imported to `assets/ghs/data/`)
  - `characters/` — Character JSONs (name, stats per level, ability cards, perks)
  - `monsters/` — Monster JSONs (name, stats per level, count, flying, conditions on attacks)
  - `monster/deck/` — Monster ability deck JSONs (cards with initiative + actions)
  - `scenarios/` — Scenario JSONs (rooms, monsters, rewards, unlocks)
  - `sections/` — Section JSONs (FH section book data)
  - `battle-goals/` — Battle goal card data
  - `items/` — Item data
  - `events/` — City/road/outpost event data
  - `label.json` / `label-spoiler.json` — Localization strings (scenario names, rule text, etc.)
- `src/app/game/model/` — TypeScript type definitions (Action types, monster ability schemas, etc.)

### 2. `.staging/worldhaven/` — Licensed Asset Repository
Community-maintained high-quality game assets. This is the richest visual resource:
- `images/art/frosthaven/scenario-layout/` — **Detailed scenario layout images** showing full map with monster positions, overlay tiles, treasure locations, loot deck config for EVERY FH scenario
- `images/monster-stat-cards/` — Monster stat card images (the physical cards)
- `images/books/` — **Frosthaven and Gloomhaven book images** (scenario book pages, section book pages, rule book pages)
- `images/map-tiles/` — Individual map tile images
- `images/overlay-tiles/` — Overlay tile images (traps, obstacles, hazardous terrain, etc.)
- `images/monsters/` — Monster artwork/portraits
- `images/characters/` — Character artwork/portraits
- `images/items/` — Item card images
- `images/battle-goals/` — Battle goal card images
- `images/events/` — Event card images
- `images/ability-cards/` — Character ability card images
- `images/attack-modifiers/` — Attack modifier card images
- `images/summons/` — Summon token images

### 3. `.staging/ghs-server/` — GHS Server Source
The Java WebSocket server. May contain additional data processing logic or schemas.

### 4. `.staging/creator-pack/` — Official Cephalofair Creator Pack
Official assets from the game publisher. May include high-res versions of game components.

### 5. `.staging/nerdhaven/` — Community Custom Assets
Community-created content. May include custom scenarios, characters, or enhanced assets.

### 6. Project Knowledge PDFs
Kyle has Frosthaven book PDFs loaded as project knowledge:
- `fhscenariobook*.pdf` — Frosthaven scenario book (multiple parts)
- `fhsectionbook*.pdf` — Frosthaven section book (multiple parts)
- `fhstartingguide.pdf` — Starting guide
- `fhpuzzlebook.pdf` — Puzzle book
- `fhsoloscenariobook.pdf` — Solo scenarios

---

## Phase 5 Prompt Structure

Phase 5 is too large for a single prompt. It should be broken into sub-prompts:

### Prompt 5.1: Full Inventory & Schema Design
- Exhaustively inventory every directory in `.staging/` — list file types, counts, naming conventions, sample contents
- Inventory what's already in `assets/ghs/data/` — which GHS JSON files are imported and which fields are being used
- Identify every data gap between what the app needs and what's currently available
- Cross-reference GHS JSON data against worldhaven images to determine: which data is parseable from JSON vs. which needs OCR/manual entry from images
- Design the SQLite reference database schema covering ALL game reference data
- Document the schema with table definitions, relationships, and example queries
- Produce a data import plan with priorities and dependencies

### Prompt 5.2: GHS JSON Import
- Parse and import all structured GHS JSON data into the reference database
- Monster stats, ability cards (with full action text/icons), character data, scenario metadata, battle goals, items, events, sections, label text
- Normalize the GHS data model into clean relational tables
- Build API endpoints to query the new database
- Verify imported data against known game values

### Prompt 5.3: Asset Migration & Image Database
- Catalog all image assets from worldhaven, creator-pack, and nerdhaven
- Copy/link relevant assets into the app's `assets/` directory structure
- Build an asset manifest mapping game concepts to image paths
- Parse scenario layout images from worldhaven to extract monster positions, overlay tile placement (this may require manual data entry or OCR)
- Store asset references in the database

### Prompt 5.4: Scenario Data Enrichment
- Parse scenario book and section book data (from GHS JSONs, label files, and/or PDFs)
- Store scenario rules, win conditions, loss conditions, story text, rewards
- Build the map layout database (hex grids, room shapes, monster spawn positions per player count)
- Store overlay tile requirements per scenario/room
- Build API endpoints for scenario preview, briefing, and room reveal data

### Prompt 5.5: API Layer & Integration
- Build/extend the `/api/data/` REST endpoints for all new reference data
- Wire the display's placeholder screens to real data
- Wire the controller's scenario preview to real data
- Wire the phone's scenario briefing to real data
- Remove all "See Scenario Book" placeholders

---

## Database Design Principles

**Separate SQLite database** (`data/reference.db` or `server/data/gamedata.db`):
- Immutable reference data only — never written during gameplay
- Populated by a build/import script (`scripts/import-data.ts` or similar)
- Read by the server's API layer via `better-sqlite3` (already in deps)
- Can be regenerated from source at any time by rerunning the import script
- Ships as a single file — easy to version, backup, or replace

**Schema principles:**
- Edition-aware: every table includes an `edition` column (gh, fh, jotl, etc.)
- Normalized: monsters, abilities, scenarios, rooms are separate tables with foreign keys
- Level-aware: monster stats are stored per-level, queryable by scenario level
- Player-count-aware: monster spawn data stores per-player-count variants
- Action schema: monster ability card actions stored as structured JSON within SQLite (JSON functions for querying), not as a deeply normalized action tree

**API principles:**
- Extend existing `/api/data/` prefix
- RESTful: `/api/data/{edition}/scenario/{index}`, `/api/data/{edition}/monster/{name}/ability-deck`
- Return fully resolved data (no client-side joins)
- Cache-friendly: reference data is immutable, responses can use `Cache-Control: public, max-age=86400`

---

## Priority Order Within Phase 5

1. **Monster ability cards** — highest leverage. Unlocks the display's ability card section (currently showing initiative only), enables future automation of monster actions, and is the data players reference most during play.

2. **Scenario rules/conditions** — replaces "See Scenario Book" on display footer and phone briefing. Needed for the setup workflow's rules phase.

3. **Monster stat cards** — some data already flows via `useDisplayMonsterData` hook, but completeness needs verification. Flying, shield, retaliate, conditions on attacks, immunities, per-level stats.

4. **Scenario map layouts** — needed for the door-opening room map display and setup chore assignments. The worldhaven scenario layout images are the primary source.

5. **Section book text** — scenario briefings, story text, door-reveal section text. Lower priority for gameplay but high value for immersion.

6. **Items, events, campaign data** — needed for Town Mode (Phase T) but not for scenario play.

---

## Key Files for Context

```
# Current data layer
server/src/dataApi.ts              — Existing /api/data/ routes
server/src/staticServer.ts         — Static file serving (assets)
assets/ghs/data/                   — Current GHS JSON files
packages/shared/src/data/types.ts  — Data type definitions

# Consumers that need real data (currently using placeholders)
app/display/ScenarioView.tsx                      — "See Scenario Book" footer
app/display/components/DisplayMonsterAbility.tsx   — Initiative only, no action text
app/display/components/DisplayFigureCard.tsx        — Monster stats (partially wired)
app/display/components/DisplayScenarioFooter.tsx    — Rules/conditions placeholders
app/controller/LobbyView.tsx                       — Scenario preview (partial data)
app/phone/overlays/PhoneRulesOverlay.tsx            — Rules briefing (placeholder)

# Project docs (READ ALL before starting)
docs/PROJECT_CONTEXT.md
docs/DESIGN_DECISIONS.md
docs/APP_MODE_ARCHITECTURE.md
docs/COMMAND_PROTOCOL.md
docs/GHS_AUDIT.md                — Most comprehensive reference for GHS data structure
docs/GHS_STATE_MAP.md            — Field-level state reference
docs/GAME_RULES_REFERENCE.md     — Authoritative game rules
docs/ROADMAP.md
docs/BUGFIX_LOG.md
app/CONVENTIONS.md               — Code conventions (BEM, Preact, etc.)
```

---

## What Success Looks Like

After Phase 5 is complete:
- A single `reference.db` SQLite file contains ALL game reference data for GH, FH, and other supported editions
- A `scripts/import-data.ts` script regenerates the database from source files
- The `/api/data/` layer serves fully resolved data from the reference DB
- The display shows real monster ability card actions (Move +2, Attack +3, Shield 1, etc.) instead of just initiative numbers
- The display footer shows real scenario rules, win conditions, and loss conditions
- The controller's scenario preview shows complete scenario data
- The phone's rules briefing shows real scenario information
- An asset manifest maps every game concept to its image path(s)
- All "See Scenario Book" placeholders are eliminated

---

## DO NOT

- Modify game state or the mutable SQLite database — reference data is separate
- Break existing API endpoints — extend, don't replace
- Hard-code data that should be in the database
- Skip the inventory step — unknown data in `.staging/` may contain exactly what's needed
- Assume GHS JSON is complete — cross-reference against worldhaven images and book PDFs
- Parse PDFs unless JSON/image sources are insufficient — PDFs are the last resort
- Import spoiler content without flagging it (locked character names, scenario rewards, etc.)
