# Gloomhaven Command — App Mode Architecture

Two operational modes across three device roles. Mode transitions are server
commands — all devices switch simultaneously via WebSocket broadcast.

## Mode Flow

```
TOWN MODE → Road Event (transition) → SCENARIO MODE → Scenario End (transition) → TOWN MODE
```

`GameState.mode`: `'town' | 'scenario' | 'transition'`

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
│   ├── ScenarioView.tsx  # single-screen + overlays
│   ├── TownView.tsx      # outpost phase stepper
│   └── overlays/
├── phone/                # Player — portrait, character-scoped
│   ├── main.tsx, index.html
│   ├── ScenarioView.tsx  # health, initiative, conditions, turn
│   ├── TownView.tsx      # tabbed character sheet
│   └── styles/
└── display/              # Monitor — portrait, read-only
    ├── main.tsx, index.html
    ├── ScenarioView.tsx  # vertical tower layout
    └── TownView.tsx      # outpost map, events, world map
```

Three parallel esbuild builds. Tree-shaking gives each device only what it uses.

---

## SCENARIO MODE

### Controller (iPad, landscape)
Primary: Single GHS-style screen — initiative-sorted figure list with characters
and monsters interleaved. Footer bar with phase button, scenario info, elements,
modifier deck.

Overlays: Character detail, monster detail, scenario controls (doors, manual
monster add, level adjust). Collapsible secondary panel for less-frequent actions.

### Phone (portrait)
Character-scoped: Health bar, initiative input (numpad overlay), active conditions
(inline icons), XP counter, loot/gold counter, summon cards, turn indicator,
long rest button. Does NOT show: monster details, other characters, modifier decks,
element board.

### Monitor (portrait, vertical tower)
Read-only: Initiative timeline (vertical), character summary bars, monster groups
with ability card + standee health, element board, round counter, scenario name.

---

## TOWN MODE

### Controller (iPad)

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

### Scenario End → Town
1. Win/loss determination
2. XP from dial → each character
3. Gold from loot (gold × conversion rate)
4. FH: Resources from loot cards
5. Treasure claims, battle goals
6. Scenario rewards (achievements, unlocks)
7. FH: Inspiration (4 − character count)
→ Automatic transition to Town Mode

### Town → Scenario
1. Scenario selected from world map
2. Road event drawn → displayed on monitor, resolved on controller
3. Transition to Scenario Mode
4. All devices switch views simultaneously

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
