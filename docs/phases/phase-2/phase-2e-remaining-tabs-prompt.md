# Phase 2E — Scenario, Loot & Decks, and Campaign Tabs

> Paste into Claude Code. Implements the final three controller tabs to complete
> Phase 2. These are setup/management tabs with lower interaction frequency than
> Active Play.

---

Read CLAUDE.md, then docs/PROJECT_CONTEXT.md, then docs/GHS_STATE_MAP.md.

Then read these files in full:
- `clients/shared/lib/commandSender.ts` — **every method signature**. Read the actual file, not prompts.
- `clients/shared/lib/stateStore.ts` — derived getters
- `clients/controller/src/main.ts` — `getStore()`, `getCommands()`, `getGameCode()`
- `clients/controller/src/tabs/activePlay.ts` — reference for patterns (event delegation via `data-action`, render-on-subscribe, `formatName` import)
- `clients/controller/src/tabs/monsterMgmt.ts` — reference for event delegation pattern used in 2D
- `clients/controller/src/utils.ts` — shared `formatName` utility
- `packages/shared/src/types/gameState.ts` — ScenarioModel, LootDeck, Party, Character types
- `packages/shared/src/types/commands.ts` — all command payloads
- `packages/shared/src/utils/elements.ts` — ELEMENT_TYPES
- `clients/controller/styles/controller.css` — existing styles

Follow the same patterns established in activePlay.ts and monsterMgmt.ts:
- Event delegation with `data-action` attributes (NOT `window._gc*` globals)
- Render full HTML on state subscription
- `formatName()` from utils.ts
- Asset URLs at `/assets/images/...` (not `/assets/ghs/images/...`)

## TAB 1: SCENARIO

### File: `clients/controller/src/tabs/scenario.ts`

Replace the stub. Exports `initScenarioTab(): void`.

#### Structure

```
#tabScenario
├── Scenario Header
│   ├── Current scenario name/number (or "No Scenario")
│   ├── Edition badge
│   └── Level display with +/- controls
│
├── Scenario Setup Section
│   ├── Scenario number input
│   ├── Edition dropdown (gh, fh, jotl, fc, cs)
│   └── "Set Scenario" button
│
├── Character Management Section
│   ├── Add Character Row
│   │   ├── Name input (text — same approach as monster names in 2D)
│   │   ├── Edition dropdown
│   │   ├── Level input (1-9)
│   │   └── "Add" button
│   ├── Character List
│   │   ├── Character Row: name + edition + level + status badges + actions
│   │   │   ├── Absent toggle button
│   │   │   ├── Exhausted toggle button
│   │   │   ├── Long Rest toggle button
│   │   │   └── Remove button (✕)
│   │   └── ... more characters
│   └── Empty state if no characters
│
├── Scenario Level & Settings
│   ├── Level: display + set buttons (0-7)
│   ├── Round counter: current round display + manual set
│   └── Edition: current edition display
│
├── Element Board (full controls)
│   ├── 6 element buttons with current state
│   └── Click cycles: inert → new → strong → waning → inert
│
└── Revealed Rooms Section
    ├── Room list (from scenario.revealedRooms)
    ├── Room ID input + "Reveal Room" button
    └── Empty state if no rooms revealed
```

#### Key Behaviors

**Set Scenario:** Calls `commands.setScenario(scenarioIndex, edition, level)`. Use the scenario number input (string, not number — scenario indices can be alphanumeric like "1", "51", "FC-1").

**Add Character:** Calls `commands.addCharacter(name, edition, level)`. Name is free text input. Edition from dropdown. Level from number input (default 1).

**Character Row Actions:**
- Absent toggle: `commands.toggleAbsent(name, edition)` — check actual method name in commandSender
- Exhausted toggle: `commands.toggleExhausted(name, edition)` — check actual method name
- Long Rest toggle: `commands.toggleLongRest(name, edition)` — check actual method name. Only visible during draw phase.
- Remove: `commands.removeCharacter(name, edition)`

