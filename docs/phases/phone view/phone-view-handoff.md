# Gloomhaven Command — Phone View Handoff

> Start a new conversation with this document. It provides full project context
> and the phone view specification for Phase 3 implementation.

---

## Project Overview

Gloomhaven Command is a multi-device companion system for Gloomhaven/Frosthaven
tabletop play. Server-authoritative, command-based architecture. Three client apps
sharing a component library.

**Repo:** `github.com/adjihad00/gloomhaven-command`
**User:** Kyle, Greenville SC. Dev machine: Windows PowerShell + Docker. Primary
playtest device: iPad (controller), phones for players.

## Architecture

- **Server** (`server/`): Express + ws + better-sqlite3. Single port (3000).
  Commands validated → applied → persisted → broadcast as diffs.
- **Shared Engine** (`packages/shared/`): TypeScript. 37 commands, applyCommand
  (pure with DataContext), validateCommand, turnOrder, conditions, elements,
  DataManager.
- **Data Layer** (`packages/shared/src/data/`): Reads GHS edition JSON files.
  Character HP by level, monster stats, scenario rooms, ability decks.
- **Preact App** (`app/`): Three entry points sharing component library.
  - Controller (`app/controller/`): iPad landscape, GM controls — COMPLETE
  - Phone (`app/phone/`): Portrait, character-scoped — SCAFFOLD ONLY
  - Display (`app/display/`): Portrait, read-only — NOT STARTED
- **Assets**: GHS SVG/PNG at `assets/ghs/images/`. No fallbacks.

## Key Project Documents (in repo)

- `CLAUDE.md` — Claude Code context with design skill references
- `RESPONSE_CONTRACT.md` — AI response formatting rules (MUST READ)
- `docs/APP_MODE_ARCHITECTURE.md` — Scenario/Town modes, device roles
- `docs/GHS_AUDIT.md` — 1,099-line GHS functionality audit
- `docs/GAME_RULES_REFERENCE.md` — Authoritative GH/FH game rules
- `docs/DESIGN_DECISIONS.md` — Append-only rationale log
- `docs/BUGFIX_LOG.md` — Issue tracker (13 batches logged)
- `docs/COMMAND_PROTOCOL.md` — WebSocket message format spec
- `app/CONVENTIONS.md` — BEM naming, spacing tokens, CSS architecture

## Response Contract

Read `RESPONSE_CONTRACT.md` in the project for AI response formatting rules.
Key points: execution-first, one recommended path, complete code, no filler.

## Design System

Aesthetic: Dark fantasy tabletop. Cinzel (display) + Crimson Pro (body).
CSS variables in `app/shared/styles/theme.css`. BEM naming per `app/CONVENTIONS.md`.
All interactive elements: `touch-action: manipulation`. All buttons: `aria-label`.
GHS assets exclusively — no emoji fallbacks, no generic icons.

## Completed Work (13 fix batches)

The controller is feature-complete for scenario play:

### Engine (packages/shared/)
- 37 commands including `completeScenario`, `toggleLongRest`, `renameCharacter`
- Condition engine: expiry state machine, regenerate+wound, bane, poison indicator
- Edition-aware conditions: `getConditionsForEdition()` (GH=10, FH=16)
- Modifier deck: standard 20-card init, bless/curse removal on draw, `lastDrawn` field
- Dual XP: `character.experience` (scenario dial) + `progress.experience` (career total)
- `completeScenario`: transfers XP+loot→progress, bonus XP, GH coin conversion + FH loot cards
- Long rest: heal 2 HP on activation, clears wound/poison
- Scenario auto-spawn, room reveal, shared ability decks
- FH loot deck builder from `scenario.lootDeckConfig`

