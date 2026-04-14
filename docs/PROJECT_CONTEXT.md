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
- **Phone Client** (`app/phone/`): Player phone, portrait. Scoped to one
  character. Initiative input, health, conditions, turn actions, loot.
- **Display Client** (`app/display/`): Portrait-oriented TV/monitor.
  Read-only. Vertical tower layout: initiative timeline → characters → monsters.

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
- Build: esbuild for clients, tsc for shared/server
- CSS: Vanilla CSS with custom properties (no framework)
- Fonts: Cinzel (headings), Crimson Pro (body)
- Persistence: SQLite via better-sqlite3

## Current Phase
Phase R COMPLETE (13 fix batches). Phase 3 Phone ScenarioView COMPLETE.
Controller is feature-complete for scenario play.
Phone ScenarioView is feature-complete: health bar, initiative numpad, turn banner,
condition strip/picker, XP/loot counters, summon section, character detail overlay,
action bar. Remaining: FH loot card interaction, server permission enforcement.

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
setMonsterLevel, importGhsState, updateCampaign, completeScenario

### Notable Command Behaviors
- **drawModifierCard:** Bless/curse cards are spliced from the deck on draw
  (returned to supply per rules §5). `lastDrawn` field tracks display.
- **completeScenario:** Transfers XP + gold, clears monsters/objectives,
  resets character combat state (HP, conditions, initiative), resets round/phase,
  sets elements inert. GH uses `char.loot` for gold; FH uses loot card system.
- **activateFigure (internal):** Long rest characters heal 2 HP on activation
  (or clear wound/poison/bane/brittle). Fires before wound/regenerate processing.
