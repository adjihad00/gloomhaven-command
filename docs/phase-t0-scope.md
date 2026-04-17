# Phase T0 — Campaign, Party & Player Sheets (Scope Document)

**Status:** Architectural scope. Not a Claude Code prompt. Defines the
three canonical record-keeping surfaces of a campaign, their device
placement, information architecture, and how they relate to other
Phase T work. A companion **Design Brief** (`phase-t0-design-brief.md`)
covers aesthetic direction. Implementation prompts follow as T0a / T0b
/ T0c / T0d.

## Why these exist

Paper-and-pencil campaigns live and die by three artifacts: the player's
character sheet, the party's party sheet (front of pad), and the
campaign sheet (back of pad). Everything else — initiative dials, AMD
cards, battle goals, event cards — is transient. These three persist
across **dozens of sessions**, accumulating the entire story of a
campaign. They deserve proportional design investment.

The project has scattered pieces of each (controller
`CharacterSheetOverlay` as read-only stub, phone `PhoneCharacterDetail`
as in-scenario controls, no party sheet, no campaign sheet). The GHS
Audit flagged the missing party sheet at row 1058 as a Medium-priority
gap. Phase T progression work (T2a-d) is building tabs that naturally
belong inside a Player Sheet but is doing so in a parallel
`TownView` tab strip — which will become the de facto character sheet
by accident unless T0 defines the canonical home first.

## Rule of placement

Each sheet has a primary device. Secondary devices may *view* it but
don't drive interactions.

| Sheet | Primary | Secondary (read-only) | Why |
|---|---|---|---|
| **Player Sheet** | Phone | Controller quick-view of any character | Player owns their own sheet; GM needs visibility for rulings |
| **Party Sheet** | Controller | Display (decorative) | Shared party state is GM-managed; phones see summary only |
| **Campaign Sheet** | Controller | Display (decorative) | World-level state; GM authority; rarely changed per session |

## The sheets are always accessible

These are *reference documents*, not phase-locked flows. A player checks
their personal quest mid-scenario. The GM checks reputation when a
character says "I want to buy this." The table looks at the campaign's
scenario flowchart between plays. None of these interactions should
require leaving the current mode.

Every sheet must be reachable from every mode (lobby, scenario, town)
via a persistent entry point. The sheet opens as a full-screen overlay
and closes cleanly back to whatever was happening. Mode-appropriate
restrictions apply — you can't equip an item during scenario mode — but
viewing is unrestricted.

## How T0 relates to other phases

T0 is the **canonical home**. Other phases rent space inside it.