### Controller (app/controller/)
- Single-screen ScenarioView with overlays
- 17 shared components, 8 controller overlays, 4 shared hooks
- Initiative numpad (dark fantasy, lifted to ScenarioView level)
- 3-step setup wizard: Edition → Party → Scenario
- Scenario summary overlay with reward preview
- Modifier deck floating overlay, loot deck panel
- Absent character bench strip
- Door confirmation overlay
- PWA manifest + service worker
- WebSocket reconnect with health check + 30s heartbeat

### Shared Components Available for Reuse
```
app/components/
├── CharacterBar.tsx       — HP bar header, inline conditions, XP/gold counters
├── ConditionGrid.tsx      — Condition icon grid (toggleable or readonly)
├── ConditionIcons.tsx      — Active condition icon strip
├── ElementBoard.tsx        — 6-element display with state cycling
├── FigureList.tsx          — Initiative-sorted figure grid with bench strip
├── HealthControl.tsx       — HP +/- buttons
├── Icons.tsx               — BloodDropIcon, XPIcon, GoldIcon, DoorIcons, TrapIcon,
│                             HazardIcon, LongRestIcon, PawIcon
├── InitiativeDisplay.tsx   — Initiative number or zzz icon display
├── LootDeckPanel.tsx       — Loot card list with draw/assign
├── ModifierDeck.tsx        — AMD badge + floating overlay
├── MonsterGroup.tsx        — Monster header + standee rows + condition picker
├── MonsterStandeeRow.tsx   — Individual standee HP/conditions
├── MonsterStatCard.tsx     — Normal/elite stat display
├── Placeholder.tsx         — Dev placeholder component
├── ScenarioFooter.tsx      — Phase button, doors, derived values, decks
├── ScenarioHeader.tsx      — Scenario name, round, elements
└── SummonCard.tsx          — Summon display
```

### Shared Hooks
```
app/hooks/
├── useCommands.ts    — wraps CommandSender from AppContext
├── useConnection.ts  — Connection + StateStore + CommandSender lifecycle
├── useDataApi.ts     — fetch from /api/data/* (editions, characters, scenarios, etc.)
└── useGameState.ts   — extracts typed fields from raw GameState
```

---

## Phone View Specification

### Role
Player's phone in portrait orientation. Scoped to ONE character (selected on
connect). Shows only what that player needs: their character's health, initiative,
conditions, XP, loot, summons, and turn status. Does NOT show: other characters,
monster details, modifier decks, element board, door controls.

### Current Scaffold (already in repo)
```
app/phone/
├── App.tsx              — Connection → CharacterPicker → ScenarioView routing
├── CharacterPicker.tsx  — Grid of available characters, stores selection
├── ConnectionScreen.tsx — Game code input + connect
├── ScenarioView.tsx     — PLACEHOLDER (renders Placeholder component)
├── TownView.tsx         — PLACEHOLDER
├── main.tsx             — Preact render entry
├── index.html           — HTML shell with CSS imports
└── styles/phone.css     — Base phone styles (minimal)
```

`App.tsx` is already wired: connects via `useConnection`, stores selected character
in localStorage, registers as `'phone'` role via `connection.register()`, and routes
to ScenarioView. The `AppContext` provider is set up.

### What Needs Building

#### P1: Phone ScenarioView — Main Screen
Portrait layout, single character. From top to bottom:

1. **Character header** — name, level, class color accent
2. **HP section** — large health bar with blood drop icon, +/- buttons, current/max
3. **Initiative section** — current initiative value or zzz icon. Tap to open numpad.
   Phase-aware: only editable during draw phase. Shows "Waiting..." during play phase
   until it's their turn.
4. **Turn status** — clear indicator: "Your Turn" (active, gold glow),
   "Waiting" (not yet), "Turn Complete" (done, dimmed). Tap to end turn when active.
5. **Condition strip** — inline horizontal scroll of active conditions. Tap condition
   to remove. "+" button to add from edition-filtered condition grid.
6. **XP + Loot counters** — tap to increment. XP uses scenario dial
   (`character.experience`), loot uses `character.loot`.
