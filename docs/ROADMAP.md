# Gloomhaven Command — Roadmap

## Phase 1: Server + Shared Library
- [x] Define GameState types (gameState.ts) by mapping GHS JSON structure
- [x] Define Command types (commands.ts) — all 33 command payloads
- [x] Define Protocol types (protocol.ts) — WS message envelopes
- [x] Implement applyCommand engine — pure state mutations
- [x] Implement validateCommand — guard invalid mutations
- [x] Implement turnOrder — initiative sort, phase transitions
- [x] Implement conditions utility — lists, toggle logic, expiry
- [x] Implement elements utility — element board decay per round
- [x] Implement ghsCompat — import/export GHS JSON saves
- [x] Implement diffStates — entity-level diff generation + client-side applyDiff
- [x] Build Express static server (staticServer.ts)
- [x] Build WebSocket hub (wsHub.ts) — connect, broadcast, heartbeat
- [x] Build session manager — tokens, revision tracking, replay buffer
- [x] Build game store — SQLite persistence, load/save
- [x] Build command handler — validate → apply → persist → broadcast
- [x] Integration test: connect two clients, send commands, verify sync
- [x] GHS JSON import endpoint — POST /api/import

## Phase 2: Controller Client
- [x] Scaffold controller HTML + TypeScript entry
- [x] Implement connection UI (setup screen)
- [x] Implement shared WebSocket client (clients/shared/lib/connection.ts)
- [x] Implement client-side state store with diff application
- [x] Build Active Play tab — initiative timeline, health, conditions, turns
- [x] Build Monster Management tab — ability cards, standees, modifier deck
- [x] Build Scenario tab — room reveals, element board, round counter
- [x] Build Loot & Decks tab — loot draw/assign, modifier deck state
- [x] Build Campaign tab — party sheet, unlocks, scenario tracking
- [x] Responsive iPad landscape layout, tab navigation

## Phase R: Controller Rebuild (replaces original Phase 2)
- [x] R1: Data layer — edition file loading, stat lookups, scenario auto-spawn
- [x] R2: Preact app scaffold — three entry points, hooks, mode routing, connection screens
- [x] R3: Core shared components + asset population
- [x] R4: Controller single-screen view — ScenarioView with overlays
- [x] R5: Scenario automation — data-driven setup, auto-spawn, room reveals
- [x] R6: Round flow automation — ability draw, turn order, auto-advance, condition/element automation

## Phase R: Controller Rebuild — Post-R6 Batches (bug fixes + polish)
- [x] R7-R8: Interaction fixes — condition picker, door confirm, modifier overlay, absent bench
- [x] R9: XP system overhaul — dual tracking, scenario-end transfer, fill bar
- [x] R10: Icon system — GHS assets + custom SVGs for game-consistent iconography
- [x] R11: PWA + reconnect + setup wizard + FH loot deck
- [x] R12: Game logic — long rest heal, bless/curse removal, scenario cleanup, GH gold

- [x] R13: UX + connection — heartbeat, resources, conditions, z-index, summary

## Phase R: Controller Rebuild — COMPLETE

## Phase 3: Phone Client — Scenario View
- [x] Scaffold phone HTML + TypeScript entry (Phase R2)
- [x] Character selection/registration on connect (Phase R2)
- [x] Character-scoped ScenarioView — health bar, initiative, conditions, XP, loot, summons
- [x] Initiative input with phase-aware numpad overlay
- [x] Turn banner with active/waiting/done states
- [x] Action bar — end turn, long rest toggle, exhaust with confirmation
- [x] Condition strip + condition picker overlay (edition-aware)
- [x] XP + Loot counter row
- [x] Summon section with expandable HP controls
- [x] Character detail overlay (full controls, XP progress, condition grid)
- [x] Dark fantasy CSS styling — stone buttons, carved health bar, candlelight glow
- [x] Loot interaction — FH loot deck draw via PhoneLootDeckPopup, loot counter read-only
- [x] Server-side permission enforcement per character
- [x] Batch 15: Phone view adjustments
  - [x] Element board (PhoneElementRow) — interactive during active turn only
  - [x] Initiative timeline (PhoneInitiativeTimeline) — auto-show/dismiss lifecycle
  - [x] Condition splash (PhoneConditionSplash) — priority queue, per-condition CSS effects
  - [x] Exhaust auto-popup (PhoneExhaustPopup) — replaces manual exhaust button
  - [x] Loot deck draw popup (PhoneLootDeckPopup) — FH loot card draw/assign
  - [x] Per-character accent theming — CSS custom properties from edition data
  - [x] Landscape two-column layout — CSS Grid at max-height 500px
  - [x] Swipe-to-close on character detail overlay
  - [x] Phone global commands (moveElement, drawLootCard) — bypass character-name check
  - [x] Summon section stubbed (deferred for joint controller development)
  - [x] Two-phase scenario end (prepareScenarioEnd/cancelScenarioEnd/completeScenario)
  - [x] Phone rewards overlay — auto-triggered on all phones, shows XP/gold/resources preview
  - [x] FH loot card viewer in character detail overlay
  - [x] Character switch button in detail overlay

## Phase 4: Display Client
- [ ] Scaffold display HTML + TypeScript entry
- [ ] Portrait vertical tower layout
- [ ] Initiative timeline (vertical, top-to-bottom)
- [ ] Character panels — health, conditions, active summons
- [ ] Monster panels — ability card, standee health/conditions
- [ ] Element board display
- [ ] Round/scenario info header
- [ ] Auto-reconnect, no interaction needed

## Phase 5: Polish & Compatibility
- [ ] GHS save file import/export UI in controller
- [ ] Campaign persistence across sessions
- [x] Undo/redo stack (bounded, 50 actions)
- [x] Scenario setup wizard in controller (batch 11)
- [ ] Monster stat reference overlay
- [x] PWA manifests for phone + controller (batch 11)
- [x] Content-hashed JS bundles + auto-generated SW precache (batch 14)
- [ ] Docker image for server deployment
- [ ] README with setup instructions
