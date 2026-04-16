# Batch 17: Display Client — Production Wiring

## Skills to Read FIRST

1. **UI/UX Pro Max skill** — Read ALL `.md` files in:
   `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
2. **Frontend Agent skills** — Read ALL `.md` files in:
   `C:\Users\Kyle Diaz\.agents\skills\`
3. **Project conventions** — Read `app/CONVENTIONS.md`

---

## Overview

The display client has 11 production-quality components, 1,345+ lines of CSS, a Canvas particle system, card draw animations, and transition overlays — all running against mock data. This batch replaces the mock data with live WebSocket state and handles every state transition the display will encounter during a real game session.

**What this batch does:**
- Wire all components to live `useGameState` / `useConnection` / `useDataApi` hooks
- Detect state transitions and trigger the correct animations
- Handle all three modes (lobby → scenario → town → lobby)
- Handle all setup phases (chores → rules → goals → start)
- Handle scenario completion (pending → confirmed)
- Auto-reconnect without user interaction
- Handle variable party sizes (1-4 characters), variable monster counts, edge cases
- Register as `display` role with the server
- PWA manifest + service worker
- Retain `PROTOTYPE_MODE` behind a URL param (`?prototype=true`) for future design iteration

**What this batch does NOT do (deferred to Batch 18):**
- Import monster ability card databases
- Import scenario rules / win conditions / setup instructions
- Replace placeholder text with real data for ability card actions, scenario rules, etc.

---

## Step 1: Audit Current State

Before writing any code, read these files thoroughly:

```
# Display client (what you're wiring)
app/display/App.tsx
app/display/ScenarioView.tsx
app/display/LobbyWaitingView.tsx
app/display/TownView.tsx
app/display/mockData.ts
app/display/components/    (ALL files)
app/display/styles/display.css

# Connection patterns to follow
app/phone/App.tsx               — Phone's connection + mode routing (best reference)
app/controller/App.tsx          — Controller's connection + mode routing
app/controller/ScenarioView.tsx — Controller's state-to-component mapping

# Shared hooks you'll use
app/hooks/useConnection.ts
app/hooks/useGameState.ts
app/hooks/useDataApi.ts

# Connection library
clients/shared/lib/connection.ts
clients/shared/lib/stateStore.ts
clients/shared/lib/commandSender.ts

# State types
packages/shared/src/types/gameState.ts
packages/shared/src/types/protocol.ts