7. **Summons** (if any) — compact summon cards with HP/conditions.
8. **Action buttons** — Long Rest toggle, End Turn, Mark Exhausted.

#### P2: Phone Initiative Input
Reuse `InitiativeNumpad` from `app/controller/overlays/InitiativeNumpad.tsx`.
It's already a standalone overlay component. Import and render it from the phone's
ScenarioView when the initiative area is tapped during draw phase.

The numpad was designed for iPad but the keys are already large. It should work on
phone screens. May need minor CSS adjustments for smaller viewports.

#### P3: Phone Character Detail
Tap character name/header to expand a detail panel (could be inline expansion or
overlay). Shows:
- Full condition grid (all edition conditions, toggleable)
- HP controls (same as main, larger)
- XP/Loot controls with +/- buttons and values
- Gold/resource totals from `character.progress`
- Level + XP fill bar (reuse `getXPBarInfo` pattern from CharacterSheetOverlay)
- Long Rest toggle
- Mark Absent, Mark Exhausted

#### P4: Server Permission Enforcement
The server already accepts `register` messages with `role: 'phone'` and
`characterName`. `WsHub` in `server/src/wsHub.ts` should enforce that phone clients
can only send commands targeting their registered character. Check if this is
already implemented — if not, add validation in the command handler.

#### P5: Phone Styles
Portrait-optimized CSS in `app/phone/styles/phone.css`. Key constraints:
- Max width ~430px (phone viewport)
- Large tap targets (minimum 44px per Apple HIG)
- HP and initiative should be the dominant visual elements
- Conditions as a horizontal scroll strip, not a grid
- Reuse CSS variables from `app/shared/styles/theme.css`
- BEM naming per `app/CONVENTIONS.md`

### What NOT to Build (Phone)
- Monster management (controller only)
- Scenario setup / room reveals / door controls (controller only)
- Element board (controller/display only)
- Modifier deck controls (controller only)
- Loot deck draw/assign (controller manages, phone shows assigned cards)
- Campaign management (future)

### Key Commands the Phone Will Use
```
setInitiative(characterName, edition, value)
toggleLongRest(characterName, edition)
toggleTurn({ type: 'character', name, edition })    — end own turn
changeHealth({ type: 'character', name, edition }, delta)
toggleCondition({ type: 'character', name, edition }, condition)
setExperience(characterName, edition, value)
setLoot(characterName, edition, value)
toggleExhausted(characterName, edition)
toggleAbsent(characterName, edition)
```

All commands target the phone's registered character only.

### Server-Side Character Filtering
The phone should only receive diffs relevant to its character + global state
(round, phase, elements). Currently the server broadcasts ALL diffs to all clients.
This is acceptable for now — the phone just ignores irrelevant data. Permission
enforcement (preventing a phone from sending commands for other characters) is the
priority.

---

## Implementation Order

1. **P1**: Build phone `ScenarioView.tsx` with all sections
2. **P2**: Wire `InitiativeNumpad` import and rendering
3. **P5**: Phone CSS — portrait layout, large tap targets
4. **P3**: Character detail panel (inline or overlay)
5. **P4**: Server permission enforcement (if not already present)
6. Playtest on actual phone device

## Build + Dev

```bash
npm install        # from repo root
npm run dev        # starts server + watches all three clients
npm run build      # production build
```

The phone is served at `/phone` (configured in `server/src/staticServer.ts`).
Open on phone browser: `http://<server-ip>:3000/phone`

---

## Approach Reminders

- **Read RESPONSE_CONTRACT.md** — execution-first, no filler, complete code
- **Read app/CONVENTIONS.md** — BEM naming, spacing tokens, CSS architecture
- **GHS assets, no fallbacks** — broken images signal path errors
- **Reuse shared components** — don't duplicate what exists in `app/components/`
- **touch-action: manipulation** on all interactive elements
- **One batch at a time** — implement, verify, commit
- **Audit before build** — check actual codebase state before assuming file contents
