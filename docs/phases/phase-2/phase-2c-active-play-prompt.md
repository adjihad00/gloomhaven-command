# Phase 2C — Active Play Tab: Full Gameplay Loop

> Paste into Claude Code. This is the largest single prompt. It builds the entire
> Active Play tab: initiative timeline, character cards with health/conditions/summons,
> monster standees with health/conditions/kill, turn advancement FABs, and element board.

---

Read CLAUDE.md, then docs/PROJECT_CONTEXT.md.

Then read these files — you need exact APIs:
- `clients/controller/src/main.ts` (exported getStore, getCommands, getGameCode)
- `clients/shared/lib/stateStore.ts` (StateStore: subscribe, getInitiativeOrder, getCharacter, getMonster, phase, round, etc.)
- `clients/shared/lib/commandSender.ts` (CommandSender: every method signature — READ THE ACTUAL FILE for correct parameter names and types)
- `packages/shared/src/types/gameState.ts` (Character, Monster, MonsterEntity, Summon, EntityCondition, ElementModel, GameState)
- `packages/shared/src/types/commands.ts` (Command, CommandTarget — READ for exact payload shapes and field names)
- `packages/shared/src/engine/turnOrder.ts` (OrderedFigure, OrderedSummon — READ for exact interface shapes)
- `packages/shared/src/utils/conditions.ts` (NEGATIVE_CONDITIONS, POSITIVE_CONDITIONS, ALL_CONDITIONS, isPositiveCondition)
- `packages/shared/src/utils/elements.ts` (ELEMENT_TYPES)
- `clients/shared/styles/theme.css` (CSS variables)
- `clients/controller/styles/controller.css` (existing styles)
- `clients/controller/index.html` (the tab panel structure — `#tabPlay` is our target, `#fabContainer` for FABs)

Also read the project knowledge file `ghs-controller.html` for the old controller's character cards, monster standees, element fan, timeline, and FAB patterns. We're rebuilding these with the command-based architecture.

## Architecture

The Active Play tab is `clients/controller/src/tabs/activePlay.ts`. It exports `initActivePlayTab()` called by `main.ts` after entering the game screen.

The module subscribes to `store`, renders into `#tabPlay`, sends commands via `commands`, and manages the FAB container. All rendering uses innerHTML string templates with event delegation via `data-action` attributes.

**CRITICAL:** Before writing any code, read `CommandSender` methods and `CommandTarget` type to understand exact parameter names. The prompt provides approximate shapes — the actual code is authoritative.

## STEP 1 — Create `clients/controller/src/tabs/activePlay.ts`

### Module structure

```
initActivePlayTab() — called once, subscribes to store, initial render
render(state) — main render, builds all sections
  ├── renderTimeline(state) — initiative bar
  ├── renderCharacters(state) — character cards with summons
  ├── renderMonsters(state) — monster groups with standees
  └── renderElements(state) — element board
updateFabs(state) — manages #fabContainer content
attachEventListeners() — one-time setup, event delegation on #tabPlay
```

### Initialization

```typescript
export function initActivePlayTab(): void
```

1. Get `store` and `commands` from main.ts exports
2. Subscribe to store — on each update, call `render(state)` and `updateFabs(state)`
3. Use revision-based dirty checking: skip render if `state.revision === lastRenderedRevision`
4. Call `attachEventListeners()` once
5. Do initial render from current state

### Main render

Assembles HTML for all sections and sets `tabPlay.innerHTML`. After innerHTML assignment, call `requestAnimationFrame(() => scrollTimelineToActive())` to auto-center the active figure in the timeline.

```
tabPlay.innerHTML =
  renderTimeline(state) +
  renderCharacters(state) +
  renderMonsters(state) +
  renderElements(state);
```

## STEP 2 — Initiative Timeline

Horizontal scrollable bar at the top. Shows figures in initiative order with icons, initiative numbers, and state indicators.

Implementation:
- Outer: `.initiative-timeline` — overflow-x scroll, no scrollbar
- Inner: `.timeline-track` — inline-flex, gap
- Each figure: `.tl-figure` — column with init number, icon ring, name
- Icon URL: `/assets/ghs/images/character/thumbnail/{figureId}.png` or `monster/thumbnail/`
- Fallback: first two chars of name uppercased
- Active figure: `.active` class — gold border glow
- Completed figure: `.completed` class — dimmed opacity
- Auto-scroll to center active figure after render

Parse `figureId` format `"edition-name"` for icon paths. Split on first hyphen.

## STEP 3 — Character Cards

