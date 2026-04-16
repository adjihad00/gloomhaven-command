# Gloomhaven Command — App Mode Architecture

Three operational modes across three device roles. Mode transitions are server
commands — all devices switch simultaneously via WebSocket broadcast.

## Mode Flow

```
LOBBY MODE → Scenario Setup → SCENARIO MODE → Scenario End → TOWN MODE → LOBBY MODE
LOBBY MODE → (future: Road Event/Travel Phase) → SCENARIO MODE
```

`GameState.mode`: `'lobby' | 'scenario' | 'town' | 'transition'`

New games start in `'lobby'` mode. `startScenario` transitions to `'scenario'`.
`completeScenario` transitions to `'town'`. `completeTownPhase` transitions to `'lobby'`.

---

## App Structure

Separate Preact entry points per device role, sharing a component library.

```
app/
├── components/           # Shared Preact components
│   ├── CharacterBoard.tsx
│   ├── MonsterGroup.tsx
│   ├── HealthControl.tsx
│   ├── ConditionGrid.tsx
│   ├── ElementBoard.tsx
│   ├── ModifierDeck.tsx
│   ├── InitiativeTimeline.tsx
│   └── ...
├── hooks/                # Shared Preact hooks
│   ├── useConnection.ts  # wraps Connection class
│   ├── useGameState.ts   # wraps StateStore
│   ├── useCommands.ts    # wraps CommandSender
│   └── useDataApi.ts     # fetch from /api/data/*
├── shared/               # Non-component shared code
│   ├── styles/           # theme.css, typography.css, components.css
│   └── assets.ts         # asset URL helpers
├── controller/           # GM — iPad landscape, full control
│   ├── main.tsx, index.html
│   ├── LobbyView.tsx     # 8-step sequential setup flow
│   ├── ScenarioView.tsx  # single-screen + overlays
│   ├── TownView.tsx      # outpost phase stepper
│   └── overlays/
├── phone/                # Player — portrait, character-scoped
│   ├── main.tsx, index.html
│   ├── App.tsx           # connection → picker → mode routing
│   ├── ConnectionScreen.tsx, CharacterPicker.tsx
│   ├── LobbyView.tsx     # waiting screen + setup phase content
│   ├── ScenarioView.tsx  # main scenario screen + overlay state machine
│   ├── TownView.tsx      # tabbed character sheet (placeholder)
│   ├── components/       # PhoneCharacterHeader, PhoneHealthBar,
│   │                       PhoneInitiativeSection, PhoneTurnBanner,
│   │                       PhoneActionBar, PhoneConditionStrip,
│   │                       PhoneCounterRow, PhoneSummonSection,
│   │                       PhoneElementRow, PhoneInitiativeTimeline
│   ├── overlays/         # PhoneInitiativeNumpad, PhoneConditionPicker,
│   │                       PhoneCharacterDetail, PhoneExhaustPopup,
│   │                       PhoneLootDeckPopup, PhoneConditionSplash
│   └── styles/phone.css
└── display/              # Monitor — portrait, read-only, production-wired
    ├── main.tsx, index.html, manifest.json
    ├── App.tsx               # connection + mode routing, display registration
    ├── ConnectionScreen.tsx   # game code input
    ├── LobbyWaitingView.tsx   # setup-phase-aware waiting screen
    ├── ScenarioView.tsx       # live state + state-driven animations
    ├── TownView.tsx           # edition-specific town steps
    ├── mockData.ts            # prototype mode data (URL param gated)
    ├── hooks/
    │   ├── useDisplayMonsterData.ts  # API fetch for monster stats/abilities
    │   └── useStateTransitions.ts    # state change detection for animations
    ├── components/            # DisplayScenarioHeader, DisplayFigureCard,
    │                            DisplayElementBoard, DisplayInitiativeColumn,
    │                            DisplayTransitions, DisplayAMDSplash,
    │                            DisplayLootSplash, DisplayScenarioFooter,
    │                            DisplayCharacterSummary, AmbientParticles
    └── styles/display.css
```

Three parallel esbuild builds. Tree-shaking gives each device only what it uses.

---

## LOBBY MODE

### Controller (iPad, landscape)
Full-screen sequential flow. Not an overlay — a dedicated view.

