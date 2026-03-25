// Diff utility — entity-level diffing for efficient state broadcasting
import type { GameState } from '../types/gameState.js';
import type { StateChange } from '../types/protocol.js';
import { deepClone } from './turnOrder.js';

/**
 * Compare two GameState objects and return StateChange[] for every value that differs.
 * Diffs at the entity level — not recursive deep diff of every nested property.
 * Never includes undoStack in diffs (server-only).
 */
export function diffStates(before: GameState, after: GameState): StateChange[] {
  const changes: StateChange[] = [];

  // 1. Top-level primitives
  const primitiveKeys: (keyof GameState)[] = [
    'gameCode', 'revision', 'revisionOffset', 'edition', 'state', 'round',
    'level', 'levelCalculation', 'levelAdjustment', 'bonusAdjustment',
    'ge5Player', 'playerCount', 'solo', 'server', 'playSeconds', 'totalSeconds',
    'finish', 'favorPoints', 'keepFavors', 'favorPoints',
  ];
  for (const key of primitiveKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.push({ path: key, value: after[key] });
    }
  }

  // 2. Element board — emit entire array if anything changed
  if (JSON.stringify(before.elementBoard) !== JSON.stringify(after.elementBoard)) {
    changes.push({ path: 'elementBoard', value: after.elementBoard });
  }

  // 3. Characters — per-character, per-field diffing
  diffIndexedArray(
    before.characters as unknown as Record<string, unknown>[],
    after.characters as unknown as Record<string, unknown>[],
    'characters', changes,
  );

  // 4. Monsters — per-monster, per-field diffing
  diffIndexedArray(
    before.monsters as unknown as Record<string, unknown>[],
    after.monsters as unknown as Record<string, unknown>[],
    'monsters', changes,
  );

  // 5. Objective containers — per-container, per-field diffing
  diffIndexedArray(
    before.objectiveContainers as unknown as Record<string, unknown>[],
    after.objectiveContainers as unknown as Record<string, unknown>[],
    'objectiveContainers', changes,
  );

  // 6. Figures — emit entire array if changed
  if (JSON.stringify(before.figures) !== JSON.stringify(after.figures)) {
    changes.push({ path: 'figures', value: after.figures });
  }

  // 7. Decks — emit entire deck if anything changed
  for (const deckKey of ['monsterAttackModifierDeck', 'allyAttackModifierDeck', 'lootDeck', 'challengeDeck'] as const) {
    if (JSON.stringify(before[deckKey]) !== JSON.stringify(after[deckKey])) {
      changes.push({ path: deckKey, value: after[deckKey] });
    }
  }

  // 8. Scenario, sections, rules — emit entire value if changed
  for (const key of [
    'scenario', 'sections', 'scenarioRules', 'appliedScenarioRules',
    'discardedScenarioRules', 'conditions', 'battleGoalEditions',
    'filteredBattleGoals', 'entitiesCounter', 'roundResets', 'roundResetsHidden',
    'gameClock', 'lootDeckEnhancements', 'lootDeckFixed', 'lootDeckSections',
    'unlockedCharacters', 'favors',
  ] as const) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.push({ path: key, value: after[key] });
    }
  }

  // 9. Party — emit entire party if anything changed
  if (JSON.stringify(before.party) !== JSON.stringify(after.party)) {
    changes.push({ path: 'party', value: after.party });
  }

  // 10. Parties array
  if (JSON.stringify(before.parties) !== JSON.stringify(after.parties)) {
    changes.push({ path: 'parties', value: after.parties });
  }

  // undoStack is intentionally excluded — server-only

  return changes;
}

/**
 * Diff an indexed array of entities (characters, monsters, objectiveContainers).
 * If the array length changed, emit the entire array.
 * Otherwise, for each index, emit per-field changes.
 */
function diffIndexedArray<T extends Record<string, unknown>>(
  before: T[],
  after: T[],
  prefix: string,
  changes: StateChange[],
): void {
  if (before.length !== after.length) {
    changes.push({ path: prefix, value: after });
    return;
  }

  for (let i = 0; i < after.length; i++) {
    const beforeItem = before[i];
    const afterItem = after[i];

    for (const key of Object.keys(afterItem)) {
      const beforeVal = beforeItem[key];
      const afterVal = afterItem[key];
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changes.push({ path: `${prefix}.${i}.${key}`, value: afterVal });
      }
    }
  }
}

/**
 * Apply a StateChange[] to a GameState, returning a new state.
 * Client-side counterpart to diffStates. Used to apply incoming diffs
 * without replacing the entire state.
 */
export function applyDiff(state: GameState, changes: StateChange[]): GameState {
  const result = deepClone(state);

  for (const change of changes) {
    const segments = change.path.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let target: any = result;

    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const index = Number(seg);
      target = Number.isNaN(index) ? target[seg] : target[index];
    }

    const lastSeg = segments[segments.length - 1];
    const lastIndex = Number(lastSeg);
    if (Number.isNaN(lastIndex)) {
      target[lastSeg] = change.value;
    } else {
      target[lastIndex] = change.value;
    }
  }

  return result;
}
