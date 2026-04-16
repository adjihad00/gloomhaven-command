# Gloomhaven Command — Project Context

## Identity
Gloomhaven Command is a multi-device companion system for Gloomhaven/Frosthaven
tabletop sessions. It replaces the patchwork of GHS + ghs-server + custom
controller/phone HTML files with a unified, ground-up architecture.

## Architecture
Server-authoritative command-based system. Clients send small command messages.
Server validates, applies via shared engine, persists to SQLite, broadcasts diffs.

### Components
- **Server** (`server/`): Node.js, Express, ws library, better-sqlite3.
  Single process serves HTTP static files + WebSocket on one port.
- **Shared Engine** (`packages/shared/`): TypeScript. Pure functions for
  game state mutations, validation, turn order, element decay, GHS compat.
- **Shared Components** (`app/components/`): Preact component library shared
  across all three clients. CharacterBar, MonsterGroup, ModifierDeck,
  InitiativeDisplay, ConditionGrid, ElementBoard, etc.
- **Controller Client** (`app/controller/`): iPad landscape. Single-screen
  ScenarioView with overlays. Setup wizard (edition → characters → scenario).
  Initiative numpad, modifier deck controls, door reveals.
- **Phone Client** (`app/phone/`): Player phone, portrait + landscape. Scoped
  to one character. Initiative input, health, conditions, turn actions, loot,
  element board, initiative timeline, condition splash, exhaust/loot popups.
  Per-character accent theming. Landscape two-column layout.
- **Display Client** (`app/display/`): Portrait-oriented TV/monitor (1080×1920).
  Read-only, zero interaction. Dark fantasy war table aesthetic with canvas
  particle effects (embers/snow), edition theming (GH warm gold, FH ice blue).
  Initiative column with auto-scroll to active figure. Character cards with
  per-character accent theming, XP/loot SVG icons. Monster cards with real GHS
  API stat data (flying, shield, retaliate, immunities, conditions on attacks),
  ability card display (right-justified with name), standees below cards.
  Completed figures collapse to compact tray (cards right, standees left).
  AMD card draw splash (3D flip), loot card splash (targets character portrait),
  element board with infusion/consumption animations, transition overlays.
  Production-wired: live WebSocket state, state-driven animation triggers,
  auto-reconnect (no user interaction needed), display role registration,
  PWA manifest + content-hashed SW. Prototype mode at `?prototype=true`.

### Key Files for Understanding the System
- Types: `packages/shared/src/types/gameState.ts` — all data structures
- Commands: `packages/shared/src/types/commands.ts` — every mutation type
- Protocol: `packages/shared/src/types/protocol.ts` — WS message envelopes
- Engine: `packages/shared/src/engine/applyCommand.ts` — mutation logic
- WS Hub: `server/src/wsHub.ts` — connection mgmt, diff broadcast, reconnect
- Design: `docs/DESIGN_DECISIONS.md` — rationale for all architectural choices
- Roadmap: `docs/ROADMAP.md` — phased plan with completion tracking
- Bugs: `docs/BUGFIX_LOG.md` — issue log
- **Rules: `docs/GAME_RULES_REFERENCE.md` — authoritative GH/FH rules. MUST be consulted for all game logic implementation**

## Repo Layout (condensed)
```
packages/shared/src/    — game logic, types, GHS compat
server/src/             — HTTP + WebSocket server
app/components/         — shared Preact UI components
app/hooks/              — shared Preact hooks (useConnection, useGameState, useCommands)
app/shared/styles/      — CSS theme, typography, component styles
app/controller/         — landscape tablet app (GM)
app/phone/              — portrait phone app (player)
app/display/            — portrait TV app (read-only)
assets/                 — game images/data (gitignored, local only)
docs/                   — context, roadmap, decisions, bugs, rules reference
```

