# Phase 1C — Command Engine, Validation, and GHS Compatibility

> **EXECUTED** — This prompt was reviewed and executed with corrections.
> Several command names, payload shapes, and type references in this document
> did not match the actual `commands.ts` types (e.g. `changeStat` vs `setExperience`/`setLoot`,
> `toggleLongRest` missing from union, `resolveTarget` discriminants). Implementation
> trusted the codebase types as source of truth and adapted the prompt's intent accordingly.
> See the git commit for the actual implementation.

---

Read CLAUDE.md, then docs/PROJECT_CONTEXT.md, then docs/GHS_STATE_MAP.md.

Then read these files in full — you need exact type and function signatures:
- `packages/shared/src/types/gameState.ts`
- `packages/shared/src/types/commands.ts`
- `packages/shared/src/types/protocol.ts` (for `StateChange`)
- `packages/shared/src/engine/turnOrder.ts`
- `packages/shared/src/utils/conditions.ts`
- `packages/shared/src/utils/elements.ts`

## Architecture

`applyCommand` is a pure function: `(state, command) → { state, changes }`. It deep-clones the input state, mutates the clone, then diffs old vs new to produce `StateChange[]`. The server calls `validateCommand` first, then `applyCommand`, then broadcasts the changes.

The diff generation uses a generic `diffStates(before, after)` utility that compares two GameState objects and emits `StateChange[]` with JSON paths like `"characters.0.health"`. This avoids hand-coding diff logic per command.

## STEP 1 — Implement diff utility

Create `packages/shared/src/engine/diffStates.ts`:

### `diffStates(before: GameState, after: GameState): StateChange[]`

Compares two GameState objects and returns an array of `StateChange` entries for every value that differs.

Strategy — do NOT do a recursive deep diff of every nested property. That's too granular and produces noisy diffs. Instead, diff at the **entity level**:

1. Compare top-level primitives: `state`, `round`, `level`, `revision`, `solo`, `edition`, etc. Emit a change for each that differs.
2. Compare `elementBoard`: if any element's state changed, emit one change for the entire `elementBoard` array.
3. Compare `characters`: for each character index, if anything on the character changed (health, conditions, initiative, summons, etc.), emit one change per changed top-level field on that character. For nested objects like `entityConditions` and `summons`, emit the entire array as the value if anything inside changed.
   - Path format: `"characters.{index}.{field}"` e.g. `"characters.0.health"`, `"characters.0.entityConditions"`
4. Compare `monsters`: same pattern. For `entities` sub-array, emit the entire `entities` array if any entity changed.
   - Path format: `"monsters.{index}.{field}"` e.g. `"monsters.2.entities"`
5. Compare `objectiveContainers`: same pattern as monsters.
6. Compare `figures`: if the array differs, emit one change for the whole array.
7. Compare decks (`monsterAttackModifierDeck`, `allyAttackModifierDeck`, `lootDeck`): emit the entire deck object if anything changed.
8. Compare `scenario`, `sections`, `scenarioRules`, etc.: emit entire value if changed.
9. Compare `party`: emit entire party if anything changed.
10. Compare `undoStack`: do NOT include in diffs — undo stack is server-only.

Use `JSON.stringify` for deep equality checks on objects/arrays. This is adequate for the comparison frequency (commands, not animation frames).

Export the function.

### `applyDiff(state: GameState, changes: StateChange[]): GameState`

Client-side counterpart. Applies a `StateChange[]` to a GameState, returning a new state. Used by clients to apply incoming diffs without replacing the entire state.

For each change:
1. Parse the `path` string: split on `"."`, convert numeric segments to array indices
2. Navigate to the parent object
3. Set the value

Use `deepClone` on the input before mutating. Export the function.

## STEP 2 — Implement `packages/shared/src/engine/validateCommand.ts`

Replace the stub. Validates that a command CAN be applied to the current state. Returns `{ valid: true }` or `{ valid: false, error: "reason" }`.

Implement a switch on `command.action`. Each case validates:

### Core gameplay commands

**changeHealth**: Target must exist and not be dead/exhausted. Delta applied to current health must stay in range `[0, maxHealth]`. Allow the delta even if it would clamp — validation just checks the target exists.

**toggleCondition**: Target must exist and not be dead.

**setInitiative**: Character must exist, not be absent. Value must be 0-99. Can only set during `"draw"` phase (state.state === 'draw').

**advancePhase**: `canAdvancePhase(state)` from turnOrder must return true.

**toggleTurn**: Figure identified by `figureId` must exist. If activating (figure is not `active`), no other figure should be `active` — OR the currently active figure will be deactivated. During `"draw"` phase, reject this command.

