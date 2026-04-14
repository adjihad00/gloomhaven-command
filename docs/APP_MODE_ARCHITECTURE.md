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
│   ├── App.tsx           # connection → picker → mode routing
│   ├── ConnectionScreen.tsx, CharacterPicker.tsx
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
└── display/              # Monitor — portrait, read-only
    ├── main.tsx, index.html
    ├── ScenarioView.tsx  # vertical tower layout
    └── TownView.tsx      # outpost map, events, world map
```

Three parallel esbuild builds. Tree-shaking gives each device only what it uses.

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
- ScenarioSetupOverlay — 3-step wizard (edition → characters → scenario)
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

Does NOT show: monsters, other characters, modifier decks, doors.

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