**Steps:**
1. **Game Mode** — Campaign or One-Off (first connection only)
2. **Edition** — Select game edition
3. **Party** — Add/remove characters with class grid and level selector
4. **Scenario** — Scenario selection with search, level controls, derived values
5. **Preview** — Enhanced scenario preview (monster portraits, room tiles, spawns, loot deck)
6. **Chores** — Server-driven chore tracking (player confirmations, ✓/⏳ status)
7. **Rules** — Scenario briefing (special rules reference, derived values)
8. **Goals** — Battle goal reminder with "Start Scenario" button

Campaign mode: Steps 1-2 skipped on return (jump to Step 4).
Steps 1-5 are client-local state; Steps 6-8 are server-driven via `state.setupPhase`.

### Phone (portrait)
Two states based on `state.setupPhase`:
- **Waiting** (no setupPhase): Character portrait + "Waiting for GM" message
- **Setup active**: Shows chore assignment, rules briefing, or battle goal reminder
  depending on current `setupPhase` value

### Monitor (portrait)
Simple "Setting up scenario..." waiting screen.

---

## SCENARIO MODE

### Controller (iPad, landscape)
Primary: Single-screen with initiative-sorted figure grid — characters and monsters
interleaved by initiative. Absent characters shown in a greyscale bench strip below
the figure grid.

Header: Scenario info (name, level, round), element board (top-right).

Footer: Phase advance button, door SVGs with confirmation overlay, derived-value
pills with SVG icons (trap damage, gold conversion, hazard damage, bonus XP),
modifier deck floating overlay, loot deck badge.

Overlays:
- CharacterDetailOverlay — health, conditions, XP, loot, summons
- CharacterSheetOverlay — stats tab with resources, campaign progress
- ~~ScenarioSetupOverlay~~ — (deprecated, replaced by LobbyView in Batch 16b)
- ~~SetupPhaseOverlay~~ — (deprecated, replaced by LobbyView in Batch 16b)
- InitiativeNumpad — lifted to ScenarioView level (escapes scroll stacking context)
- MenuOverlay — scenario end (victory/defeat), settings
- ScenarioSummaryOverlay — per-character reward preview before commit
- LootDeckOverlay — FH loot deck draw/assign
- OverlayBackdrop — shared backdrop for all overlays

### Phone (portrait + landscape)
Character-scoped scenario view. Shows ONLY the selected player's data.
Per-character accent theming: App.tsx sets `--phone-accent`, `--phone-accent-glow`,
`--phone-accent-dark` CSS custom properties from the character's class color (edition
data). Used across HP bar, initiative glow, turn banner, action bar, numpad, and
detail overlay.

**Portrait layout** (top to bottom):
- **InitiativeTimeline** — Horizontal strip at top showing all figures sorted by
  initiative. Auto-appears at play phase start, auto-dismisses when player's turn
  starts, re-appears after End Turn. Character/monster portrait thumbnails with gold
  glow on active figure.
- **CharacterHeader** — class thumbnail, name (Cinzel), level, class color accent bar.
  Tap opens CharacterDetail overlay.
- **TurnBanner** — "Your Turn" (gold glow pulse), "Waiting" (with position), "Done"
  (checkmark). Hidden during draw phase.
- **HealthBar** — Full-width bar with current/max numerals, blood drop icon, +/- buttons.
  Color: green >50%, gold >25%, red. Carved stone visual with layered shadows.
- **InitiativeSection** — Large initiative circle or LongRestIcon. Phase-aware states:
  draw (tappable → numpad), active (gold glow), queued, done (dimmed).
- **ConditionStrip** — Horizontal scrollable row of active condition icons (36px).
  Tap to remove, "+" button opens ConditionPicker overlay.
- **ElementRow** — Compact element board reusing shared `ElementBoard` component.
  Interactive during active turn only (same inert→new→strong→waning→inert cycle as
  controller). Read-only when not the character's turn.
- **CounterRow** — Side-by-side XP (star) and Loot (coin, read-only — no +/- buttons,
  controller manages assignment). FH loot draw button when loot deck is available.
- **SummonSection** — Deferred (stubbed, returns null). Awaiting joint development
  with controller summon system.
