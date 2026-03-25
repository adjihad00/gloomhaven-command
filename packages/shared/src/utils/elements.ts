// Element board utilities — pure functions, no mutation
import type { ElementModel, ElementType, ElementState } from '../types/gameState.js';

/** All six element types on the board */
export const ELEMENT_TYPES: readonly ElementType[] = [
  'fire', 'ice', 'air', 'earth', 'light', 'dark',
] as const;

/** Create a default element board with all elements inert */
export function createDefaultElementBoard(): ElementModel[] {
  return ELEMENT_TYPES.map((type) => ({ type, state: 'inert' as ElementState }));
}

/**
 * Decay all elements on the board (called at end of round).
 * GHS rules: new → waning, strong → waning, waning → inert.
 * Returns a new array — does NOT mutate input.
 */
export function decayElements(board: ElementModel[]): ElementModel[] {
  return board.map((el) => {
    let newState: ElementState = el.state;
    if (el.state === 'new' || el.state === 'strong') {
      newState = 'waning';
    } else if (el.state === 'waning') {
      newState = 'inert';
    }
    return { type: el.type, state: newState };
  });
}

/** Look up an element's current state. Returns 'inert' if not found. */
export function inferElement(board: ElementModel[], elementType: ElementType): ElementState {
  const el = board.find((e) => e.type === elementType);
  return el ? el.state : 'inert';
}

/**
 * Toggle an element: inert → new → inert.
 * Returns a new board array — does NOT mutate input.
 */
export function cycleElement(board: ElementModel[], elementType: ElementType): ElementModel[] {
  return board.map((el) => {
    if (el.type !== elementType) return { type: el.type, state: el.state };
    const newState: ElementState = el.state === 'inert' ? 'new' : 'inert';
    return { type: el.type, state: newState };
  });
}