**moveElement**: Element type must exist on `elementBoard`.

**changeStat**: Character must exist. Stat must be `'experience'` or `'gold'`.

**toggleLongRest**: Character must exist. Only valid during `"draw"` phase.

### Entity management commands

**addEntity**: Monster must exist. Entity number must not already exist in that monster's entities.

**removeEntity**: Monster and entity number must exist.

**addSummon**: Character must exist.

**removeSummon**: Character must exist. Summon index must be valid.

**addCharacter**: No character with that name should already exist.

**removeCharacter**: Character must exist.

**toggleCharacterAbsent**: Character must exist.

**toggleCharacterExhausted**: Character must exist.

### Deck commands

**drawLootCard**: Loot deck must have cards remaining (`current < cards.length`).

**assignLoot**: Card index must be valid. Character must exist.

**drawMonsterAbility**: Monster must exist. Monster must have abilities available.

**shuffleModifierDeck**: Deck identifier must be valid ('monster', 'ally', or a character name that exists).

**drawModifierCard**: Same as shuffle — deck must be valid and have cards.

**addModifierCard / removeModifierCard**: Deck must be valid.

### Scenario/campaign commands

**setScenario**: Always valid (creates/replaces scenario).

**revealRoom**: Scenario must exist. Room must not already be revealed.

**setScenarioLevel**: Level must be 0-7.

**undoAction**: `undoStack` must have entries.

For any command action not recognized, return `{ valid: false, error: 'Unknown command action' }`.

## STEP 3 — Implement `packages/shared/src/engine/applyCommand.ts`

Replace the stub. This is the main engine.

Signature:
```typescript
export function applyCommand(
  state: GameState,
  command: Command
): { state: GameState; changes: StateChange[] }
```

Logic:
1. `const before = deepClone(state);`
2. `const after = deepClone(state);`
3. Switch on `command.action`, mutate `after` in place
4. `after.revision += 1;`
5. Push an undo entry onto `after.undoStack` (snapshot of `before`, capped at `after.undoLimit || 50`)
6. `const changes = diffStates(before, after);`
7. Return `{ state: after, changes }`

Implement every command action. Import and use utilities from turnOrder, conditions, and elements where applicable.

### Command implementations

Group them logically in a helper-per-command pattern to keep the switch clean:

```typescript
function handleChangeHealth(state: GameState, payload: ChangeHealthCommand['payload']): void {
  // resolve target, clamp health, auto-kill at 0 for monsters
}
```