- **T1 (rewards)** — complete. The rewards tableau feeds into Player
  Sheet history ("Scenario #23 completed — gained 12 XP, 8 gold, leveled
  to 4").
- **T2a (items)** — shop + equip + unequip + sell becomes the **Items
  tab** of the Player Sheet. Not a separate TownView tab.
- **T2b (level up + perks)** — **Level Up + Perks tabs** of the Player
  Sheet.
- **T2c (personal quest + retirement)** — **Personal Quest tab** of the
  Player Sheet.
- **T2d (enhancements + FH crafting/brewing)** — **Enhancements tab**.
  Crafting and brewing live in their own tabs inside the Player Sheet
  (each FH-only).
- **T3 (FH outpost controller)** — doesn't live inside a sheet; it's a
  flow. But it reads/writes Campaign Sheet data (buildings, calendar,
  morale). Campaign Sheet's FH tab is the persistent view; T3 is the
  periodic transaction.
- **T4 (display town map)** — the Campaign Sheet's Outpost tab, on
  display.
- **T5 (world map scenario selection)** — the Party Sheet's Location
  tab.
- **T6 (event card system)** — events drawn during flows; historical
  event outcomes stored on the Party Sheet's Events tab.
- **T7 (GH town phase)** — Campaign Sheet variant for GH (simpler;
  prosperity + achievements dominate; no outpost/buildings).
- **T8 (display coordinator)** — orchestrates phases; can project sheet
  views onto display when a phase isn't active.

Two implications for existing prompt plans:

1. **T2a needs revision.** Currently scoped to build a TownView with
   tabs including Items. Should be rewritten post-T0 to build the
   Player Sheet's Items tab. The work is mostly the same; the home
   changes. This is the one-time rework cost of sheets-first.
2. **Display town view (T4) absorbs Campaign Sheet's outpost surface.**
   T4's prompt should reference T0 and place the outpost map as the
   Campaign Sheet's Outpost tab, with the display simply rendering that
   tab when in town mode and nothing else is overriding.

## Player Sheet

### Placement
**Primary device:** phone. Full-screen overlay, reachable from every
phone screen via a persistent character-portrait button that currently
opens `PhoneCharacterDetail`. That button now opens the Player Sheet.
`PhoneCharacterDetail` is **absorbed** — its in-scenario controls
become the Overview tab's "Active Scenario" section when a scenario is
running.

**Secondary device:** controller. GM opens read-only view of any
character from the controller's party roster. No editing from
controller — the player drives their own sheet. Exception: the GM can
adjust health/conditions/XP during scenario play via the existing
scenario mode controls; those aren't Player Sheet actions.

### Tabs

Order matters — most-used first.

1. **Overview** — portrait, name/title, class icon, level, XP bar, gold,
   career stats (scenarios played, retirements, current hand size),
   **Active Scenario section** (only visible in scenario mode; absorbs
   the existing PhoneCharacterDetail controls: HP bar, conditions,
   initiative, turn actions), **Current Town Activity** (only visible
   in town mode during T8's downtime: "At the Craftsman," "Browsing
   shop," etc.)
2. **Items** (T2a home) — equipped by slot, inventory, shop browser,
   sell actions
3. **Hand & Deck** — ability cards available at current level. Visual
   card gallery with filter: all / in hand / removed / lost / discard /
   enhanced. In scenario mode, hand view reflects live play (if we're
   tracking that yet — it's a stretch goal). In town/lobby, planning
   view.
4. **Perks** (T2b home) — perk list with AMD modification preview,
   applied/unapplied, "perk points available" chip
5. **Level Up** (T2b home, conditionally visible) — only tab-active when
   eligible. Guided flow (pick card, HP increase, perk mark).
6. **Enhancements** (T2d home) — ability card browser with enhancement
   slots, cost calculator, applied enhancements listed
7. **Personal Quest** (T2c home) — quest card, progress markers,
   retirement conditions, retire button
8. **Notes** — freeform journal, persists forever. Per-character. Useful
   for tracking long-running story hooks, NPCs met, loose ends.
9. **History** — auto-generated timeline. Scenarios played, level-ups
   with dates, major events (retirement of a party member, character
   death via exhaustion that ended a scenario, personal quest milestones).
   Sourced from T1 rewards snapshots and `state.party.scenarios`.

### Interaction model
- Tabs slide horizontally at the top (existing phone pattern).
- Overview is the landing tab; sticks on reopen.
- In scenario mode, closing the sheet returns to ScenarioView;
  reopening lands on Overview with Active Scenario section visible.
- FH-only tabs (Enhancements if GH doesn't have them — check rules;
  Crafting/Brewing if separate from Items) hide on GH/jotl/cs/fc/toa.
  Edition detection via `state.edition`.

### State wiring
- All data sourced from `state.characters[i]` and
  `state.characters[i].progress`. No new engine state for T0a.
- Future T0 batches may add per-character notes and history. Those
  additions go in `CharacterProgress.notes` (field exists) and a new
  `CharacterProgress.history: HistoryEntry[]` array. History entries
  populate on state transitions (scenario complete, level up, etc.).

### Commands
None new in T0a beyond existing scenario commands. Progression
commands arrive with T2a-d.

---

## Party Sheet

### Placement
**Primary device:** controller. Opens as full-screen overlay from a
persistent "Party" button in the main nav (add one — current
controller lacks persistent nav). Accessible in every mode.

**Secondary device:** display. When nothing else claims the display
(lobby idle, town idle between phases), display shows a decorative,
read-only Party Sheet — basically a glorified "what's the party
up to" screen. Auto-hides when a phase starts.

**Phone:** no Party Sheet view. Phones may see a **Party** mini-pill
in their own sheet's Overview tab (party name, reputation, current
location) but can't open the full sheet.

### Tabs

1. **Roster** — grid of character portraits with name/title/level/HP
   max. Active characters top, retired in an archive section below.
   Tap a portrait → controller-side quick view of that Player Sheet
   (read-only). Includes "Add character" and "Retire character" GM
   actions.
2. **Standing** — editable party name, reputation slider with
   price-modifier chip (uses T2a's `getReputationPriceModifier`),
   party notes freeform, party achievements list (from
   `state.party.achievementsList`).
3. **Location** — current position (`state.party.location`). When T5
   lands, embeds world map scenario selector here. Until then, plain
   text + edit.
4. **Resources** (FH only) — morale/defense/soldiers/inspiration
   gauges, shared loot pool.
5. **Events** — active event cards, historical event outcomes (who
   drew, what was chosen, when).

### Interaction model
- Tabs run vertically on left side (iPad landscape works better with
  side tabs for persistent-nav surfaces).
- Each tab content area takes the right two-thirds of the screen.
- Editable fields commit on blur or Enter.

### State wiring
All fields map to `state.party.*` which already exists in the engine.
No new state needed.

### Commands
Existing `updateCampaign` (generic `{ field, value }` updater) is the
catch-all. T0b may add more structured commands if `updateCampaign`
feels too loose in practice (e.g. `setPartyName`, `setReputation`,
`addPartyAchievement`). Prefer structured commands for values with
validation (reputation range, achievement uniqueness).

---

## Campaign Sheet

### Placement
**Primary device:** controller. Persistent "Campaign" button in main
nav alongside "Party." Full-screen overlay.

**Secondary device:** display. Same deal as Party Sheet — fills the
display when no phase-specific view is claiming it. Especially the
Outpost tab in FH, which is effectively a living outpost diorama.

### Tabs

1. **Prosperity** — checkbox grid for prosperity levels 1–9. Each level
   row shows thresholds (checkboxes toward the next level), and when a
   level unlocks, a celebratory reveal shows new items / characters
   unlocked.
2. **Scenarios** — completed scenarios list + a visual flowchart of
   the scenario unlock tree (nodes for each scenario, lines for
   unlocks/blocks, state colors per scenario status). Tap a node to see
   completion details (date, who played, rewards, outcome).
3. **Unlocks** — items / characters / ability cards / treasures
   revealed. Filterable, searchable.
4. **Donations** — sanctuary/temple running total with milestone
   markers at 10g intervals; mini-animation when crossing a milestone.
5. **Achievements** — global achievements, progress toward conclusions.
6. **Outpost** (FH only) — the big one. Outpost map with building
   positions. Each building shows status (unlocked / built / damaged /
   wrecked) with color coding. Calendar with season marker and week
   counter. Campaign stickers. Trials. This tab is what the display
   shows in its idle town state; it's also what T4 designs (T4's
   "display town map" = this tab rendered on display).
7. **Settings** — edition (read-only after campaign start), campaign
   mode (campaign / one-off / casual), GHS save import/export.

### Interaction model
Same side-tab pattern as Party Sheet on controller.
Display rendering uses only the decorative mode — no interactions.

### State wiring
All fields map to `state.party.*` (confusingly, "party" on the state
carries both party-level and campaign-level fields). Consider renaming
for clarity in T0 scope: `state.party` → `state.campaign` as a future
consideration. Not doing that rename in T0a to avoid churn; documenting
here so future batches know the semantic split.

### Commands
`updateCampaign` handles most. Structured additions where validation
is needed: `adjustProsperity(delta)`, `addDonation(amount)`,
`unlockItem(itemId)`, `unlockCharacter(className)`, `markAchievement(key)`.

---

## T0 Build Order

| Batch | Scope | Device focus | Rework risk |
|---|---|---|---|
| **T0a** | Player Sheet shell + Overview tab. Absorbs `PhoneCharacterDetail`. Placeholder tabs (Items/Perks/etc.) labeled "Coming in T2…" pointing to known batches. Controller read-only quick-view. | Phone primary | Low — new surface, replaces only overlay |
| **T0b** | Party Sheet on controller. All tabs functional except Location (waiting on T5). Display decorative rendering. | Controller + display | Low — entirely new surface |
| **T0c** | Campaign Sheet on controller. All tabs functional except Outpost (waiting on T3/T4 for full data coverage — GH tabs can all ship). Display decorative rendering. | Controller + display | Low — entirely new surface |
| **T0d** | Notes + History tabs on Player Sheet. Requires engine additions to `CharacterProgress`. | Phone | Medium — engine type changes, migration of existing saves |

After T0a-c: T2a-d rewrite targets the Player Sheet tabs.

## Risks & constraints

1. **Phone screen real estate.** 9 tabs in a scrollable horizontal
   strip is at the edge of usable. Design brief handles visual density;
   if it can't make 9 tabs readable, consider grouping (Progression
   super-tab containing Perks/Level Up/Enhancements).
2. **Controller iPad landscape layout.** Side tabs work here but need to
   not steal space from the tab content. Design brief specifies widths.
3. **Display decorative mode** must not fight T8's phase-aware views.
   Display shows Campaign/Party Sheet **only when nothing else is
   active** — specifically: `state.mode === 'lobby'` without setupPhase,
   OR `state.mode === 'town'` with `state.party.townPhase?.step`
   unset/in a quiet moment. T8 owns the override logic.
4. **Read-only in wrong mode.** Items tab on phone during scenario mode
   shows inventory but equip buttons disabled. Design must make the
   disabled state explicit, not confusing.
5. **Save compatibility.** GHS save imports should map cleanly into
   Party / Campaign Sheet fields. Current import code (`ghsCompat.ts`)
   handles the mapping; T0 surfaces just read what's there. New fields
   T0 introduces (per-character history, structured notes) must import
   as empty defaults and persist forward only.

## What T0 does NOT include

- Progression commands (T2)
- Outpost phase flow (T3)
- World map (T5)
- Event system (T6)
- Phase orchestration (T8)
- Monster stat reference (unrelated)

T0 is surfaces only. The data and the surface. Other phases light up
interactivity inside the surfaces T0 creates.

---

## Where to save this

Repo: `docs/PHASE_T0_SCOPE.md`. Reference from `docs/ROADMAP.md` as
the root of a new Phase T0 subsection.
