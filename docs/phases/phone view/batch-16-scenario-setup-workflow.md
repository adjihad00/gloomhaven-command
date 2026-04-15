# Batch 16: Multi-Phase Scenario Setup with Chore Assignment

## Skills to Read FIRST

1. **UI/UX Pro Max skill** — Read ALL `.md` files in:
   `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
2. **Frontend Agent skills** — Read ALL `.md` files in:
   `C:\Users\Kyle Diaz\.agents\skills\`
3. **Project conventions** — Read `app/CONVENTIONS.md`

---

## Overview

Replace the current scenario setup flow (select scenario → immediately initialize) with a multi-phase collaborative workflow that mirrors the two-phase scenario completion flow from Batch 15.

The goal: when the GM selects a scenario, every player at the table gets an assignment on their phone ("You're collecting monster standees", "You're building the map"), complete with images and checklists. This turns the 5-minute setup scramble into an organized, parallel process.

### Workflow Phases

```
Phase 1: PREVIEW     — Controller selects scenario, sees full preview overlay
Phase 2: CHORES      — Controller assigns setup tasks, phones show assignments
Phase 3: RULES       — All devices show special rules + win conditions
Phase 4: GOALS       — Phones remind players to choose battle goals
Phase 5: START       — Controller confirms, scenario initializes on all devices
```

---

## Phase 1: Enhanced Scenario Preview (Controller)

### Current State
The controller has a `ScenarioSetupOverlay` with a 3-step wizard (Edition → Characters → Scenario). After selecting a scenario, it calls `setScenario` and the scenario initializes immediately.

### New Behavior
After the user selects a scenario in step 3, instead of immediately initializing, show an **enhanced preview overlay** with full scenario information derived from the scenario JSON data.

### Audit First
Read the actual scenario JSON files to understand what fields are available. Check both GH and FH scenarios:
```
assets/ghs/data/gh/scenarios/1.json     (or wherever they live after data population)
assets/ghs/data/fh/scenarios/0.json
```

Also check if the GHS data has section files with rules/conditions:
```
assets/ghs/data/fh/sections/
assets/ghs/data/gh/sections/
```

The key fields we know exist from the GHS audit:
- `index` — scenario number
- `name` — scenario name  
- `edition` — which game
- `monsters[]` — all monster type names needed for entire scenario
- `rooms[]` — array of rooms, each with:
  - `ref` — map tile reference (e.g., "L1a", "G1b", "I1b")
  - `roomNumber` — room number
  - `initial` — is this the starting room?
  - `monster[]` — spawn entries per room
  - `treasures[]` — treasure tile numbers
  - `marker` — section marker (FH section number to read)
- `unlocks[]` — scenarios this unlocks
- `rewards` — completion rewards

Fields that MAY exist (audit the actual files):
- `rules[]` — special scenario rules
- `goals` or `objectives` — win conditions
- `overlays[]` — overlay tile references
- `allies[]` — scenario allies
- `sections[]` — associated section references
- `lootDeckConfig` — FH loot deck setup

Fields that are NOT in JSON (live in physical books only):
- Scenario book page numbers (but these can be derived: GH scenario N ≈ page N; FH scenarios reference section book)
- Overlay tile images (traps, hazardous terrain, obstacles) — the JSON may not list these specifically
- Narrative text / introduction
- Detailed win condition text

### Preview Overlay Layout

Design this with UI/UX Pro Max. Dark fantasy aesthetic. This is the GM's planning screen before committing to the scenario.

```
┌─────────────────────────────────────────────┐
│  ⟨ Back                    Scenario Preview │
├─────────────────────────────────────────────┤
│                                             │
│  SCENARIO #1 — BLACK BARROW                 │
│  Edition: Gloomhaven                        │
│  📖 Scenario Book: p.XX  |  Section Book: — │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  MONSTER TYPES (3)                          │
│  ┌──────┐  ┌──────┐  ┌──────┐              │
│  │ img  │  │ img  │  │ img  │              │
│  │Bandit│  │Bandit│  │Living│              │
│  │Guard │  │Archer│  │Bones │              │
│  │(6 st)│  │(6 st)│  │(6 st)│              │
│  └──────┘  └──────┘  └──────┘              │
│                                             │
│  MAP TILES (3 rooms)                        │
│  Room 1: L1a (initial)                      │
│  Room 2: G1b                                │
│  Room 3: I1b                                │
│                                             │
│  OVERLAY TILES                              │
│  [list from data, or "See Scenario Book"]   │
│                                             │
│  TREASURES                                  │
│  Treasure #7 (Room 3)                       │
│                                             │
│  SPECIAL RULES                              │
│  [from scenario data, or "See Scenario Book │
│   for special rules and win conditions"]    │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐  ┌──────────────────┐     │
│  │ Assign Chores│  │ Start Scenario   │     │
│  │              │  │ (Skip Setup)     │     │
│  └──────────────┘  └──────────────────┘     │
│                                             │
└─────────────────────────────────────────────┘
```

**Monster type display:**
- Show monster portrait image from `assets/ghs/images/{edition}/monsters/{name}.png` (or `.webp`, `.jpg` — audit actual asset paths)
- Show monster name (format for display: `bandit-guard` → `Bandit Guard`)
- Show standee count from `monster.count` in the monster data JSON
- Show stat summary at current scenario level (HP, Move, Attack for normal/elite)

**Map tiles:**
- Show tile reference codes from each room's `ref` field
- Mark which room is `initial: true`
- Show door connections between rooms (room N's `rooms[]` field links to other rooms)
- If map tile images exist in assets (e.g., `assets/ghs/images/{edition}/map/{ref}.png`), show them. If not, show the reference code prominently so GM can find the physical tile.

**Overlay tiles:**
- If the scenario JSON contains overlay data, list and show images
- If not, display: "Refer to Scenario Book for overlay tile setup"

**Scenario book reference:**
- GH: "Scenario Book p.{index}" (scenario number ≈ page number, close enough for reference)
- FH: "Section Book — see sections referenced in scenario" + list any section markers from rooms

**Two action buttons:**
1. **"Assign Chores"** — enters Phase 2 (broadcasts setup to phones)
2. **"Start Scenario (Skip Setup)"** — skips directly to Phase 5 (for when the table is already set up, or playing solo). This calls the existing `setScenario` flow.

---

## Phase 2: Chore Assignment

### Command: `prepareScenarioSetup`

New command, similar pattern to `prepareScenarioEnd`:

```typescript
// C→S
{
  type: "command",
  action: "prepareScenarioSetup", 
  payload: {
    scenarioIndex: string,
    edition: string,
    group?: string,
    chores: ChoreAssignment[]
  }
}

interface ChoreAssignment {
  characterName: string;
  edition: string;
  choreType: 'monsters' | 'map' | 'overlays';
  items: ChoreItem[];
}

interface ChoreItem {
  name: string;           // display name
  dataName?: string;      // machine name for image lookup
  count?: number;         // e.g., 6 standees
  ref?: string;           // tile reference
  roomNumber?: number;    // which room
  imageUrl?: string;      // resolved asset path
  description?: string;   // additional context
}
```

**Server handler:**
- Sets `state.setupPhase = 'chores'` (new field on GameState)
- Stores `state.setupData = { scenarioIndex, edition, group, chores, choreConfirmations: {} }` (new field)
- Broadcasts to all clients

**Chore auto-assignment logic** (controller-side, before sending command):

Based on number of active (non-absent) characters:

| Players | Assignment |
|---------|-----------|
| 2 | Player 1: Monsters + Map tiles, Player 2: Overlay tiles |
| 3 | Player 1: Monsters, Player 2: Map tiles, Player 3: Overlay tiles |
| 4 | Player 1: Monsters, Player 2: Map tiles, Player 3: Overlay tiles, Player 4: Monster stat cards + ability decks |

The controller calculates assignments and populates the `chores[]` array. Each chore contains the specific items that player needs to collect, with images resolved from asset paths.

**Monster chore items:** For each unique monster in `scenario.monsters[]`, load the monster JSON to get `count` (standee count) and resolve the portrait image path. Include both normal and elite base colors needed.

**Map tile chore items:** For each room in `scenario.rooms[]`, include the `ref` (tile reference code). If map tile images exist in assets, include the path. List in room order.

**Overlay tile chore items:** If overlay data exists in the scenario JSON, list specific tiles. If not, this chore is: "Set up overlay tiles per Scenario Book" with the book page reference.

### Controller Overlay During Chores

After broadcasting `prepareScenarioSetup`, the controller preview overlay transitions to a **chore tracking view**:

```
┌───────────────────────────────────────────┐
│  SCENARIO SETUP — #1 Black Barrow         │
├───────────────────────────────────────────┤
│                                           │
│  Setup Tasks                              │
│                                           │
│  ✓  Kyle (Drifter) — Monsters             │
│     [confirmed]                           │
│                                           │
│  ⏳ Sarah (Boneshaper) — Map Tiles        │
│     [waiting...]                          │
│                                           │
│  ⏳ Mike (Blinkblade) — Overlay Tiles     │
│     [waiting...]                          │
│                                           │
├───────────────────────────────────────────┤
│                                           │
│  ┌────────────┐  ┌────────────────────┐   │
│  │   Cancel   │  │ Proceed to Rules   │   │
│  │            │  │  (all confirmed)   │   │
│  └────────────┘  └────────────────────┘   │
│                                           │
└───────────────────────────────────────────┘
```

- Shows each player's assignment with their character name and class
- Status: ⏳ waiting / ✓ confirmed
- **"Proceed to Rules"** button only enables when ALL chores are confirmed
- **"Cancel"** sends `cancelScenarioSetup` and dismisses everything

### Phone Chore Overlay

When a phone receives the `prepareScenarioSetup` broadcast, it matches its registered character to the `chores[]` array and shows a full-screen overlay:

**Design this with UI/UX Pro Max. This should feel like a quest assignment — a parchment scroll with a task list.**

```
┌───────────────────────────────────────────┐
│                                           │
│  ⚔ YOUR SETUP TASK ⚔                     │
│                                           │
│  Collect Monster Standees                 │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │  [portrait]  Bandit Guard           │  │
│  │              6 standees (white+gold)│  │
│  ├─────────────────────────────────────┤  │
│  │  [portrait]  Bandit Archer          │  │
│  │              6 standees (white+gold)│  │
│  ├─────────────────────────────────────┤  │
│  │  [portrait]  Living Bones           │  │
│  │              6 standees (white+gold)│  │
│  └─────────────────────────────────────┘  │
│                                           │
│  Also collect:                            │
│  • Stat cards for each monster type       │
│  • Ability card decks (shuffle each)      │
│                                           │
│  ┌─────────────────────────────────┐      │
│  │     ✓  Task Complete            │      │
│  └─────────────────────────────────┘      │
│                                           │
└───────────────────────────────────────────┘
```

**For monster chores:**
- List each monster type with portrait image, name, standee count
- Reminder to collect stat cards and ability decks
- Note which standee base colors are needed (white for normal, gold for elite) — this can be derived from the room spawn data

**For map tile chores:**
- List each map tile by reference code with image if available
- Show room layout / connections: "Room 1 (L1a) → Room 2 (G1b) → Room 3 (I1b)"
- If hex map images of the tiles exist in assets, show them
- If not, show the tile reference prominently

**For overlay tile chores:**
- If overlay data exists in scenario JSON, list specific tiles with images
- If not, show: "Set up overlay tiles for all rooms per Scenario Book p.XX"
- Always include: "Place overlay tiles for Room 1 only during initial setup. Other rooms are revealed when doors are opened."

**"Task Complete" button:**
- Sends `confirmChore` command
- Button transitions to a confirmed state (checkmark, disabled, green)
- Overlay stays visible but shows "Waiting for other players..."

### Command: `confirmChore`

```typescript
{
  type: "command",
  action: "confirmChore",
  payload: {
    characterName: string,
    edition: string
  }
}
```

**Server handler:**
- Sets `state.setupData.choreConfirmations[characterName] = true`
- Broadcasts diff so controller sees the confirmation
- Phone clients don't need to react to other players' confirmations

**Phone whitelist:** Add `confirmChore` to the phone command whitelist (character-scoped).

---

## Phase 3: Rules & Win Conditions

### Command: `proceedToRules`

Triggered when controller clicks "Proceed to Rules" (after all chores confirmed):

```typescript
{
  type: "command",
  action: "proceedToRules",
  payload: {}
}
```

**Server handler:**
- Sets `state.setupPhase = 'rules'`
- Broadcasts to all clients

### Controller Overlay

Shows scenario rules and win conditions. This is the "Read the scenario introduction" moment.

```
┌───────────────────────────────────────────┐
│  SCENARIO #1 — BLACK BARROW               │
├───────────────────────────────────────────┤
│                                           │
│  📖 SPECIAL RULES                         │
│  [rules from scenario data, or:]          │
│  "Read Special Rules from Scenario Book"  │
│                                           │
│  🎯 WIN CONDITION                         │
│  [goal from scenario data, or:]           │
│  "Read Win Condition from Scenario Book"  │
│                                           │
│  ❌ LOSS CONDITION                         │
│  All characters exhausted.                │
│  [additional loss conditions from data]   │
│                                           │
│  📋 SCENARIO LEVEL: 2                     │
│  Trap: 4 | Gold: 3 | Hazard: 2 | XP: 8  │
│                                           │
├───────────────────────────────────────────┤
│  ┌────────────┐  ┌───────────────────┐    │
│  │   Cancel   │  │  Proceed to       │    │
│  │            │  │  Battle Goals     │    │
│  └────────────┘  └───────────────────┘    │
│                                           │
└───────────────────────────────────────────┘
```

### Phone Rules Overlay

All phones show a simplified version of the same information:

```
┌───────────────────────────────────────┐
│                                       │
│  📖 SCENARIO BRIEFING                 │
│                                       │
│  #1 — Black Barrow                    │
│                                       │
│  Special Rules:                       │
│  [rules text or book reference]       │
│                                       │
│  Win: [condition or book reference]   │
│  Loss: All characters exhausted       │
│                                       │
│  Level 2 — Trap: 4, Gold: 3×         │
│                                       │
│  Waiting for GM to proceed...         │
│                                       │
└───────────────────────────────────────┘
```

No dismiss button — this stays up until the controller advances to Phase 4.

**Data note:** The scenario JSON may or may not contain rules/goals text. Audit the actual files. If the data exists, display it. If not, show a reference to the scenario book. Either way, the overlay is useful because it shows the calculated scenario level and derived values (trap damage, gold conversion, etc.) which ARE computable from game state.

---

## Phase 4: Battle Goals

### Command: `proceedToBattleGoals`

```typescript
{
  type: "command",
  action: "proceedToBattleGoals",
  payload: {}
}
```

**Server handler:**
- Sets `state.setupPhase = 'goals'`
- Broadcasts to all clients

### Controller Overlay

Simple transition screen:

```
┌───────────────────────────────────────────┐
│                                           │
│  ⚔ BATTLE GOALS                          │
│                                           │
│  Players: choose your battle goals now.   │
│                                           │
│  GH: Deal 2 goals, keep 1                │
│  FH: Deal 3 goals, keep 1                │
│                                           │
│  [player confirmation status list]        │
│                                           │
│  ┌────────────┐  ┌───────────────────┐    │
│  │   Cancel   │  │  Start Scenario   │    │
│  │            │  │                   │    │
│  └────────────┘  └───────────────────┘    │
│                                           │
└───────────────────────────────────────────┘
```

**"Start Scenario"** can be clicked at any time — battle goal selection happens with physical cards, so there's no digital confirmation needed. The GM just waits until everyone at the table has picked, then clicks start.

Alternatively, if you want the phone confirmation pattern: add a "Goal Chosen" button on each phone and only enable "Start Scenario" when all confirm. This adds a nice checkpoint but may be overkill. **Implement the simpler version** (GM clicks start when ready) but structure the code so phone confirmations can be added later.

### Phone Battle Goal Overlay

```
┌───────────────────────────────────────┐
│                                       │
│  🎯 CHOOSE YOUR BATTLE GOAL          │
│                                       │
│  Deal yourself [2/3] battle goal      │
│  cards from the deck.                 │
│                                       │
│  Choose 1 to keep.                    │
│  Return the rest to the bottom        │
│  of the deck WITHOUT SHOWING          │
│  other players.                       │
│                                       │
│  GH: Deal 2, keep 1                   │
│  FH: Deal 3, keep 1                   │
│                                       │
│  Waiting for GM to start scenario...  │
│                                       │
└───────────────────────────────────────┘
```

The edition-appropriate rule (2 or 3 cards) should be derived from the active edition.

---

## Phase 5: Scenario Start

### Command: `initiateScenario`

This is NOT a new command — it fires the existing `setScenario` command which handles all initialization (auto-spawn Room 1 monsters, set scenario level, build loot deck, etc.).

```typescript
{
  type: "command",
  action: "setScenario",
  payload: {
    scenarioIndex: string,
    edition: string,
    group?: string
  }
}
```

**Before calling setScenario**, clear the setup state:
- `state.setupPhase = null`
- `state.setupData = null`

When phones receive the state update showing a scenario is now active (and setupPhase is cleared), they dismiss any remaining setup overlays and transition to their normal ScenarioView.

### Cancel at Any Phase

### Command: `cancelScenarioSetup`

```typescript
{
  type: "command", 
  action: "cancelScenarioSetup",
  payload: {}
}
```

**Server handler:**
- Clears `state.setupPhase` and `state.setupData`
- Broadcasts to all clients
- All setup overlays dismiss on all devices
- Controller returns to the scenario picker

---

## New Commands Summary

| Command | Direction | Phone Whitelist? | Purpose |
|---------|-----------|-----------------|---------|
| `prepareScenarioSetup` | Controller → Server | No (controller only) | Enter chore phase, broadcast assignments |
| `confirmChore` | Phone → Server | Yes (character-scoped) | Player confirms their setup task is done |
| `proceedToRules` | Controller → Server | No | Advance to rules display phase |
| `proceedToBattleGoals` | Controller → Server | No | Advance to battle goal phase |
| `cancelScenarioSetup` | Controller → Server | No | Abort entire setup workflow |

Note: `setScenario` already exists — it's the final step that actually initializes the game.

### GameState Additions

```typescript
// Add to GameState
setupPhase?: 'chores' | 'rules' | 'goals' | null;
setupData?: {
  scenarioIndex: string;
  edition: string;
  group?: string;
  chores: ChoreAssignment[];
  choreConfirmations: Record<string, boolean>;  // characterName → confirmed
} | null;
```

---

## Implementation Plan

### Step 1: Audit scenario data
Before writing any code, audit 3-4 actual scenario JSON files (GH #1, FH #0, one mid-campaign scenario from each) to determine exactly which fields exist. Check for: `rules`, `goals`, `objectives`, `overlays`, `sections`, `allies`, and any other fields not shown in the minimal GHS audit example. Also check the `sections/` directory structure. Document findings.

### Step 2: Engine changes
- Add `setupPhase` and `setupData` to GameState types
- Add 5 new commands to `commands.ts`
- Add handlers in `applyCommand.ts`
- Add validation in `validateCommand.ts`
- Add `confirmChore` to phone whitelist in `wsHub.ts`
- Add command sender methods in `commandSender.ts`

### Step 3: Data API
- Add `/api/data/scenario-preview/{edition}/{index}` endpoint that returns the full preview data:
  - Scenario metadata (name, index, edition)
  - Monster list with resolved portrait URLs and standee counts
  - Room list with tile references and map tile image URLs (if they exist)
  - Overlay tile list (if data exists)
  - Rules/goals text (if data exists)
  - Section references
  - Book page reference
- This endpoint does the data assembly so the controller doesn't need multiple fetches

### Step 4: Controller preview overlay
- Redesign `ScenarioSetupOverlay` step 3 to show the enhanced preview
- Add the two action buttons (Assign Chores / Start Scenario)
- Fetch preview data from the new API endpoint

### Step 5: Controller chore tracking overlay
- New overlay (or transform of the preview overlay) showing assignment status
- Listen for `choreConfirmations` in state diffs
- Enable "Proceed to Rules" only when all confirmed

### Step 6: Controller rules + battle goals overlays
- Rules overlay showing scenario data (or book references)
- Battle goals overlay with "Start Scenario" button

### Step 7: Phone setup overlays
- `PhoneChoreOverlay` — shows assigned chore with item images and "Task Complete" button
- `PhoneRulesOverlay` — shows scenario briefing (read-only)
- `PhoneBattleGoalOverlay` — shows battle goal reminder (read-only)
- All overlays watch `state.setupPhase` and show/hide accordingly
- All dismiss when `setupPhase` clears (scenario started or cancelled)

### Step 8: Phone ScenarioView integration
- Watch `state.setupPhase` in ScenarioView
- Render appropriate overlay based on current phase
- Handle transitions between phases smoothly

---

## Asset Path Resolution

Monster portraits are the most important visual element. Audit the actual asset directory to find the correct paths. Expected patterns:

```
assets/ghs/images/{edition}/monsters/{monster-name}.png
assets/ghs/images/monster/{monster-name}.png  
assets/worldhaven/images/monster/icons/{monster-name}.png
```

Map tile images (may or may not exist):
```
assets/ghs/images/{edition}/map/{tile-ref}.png
assets/worldhaven/images/map/{edition}/{tile-ref}.png
```

**If images don't exist for a given asset type, do NOT use fallbacks.** Show the name/reference prominently with styled typography instead. A text-only chore card with "Bandit Guard — 6 standees" in Cinzel is better than a broken image.

---

## Verification Checklist

- [ ] Controller scenario picker → preview overlay shows full scenario info
- [ ] Monster types displayed with portraits, names, standee counts
- [ ] Map tile references shown per room with connections
- [ ] "Assign Chores" button broadcasts `prepareScenarioSetup`
- [ ] "Start Scenario (Skip Setup)" bypasses chore flow, calls `setScenario` directly
- [ ] Phone receives chore assignment overlay with correct items for their assignment
- [ ] Monster chore shows portraits, names, counts, base color reminder
- [ ] Map tile chore shows tile references (and images if available)
- [ ] Overlay tile chore shows data or scenario book reference
- [ ] Phone "Task Complete" sends `confirmChore`
- [ ] Controller shows confirmation status per player in real-time
- [ ] "Proceed to Rules" only enables when all chores confirmed
- [ ] Rules overlay shows special rules + win conditions (from data or book reference)
- [ ] Rules overlay shows calculated scenario level + derived values
- [ ] Phone rules overlay shows simplified briefing
- [ ] Battle goals overlay shows edition-appropriate deal count (2 for GH, 3 for FH)
- [ ] Phone battle goal overlay shows reminder text
- [ ] "Start Scenario" calls `setScenario`, clears setup state
- [ ] All setup overlays dismiss on all devices when scenario starts
- [ ] "Cancel" at any phase clears everything, returns to scenario picker
- [ ] `cancelScenarioSetup` broadcasts and dismisses all phone overlays
- [ ] New commands added to shared types, engine, validation
- [ ] `confirmChore` added to phone whitelist
- [ ] Service worker cache hashes regenerated after changes

---

## Docs to Update

- `docs/DESIGN_DECISIONS.md` — multi-phase setup workflow rationale, chore assignment strategy, data-driven vs. book-reference approach for missing data
- `docs/COMMAND_PROTOCOL.md` — 5 new commands documented
- `docs/APP_MODE_ARCHITECTURE.md` — setup flow added to Scenario Mode section, new overlays listed for controller and phone
- `docs/PROJECT_CONTEXT.md` — new commands, new components, new API endpoint
- `docs/ROADMAP.md` — update Phase 3 / Phase 5 progress
- `docs/GHS_STATE_MAP.md` — add `setupPhase` and `setupData` fields

**Commit message:** `feat: multi-phase scenario setup with chore assignment to phones`
