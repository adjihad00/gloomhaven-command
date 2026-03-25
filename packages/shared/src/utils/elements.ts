// TODO: Element board decay logic per round
import type { ElementBoard, ElementState } from '../types/gameState.js';

export function decayElement(state: ElementState): ElementState {
  if (state === 'strong') return 'waning';
  if (state === 'waning') return 'inert';
  return 'inert';
}

export function decayAllElements(board: ElementBoard): ElementBoard {
  return {
    fire: decayElement(board.fire),
    ice: decayElement(board.ice),
    air: decayElement(board.air),
    earth: decayElement(board.earth),
    light: decayElement(board.light),
    dark: decayElement(board.dark),
  };
}