Grid of character cards. Each shows:
- Name (formatted: hyphens to spaces, capitalized)
- Health with +/- buttons (data-action="changeHealth")
- Initiative display: editable `<input type="number">` during draw phase, static `<span>` during next phase
- Condition grid: all conditions as toggle buttons (data-action="toggleCondition")
- Nested summon cards

Initiative input: on `change` event, send `setInitiative` command. Only shown during `state.state === 'draw'`.

Character cards highlight: `.active-turn` (gold glow) when `char.active`, `.turn-done` (dimmed) when `char.off`.

Filter out `char.absent === true` characters.

### Summon Cards

Rendered in a `.summons-section` below the parent character's condition grid, inside the character card. Smaller than character cards, blue-tinted border (var(--shield-blue)).

Each summon shows: name, parent name, health +/-, kill button (☠), and condition buttons (negative conditions only — matching old controller behavior where summons only show negative conditions).

Kill button: sends `removeSummon` command. Health buttons: send `changeHealth` with `summon` target type.

## STEP 4 — Monster Standees

Grid of monster groups. Each group has a header (name, initiative) and rows of standees.

Each standee row shows:
- Standee number in a circular badge
- Elite: gold-tinted background, gold badge border
- Boss: red-tinted background
- Health with +/- buttons
- Kill button (☠) — toggles dead state
- Condition buttons (negative conditions only)
- Dead standees: 30% opacity, red border

Kill/revive logic: if entity is alive, deal damage equal to current health (sends `changeHealth` with `-health` delta). If dead, heal by 1 (sends `changeHealth` with `+1` delta). Read the actual `applyCommand` behavior for `changeHealth` on dead entities.

## STEP 5 — Element Board

Horizontal row of 6 element buttons between monsters section and FAB area (or at bottom of tab).

Each element shows its icon from `/assets/ghs/images/element/{type}.svg` and its current state via CSS class: `state-inert` (dim), `state-new`/`state-strong` (bright, colored), `state-waning` (medium brightness).

Click cycles: inert → new → inert. Sends `moveElement` command.

## STEP 6 — Floating Action Buttons

Managed in `#fabContainer` (outside the tab panel, in the game screen). Content changes based on game state:

1. **Draw phase, not all initiatives set:** Disabled button with "Set Initiatives..." label
2. **Draw phase, all non-absent characters have initiative > 0:** Enabled "Start Round" button → sends `advancePhase()`
3. **Next phase, a figure is active:** "Next Turn" button → sends `toggleTurn(activeFigureId)`
4. **Next phase, all figures done (all off):** "Next Round" button → sends `advancePhase()`

Read `CommandSender.toggleTurn()` for exact params. Read `CommandSender.advancePhase()`. Wire the button click in the FAB updater, not in event delegation (since FAB is outside tabPlay).

## STEP 7 — Event Delegation

Single click listener on `#tabPlay` reads `data-action` from the closest ancestor with that attribute. Switch on action:

- `changeHealth`: build CommandTarget from data attributes, read delta, call `commands.changeHealth()`
- `toggleCondition`: build CommandTarget, read condition name, call `commands.toggleCondition()`
- `cycleElement`: read element type, determine next state from current board, call `commands.moveElement()`
- `removeSummon`: read char name/edition + summon index, call `commands.removeSummon()`
- `toggleDead`: read monster/entity info, determine alive vs dead, send appropriate health delta

Single `change` listener on `#tabPlay` for initiative inputs: read value, call `commands.setInitiative()`.

**buildTarget() helper:** constructs a `CommandTarget` from `data-target-type`, `data-target-name`, `data-target-edition`, plus `data-summon-index` or `data-entity-number` depending on type. **Match the exact field names from the CommandTarget type in commands.ts.**

Section collapse: click on `.play-section-header[data-collapse]` toggles the content div's visibility.

## STEP 8 — CSS

Add Active Play styles to `clients/controller/styles/controller.css`. Key components:

**Timeline:** Sticky or fixed at top of tab, horizontal scroll, dark background. Figures are 60-80px wide columns. Active has gold ring + arrow indicator. Completed is dimmed.

**Character cards:** Grid `auto-fill minmax(300px, 1fr)`. Dark card background, copper border. Health control is inline flex with circular +/- buttons.

**Condition buttons:** 32-36px squares in a flex-wrap grid. Dark background, muted border. Active negative: red border + glow. Active positive: green. Icons via `<img>` with SVG sources.

**Summon cards:** Nested inside character card, blue (`var(--shield-blue)`) border, slightly reduced sizing.

