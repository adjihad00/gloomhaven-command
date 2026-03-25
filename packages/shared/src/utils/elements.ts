// Element board utilities — types from GHS Element.ts source
import type { ElementModel, ElementType, ElementState } from '../types/gameState.js';

const ELEMENT_TYPES: readonly ElementType[] = [
  'fire', 'ice', 'air', 'earth', 'light', 'dark',
] as const;

/** Create a default element board with all elements inert */
export function createDefaultElementBoard(): ElementModel[] {
  return ELEMENT_TYPES.map((type) => ({ type, state: 'inert' as ElementState }));
}

/** Decay a single element state: strong→waning, waning→inert, else unchanged */
export function decayElement(state: ElementState): ElementState {
  if (state === 'strong') return 'waning';
  if (state === 'waning') return 'inert';
  if (state === 'new') return 'strong';
  return state;
}

/** Decay all elements on the board (called at end of round) */
export function decayElements(board: ElementModel[]): ElementModel[] {
  return board.map((el) => ({ type: el.type, state: decayElement(el.state) }));
}
