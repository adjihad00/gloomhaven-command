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

## Phase 3: Phone Client
- [ ] Scaffold phone HTML + TypeScript entry
- [ ] Character selection/registration on connect
- [ ] Character-scoped view — health, XP, conditions, gold, items
- [ ] Initiative input with phase-aware locking
- [ ] Turn actions — end turn, long rest
- [ ] Loot interaction — view drawn cards, assign
- [ ] Server-side permission enforcement per character

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
- [ ] Docker image for server deployment
- [ ] README with setup instructions
