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
- [ ] Build Express static server (staticServer.ts)
- [ ] Build WebSocket hub (wsHub.ts) — connect, broadcast, heartbeat
- [ ] Build session manager — tokens, revision tracking, replay buffer
- [ ] Build game store — SQLite persistence, load/save
- [ ] Build command handler — validate → apply → persist → broadcast
- [ ] Integration test: connect two clients, send commands, verify sync
- [ ] GHS JSON import endpoint — POST /api/import

## Phase 2: Controller Client
- [ ] Scaffold controller HTML + TypeScript entry
- [ ] Implement connection UI (setup screen)
- [ ] Implement shared WebSocket client (clients/shared/lib/connection.ts)
- [ ] Implement client-side state store with diff application
- [ ] Build Active Play tab — initiative timeline, health, conditions, turns
- [ ] Build Monster Management tab — ability cards, standees, modifier deck
- [ ] Build Scenario tab — room reveals, element board, round counter
- [ ] Build Loot & Decks tab — loot draw/assign, modifier deck state
- [ ] Build Campaign tab — party sheet, unlocks, scenario tracking
- [ ] Responsive iPad landscape layout, tab navigation

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
- [ ] Undo/redo stack (bounded, 50 actions)
- [ ] Scenario setup wizard in controller
- [ ] Monster stat reference overlay
- [ ] PWA manifests for phone + controller
- [ ] Docker image for server deployment
- [ ] README with setup instructions