**Level Control:** `commands.setScenarioLevel(level)` with buttons for each level 0-7, highlighting current.

**Round Control:** Display `state.round`. Include a `commands.setRound(value)` if that command exists on CommandSender. If not, display read-only.

**Element Board:** Same as Active Play but with full control. Each element has its state displayed and click-to-cycle. This is the primary element control point — Active Play shows a compact version.

**Reveal Room:** Number input + button. Calls `commands.revealRoom(roomId)`.

#### Rendering

Follow the same render-on-subscribe pattern. Event delegation on the `#tabScenario` panel:

```typescript
function initScenarioTab(): void {
  const panel = document.getElementById('tabScenario')!;
  panel.addEventListener('click', handleScenarioClick);
  panel.addEventListener('change', handleScenarioChange);
  getStore().subscribe(state => {
    if (state) renderScenarioTab(state);
  });
}
```

## TAB 2: LOOT & DECKS

### File: `clients/controller/src/tabs/lootDecks.ts`

Replace the stub. Exports `initLootDecksTab(): void`.

#### Structure

```
#tabLoot
├── Loot Deck Section
│   ├── Deck Status: cards remaining / total
│   ├── "Draw Card" button
│   ├── Drawn Cards List (unassigned)
│   │   ├── Card: type + value + "Assign to..." dropdown + assign button
│   │   └── ... more drawn cards
│   ├── Assigned Cards Summary
│   │   ├── Character: total loot value summary
│   │   └── ... per character
│   └── Empty state if no loot deck
│
├── Character Attack Modifier Decks
│   ├── Per-character deck card (for each character)
│   │   ├── Character name
│   │   ├── Deck status: remaining / total
│   │   ├── "Draw" button
│   │   ├── "Shuffle" button
│   │   ├── Bless +/- buttons
│   │   └── Curse +/- buttons
│   └── ... more characters
│
├── Ally Attack Modifier Deck (if applicable)
│   ├── Same controls as monster modifier deck
│   └── Draw, Shuffle, Bless/Curse
│
└── Empty state panels where needed
```

#### Key Behaviors

**Loot Deck Draw:** `commands.drawLootCard()`. After drawing, the card appears in the "unassigned" list.

**Loot Card Assignment:** Each unassigned card shows a dropdown of active characters + an "Assign" button. Calls `commands.assignLoot(cardIndex, characterName)`. Check commandSender for exact signature — `assignLoot` may need edition or other params.

**Drawn Cards Display:** Show `state.lootDeck.drawn` — these are cards drawn but not yet assigned. Display the card type (money, lumber, metal, etc.) and value. Use the `LootType` enum values from GHS_STATE_MAP.md for display labels.

**Assigned Cards:** Show `state.lootDeck.assigned` grouped by character. Summarize total value per character.

**Character AMD:** For each character in `state.characters`, show their `attackModifierDeck` status. Draw/shuffle/bless/curse controls using the character's name as the deck identifier. Commands:
- Draw: `commands.drawModifierCard(characterName)` — check if this takes name or `edition-name`
- Shuffle: `commands.shuffleModifierDeck(characterName)`
- Bless: `commands.addModifierCard(characterName, 'bless')`
- Curse: `commands.addModifierCard(characterName, 'curse')`
- Remove bless/curse: `commands.removeModifierCard(characterName, 'bless'|'curse')`

**Ally AMD:** Same controls as monster AMD but using `'ally'` as the deck identifier. Only show if `state.allyAttackModifierDeck` exists and has cards.

#### Rendering