- **ActionBar** — Fixed bottom toolbar: Long Rest (draw phase), End Turn (active turn).
  No manual Exhaust button (replaced by auto-exhaust popup at 0 HP).

**Landscape layout** (CSS Grid two-column at `max-height: 500px`):
- Left column: HP bar, initiative section, turn banner.
- Right column: conditions, element board, counters.

Overlays:
- **PhoneInitiativeNumpad** — 3×4 grid numpad, stone-tile keys, Long Rest button.
- **PhoneConditionPicker** — Edition-aware grid split Positive/Negative.
- **PhoneCharacterDetail** — Bottom sheet with swipe-to-close gesture (touch-based
  panel dragging, >80px threshold). HP, XP (with career total + progress bar),
  loot (read-only), full condition grid, Long Rest/Absent/Exhaust toggles.
- **PhoneExhaustPopup** — Full-screen dramatic overlay when HP reaches 0. Skull icon,
  deep red accents, Cinzel typography. Confirm (exhaust) or Cancel (back to 1 HP).
- **PhoneLootDeckPopup** — FH loot deck draw popup. Shows drawn card type,
  auto-assigns to character.
- **PhoneInitiativeTimeline** — (see layout section above; auto-show/dismiss lifecycle).
- **PhoneConditionSplash** — Full-screen condition reminder on turn start.
  Priority-ordered queue (stun first). Per-condition CSS effects (wound=red vignette,
  stun=shake+grey-blue, poison=green pulse, etc.). 4-second auto-dismiss or tap.

**Setup overlays** (rendered from App.tsx during `state.setupPhase`):
- **PhoneChoreOverlay** — full-screen chore assignment (monster standees, map tiles,
  overlays). Shows monster portraits, item lists, "Task Complete" confirm button.
- **PhoneRulesOverlay** — scenario briefing (special rules reference, win/loss
  conditions, scenario level + derived values).
- **PhoneBattleGoalOverlay** — battle goal reminder with edition-appropriate deal
  count (GH=2, FH=3).

Does NOT show: monsters, other characters, modifier decks, doors.

### Monitor / Display (portrait, 1080×1920 vertical tower)
Read-only, zero interaction. Dark fantasy war table aesthetic.
Production-wired to live WebSocket state with state-driven animation triggers.
Registers as `role: 'display'` with server. Auto-connects from localStorage on
page load; auto-reconnects silently on any connection loss. Connection status
shown as tiny dot (top-right), no error modals. Prototype mode at `?prototype=true`
uses mock data with keyboard controls (Tab/1-6/a/l/v/d/r).

**Layout:** Sticky header (round/level/elements) → initiative column → completed
figure tray → fixed footer (special rules, victory/defeat conditions).

**Character cards:** Initiative badge, portrait, name, level, HP bar, conditions,
XP icon + loot bag icon. Per-character accent theming from phone theme colors.
Active card has gold border + glow. Done cards collapse to compact form (portrait +
HP + conditions only) and stack vertically in bottom-right tray.

**Monster cards:** Left-justified (aligned with character cards). Initiative badge,
portrait, name, innate stat icons (from GHS API: flying, shield, retaliate, conditions
on attacks, immunities — normal white / elite gold). Ability card area right-justified
with ability name + action icons (inverted white for visibility). Standees render
below card, indented. Compact form shows portrait + flying + combined shield/retaliate.

**Completed figure tray:** Bottom-left: monster standees grouped by type (full size).
Bottom-right: compact character + monster cards stacked vertically.

**Auto-scroll:** Active figure scrolls to top. When active figure advances (via
server state change), previous figure transitions to completed tray.

**Element board:** 6 elements with strong (pulsing glow), waning (full brightness
icon, dimmed ring), inert (greyed) states. Infusion animation (radial color burst).
Consumption animation (conic-gradient vortex drain).

