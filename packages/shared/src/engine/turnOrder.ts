// Turn order engine — initiative ordering, phase management, round lifecycle
import type {
  GameState,
  FigureIdentifier,
  Character,
  Monster,
  ObjectiveContainer,
} from '../types/gameState.js';
import { decayElements } from '../utils/elements.js';
import { processConditionEndOfRound } from '../utils/conditions.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OrderedFigure {
  figureId: FigureIdentifier;
  type: 'character' | 'monster' | 'objectiveContainer';
  name: string;
  edition: string;
  initiative: number;
  active: boolean;
  off: boolean;
  absent?: boolean;
  summons?: OrderedSummon[];
}

export interface OrderedSummon {
  name: string;
  index: number;
  active: boolean;
  off: boolean;
  dead: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Deep clone via JSON round-trip. Used by all state-returning functions. */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Parse a figure string from state.figures[] ("edition-name") into edition + name.
 * Name may contain hyphens (e.g. "fh-banner-spear").
 */
function parseFigureString(figureStr: string): { edition: string; name: string } {
  const [edition, ...rest] = figureStr.split('-');
  return { edition, name: rest.join('-') };
}

/**
 * Find a figure in the game state collections and return it with its type.
 */
function findFigure(
  state: GameState,
  edition: string,
  name: string,
): { type: 'character'; figure: Character }
  | { type: 'monster'; figure: Monster }
  | { type: 'objectiveContainer'; figure: ObjectiveContainer }
  | null {
  const char = state.characters.find((c) => c.edition === edition && c.name === name);
  if (char) return { type: 'character', figure: char };

  const mon = state.monsters.find((m) => m.edition === edition && m.name === name);
  if (mon) return { type: 'monster', figure: mon };

  const obj = state.objectiveContainers.find((o) => o.edition === edition && o.name === name);
  if (obj) return { type: 'objectiveContainer', figure: obj };

  return null;
}

// ── Core functions ─────────────────────────────────────────────────────────

/**
 * Returns all figures mapped to rich objects in state.figures[] order.
 * Does NOT re-sort — GHS maintains figures[] in initiative order.
 */
export function getInitiativeOrder(state: GameState): OrderedFigure[] {
  const result: OrderedFigure[] = [];

  for (const figureStr of state.figures) {
    const { edition, name } = parseFigureString(figureStr);
    const found = findFigure(state, edition, name);
    if (!found) continue;

    const { type, figure } = found;

    // Skip monster groups where all entities are dead
    if (type === 'monster') {
      const monster = figure as Monster;
      const hasLiveEntities = monster.entities.some((e) => !e.dead);
      if (!hasLiveEntities) continue;
    }

    const ordered: OrderedFigure = {
      figureId: { type, name, edition },
      type,
      name,
      edition,
      initiative: 'initiative' in figure ? (figure as { initiative: number }).initiative : 0,
      active: figure.active,
      off: figure.off,
    };

    if (type === 'character') {
      const char = figure as Character;
      ordered.absent = char.absent;
      ordered.summons = char.summons
        .filter((s) => !s.dead)
        .map((s, i) => ({
          name: s.name,
          index: i,
          active: s.active,
          off: s.off,
          dead: s.dead,
        }));
    }

    result.push(ordered);
  }

  return result;
}

/**
 * Returns the FigureIdentifier of the next figure to act, or null if round is complete.
 */
export function getNextFigure(state: GameState): FigureIdentifier | null {
  const order = getInitiativeOrder(state);
  const eligible = order.filter((f) => !f.off && !f.absent);

  const activeFigure = eligible.find((f) => f.active);
  if (activeFigure) return activeFigure.figureId;

  const next = eligible[0];
  return next ? next.figureId : null;
}

/**
 * Returns true when all non-absent figures have off === true.
 */
export function isRoundComplete(state: GameState): boolean {
  const order = getInitiativeOrder(state);
  return order.every((f) => f.off || f.absent);
}

/**
 * Returns true if the phase can be advanced.
 * draw → next: all non-absent characters must have initiative > 0
 * next → draw: round must be complete
 */
export function canAdvancePhase(state: GameState): boolean {
  if (state.state === 'draw') {
    return state.characters
      .filter((c) => !c.absent)
      .every((c) => c.initiative > 0);
  }
  // state === 'next'
  return isRoundComplete(state);
}

/**
 * Transition from draw to next phase. Resets all figure states,
 * sorts figures[] by initiative, and activates the first figure.
 */
export function startRound(state: GameState): GameState {
  const s = deepClone(state);
  s.state = 'next';

  // Reset all characters and their summons
  for (const char of s.characters) {
    char.active = false;
    char.off = false;
    for (const summon of char.summons) {
      summon.active = false;
      summon.off = false;
    }
  }

  // Reset all monsters and their entities
  for (const mon of s.monsters) {
    mon.active = false;
    mon.off = false;
    for (const entity of mon.entities) {
      entity.active = false;
      entity.off = false;
    }
  }

  // Reset all objective containers and their entities
  for (const obj of s.objectiveContainers) {
    obj.active = false;
    obj.off = false;
    for (const entity of obj.entities) {
      entity.active = false;
    }
  }

  // Sort figures[] by initiative value
  // Build a map of edition-name → initiative for sorting
  const initiativeMap = new Map<string, { initiative: number; typeOrder: number }>();

  for (const char of s.characters) {
    const key = `${char.edition}-${char.name}`;
    initiativeMap.set(key, { initiative: char.initiative, typeOrder: 0 });
  }
  for (const mon of s.monsters) {
    const key = `${mon.edition}-${mon.name}`;
    initiativeMap.set(key, { initiative: mon.initiative, typeOrder: 1 });
  }
  for (const obj of s.objectiveContainers) {
    const key = `${obj.edition}-${obj.name}`;
    initiativeMap.set(key, { initiative: obj.initiative, typeOrder: 2 });
  }

  // Stable sort: lower initiative first, ties: characters < monsters < objectives
  s.figures.sort((a, b) => {
    const aInfo = initiativeMap.get(a);
    const bInfo = initiativeMap.get(b);
    const aInit = aInfo?.initiative ?? 0;
    const bInit = bInfo?.initiative ?? 0;
    if (aInit !== bInit) return aInit - bInit;
    const aType = aInfo?.typeOrder ?? 3;
    const bType = bInfo?.typeOrder ?? 3;
    return aType - bType;
  });

  // Activate the first non-absent figure
  const order = getInitiativeOrder(s);
  const first = order.find((f) => !f.absent);
  if (first) {
    const found = findFigure(s, first.edition, first.name);
    if (found) found.figure.active = true;
  }

  return s;
}

/**
 * End the current round. Resets figures, increments round, decays elements,
 * processes end-of-round conditions.
 */
export function endRound(state: GameState): GameState {
  const s = deepClone(state);
  s.state = 'draw';
  s.round += 1;

  // Reset all characters
  for (const char of s.characters) {
    char.active = false;
    char.off = false;
    char.initiative = 0;
    char.longRest = false;
    char.entityConditions = processConditionEndOfRound(char.entityConditions);
    // Reset and process summons
    for (const summon of char.summons) {
      summon.active = false;
      summon.off = false;
      summon.entityConditions = processConditionEndOfRound(summon.entityConditions);
    }
  }

  // Reset all monsters and their entities
  for (const mon of s.monsters) {
    mon.active = false;
    mon.off = false;
    for (const entity of mon.entities) {
      entity.active = false;
      entity.off = false;
      entity.entityConditions = processConditionEndOfRound(entity.entityConditions);
    }
  }

  // Reset all objective containers and their entities
  for (const obj of s.objectiveContainers) {
    obj.active = false;
    obj.off = false;
    for (const entity of obj.entities) {
      entity.active = false;
    }
  }

  // Element decay
  s.elementBoard = decayElements(s.elementBoard);

  return s;
}

/**
 * End the current figure's turn and activate the next one.
 */
export function activateNextFigure(state: GameState): GameState {
  const s = deepClone(state);

  // Find and deactivate the currently active figure
  const order = getInitiativeOrder(s);
  const activeFigure = order.find((f) => f.active);

  if (activeFigure) {
    const found = findFigure(s, activeFigure.edition, activeFigure.name);
    if (found) {
      found.figure.active = false;
      found.figure.off = true;

      if (found.type === 'character') {
        const char = found.figure as Character;
        for (const summon of char.summons) {
          summon.active = false;
          summon.off = true;
        }
      } else if (found.type === 'monster') {
        const mon = found.figure as Monster;
        for (const entity of mon.entities) {
          entity.active = false;
          entity.off = true;
        }
      } else if (found.type === 'objectiveContainer') {
        const obj = found.figure as ObjectiveContainer;
        for (const entity of obj.entities) {
          entity.active = false;
        }
      }
    }
  }

  // Activate the next non-off, non-absent figure
  const updatedOrder = getInitiativeOrder(s);
  const next = updatedOrder.find((f) => !f.off && !f.absent);
  if (next) {
    const found = findFigure(s, next.edition, next.name);
    if (found) found.figure.active = true;
  }

  return s;
}