**Monster groups:** Similar card structure to characters. Standee rows are stacked inside. Elite standees have gold-tinted left border or background. Dead standees heavily dimmed.

**Element buttons:** 44-48px squares. Color states via CSS: inert=dim, strong/new=bright with element-specific color hints, waning=pulsing or reduced brightness.

**FABs:** 56px circle, centered icon, positioned bottom-right. Gold gradient for active, dimmed for disabled. Label text below.

Follow the dark parchment aesthetic. Use CSS variables from theme.css throughout.

## STEP 9 — Wire into main.ts

Edit `clients/controller/src/main.ts`:
1. Import `initActivePlayTab` from `'./tabs/activePlay.js'`
2. Call `initActivePlayTab()` inside `enterGameScreen()` after showing the game screen
3. Tab module self-manages its subscription — no further wiring needed

## STEP 10 — Build and verify

```powershell
npm run build --workspace=clients/controller
npx tsx server/src/index.ts
```

Open `http://localhost:3000/controller`. Connect with a game code. Either import a GHS save or use curl to add test data:

```powershell
curl -X POST http://localhost:3000/api/import -H "Content-Type: application/json" -d "{\"gameCode\":\"test\",\"ghsState\":{\"revision\":0,\"state\":\"draw\",\"round\":1,\"level\":2,\"figures\":[\"gh-brute\",\"gh-spellweaver\",\"gh-guard\"],\"characters\":[{\"name\":\"brute\",\"edition\":\"gh\",\"level\":3,\"health\":10,\"maxHealth\":12,\"initiative\":0,\"active\":false,\"off\":false,\"absent\":false,\"exhausted\":false,\"entityConditions\":[],\"summons\":[{\"name\":\"bear\",\"number\":1,\"color\":\"blue\",\"health\":5,\"maxHealth\":8,\"attack\":3,\"movement\":2,\"range\":0,\"dead\":false,\"active\":false,\"off\":false,\"entityConditions\":[],\"tags\":[]}],\"longRest\":false}],\"monsters\":[{\"name\":\"guard\",\"edition\":\"gh\",\"level\":2,\"entities\":[{\"number\":1,\"type\":\"normal\",\"health\":5,\"maxHealth\":5,\"dead\":false,\"active\":false,\"off\":false,\"entityConditions\":[]},{\"number\":2,\"type\":\"elite\",\"health\":8,\"maxHealth\":8,\"dead\":false,\"active\":false,\"off\":false,\"entityConditions\":[]}],\"initiative\":30,\"active\":false,\"off\":false,\"abilities\":[]}],\"elementBoard\":[{\"type\":\"fire\",\"state\":\"inert\"},{\"type\":\"ice\",\"state\":\"strong\"},{\"type\":\"air\",\"state\":\"inert\"},{\"type\":\"earth\",\"state\":\"waning\"},{\"type\":\"light\",\"state\":\"inert\"},{\"type\":\"dark\",\"state\":\"inert\"}]}}"
```

Verify these interactions:
1. Timeline shows brute + guard in initiative order
2. Character card: brute with health 10/12, +/- buttons work
3. Summon card: bear with health 5/8, nested under brute
4. Monster group: guard with standees #1 (normal) and #2 (elite, gold-tinted)
5. Health changes reflect immediately (server round-trip)
6. Condition toggle works — button highlights red/green
7. Element bar shows states correctly, click cycles
8. FAB shows "Set Initiatives..." (disabled) during draw phase
9. Enter initiative 15 for brute → FAB becomes "Start Round" (enabled)
10. Click Start Round → phase changes to next, first figure becomes active
11. Click Next Turn → advances to next figure
12. After all figures done → "Next Round" FAB appears
13. No console errors

## STEP 11 — Update ROADMAP.md

Mark complete:
- [x] Build Active Play tab — initiative timeline, health, conditions, turns

## STEP 12 — Commit

```powershell
git add -A
git commit -m "feat(controller): implement Active Play tab with full gameplay loop

- Initiative timeline: horizontal scrollable, auto-centers active figure
- Character cards: health +/-, condition toggles, initiative input (draw phase)
- Summon cards: health, conditions, kill — nested under parent character
- Monster groups: standee rows with health, conditions, kill, elite/boss styling
- Element board: 6 elements with state display and click-to-cycle
- FABs: phase-aware (Set Initiatives → Start Round → Next Turn → Next Round)
- Event delegation for all interactions via data-action attributes
- State subscription with revision-based dirty checking"
git push
```

Report: commit hash, esbuild output size, and which of the 13 verification checks passed.
