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

Each role's `main.tsx` mounts its Preact `<App />` and then calls
`registerServiceWorker({ swPath: '/app/<role>/sw.js', scope: '/<role>' })`
from `app/shared/swRegistration.ts` (Phase 6 — self-healing SW with a
pre-register version check against `/sw-version.json`).

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
│   ├── useDataApi.ts     # fetch from /api/data/*
│   ├── useScenarioText.ts    # fetch special rules from /api/ref/scenario-text
│   └── useScenarioBookData.ts # fetch win/loss from /api/ref/scenario-book
├── shared/               # Non-component shared code
│   ├── styles/           # theme.css, typography.css, components.css
│   ├── assets.ts         # asset URL helpers
│   └── swRegistration.ts # self-healing SW register + client watchdog (Phase 6)
├── controller/           # GM — iPad landscape, full control
│   ├── main.tsx, index.html
│   ├── App.tsx           # mode router + ControllerNav (T0b) + PartySheetOverlay (T0b)
│   │                       + CampaignSheetOverlay (T0c) mounts
│   ├── ControllerNav.tsx # persistent ⋯ button (T0b) reachable in every mode
│   ├── LobbyView.tsx     # 8-step sequential setup flow
│   ├── ScenarioView.tsx  # single-screen + overlays; threads onOpenPartySheet
│   │                       + onOpenCampaignSheet to inline MenuOverlay (T0c)
│   ├── TownView.tsx      # outpost phase stepper
│   └── overlays/         # PartySheetOverlay (T0b), CampaignSheetOverlay (T0c) —
│                           controller-side readOnly=false mounts of shared sheets
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
│   │                       PhoneExhaustPopup, PhoneLootDeckPopup,
│   │                       PhoneConditionSplash, PhoneRewardsOverlay,
│   │                       PhoneChoreOverlay, PhoneRulesOverlay,
│   │                       PhoneBattleGoalOverlay
│   ├── sheets/           # Phase T0a — Player Sheet (canonical character home,
│   │                       reachable from every mode via portrait button).
│   │                       PlayerSheet, header, tabs, intro, menu,
│   │                       IlluminatedCapital. tabs/OverviewTab + 5 placeholders.
│   │                       Absorbed PhoneCharacterDetail's controls into
│   │                       OverviewActiveScenario.
│   └── styles/phone.css
└── display/              # Monitor — portrait, read-only, production-wired
    ├── main.tsx, index.html, manifest.json
    ├── App.tsx               # connection + mode routing, display registration,
    │                           mounts DisplayRewardsOverlay when state.finishData present.
    │                           Phase T0c: idle lobby (no setupPhase) and town mode render
    │                           DisplayIdleSheetsView in place of LobbyWaitingView/TownView.
    ├── views/
    │   ├── DisplayIdleSheetsView.tsx  # alternates Party + Campaign Sheets (T0c) —
    │   │                                 fade-swap on each sheet's onCycleComplete
    │   └── DisplayPartySheetView.tsx  # decorative Party Sheet wrapper (T0b);
    │                                     @deprecated by T0c (retained for rollback)
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
    ├── overlays/              # DisplayRewardsOverlay (Phase T1)
    └── styles/display.css
