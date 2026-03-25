# Phase 1B — Utilities and Turn Order Engine

> Paste into Claude Code. This implements the element board utilities and
> the turn order engine that Phase 1C's command engine depends on.

---

Read CLAUDE.md, then docs/PROJECT_CONTEXT.md, then docs/GHS_STATE_MAP.md, then `packages/shared/src/types/gameState.ts` and `packages/shared/src/types/commands.ts` to understand the exact types you're working with.

## Context

GamePhase in GHS is only `"draw" | "next"`. There is no explicit `"play"` phase. During `"next"` phase, figures take turns tracked by `active` (currently acting) and `off` (turn completed) boolean flags. When all figures are `off`, the round is complete and phase returns to `"draw"`. This means the turn order engine is central to gameplay flow — it determines who acts next and when the round ends.

The `figures` array on GameState contains ordered `FigureIdentifier` strings in the format `"edition-name"` (e.g. `"fh-banner-spear"`, `"gh-guard"`). This array determines display/initiative order. Characters AND monsters appear in this array. Summons act on their parent character's initiative but are not listed in `figures[]` — they inherit turn order from their parent.

## STEP 0 — Type additions to `packages/shared/src/types/gameState.ts`

Before implementing utilities, add two missing fields needed by the turn order engine:

1. **Add `initiative: number` to the `Monster` interface.** Place it after `level`. This stores the initiative value from the drawn ability card. Set by the `drawMonsterAbility` command in Phase 1C. Defaults to `0` (no card drawn yet), same as Character.

2. **Add `off: boolean` to the `Summon` interface.** Place it after `active`. Tracks whether the summon has completed its turn within the parent character's turn. Matches the pattern used by Character, Monster, MonsterEntity, and ObjectiveContainer.

## STEP 1 — Implement `packages/shared/src/utils/elements.ts`

Replace the stub. Implement these exports:

### `ELEMENT_TYPES`
Constant array of all six element types: `['fire', 'ice', 'air', 'earth', 'light', 'dark']`

### `createDefaultElementBoard(): ElementModel[]`
Returns a fresh element board with all six elements in `'inert'` state. Use the exact `ElementModel` type from `gameState.ts`.

### `decayElements(board: ElementModel[]): ElementModel[]`
Returns a new array (do NOT mutate the input). Decay rules per GHS:
- `'new'` → `'strong'` (new elements become strong at end of round)
- `'strong'` → `'waning'`
- `'waning'` → `'inert'`
- `'inert'` → `'inert'` (no change)

Wait — verify against the GHS source. In the existing controller app (`ghs-controller.html`), the new-round logic does:
```javascript
if (el.state === 'new' || el.state === 'strong') {
    el.state = 'waning';
} else if (el.state === 'waning') {
    el.state = 'inert';
}
```

So the actual GHS decay is: `new → waning`, `strong → waning`, `waning → inert`. Both `new` and `strong` decay to `waning` at round end, NOT `new → strong`. Implement this exact behavior.

### `inferElement(board: ElementModel[], elementType: ElementType): ElementState`
Helper that safely looks up an element's current state. Returns `'inert'` if the element is not found on the board.

### `cycleElement(board: ElementModel[], elementType: ElementType): ElementModel[]`
Returns a new board array with the specified element toggled. Cycle: `inert → new → inert`. Used by the controller to manually flip elements. Does NOT mutate input.

## STEP 2 — Implement `packages/shared/src/engine/turnOrder.ts`

Replace the stub. This is the most logic-dense utility in Phase 1. Implement these exports:

### `getInitiativeOrder(state: GameState): OrderedFigure[]`

Returns all figures sorted by initiative, ready for display in the initiative timeline. This must match the GHS ordering logic from the existing apps.

Define the return type:
```typescript
export interface OrderedFigure {
  figureId: FigureIdentifier;
  type: 'character' | 'monster' | 'objectiveContainer';
  name: string;
  edition: string;
  initiative: number;
  active: boolean;    // currently taking turn
  off: boolean;       // turn completed
  absent?: boolean;   // characters only — not participating
  // For display: include child summons under characters
  summons?: OrderedSummon[];
}

export interface OrderedSummon {
  name: string;
  index: number;       // index within parent character's summons array
  active: boolean;
  off: boolean;
  dead: boolean;
}
```