The loot deck may not exist or may be empty in many games (Gloomhaven doesn't use it — Frosthaven does). Handle gracefully:

```typescript
function renderLootDeck(state: GameState): string {
  const deck = state.lootDeck;
  if (!deck || !deck.cards || deck.cards.length === 0) {
    return `
      <div class="loot-section">
        <h3 class="section-title heading-sm">Loot Deck</h3>
        <div class="empty-state">No loot deck configured for this scenario</div>
      </div>
    `;
  }
  // ... render deck with draw/assign controls
}
```

## TAB 3: CAMPAIGN

### File: `clients/controller/src/tabs/campaign.ts`

Replace the stub. Exports `initCampaignTab(): void`.

This tab is a **read-mostly** overview of campaign state. Most campaign mutations happen through scenario results, not direct GM input during play. Keep it simple for now — display what's there, with minimal edit controls.

#### Structure

```
#tabCampaign
├── Party Info Section
│   ├── Party name (from state.party.name)
│   ├── Reputation display
│   ├── Prosperity display (GH) / Morale display (FH)
│   └── Donations (GH) / Resources summary (FH)
│
├── Character Roster
│   ├── Per-character summary card
│   │   ├── Name + Edition + Level
│   │   ├── XP total (from character.experience or character.progress)
│   │   ├── Gold total
│   │   ├── Stat controls: XP +/- and Gold +/- buttons
│   │   └── Check marks / perks count
│   └── ... more characters
│
├── Scenario History
│   ├── Completed scenarios list (from party.scenarios)
│   └── Count display
│
├── Unlocked Characters
│   ├── List from state.unlockedCharacters
│   └── Empty state if none
│
└── Game Info
    ├── Edition
    ├── Game code
    ├── Revision number
    ├── Total play time (from state.totalSeconds)
    └── Server connection status
```

#### Key Behaviors

**XP and Gold controls:** Per-character +/- buttons for experience and gold (in-scenario tracking). Calls `commands.changeStat(characterName, edition, 'experience', delta)` and `commands.changeStat(characterName, edition, 'gold', delta)`. Verify these commands exist on CommandSender — they were listed in the Phase 2A corrections.

If `changeStat` doesn't exist, use `changeHealth` pattern to check what stat mutation commands are available. If none exist, add them to the stack (commandSender → commands.ts → applyCommand → validateCommand) like 2D did for modifier cards.

**Party fields:** Display-only for now. Campaign party editing (reputation, prosperity, donations) is Phase 5 polish.

**Scenario history / unlocked characters:** Display-only lists. No edit controls needed yet.

**Play time:** Convert `state.totalSeconds` to hours:minutes display.

**Game info:** Show `getGameCode()`, `state.revision`, `state.edition`.

#### Rendering

The party object may be null or sparse. Handle gracefully:

```typescript
function renderPartyInfo(state: GameState): string {
  const party = state.party;
  if (!party) {
    return `
      <div class="campaign-section">
        <h3 class="section-title heading-sm">Party</h3>
        <div class="empty-state">No party data. Import a GHS save or start a campaign.</div>
      </div>
    `;
  }
  // ... render party fields
}
```

## STEP 1 — Implement all three tab files

Write `scenario.ts`, `lootDecks.ts`, and `campaign.ts` following the structures above. Each:
- Exports an `init*Tab()` function
- Uses event delegation (NOT window globals)
- Subscribes to store for re-renders
- Uses `formatName()` from utils.ts
- Handles null/empty states gracefully
- Reads commandSender.ts for exact method signatures

## STEP 2 — Write CSS for all three tabs

Append to `clients/controller/styles/controller.css`:

### Scenario tab styles
- `.scenario-header`: prominent display of current scenario name + level
- Level selector: row of numbered buttons (0-7), active one highlighted gold
- Character list: compact rows with name + badges + action buttons
- Status badges: small colored pills for absent (gray), exhausted (red), long rest (blue)
- Add character row: inline form matching 2D's add monster pattern
- Element board: grid of 6 element buttons (larger than Active Play's compact version)
- Room list: simple numbered list with reveal input

### Loot tab styles
- `.loot-drawn-card`: card showing loot type with icon + value + assign dropdown
- Loot type colors: money=gold, lumber=brown, metal=silver, hide=tan, herbs=green
- Character AMD cards: compact cards in a grid, matching monster modifier deck style from 2D
- Deck status bars: visual indicator of remaining/total

### Campaign tab styles
- `.campaign-section`: bordered sections with headers
- Character roster cards: show name, level, XP, gold with +/- buttons
- Stat controls: inline +/- buttons matching health control pattern
- Scenario list: scrollable list with compact entries
- Game info: key-value display in muted text
- Play time: formatted display

### Shared patterns
Keep consistent with existing styles. Reuse `.btn-sm`, `.btn-icon`, `.form-input`, `.form-select`, `.empty-state`, `.section-title` classes from existing CSS.

## STEP 3 — Wire into main.ts

Edit `clients/controller/src/main.ts`:
1. Import `initScenarioTab` from `./tabs/scenario.js`
2. Import `initLootDecksTab` from `./tabs/lootDecks.js`
3. Import `initCampaignTab` from `./tabs/campaign.js`
4. Call all three in `enterGameScreen()` alongside existing tab inits

## STEP 4 — Add any missing commands

If any commands needed by these tabs don't exist on CommandSender, add them through the full stack:
1. `clients/shared/lib/commandSender.ts` — add method
2. `packages/shared/src/types/commands.ts` — add command type to union
3. `packages/shared/src/engine/applyCommand.ts` — add handler
4. `packages/shared/src/engine/validateCommand.ts` — add validation

Likely candidates:
- `changeStat` for XP/gold — may already exist, verify
- `setRound` for manual round adjustment — may not exist yet
- `toggleLongRest` — was listed as removed in 2A corrections, verify if it's back

Document any additions in the commit message.

## STEP 5 — Verify

Build and test:
```powershell
npm run build --workspace=packages/shared
npm run build --workspace=clients/controller
npx tsx server/src/index.ts
```

Connect to a game with existing state (use the test import from 2C or import a GHS save).

### Scenario tab checks:
1. Current scenario info displays (or "No Scenario" for fresh games)
2. Set Scenario form works — entering a number + edition + clicking Set updates state
3. Add Character form works — new character appears in Active Play tab
4. Character row shows absent/exhausted/longRest toggle buttons
5. Toggling absent removes character from Active Play initiative
6. Remove character button works
7. Level selector (0-7) buttons work, current level highlighted
8. Element board shows all 6 elements with correct states, cycling works
9. Reveal Room adds room ID to list

### Loot tab checks:
10. Loot deck status shows (or empty state for GH games without loot)
11. Character AMD cards show for each character
12. AMD draw/shuffle/bless/curse buttons work
13. Ally AMD section shows if applicable

### Campaign tab checks:
14. Party info displays (or empty state)
15. Character roster shows with XP and Gold values
16. XP +/- buttons work
17. Gold +/- buttons work
18. Game info shows game code, revision, edition
19. All three tabs switch correctly and maintain state

## STEP 6 — Update ROADMAP.md

Mark complete:
- [x] Build Scenario tab — room reveals, element board, round counter
- [x] Build Loot & Decks tab — loot draw/assign, modifier deck state
- [x] Build Campaign tab — party sheet, unlocks, scenario tracking
- [x] Responsive iPad landscape layout, tab navigation

All Phase 2 items should now be [x].

## STEP 7 — Update PROJECT_CONTEXT.md

Change current phase to:
```
## Current Phase
Phase 2 COMPLETE. Phase 3 — Phone Client (see ROADMAP.md)
```

## STEP 8 — Commit

```powershell
git add -A
git commit -m "feat(controller): implement Scenario, Loot & Decks, and Campaign tabs

- Scenario tab: set scenario, add/remove characters, level selector,
  character status toggles (absent/exhausted/longRest), element board,
  room reveal controls, round display
- Loot & Decks tab: loot deck draw/assign, character AMD controls
  (draw/shuffle/bless/curse), ally AMD controls
- Campaign tab: party overview, character roster with XP/gold +/- controls,
  scenario history, unlocked characters, game info display
- All three tabs use event delegation pattern
- Phase 2 complete — all controller tabs functional"
git push
```

Report: commit hash, bundle size, which of the 19 checks pass, and any commands added to the stack.