Each handler receives the `after` state and mutates it directly (it's already a clone).

#### Core gameplay

**changeHealth**: Resolve target via `resolveTarget()` helper (see below). Apply delta, clamp to `[0, maxHealth]`. If a monster entity reaches 0 health, set `dead = true`. If a character reaches 0 health, do NOT auto-kill (characters choose to become exhausted).

**toggleCondition**: Resolve target. Call `toggleCondition()` from conditions utility on the entity's `entityConditions` array.

**setInitiative**: Find character by name. Set `initiative = value`.

**advancePhase**: Call `canAdvancePhase()`. If current state is `"draw"`, call `startRound()`. If current state is `"next"` and round is complete, call `endRound()`. Replace the state wholesale with the returned state from turnOrder functions.

**toggleTurn**: Find the figure. If figure is `active`, set `active = false`, `off = true`. Process end-of-turn conditions via `processConditionEndOfTurn()`. Apply wound damage if any. If figure is NOT `active` and NOT `off`, set `active = true` and deactivate any currently active figure. Handle summons: if toggling a character, also set their summons' `active`/`off` accordingly.

**moveElement**: Find element on board by type. Set `state = newState`.

**changeStat**: Find character. Add delta to the specified stat. Clamp `experience >= 0`, `gold >= 0`.

**toggleLongRest**: Find character. Toggle `longRest` boolean. If entering long rest, set `initiative = 99`.

#### Entity management

**addEntity**: Find monster. Push new entity with provided number, type, health, maxHealth. Initialize: `dead: false`, `active: false`, `off: false`, `dormant: false`, `entityConditions: []`, `markers: []`, `tags: []`.

**removeEntity**: Find monster. Filter out the entity with matching number.

**addSummon**: Find character. Push new summon with provided fields. Initialize: `dead: false`, `active: false`, `off: false`, `entityConditions: []`, `tags: []`, `number` set to next available summon number for that character.

**removeSummon**: Find character. Splice summon at the given index.

**addCharacter**: Push a new Character object onto `state.characters`. Add `figureId` to `state.figures`. Initialize all fields with sensible defaults (health = maxHealth from payload or 10, initiative = 0, entityConditions = [], summons = [], etc.).

**removeCharacter**: Remove from `state.characters` and from `state.figures`.

**toggleCharacterAbsent**: Toggle `absent` flag. If becoming absent, also set `active = false`, `off = false`, `initiative = 0`.

**toggleCharacterExhausted**: Toggle `exhausted` flag. If becoming exhausted, set `health = 0`, `active = false`, `off = true`.

#### Deck commands

**drawLootCard**: Increment `lootDeck.current`. The card at `current - 1` is the drawn card. Add it to `lootDeck.drawn`.

**assignLoot**: Remove card from `lootDeck.drawn`, add to `lootDeck.assigned` with the character name.

**drawMonsterAbility**: Find monster. Advance the ability card pointer. If the deck needs shuffling (check shuffle flag on the card), shuffle it.

**shuffleModifierDeck**: Find the deck (monster, ally, or character). Reset `current` to 0, shuffle `cards` array using Fisher-Yates, clear `drawn`/`discarded`.

**drawModifierCard**: Find the deck. Advance `current`, move card to drawn pile. If the drawn card has `shuffle: true`, mark deck for shuffle at end of round.

**addModifierCard**: Find the deck. Insert a bless or curse card at a random position in the remaining (undrawn) portion of the deck.

**removeModifierCard**: Find the deck. Remove the first bless or curse card from the remaining portion.

#### Scenario/campaign

**setScenario**: Set `state.scenario` with the provided data. Reset round to 0, phase to `"draw"`, clear monsters and objectives.

**revealRoom**: Add room ID to `state.scenario.revealedRooms`.

**setScenarioLevel**: Set `state.level`.

**undoAction**: Pop the last entry from `undoStack`. Parse the snapshot JSON. Replace the current state with it BUT keep the current `undoStack` (with the popped entry removed). Keep the current `revision` (increment it — undo is itself a revisioned change).

### `resolveTarget` helper

```typescript
function resolveTarget(state: GameState, target: CommandTarget): {
  entity: Character | MonsterEntity | Summon | ObjectiveEntity | null;
  parent?: Monster | Character | ObjectiveContainer;
  characterIndex?: number;
  monsterIndex?: number;
  entityIndex?: number;
  summonIndex?: number;
}
```

Switch on `target.type`:
- `'character'`: find in `state.characters` by name
- `'summon'`: find character, then summon by index
- `'monsterEntity'`: find monster by name, then entity by number
- `'monster'`: find monster by name (returns monster, not an entity)

Return null for entity if not found.

## STEP 4 — Implement `packages/shared/src/utils/ghsCompat.ts`

Replace the stub. This handles importing GHS JSON save files and exporting back.

### `importGhsState(ghsJson: unknown): GameState`

Takes a raw JSON object (from GHS SQLite or a GHS backup file) and converts it to our `GameState` type.

The GHS JSON is almost 1:1 with our types (because we based our types on the GHS source). The import function's job is:

1. Validate that `ghsJson` is an object with expected top-level keys
2. Cast/coerce types where needed (GHS may serialize enums as strings that match our string literals)
3. Initialize any fields we added that GHS doesn't have: `undoStack: []`, `undoLimit: 50`
4. Ensure all arrays exist (GHS may omit empty arrays as `undefined`)
5. Normalize `elementBoard`: ensure all 6 elements exist, defaulting to `'inert'`
6. Return the typed `GameState`

Do NOT deeply validate every nested field — trust the GHS structure. Use type assertions where the structure is known to match. Add null coalescing for optional fields.

### `exportGhsState(state: GameState): Record<string, unknown>`

Converts our `GameState` back to a GHS-compatible JSON object.

1. Deep clone the state
2. Remove fields GHS doesn't understand: `undoStack`, `undoLimit`
3. Return the plain object

### `createEmptyGameState(edition?: string): GameState`

Returns a blank, valid GameState for starting a new game. Initialize:
- `revision: 0`, `state: 'draw'`, `round: 0`, `level: 1`
- Empty arrays for characters, monsters, figures, objectiveContainers
- Default element board via `createDefaultElementBoard()`
- Empty decks (monsterAttackModifierDeck, allyAttackModifierDeck, lootDeck)
- `undoStack: []`, `undoLimit: 50`
- `edition: edition ?? 'gh'`
- All other fields with sensible defaults matching GHS

Export this function — the server uses it when creating a new game.

## STEP 5 — Update barrel exports

Add to `packages/shared/src/index.ts`:
- `diffStates`, `applyDiff` from `engine/diffStates.ts`
- `applyCommand` (already exported, now implemented)
- `validateCommand` (already exported, now implemented)
- `importGhsState`, `exportGhsState`, `createEmptyGameState` from `utils/ghsCompat.ts`

## STEP 6 — Verification

1. `npx tsc --noEmit` from `packages/shared/` — zero errors
2. `applyCommand` handles every action in the `Command` union (exhaustive switch — add a `default` that throws for safety)
3. `validateCommand` handles every action
4. `diffStates` never includes `undoStack` in changes
5. `resolveTarget` handles all `CommandTarget` discriminants
6. All functions remain pure — `applyCommand` clones before mutating

Create and run `_test_engine.mts` at repo root:

```typescript
import {
  applyCommand, validateCommand, createEmptyGameState, diffStates, applyDiff
} from './packages/shared/src/index.js';

// Create a fresh game state
const state = createEmptyGameState('gh');

// Add a character
const { state: s1, changes: c1 } = applyCommand(state, {
  action: 'addCharacter',
  payload: { name: 'brute', edition: 'gh', level: 1 }
});
console.assert(s1.characters.length === 1, 'Should have 1 character');
console.assert(s1.characters[0].name === 'brute', 'Character should be brute');
console.assert(c1.length > 0, 'Should have changes');
console.log(`✓ addCharacter: ${c1.length} changes`);

// Validate changeHealth
const v1 = validateCommand(s1, {
  action: 'changeHealth',
  payload: { target: { type: 'character', name: 'brute' }, delta: -3 }
});
console.assert(v1.valid === true, 'changeHealth should be valid');
console.log('✓ validateCommand: changeHealth valid');

// Apply changeHealth
const { state: s2, changes: c2 } = applyCommand(s1, {
  action: 'changeHealth',
  payload: { target: { type: 'character', name: 'brute' }, delta: -3 }
});
console.assert(s2.characters[0].health === s1.characters[0].health - 3, 'Health should decrease by 3');
console.assert(s1.characters[0].health !== s2.characters[0].health, 'Original state should not be mutated');
console.log(`✓ changeHealth: hp ${s1.characters[0].health} → ${s2.characters[0].health}, ${c2.length} changes`);

// Test applyDiff
const reconstructed = applyDiff(s1, c2);
console.assert(reconstructed.characters[0].health === s2.characters[0].health, 'applyDiff should match');
console.log('✓ applyDiff: reconstructed state matches');

// Test undo
const { state: s3 } = applyCommand(s2, { action: 'undoAction', payload: {} });
console.assert(s3.characters[0].health === s1.characters[0].health, 'Undo should restore health');
console.log(`✓ undoAction: hp restored to ${s3.characters[0].health}`);

// Test element
const { state: s4 } = applyCommand(s1, {
  action: 'moveElement',
  payload: { element: 'fire', newState: 'strong' }
});
const fireEl = s4.elementBoard.find(e => e.type === 'fire');
console.assert(fireEl?.state === 'strong', 'Fire should be strong');
console.log('✓ moveElement: fire → strong');

// Test set initiative + advance phase
const { state: s5 } = applyCommand(s1, {
  action: 'setInitiative',
  payload: { characterName: 'brute', value: 15 }
});
console.assert(s5.characters[0].initiative === 15, 'Initiative should be 15');
console.log('✓ setInitiative: 15');

console.log('\n✓ All Phase 1C tests passed');
```

Run: `npx tsx _test_engine.mts`

Delete after: `Remove-Item _test_engine.mts -ErrorAction SilentlyContinue`

## STEP 7 — Update ROADMAP.md

Mark these items as complete:
- [x] Implement applyCommand engine — pure state mutations
- [x] Implement validateCommand — guard invalid mutations
- [x] Implement ghsCompat — import/export GHS JSON saves

Also mark the already-completed items from 1A and 1B if not already marked:
- [x] Define GameState types
- [x] Define Command types
- [x] Define Protocol types
- [x] Implement turnOrder
- [x] Implement conditions utility
- [x] Implement elements utility

## STEP 8 — Commit

```powershell
git add -A
git commit -m "feat(shared): implement command engine, validation, and GHS compatibility

- applyCommand: handles all 32 command actions as pure state mutations
- validateCommand: validates every command against current state
- diffStates: entity-level diff generation for efficient broadcasting
- applyDiff: client-side diff application via JSON path
- resolveTarget: unified entity targeting across command types
- ghsCompat: importGhsState, exportGhsState, createEmptyGameState
- Undo stack: snapshot-based with configurable depth limit
- All engine functions are pure — no input mutation"
git push
```

Report: commit hash, tsc output, test results, and the count of command actions handled in applyCommand.