## Design Principles
1. Server owns game state. Clients are views that send commands.
2. Commands are small typed payloads (~15 types). No full-state sync.
3. Server validates every command before applying.
4. Diffs broadcast to all clients. Reconnecting clients replay missed diffs.
5. Session tokens + revision tracking = no state loss on reconnect.
6. One port, one origin. No WS/WSS mismatch. No proxy layers.
7. Shared TypeScript engine used by server and clients = zero logic duplication.
8. All clients share a CSS design system (dark parchment theme).
9. Display is portrait-only vertical tower layout.
10. Controller is landscape-only tabbed layout for iPad.
11. Phone is portrait-only, scoped to a single character.

## Connection Protocol Summary
See `docs/COMMAND_PROTOCOL.md` for full spec.
- Connect: client sends `{ type: "connect", gameCode, sessionToken? }`
- Server responds: `{ type: "connected", sessionToken, revision, state }`
- Client command: `{ type: "command", action: "changeHealth", ... }`
- Server broadcast: `{ type: "diff", revision, changes: [...] }`
- Reconnect: client sends token + lastRevision, server replays missed diffs
- Heartbeat: server pings every 15s (protocol-level), client auto-pongs. Client sends 30s keep-alive pong (application-level). visibilitychange triggers aggressive health check (5s timeout)

## Asset Sources (gitignored, populated locally)
- `assets/ghs/` — GHS client release (images, data JSONs)
- `assets/worldhaven/` — Licensed GH/FH asset repo
- `assets/creator-pack/` — Official Cephalofair creator pack
- `assets/nerdhaven/` — Community custom assets

## Tech Stack
- Runtime: Node.js 20+
- Language: TypeScript 5.x throughout
- Server: Express 4, ws 8, better-sqlite3
- Build: esbuild for clients (content-hashed in production), tsc for shared/server
- CSS: Vanilla CSS with custom properties (no framework)
- Fonts: Cinzel (headings), Crimson Pro (body)
- Persistence: SQLite via better-sqlite3

## Current Phase
Phase R COMPLETE (13 fix batches). Phase 3 Phone ScenarioView — Batch 16 COMPLETE.
Phase 4 Display Client — Design Exploration COMPLETE. Production wiring COMPLETE (Batch 17).
Batch 18a: Server logic bugs + controller standee management COMPLETE.
Batch 18b: Display UI polish COMPLETE (stat icon consolidation, hidden initiatives, stable tray).
Controller is feature-complete for scenario play.
Lobby mode added as first-class AppMode with campaign/one-off game modes.
Phone ScenarioView is feature-complete: health bar, initiative numpad, turn banner,
condition strip/picker, XP/loot counters, character detail overlay (swipe-to-close),
action bar (auto-exhaust popup replaces manual button), element board (interactive
during active turn), initiative timeline (auto-show/dismiss), condition splash on
turn start, per-character accent theming, landscape two-column layout.
Server enforces phone command permissions (whitelist + character match + global actions).
Summon section deferred for joint controller development.
FH loot deck draw integrated via PhoneLootDeckPopup.

Multi-phase scenario setup workflow (Batch 16): 5-phase collaborative setup
(Preview → Chores → Rules → Goals → Start). Controller shows enhanced scenario
preview with monster portraits, room tiles, loot deck config. Auto-assigns setup
chores to players by count. Phone overlays show assigned chores (with monster images),
scenario briefing, and battle goal reminders. All devices synchronize via
`state.setupPhase` and `state.setupData` broadcast.

## Documentation Policy
All project documents MUST be updated to reflect any code changes before committing
and pushing to the repo. Stale docs cause compounding errors across sessions.
Documents to review on every change:
- `docs/BUGFIX_LOG.md` — bug fixes (append-only)
- `docs/DESIGN_DECISIONS.md` — architectural choices (append-only)
- `docs/ROADMAP.md` — completion status
- `docs/PROJECT_CONTEXT.md` — repo layout, components, commands
- `docs/APP_MODE_ARCHITECTURE.md` — UI structure, views, flows
- `docs/GAME_RULES_REFERENCE.md` — game rules implemented or clarified