Logic:
1. Iterate `state.figures[]` (these are already in GHS display order)
2. For each `figureId`, find the matching entity in `state.characters`, `state.monsters`, or `state.objectiveContainers`. Determine `type` from which collection contains the match: `'character'`, `'monster'`, or `'objectiveContainer'`.
3. Skip characters with `absent === true`
4. For characters, attach their living summons (filter `dead === false`)
5. Build `OrderedFigure` with all fields populated
6. Return the array in the same order as `state.figures[]` — GHS pre-sorts this by initiative

The `figures[]` array is the source of truth for order. Do NOT re-sort by initiative value — GHS maintains this array in sorted order. Just map it to rich objects.

Parsing `figureId`: the format is `"edition-name"` where name may contain hyphens (e.g. `"fh-banner-spear"`). Split on first hyphen only: `const [edition, ...rest] = id.split('-'); const name = rest.join('-');`

### `getNextFigure(state: GameState): FigureIdentifier | null`

Returns the `figureId` of the next figure that should take its turn, or `null` if the round is complete.

Logic:
1. Get initiative order via `getInitiativeOrder(state)`
2. Filter to figures that are NOT `off` and NOT `absent`
3. If any figure has `active === true`, return that figure (someone is mid-turn)
4. Otherwise, return the first figure that is not `off` (next to act)
5. If all figures are `off`, return `null` (round complete → transition to `"draw"`)

### `isRoundComplete(state: GameState): boolean`

Returns true when all non-absent figures have `off === true`. This signals time to advance to `"draw"` phase and start a new round.

### `canAdvancePhase(state: GameState): boolean`

Returns true if the phase can be advanced:
- From `"draw"` to `"next"`: all non-absent characters must have `initiative > 0`
- From `"next"` to `"draw"`: `isRoundComplete()` must be true

### `startRound(state: GameState): GameState`

Returns a new GameState (deep clone — do NOT mutate input) with:
1. `state.state = 'next'`
2. All characters: `active = false`, `off = false`
3. All character summons: `active = false`, `off = false`
4. All monsters: `active = false`, `off = false`. All `MonsterEntity` items within each monster: `active = false`, `off = false`
5. All objective containers: `active = false`, `off = false`. All `ObjectiveEntity` items within each container: `active = false`
6. The first figure in initiative order gets `active = true`
7. Sort `state.figures[]` by initiative value (characters by their `initiative` field, monsters by their `initiative` field, objective containers by their `initiative` field)

Sorting rule: lower initiative goes first. Ties: characters before monsters before objectives. Within same type and initiative: preserve existing order.

### `endRound(state: GameState): GameState`

Returns a new GameState with:
1. `state.state = 'draw'`
2. `state.round += 1`
3. All characters: `active = false`, `off = false`, `initiative = 0`, `longRest = false`
4. All character summons: `active = false`, `off = false`
5. All monsters: `active = false`, `off = false`. All `MonsterEntity` items within each monster: `active = false`, `off = false`
6. All objective containers: `active = false`, `off = false`. All `ObjectiveEntity` items within each container: `active = false`
7. Element decay: apply `decayElements()` to `state.elementBoard`
8. Condition processing: for each entity (characters, summons, monster entities), handle condition state transitions per `processConditionEndOfRound()` (see Step 3)

### `activateNextFigure(state: GameState): GameState`

Returns a new GameState where:
1. The currently `active` figure (if any) has `active = false`, `off = true`
2. If the figure is a character, its summons also get `active = false`, `off = true`
3. If the figure is a monster, all its `MonsterEntity` items get `active = false`, `off = true`
4. If the figure is an objective container, all its `ObjectiveEntity` items get `active = false`
5. The next figure in initiative order (first non-`off`) gets `active = true`
6. If no next figure exists, nothing changes (caller should check `isRoundComplete()`)

### Utility: `deepClone<T>(obj: T): T`

Use `JSON.parse(JSON.stringify(obj))` for now. Used by all state-returning functions to avoid mutation. Export it — the command engine in 1C will need it too.

## STEP 3 — Implement condition end-of-round processing