```

Three parallel esbuild builds. Tree-shaking gives each device only what it uses.

---

## Cross-Mode Surfaces

### Party Sheet (Phase T0b)

The **Party Sheet** is the campaign's canonical shared-state surface. It is
reachable from every controller mode (Lobby / Scenario / Town) via the
hamburger `MenuOverlay`:

- **Lobby / Town:** opened by the floating `⋯` button from
  `ControllerNav` (mounted at `app/controller/App.tsx` as a sibling to
  the mode view; rendered only when `mode !== 'scenario'` so it doesn't
  overlap the scenario header's element board).
- **Scenario:** opened by the `☰` button in `ScenarioHeader.menu-btn`
  (already present pre-T0b). `ScenarioView` receives an `onOpenPartySheet`
  prop from App.tsx and threads it into its `MenuOverlay` mount, so the
  hamburger has the Party Sheet entry across all modes.

Both entry points mount the same `MenuOverlay` component (Undo · Party
Sheet · Export · Disconnect). Scenario-specific controls (End Scenario —
Victory / Defeat) live in a separate `ScenarioControlsOverlay` triggered
by clicking the scenario name (`.scenario-label--interactive`) in the
header — clusters scenario actions next to the scenario title instead
of nested in a catch-all menu.

The Party Sheet overlay itself (`PartySheetOverlay`) is mounted from
`App.tsx` so it sits at the app root; `readOnly: false` enables full
editing.

**Tabs (in order):** Roster · Standing · Location · Resources (FH only) · Events

- **Roster** — active-character portrait grid (per-class accent borders from
  `getCharacterTheme`), absent strip, retirement archive (collapsible).
- **Standing** — editable party name; reputation slider (−20 to +20) with
  live price-modifier chip computed via `getReputationPriceModifier`
  (rules §16); party notes textarea; party achievements list with
  add/remove via `addPartyAchievement` / `removePartyAchievement`
  structured commands.
- **Location** — editable current location + reverse-chronological
  scenario history timeline. World-map scenario picker lands in T5.
- **Resources (FH only)** — morale / defense / soldiers / inspiration /
  trials gauges with +/− buttons; shared loot pool chips (read-only;
  mutation UI belongs to T3 outpost). Tab hidden on non-FH editions.
- **Events** — active event cards as read-only list; empty state with
  gilt-bordered sigil. T6 will refine active/resolved lifecycle.

Editable text inputs use `useCommitOnPause` (blur / Enter / 1000 ms
typing-pause commit).

### Campaign Sheet (Phase T0c)

The **Campaign Sheet** is the campaign's world-record surface — the third
and final sheet in the T0 trio. Reachable from every controller mode via
the same `MenuOverlay` that exposes Party Sheet, immediately below the
Party Sheet entry. Mounted as a shared `app/shared/sheets/CampaignSheet*`
family parallel to PartySheet.

**Tabs (in order):** Prosperity · Scenarios · Unlocks · Donations ·
Achievements · Outpost (FH only) · Settings

- **Prosperity** — current level (1–9) with progress bar to next
  threshold; level list with completed / current / next / locked states;
  GM "+1 checkmark" button. Threshold tables in `getProsperityLevel`
  (rules §17).
- **Scenarios** — reverse-chronological list of completed scenarios with
  filter chips (All / Main / Casual / Conclusions). Empty state with
  scroll-and-quill sigil. No add/edit — scenarios append automatically
  via `completeScenario`.
- **Unlocks** — three collapsible sections (Items / Characters /
  Treasures) with shared search filter. Read-only.
- **Donations** — running total + milestone pips (every 10 g) with
  flash-on-cross cue; GM "+10g Donate" button.
- **Achievements** — global achievements list with add/remove via
  structured `addGlobalAchievement` / `removeGlobalAchievement`
  commands (parallel to T0b's party achievement pattern; GM-only).
- **Outpost (FH only)** — dashboard form: calendar strip (season +
  week), resource pills (Morale / Defense / Soldiers / Inspiration /
  Trials), building cards with state chips (Active / Damaged /
  Wrecked / Building), campaign stickers. Hidden on non-FH editions.
  Coordinate-based map deferred to T4 / T0c-polish.
- **Settings** — read-mostly: edition · campaign mode · game code ·
  Export Campaign action (opens `/api/export/{gameCode}`) · Import
  placeholder (disabled).

The Campaign Sheet's **signature visual is wax-sealed tab headers** — every
tab content area opens with a circular gilt wax-seal motif containing a
tab-specific glyph (gears / scroll / chest / coin / shield / building /
gear), followed by the tab title in Cinzel and a thin gilt rule. Shared
primitive: `app/shared/sheets/WaxSealHeader.tsx`.

One-time intro animation: "a map unfurling" (rolled scroll with wax seal,
unfurls horizontally, title fades in). Persists via
`updateCampaign('campaignSheetIntroSeen', true)`. Skip on tap; reduced-motion
skips the animation while still setting the flag.

### Display decorative idle rotation (Phase T0c)

The display renders `DisplayIdleSheetsView` in place of `LobbyWaitingView`
when `mode === 'lobby'` AND no `setupPhase` is active, AND in place of
`TownView` whenever `mode === 'town'`. Scenario mode is untouched —
`ScenarioView` fully owns the display during play. During active setup
phases (chores / rules / goals), `LobbyWaitingView` still renders so
table-level prompts drive the ceremony.

`DisplayIdleSheetsView` alternates **Party Sheet ↔ Campaign Sheet**.
Each sheet mounts with `readOnly + autoCycle + skipIntro + layout="portrait"`,
running its own internal 30-second per-tab cycle. When the inner sheet
wraps past its last visible tab, its optional `onCycleComplete` callback
fires and the wrapper fades for 300 ms while swapping to the sibling
sheet. This gives each sheet a continuous breath
(roughly 2.5–3.5 minutes per pass depending on edition) instead of
choppy per-tab interleaving.

The display ignores Escape and has no interactions besides a 96×96
top-left tap-zone (`display-idle-sheets__hot-zone`) that opens the
existing `DisplayConfigMenu`. `DisplayPartySheetView` is retained
importable + JSDoc-`@deprecated` for rollback.

The Party Sheet's signature visual is the **gilt-bound tab binding** — a
continuous gilt-gold metallic rule along the tab strip's inner edge,
broken only at the active tab via a content-panel-coloured pseudo-element.
Reads as a brass-reinforced page binding biting into the active tab.

The Campaign Sheet's signature visual is the **wax-sealed tab headers**
(see Campaign Sheet section above) — distinguishes the two sheets
visually so the alternation reads as two separate ledgers, not one
view rearranging.

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
the figure grid. Monster groups have inline standee management (+ Normal, + Elite,
× remove) for mid-game spawns and corrections.

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
- **PlayerSheet** *(Phase T0a, replaces PhoneCharacterDetail)* — full-screen modal
  reached via the character-portrait button in every mode. 6-tab strip
  (Overview / Items / Progression / Personal Quest / Notes / History). Overview
  is fully implemented; other tabs are structural placeholders pointing at
  their implementation batch. Overview composes: XP bar with wax-seal level-up
  cue, 4-up stat medallions (Gold/HP/Scenarios/Perks), **Active Scenario**
  section (scenario mode only — absorbs all HP/XP/condition/element/long-rest/
  exhaust controls from the old PhoneCharacterDetail), and a hand-preview
  placeholder for T2b. One-time intro animation persists via
  `CharacterProgress.sheetIntroSeen` + the new `setCharacterProgress` command.
  Same surface renders read-only on controller via `PlayerSheetQuickView`
  (replaces the old controller `CharacterSheetOverlay`).
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
figure tray → fixed footer (special rules from reference DB with inline icons,
victory/defeat conditions from book extraction pipeline).

**Character cards:** Initiative badge, portrait, name, level, HP bar, conditions,
XP icon + loot bag icon. Per-character accent theming from phone theme colors.
Active card has gold border + glow. Done cards collapse to compact form (portrait +
HP + conditions only) and stack vertically in bottom-right tray (always right-aligned).
During draw phase, initiative badges show `??` for entered values (secret until reveal),
empty for unentered, `99` for long rest (publicly declared per rules).

**Monster cards:** Left-justified (aligned with character cards). Initiative badge,
portrait, name, innate stat icons (from GHS API: flying, shield, retaliate, conditions
on attacks, immunities — single icon per stat type with white normal / gold elite values
when they differ). Ability card area right-justified with real card name (from labels)
+ full action tree: move/attack/range totalized against base stats (normal/elite colors),
conditions (colored icons), elements (infuse/consume icons), summons (name text),
sub-actions (recursive, smaller). Standees render below card, indented.
Compact form shows portrait + flying + combined shield/retaliate.

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

**Player Sheet — canonical character home (Phase T0a).** The same sheet shown
in every mode (not town-only). Reachable from the character-portrait button
in Lobby / Scenario / Town views. Tabs are stable across batches:

| Tab | Content | Batch |
|-----|---------|-------|
| Overview | XP bar, stat medallions (Gold/HP/Scenarios/Perks), Active Scenario controls (scenario mode), Hand preview | ✓ T0a |
| Items | Equipped (by slot), owned, shop (filtered by prosperity), FH crafting/alchemist | T2a |
| Progression | Perks (AMD mods + applied status), Level Up flow, Enhancements, FH crafting/brewing | T2b + T2d |
| Personal Quest | Quest description, progress markers, retirement conditions | T2c |
| Notes | Freeform per-character journal (persistent via `CharacterProgress.notes`) | ✓ T0d |
| History | Auto-generated timeline of scenarios; future batches extend via `HistoryEntry` variants | ✓ T0d |

T2a-d tabs (Items / Progression / Personal Quest) remain "Available in [batch]"
placeholders; T0d ships the Notes and History tabs as real content. The
controller renders the same sheet read-only via `PlayerSheetQuickView` (opened
from `CharacterDetailOverlay.onOpenSheet`); the `readOnly` flag gates
progression tabs and makes Notes display-only, but keeps the Active Scenario
section interactive so the GM retains HP/condition controls.

The History tab auto-seeds from `state.party.scenarios[]` on first open via
the `backfillCharacterHistory` command (engine-gated idempotent). Live entries
are appended by engine hooks at trigger sites — T0d hooks
`handleCompleteScenario` (victory → `scenarioCompleted`, defeat →
`scenarioFailed`, absent characters skipped). Backfilled entries render
dashed-border + "Reconstructed" chip with no reward detail; live entries
render the XP / gold / battle-goal-check rewards from the `state.finishData`
snapshot captured at `prepareScenarioEnd` time.

### Monitor (portrait)

**Frosthaven:** Outpost map (buildings), calendar, morale/defense/resources.
During events: full event card overlay for table to read.

**Gloomhaven:** City map, prosperity track. Events as overlay.

**After town phase:** World map with available scenarios. Party movement breadcrumbs
to selected mission. Road event card overlay.

---

## MODE TRANSITIONS

### Scenario End → Town → Lobby (Phase T1)
1. **`prepareScenarioEnd`** builds `state.finishData` — a per-character rewards
   snapshot containing XP (scenario + bonus + career delta), gold (coins ×
   conversion), FH resources, treasures revealed during play, XP thresholds per
   rules §12, battle-goal check slot, FH inspiration (`4 - playerCount` on
   victory), and a `dismissed` flag per row. `state.finish` becomes
   `pending:victory` or `pending:failure`. Broadcast to all clients.
2. **Pending window** — snapshot is mutated in place:
   - `setBattleGoalComplete({ characterName, edition, checks: 0..3 })` —
     character-scoped. Defeat rejected. GM can toggle from controller, player
     from own phone.
   - `claimTreasure({ characterName, edition, treasureId })` — moves id from
     `treasuresPending` to `treasuresClaimed` on the snapshot row; resolves
     reward text via `DataContext.getTreasure`.
   - `dismissRewards({ characterName, edition })` — per-phone local close (other
     phones unaffected).
   - `cancelScenarioEnd` — clears both `finish` and `finishData`, snapshots
     everywhere dismiss.
3. **`completeScenario`** atomically applies the snapshot to `char.progress`
   (experience, gold, loot resources, battleGoals checks on victory, treasure
   rewards via `applyTreasureReward`). FH inspiration rolls into
   `state.party.inspiration`. In-scenario counters (experience, loot, lootCards,
   treasures) reset. Mode → `'town'`; `finish` → `success`/`failure`.
   `finishData` is intentionally preserved through the transition so all three
   clients continue showing the rewards tableau.
4. **Rewards surfaces stay visible through town:**
   - Phone `PhoneRewardsOverlay` mounts from `app/phone/ScenarioView.tsx` while
     `finishData` exists; Continue button fires `dismissRewards` and hides locally.
   - Controller `ScenarioSummaryOverlay` — lifecycle unchanged (open on
     `prepareScenarioEnd`, close on cancel/confirm). Confirm fires
     `completeScenario`.
   - Display `DisplayRewardsOverlay` mounts from `app/display/App.tsx` as a
     sibling to the mode view so it survives the scenario→town transition;
     full-bleed read-only tableau with edition-themed particles.
5. Town phase checklist (placeholder) → **`completeTownPhase`** →
   `state.mode = 'lobby'` AND `state.finishData = undefined` (rewards clear).
6. **`startScenario`** on the next run also clears `finishData` defensively, so
   no stale rewards leak between scenarios.

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