## GHS Compatibility
The shared engine can import/export GHS JSON game saves via
`packages/shared/src/utils/ghsCompat.ts`. This allows migrating
existing campaigns and provides a fallback bridge if needed.

## Commands Quick Reference
changeHealth, changeMaxHealth, toggleCondition, setInitiative, advancePhase,
toggleTurn, addEntity, removeEntity, moveElement,
drawLootCard, assignLoot, drawMonsterAbility, shuffleMonsterAbilities,
shuffleModifierDeck, drawModifierCard, addModifierCard, removeModifierCard,
revealRoom, undoAction, setScenario, addCharacter, removeCharacter,
setLevel, setExperience, setLoot, toggleExhausted, toggleAbsent,
toggleLongRest, renameCharacter, setLevelAdjustment, setRound,
addSummon, removeSummon, addMonsterGroup, removeMonsterGroup,
setMonsterLevel, importGhsState, updateCampaign,
prepareScenarioEnd, cancelScenarioEnd, completeScenario,
prepareScenarioSetup, confirmChore, proceedToRules,
proceedToBattleGoals, cancelScenarioSetup, startScenario,
completeTownPhase

### Notable Command Behaviors
- **drawModifierCard:** Bless/curse cards are spliced from the deck on draw
  (returned to supply per rules §5). `lastDrawn` field tracks display.
- **prepareScenarioEnd:** Sets `state.finish = 'pending:victory'` or
  `'pending:failure'`. Broadcast to all clients — phones show rewards preview.
- **cancelScenarioEnd:** Clears `state.finish` back to `undefined`. Phones
  dismiss rewards overlay.
- **completeScenario:** Transfers XP + gold, clears monsters/objectives,
  resets character combat state (HP, conditions, initiative), resets round/phase,
  sets elements inert. GH uses `char.loot` for gold; FH uses loot card system.
  Sets `state.finish = 'success'/'failure'`. Phones transition to "claimed" state.
- **activateFigure (internal):** Long rest characters heal 2 HP on activation
  (or clear wound/poison/bane/brittle). Fires before wound/regenerate processing.
  Monster activation triggers ability card consume + summon actions via
  `processMonsterAbilityActions()`.
- **revealRoom:** Spawns monsters for the revealed room. During play phase
  (`state.state === 'next'`), also draws ability cards for new monster groups
  and re-sorts figures by initiative (per rules §7: revealed monsters act
  during the round they appear).
- **toggleTurn (monster deactivation):** Processes end-of-turn conditions,
  then triggers ability card infuse actions (per rules §6: infuse at end of
  monster turn). Dead standees are cleaned up at end of round, not immediately.
- **advancePhase (next→draw):** Removes dead monster entities, prunes empty
  monster groups, then calls `endRound()` for round increment + element decay.

### Phone Command Permissions
Phone clients are restricted server-side to character-scoped commands
(setInitiative, changeHealth, toggleCondition, setExperience, setLoot,
toggleExhausted, toggleAbsent, toggleLongRest, addSummon, removeSummon,
toggleTurn, renameCharacter, confirmChore). Each command's target must match
the phone's registered characterName. Commands targeting summons are allowed
if the summon owner matches. Additionally, `moveElement` and `drawLootCard`
are in a `PHONE_GLOBAL_ACTIONS` set that bypasses character-name validation
(these are game-global actions with no character target). All other commands
are rejected with an error.

## Build Process
- `app/build.mjs` — builds all three Preact client apps via esbuild
- **Production** (`npm run build`): content-hashed filenames (`main-[hash].js`),
  auto-generates `dist/index.html` + `dist/sw.js` per app with baked-in precache lists
- **Dev** (`npm run dev`): plain `main.js`, source HTML/SW files served directly
- Static server prefers `dist/` files when present, falls back to source for dev