**Splash animations:** AMD card draw (3D perspective flip, landscape card shape,
special flares for bless/curse/2x/null). Loot card (slide in, display, shrink toward
looting character's portrait).

**Ambient effects:** Canvas particle system — embers preset (GH), snow preset (FH).
Fog layers, vignette, candlelight flicker on text.

**Edition theming:** GH warm gold (#d3a663) vs FH ice blue (#77aadd) via CSS custom
properties affecting accents, glows, borders, particles. Applied from `state.edition`
via `data-edition` attribute on document root.

**State-driven animations:** `useStateTransition` hook detects changes in:
- `state.round` → round increment flourish
- `state.finish` → victory/defeat overlay (pending, confirmed, cancelled)
- `state.monsterAttackModifierDeck.lastDrawn` → AMD card flip splash
- `state.lootDeck.current` → loot card draw splash (targets active character)
- Element state changes → infusion burst / consumption vortex (handled in DisplayElementBoard)
Animations suppressed on reconnect (only fire on live state changes).

---

## TOWN MODE

**Current state (Batch 16c):** Town mode is a placeholder. Controller and phone
TownViews show an ordered checklist of town phase steps (edition-appropriate: GH has
3 steps, FH has 5) plus a travel phase reminder. A "Town Phase Complete" button fires
the `completeTownPhase` command, which transitions `mode` from `'town'` to `'lobby'`.
Full town phase implementation is deferred to Phase T.

### Controller (iPad) — Future Design

**FH Outpost Phase — 5-step guided workflow:**
1. Passage of Time — calendar with season marker, advance + section prompts
2. Outpost Event — draw card (on monitor), resolve A/B on controller, attack events
3. Building Operations — building list with status + operation effects
4. Downtime — per-character activities: level up, retire, craft, brew, sell
5. Construction — building catalog, select + confirm, morale spend option

After outpost: Scenario selection with world map + available scenarios.

**GH Town Phase (simpler):** City event → character management → scenario selection.

### Phone (portrait)

**Character Sheet — tabbed:**
| Tab | Content |
|-----|---------|
| Items | Equipped (by slot), owned, shop (filtered by prosperity), FH crafting/alchemist |
| Perks | Perk points, perk list with AMD modifications, applied vs unapplied |
| Level Up | XP vs threshold, guided steps if eligible (pick card, HP increase, perks) |
| Enhancements | Cost calculator, ability card browser with enhancement slots |
| Personal Quest | Quest description, progress, retirement conditions |

### Monitor (portrait)

**Frosthaven:** Outpost map (buildings), calendar, morale/defense/resources.
During events: full event card overlay for table to read.

**Gloomhaven:** City map, prosperity track. Events as overlay.

**After town phase:** World map with available scenarios. Party movement breadcrumbs
to selected mission. Road event card overlay.

---

## MODE TRANSITIONS

### Scenario End → Town → Lobby
1. Win/loss determination (`prepareScenarioEnd` → pending state on all devices)
2. XP from dial → each character
3. Gold from loot (gold × conversion rate)
4. FH: Resources from loot cards
5. Treasure claims, battle goals
6. Scenario rewards (achievements, unlocks)
7. FH: Inspiration (4 − character count)
8. `completeScenario` → `state.mode = 'town'`
9. Town phase checklist (placeholder) → `completeTownPhase` → `state.mode = 'lobby'`

### Lobby → Scenario
1. Controller steps through lobby flow (edition → party → scenario → preview → chores → rules → goals)
2. `startScenario` command atomically: runs scenario setup, sets `mode = 'scenario'`, sets `edition`, clears `setupPhase`/`setupData`
3. All devices switch to ScenarioView simultaneously

---

## BUILD ORDER

### Phase R (Rebuild) — Scenario Mode
R1-R6: Data layer, Preact scaffold, shared components, controller view,
scenario automation, round flow. After R6: playable scenario on all devices.

### Phase T (Town) — Campaign Layer
T1: Scenario end + rewards workflow
T2: Character sheet on phone (items, perks, level up, enhancements)
T3: FH outpost phase on controller (5-step guided)
T4: Town mode monitor display (outpost map, events)
T5: Scenario selection with world map
T6: Event cards (road/city/outpost) with monitor display
T7: GH town phase variant

### Phase P (Polish)
Full playtesting, visual refinement, PWA, Docker, documentation.

---

## DATA REQUIREMENTS

### Scenario Mode (R1 data layer)
Character stats, monster stats, scenarios, ability decks, level calculation,
modifier decks, condition definitions.

### Town Mode (additional data, Phase T)
Item catalog, building definitions (FH), campaign structure, event cards,
personal quests, enhancement costs, prosperity thresholds, XP thresholds,
town guard deck (FH), alchemy chart (FH).