# Display-specific hooks already created
app/display/components/useDisplayMonsterData (if it exists as a separate file — otherwise it's inline)
```

Understand the patterns used by the phone and controller before modifying the display. The display follows the SAME connection lifecycle but is simpler (no commands, no registration character).

---

## Step 2: App.tsx — Connection + Mode Routing

### Connection Lifecycle

Follow the phone's `App.tsx` pattern but simpler:

1. **Connection screen:** Game code input → `useConnection(gameCode)` → WebSocket opens
2. **Register as display:** After connection, send `{ type: "register", role: "display" }` — no characterName needed
3. **Auto-reconnect:** The display must reconnect silently on any connection loss. No user is present to click "reconnect." Use the existing `connection.ts` auto-reconnect with exponential backoff. On `visibilitychange` (if Chrome is backgrounded), follow the same pause/resume pattern as the phone.
4. **Persist game code:** Save to `localStorage` so the display auto-connects on page load (browser restart, power cycle, etc.)

### Mode Routing

```typescript
// Derive from state
const mode = state?.mode;  // 'lobby' | 'scenario' | 'town' | undefined

switch (mode) {
  case 'scenario':
    return <ScenarioView state={state} />;
  case 'town':
    return <TownView state={state} />;
  case 'lobby':
  default:
    return <LobbyWaitingView state={state} />;
}
```

### Setup Phase Handling

When `state.mode === 'lobby'` and `state.setupPhase` exists, the display should show setup-aware content in `LobbyWaitingView`:
- `setupPhase === 'chores'`: "Players collecting scenario materials..."
- `setupPhase === 'rules'`: Show scenario name + "Reviewing scenario rules..."
- `setupPhase === 'goals'`: "Choosing battle goals..."
- Otherwise: "Waiting for GM to select scenario..."

Keep these atmospheric (particles, fog, Cinzel text) — NOT functional overlays. The display doesn't participate in setup.

### Scenario Finish Handling

When `state.finish` changes:
- `'pending:victory'` → Show victory transition animation (overlay, but don't block the ScenarioView underneath)
- `'pending:failure'` → Show defeat transition animation
- `'success'` / `'failure'` → Keep showing the result (GM confirmed)
- Back to `undefined` → Dismiss (GM cancelled)

### Prototype Mode Toggle

Keep `PROTOTYPE_MODE` but gate it on a URL param:
```typescript
const PROTOTYPE_MODE = new URLSearchParams(window.location.search).get('prototype') === 'true';
```

When active, use `mockData.ts` as before with keyboard controls. When inactive (default), use live data. This preserves the design iteration workflow without any build-time flags.

---

## Step 3: ScenarioView — Live State Mapping

This is the core wiring task. Map every mock data field to its live GameState equivalent.

### Data Extraction

```typescript
// From useGameState or direct state access
const scenario = state.scenario;          // { index, name, edition }
const round = state.round;                // number
const level = state.level;                // number
const phase = state.state;                // 'draw' | 'next'
const elements = state.elementBoard;      // ElementModel[]
const characters = state.characters;      // Character[]
const monsters = state.monsters;          // Monster[]
const figures = state.figures;            // string[] — ordered refs
const finish = state.finish;              // scenario completion state
const edition = state.edition;            // for edition theming
```

### Figure Ordering

The initiative column needs all figures sorted by initiative order. Use `state.figures` as the authoritative order (the server maintains this). Cross-reference with `state.characters` and `state.monsters` to build the display list:

```typescript
// state.figures contains refs like "fh-drifter", "fh-algox-guard"
// Match to characters by `${char.edition}-${char.name}`
// Match to monsters by `${monster.edition}-${monster.name}`
```

Audit `app/hooks/useGameState.ts` and `packages/shared/src/engine/turnOrder.ts` to understand the exact figure reference format and sorting logic. The phone's `PhoneInitiativeTimeline.tsx` already does this mapping — reference its approach.

### Active Figure Detection

The active figure is the figure whose `active` field is `true`:
- For characters: `character.active === true`
- For monsters: the monster group with any entity where `entity.active === true`, or the monster group itself with `monster.active === true`

Cross-reference with the phone and controller to match the exact active detection logic.

### Phase-Aware Layout

- **Draw phase** (`state.state === 'draw'`): Characters show "waiting" state, no initiative values yet. Monsters have no ability cards drawn. The display should show a "Setting Initiatives" or round-start state.
- **Play phase** (`state.state === 'next'`): Full initiative order is active. Characters and monsters have initiative values. Active figure highlighted.

**CRITICAL: GHS uses `'next'` not `'play'` for the play phase.** This was a bug source in Batch 15. Verify this throughout all display code.

### Derived Values

Calculate from state for the scenario header / footer:
```typescript
const trapDamage = level + 2;                    // GH
// const trapDamage = Math.ceil((level + 1) / 2); // FH — check edition
const goldConversion = Math.ceil((level + 1) / 2) + 1;  // GH
// const goldConversion = ...;                    // FH — check formula
const hazardDamage = Math.ceil((level + 1) / 2);
const bonusXP = Math.floor(level / 2) + 4;       // verify formula
```

**Check `docs/GAME_RULES_REFERENCE.md`** for the exact formulas per edition. The controller already calculates these — find where and reuse the logic.

---

## Step 4: Component Wiring — What Each Component Needs

### DisplayScenarioHeader
- **From state:** `scenario.name`, `scenario.index`, `round`, `level`
- **Derived:** trap damage, gold conversion, hazard damage, bonus XP
- **Edition:** for GH vs FH formula selection
- **Transition trigger:** `round` changes → round increment animation

### DisplayElementBoard
- **From state:** `elementBoard[]` — each element has `type` (fire/ice/air/earth/light/dark) and `state` (strong/waning/inert/consumed/new)
- **Map `state` to visual:** `strong` → full glow, `waning` → half-filled dimmer, everything else → inert/grey
- **Transition trigger:** element state changes → infusion burst or consumption vortex animation
- **Note:** Elements may have states beyond strong/waning/inert (see GHS_STATE_MAP: new, consumed, partlyConsumed, always). Map all of these to the three visual states the prototype handles.

### DisplayInitiativeColumn
- **From state:** `figures[]` ordering, `characters[]`, `monsters[]`
- **Props per figure:** initiative value, active status, completed status, HP, conditions, name, edition, portrait path
- **Active figure:** gold highlight, enlarged
- **Completed figures:** moved to compact tray
- **Waiting figures:** normal presentation
- **Transition trigger:** active figure changes → scroll animation, previous figure moves to completed tray

### DisplayFigureCard
- **Character cards:** `character.name`, `character.edition`, `character.level`, `character.health`, `character.maxHealth`, `character.initiative`, `character.entityConditions[]`, `character.exhausted`, `character.absent`, `character.longRest`
- **Monster cards:** `monster.name`, `monster.edition`, `monster.level`, `monster.ability` (drawn card index), `monster.entities[]` (standees with individual HP/conditions)
- **Portrait paths:** Resolve via `assets/ghs/images/{edition}/characters/{name}.png` for characters, `assets/ghs/images/{edition}/monsters/{name}.png` for monsters. Check actual paths — may need `.webp` or different directory structure. Audit the asset directory.

### DisplayMonsterAbility
- **From state:** `monster.ability` (the index of the drawn ability card)
- **From data API:** The actual ability card data (initiative, actions) — fetch from `/api/data/{edition}/monster/deck/{deckName}`
- **PLACEHOLDER for this batch:** If the ability card data API doesn't return full action text, show: initiative number + "See ability card" placeholder. The monster's drawn ability INDEX is in state, but resolving it to actual card actions requires the ability deck data. Use `useDisplayMonsterData` hook if it already fetches ability data, otherwise show the initiative value from the drawn card and placeholder the action list.
- **When active:** Expanded view with all resolved actions
- **When not active:** Compact summary

### DisplayCharacterSummary
- **From state:** All characters — name, HP, maxHealth, conditions, XP, loot, exhausted
- **Layout:** Compact horizontal bar at bottom of display
- **Exhausted:** Dimmed, strikethrough
- **Absent:** Hidden entirely (absent characters don't participate)

### DisplayTransitions
- **Round change:** Triggered when `state.round` increments (compare previous round to current)
- **Scenario start:** Triggered when `state.mode` changes from `'lobby'` to `'scenario'` (or when scenario first loads with `round === 1`)
- **Room reveal:** Triggered when `state.monsters` gains new entries (a door was opened, new monster groups spawned). Detect by comparing previous monster list to current.
- **Scenario end:** Triggered by `state.finish` changing to `'pending:victory'` or `'pending:failure'`
- **Victory confirmed:** `state.finish === 'success'`
- **Defeat confirmed:** `state.finish === 'failure'`

### AmbientParticles
- **From state:** `state.edition` — selects particle preset (embers for GH, snow for FH)
- **Always running:** This is ambient, not triggered by state changes
- **Edition switch:** If edition changes (shouldn't happen mid-scenario, but handle it), restart particle system with new preset

### DisplayScenarioFooter
- **From state:** `state.scenarioRules` — if populated, display them
- **PLACEHOLDER:** If `scenarioRules` is empty or doesn't contain readable text, show: "Special rules: See Scenario Book" and "Win condition: See Scenario Book"
- This footer was added in Round One — verify it handles empty/missing data gracefully

### DisplayAMDSplash / DisplayLootSplash
- **AMD draw:** Triggered when `state.monsterAttackModifierDeck.lastDrawn` changes. The `lastDrawn` field contains the drawn card ID. Resolve to card type (plus1, minus1, double, null, bless, curse, etc.) and trigger the appropriate animation with special flares for bless/curse/2x/null.
- **Loot draw:** Triggered when `state.lootDeck` changes (a card was drawn). Detect by comparing previous `lootDeck.current` to current. Show the drawn card type and animate toward the relevant character.

---

## Step 5: State Transition Detection

The display needs to detect state changes to trigger animations. This requires comparing previous state to current state.

### Implementation Pattern

Use a `useRef` to store previous state values and compare on each render:

```typescript
function useStateTransition<T>(currentValue: T, callback: (prev: T, curr: T) => void) {
  const prevRef = useRef<T>(currentValue);
  useEffect(() => {
    if (prevRef.current !== currentValue) {
      callback(prevRef.current, currentValue);
      prevRef.current = currentValue;
    }
  }, [currentValue]);
}
```

### Transitions to Detect

| Previous State | Current State | Animation |
|---|---|---|
| `round: N` | `round: N+1` | Round increment flourish |
| `mode: 'lobby'` | `mode: 'scenario'` | Scenario start cinematic |
| `mode: 'scenario'` | `mode: 'town'` | Fade to town |
| `finish: undefined` | `finish: 'pending:victory'` | Victory overlay |
| `finish: undefined` | `finish: 'pending:failure'` | Defeat overlay |
| `finish: 'pending:*'` | `finish: undefined` | Dismiss overlay (cancelled) |
| Character A active | Character B active | Scroll to new active, animate previous to tray |
| `monsters.length: N` | `monsters.length: N+M` | Room reveal flash (new monsters appeared) |
| `phase: 'draw'` | `phase: 'next'` | Initiative order materializes |
| `AMD.lastDrawn: X` | `AMD.lastDrawn: Y` | AMD card flip animation |
| `lootDeck.current: N` | `lootDeck.current: N+1` | Loot card draw animation |
| Element state change | (any element) | Infusion burst or consumption vortex |

### Edge Cases

- **First render after connection:** Don't trigger "scenario start" animation on reconnect. Check if this is a fresh connection vs. reconnect (the `reconnected` message type vs. `connected` message type). On reconnect, render current state without transitions.
- **Multiple changes in one diff:** A single diff can contain multiple state changes (e.g., monster killed + loot dropped + health changed). Process animation triggers in priority order and queue if needed.
- **Rapid state changes:** If the GM is clicking quickly, transitions may queue up. Each animation should have a maximum duration and be cancellable by the next transition.

---

## Step 6: Data API Integration

### Monster Portraits
```
GET /api/data/{edition}/character/{name}  → character portrait path
GET /api/data/{edition}/monster/{name}    → monster portrait path + stats
```

The `useDisplayMonsterData` hook from Round Two already fetches monster stats. Verify it handles:
- Multiple monster groups simultaneously (batch fetching, not sequential)
- Level changes (if scenario level changes, stats need refetching)
- New monster groups appearing (room reveal adds monsters — hook must react)
- Caching (don't re-fetch on every render)

### Character Portraits
Resolve portrait paths from asset conventions:
```
assets/ghs/images/{edition}/characters/{name}.png
```

Audit the actual asset directory to confirm the path pattern. The phone client already resolves these — check `app/phone/App.tsx` or `characterThemes.ts` for the pattern.

### Ability Card Data (PLACEHOLDER)
The drawn ability card index is in `monster.ability`, but resolving it to action text requires:
1. Fetch the monster's `deck` field from monster data (e.g., `"guard"`)
2. Fetch the ability deck: `/api/data/{edition}/monster/deck/{deckName}`
3. Index into the deck to get the card's initiative and actions

If this API endpoint exists and returns usable data, wire it up. If not, show the initiative number (which is available from the drawn card) and placeholder text for actions. **Document what data is missing so Batch 18 knows exactly what to build.**

---

## Step 7: Auto-Reconnect Hardening

The display has NO user interaction. If it loses connection, it must recover completely on its own.

### Requirements
- **Auto-connect on load:** If `localStorage` has a game code, connect immediately on page load
- **Auto-reconnect on disconnect:** Exponential backoff (1s → 2s → 4s → 8s → 16s → 30s max)
- **Visibility handling:** Pause reconnect timers when Chrome is backgrounded, resume + immediate health check on foreground
- **Full state recovery:** On reconnect, the server replays missed diffs. If too far behind (>100 revisions), server sends full state. The display must handle both.
- **Connection status indicator:** Small, unobtrusive indicator in a corner:
  - Connected: no indicator (or tiny green dot)
  - Reconnecting: subtle amber pulsing dot
  - Disconnected: red dot
  - This should NOT be a banner or toast — just a tiny status light that doesn't distract from the game display
- **No error modals.** Never show error messages that require dismissal. Log to console only.

### Test Scenarios
- [ ] Kill and restart the server — display auto-reconnects and shows current state
- [ ] Unplug ethernet / disconnect WiFi — display reconnects when network returns
- [ ] Close and reopen Chrome — display auto-connects using saved game code
- [ ] Server sends full state reset (>100 revisions behind) — display handles cleanly

---

## Step 8: Edition Theming

The display already has edition-based theming (GH warm gold vs FH ice blue) from the prototype. Wire this to `state.edition`:

```typescript
useEffect(() => {
  const root = document.documentElement;
  if (edition === 'fh') {
    root.classList.add('edition-fh');
    root.classList.remove('edition-gh');
  } else {
    root.classList.add('edition-gh');
    root.classList.remove('edition-fh');
  }
}, [edition]);
```

Verify the CSS classes already exist and apply correctly. Also apply to the particle system (embers for GH, snow for FH).

---

## Step 9: PWA Manifest + Service Worker

Create `app/display/manifest.json`:
```json
{
  "name": "Gloomhaven Command — Display",
  "short_name": "GH Display",
  "display": "fullscreen",
  "orientation": "portrait",
  "background_color": "#1a1410",
  "theme_color": "#1a1410",
  "icons": [/* reuse PWA icons from phone/controller */]
}
```

Service worker: follow the same hash-based cache busting pattern from Batch 14. The display build already goes through esbuild with content-hashed filenames. Generate the SW precache list at build time.

---

## Step 10: Display Registration

The server tracks client roles. Register the display:

```typescript
// After connection established
connection.send({ type: "register", role: "display" });
```

Check if the server's `wsHub.ts` already handles `role: "display"` registration. If not, add it — the display role has no command restrictions (per COMMAND_PROTOCOL.md: "Controller and display clients have no command restrictions"), but it also never sends commands. The registration is primarily for the server to know which clients are connected in each role (useful for debugging and future features like "is a display connected?").

---

## File Changes Expected

### Modified
```
app/display/App.tsx                    — Connection lifecycle, mode routing, prototype toggle
app/display/ScenarioView.tsx           — Replace mock data with live state, transition detection
app/display/LobbyWaitingView.tsx       — Setup phase awareness from state
app/display/TownView.tsx               — Wire to live state
app/display/components/DisplayScenarioHeader.tsx   — Live scenario/round/level data
app/display/components/DisplayElementBoard.tsx     — Live elementBoard state + transitions
app/display/components/DisplayInitiativeColumn.tsx — Live figure ordering + active detection
app/display/components/DisplayFigureCard.tsx       — Live character/monster data + portraits
app/display/components/DisplayMonsterAbility.tsx   — Live ability card data (or placeholder)
app/display/components/DisplayCharacterSummary.tsx — Live character state
app/display/components/AmbientParticles.tsx        — Edition-based preset selection
app/display/components/DisplayTransitions.tsx      — State transition triggers
app/display/components/DisplayAMDSplash.tsx        — AMD lastDrawn trigger
app/display/components/DisplayLootSplash.tsx       — Loot deck trigger
```

### New
```
app/display/hooks/useStateTransitions.ts  — State comparison + animation trigger hook
app/display/manifest.json                 — PWA manifest
app/display/sw.js                         — Service worker (or generated at build time)
```

### Possibly Modified
```
server/src/wsHub.ts            — Handle display role registration (if not already)
server/src/staticServer.ts     — Serve display manifest/SW with correct headers
app/build.mjs                  — Generate display SW with precache list (if not already)
```

---

## Verification Checklist

### Connection
- [ ] Display connects to server using game code
- [ ] Game code persisted to localStorage, auto-connects on reload
- [ ] Display registers as `role: "display"`
- [ ] Auto-reconnect works after server restart
- [ ] Auto-reconnect works after network interruption
- [ ] Connection status indicator shows correct state (connected/reconnecting/disconnected)
- [ ] No error modals ever appear — all errors logged to console only

### Mode Routing
- [ ] Lobby mode shows LobbyWaitingView with atmospheric effects
- [ ] Scenario mode shows ScenarioView with live data
- [ ] Town mode shows TownView
- [ ] Mode transitions are smooth (not jarring full-page reloads)

### Setup Phase Awareness
- [ ] During chores phase, lobby view shows "Players collecting materials..."
- [ ] During rules phase, shows scenario name + "Reviewing rules..."
- [ ] During goals phase, shows "Choosing battle goals..."
- [ ] When scenario starts (mode → scenario), plays scenario start cinematic

### Scenario View — Live Data
- [ ] Scenario header shows correct name, number, round, level
- [ ] Derived values (trap, gold, hazard, XP) calculated correctly per edition
- [ ] Element board reflects live `elementBoard` state
- [ ] Element state changes trigger infusion/consumption animations
- [ ] Initiative column shows all figures in correct order from `state.figures`
- [ ] Character cards show correct HP, conditions, initiative, level
- [ ] Monster cards show correct standee count, HP per standee, conditions
- [ ] Active figure is highlighted with gold glow, enlarged
- [ ] Completed figures move to compact tray
- [ ] Auto-scroll brings active figure to top of viewport
- [ ] Character portraits load from correct asset paths
- [ ] Monster portraits load from correct asset paths

### Turn Flow
- [ ] When active figure changes (turn advances), animation plays
- [ ] Previous active figure moves to completed tray with animation
- [ ] New active figure scrolls into prominence
- [ ] Monster ability card expands when monster is active
- [ ] Phase change (draw → next) triggers initiative order materialization

### Animations
- [ ] Round increment triggers flourish animation
- [ ] Room reveal (new monsters appear) triggers flash/highlight
- [ ] AMD card draw triggers flip animation with correct card type
- [ ] Loot card draw triggers shrink-to-character animation
- [ ] Victory overlay triggers on `finish === 'pending:victory'`
- [ ] Defeat overlay triggers on `finish === 'pending:failure'`
- [ ] Overlay dismissed if finish goes back to undefined (cancelled)
- [ ] Animations don't trigger on reconnect (only on live state changes)

### Edition Theming
- [ ] GH game shows warm gold theme + ember particles
- [ ] FH game shows ice blue theme + snow particles
- [ ] Theme applies immediately on connection (not after first state change)

### Edge Cases
- [ ] 1 character, 0 monsters (lobby just started scenario) — no crash
- [ ] 4 characters, 6 monster groups — layout handles without overflow
- [ ] All characters exhausted — display handles gracefully
- [ ] Absent characters not shown in initiative column or summary
- [ ] Monster group with 0 living entities — hidden or shown as defeated
- [ ] Long rest characters show zzz icon for initiative during draw phase
- [ ] Prototype mode accessible at `/display?prototype=true`

### PWA
- [ ] Manifest loads correctly
- [ ] Service worker caches display assets
- [ ] SW uses content-hashed filenames from build

---

## Docs to Update

- `docs/DESIGN_DECISIONS.md` — append: display production wiring approach, state transition detection pattern, auto-reconnect strategy, prototype mode URL param toggle
- `docs/APP_MODE_ARCHITECTURE.md` — update display section with production component list and mode routing
- `docs/PROJECT_CONTEXT.md` — update display client description, mark Phase 4 production wiring complete
- `docs/ROADMAP.md` — update Phase 4 progress
- `docs/BUGFIX_LOG.md` — append any bugs found during wiring

**Commit message:** `feat: display client production wiring — live state, transitions, auto-reconnect`