Add to `packages/shared/src/utils/conditions.ts` (extend what's already there from Phase 1A):

### `processConditionEndOfRound(conditions: EntityCondition[]): EntityCondition[]`

Returns a new array (no mutation). At end of round, GHS conditions transition:
- Conditions with `state === 'new'` → set `state = 'normal'` (they survive their first round)
- Conditions with `state === 'normal'` and `expired === false` → set `state = 'expire'` if they are single-round conditions
- Conditions with `state === 'expire'` → remove from array

For Gloomhaven Command, simplify to: all conditions with `expired === true` are removed. Conditions with `state === 'turn'` transition to `state = 'normal'` at end of the entity's turn (not end of round). End-of-round just cleans up expired ones.

### `processConditionEndOfTurn(conditions: EntityCondition[]): EntityCondition[]`

At end of a figure's turn:
- Conditions with `state === 'turn'` → set `state = 'normal'`
- Wound deals 1 damage (but that's a side effect — return a flag instead)

Return type should be `{ conditions: EntityCondition[]; woundDamage: number }` so the caller can apply HP loss from wound.

### `toggleCondition(conditions: EntityCondition[], conditionName: ConditionName, value?: number): EntityCondition[]`

If condition exists (active, not expired/removed): remove it.
If condition does not exist: add it with `state: 'new'`, `expired: false`, `permanent: false`, `value: value ?? 1`. Use `'new'` (not `'normal'`) so the condition survives its first round — it transitions to `'normal'` at end of round via `processConditionEndOfRound`.

Returns a new array.

## STEP 4 — Update barrel exports in `packages/shared/src/index.ts`

Add all new exports:
- From `elements.ts`: `ELEMENT_TYPES`, `createDefaultElementBoard`, `decayElements`, `inferElement`, `cycleElement`
- From `turnOrder.ts`: `OrderedFigure`, `OrderedSummon`, `getInitiativeOrder`, `getNextFigure`, `isRoundComplete`, `canAdvancePhase`, `startRound`, `endRound`, `activateNextFigure`, `deepClone`
- From `conditions.ts` (new additions): `processConditionEndOfRound`, `processConditionEndOfTurn`, `toggleCondition`

## STEP 5 — Verification

1. `npx tsc --noEmit` from `packages/shared/` — zero errors
2. All functions are pure (no mutations to input parameters)
3. `decayElements` follows GHS rules: new→waning, strong→waning, waning→inert
4. `getInitiativeOrder` does NOT re-sort — it maps `figures[]` order to rich objects
5. `startRound` DOES sort `figures[]` by initiative value
6. `deepClone` is used in every function that returns modified state

Run a quick sanity check — create and run `_test_turnorder.mts` at repo root:

```typescript
import {
  createDefaultElementBoard, decayElements,
  getInitiativeOrder, isRoundComplete, startRound, endRound,
  deepClone
} from './packages/shared/src/index.js';

// Test element decay
const board = createDefaultElementBoard();
board[0].state = 'new';
board[1].state = 'strong';
board[2].state = 'waning';
const decayed = decayElements(board);
console.assert(decayed[0].state === 'waning', 'new should decay to waning');
console.assert(decayed[1].state === 'waning', 'strong should decay to waning');
console.assert(decayed[2].state === 'inert', 'waning should decay to inert');
console.assert(board[0].state === 'new', 'original should not be mutated');
console.log('✓ Element decay tests passed');

console.log('✓ All Phase 1B sanity checks passed');
```

Run: `npx tsx _test_turnorder.mts`

Delete after verification: `Remove-Item _test_turnorder.mts -ErrorAction SilentlyContinue`

## STEP 6 — Update ROADMAP.md

Mark these items as complete:
- [ ] → [x] Implement turnOrder — initiative sort, phase transitions
- [ ] → [x] Implement conditions utility — lists, toggle logic, expiry
- [ ] → [x] Implement elements utility — element board decay per round

## STEP 7 — Commit

```powershell
git add -A
git commit -m "feat(shared): implement turn order engine and element/condition utilities

- Element board: decay, create, infer, cycle (pure functions)
- Turn order: initiative ordering, next figure, round start/end
- Phase management: canAdvancePhase, startRound, endRound
- Condition processing: end-of-round, end-of-turn, toggle
- deepClone utility for immutable state operations
- All functions are pure — no input mutation"
git push
```

Report: commit hash, tsc output, and the sanity check results.
