// Turn order and initiative — stub until Phase 1B
import type { GameState, FigureIdentifier } from '../types/gameState.js';

/** Get all figures sorted by initiative for the current round */
export function getInitiativeOrder(_state: GameState): FigureIdentifier[] {
  throw new Error('Not implemented — Phase 1B');
}

/** Get the next figure that should take its turn */
export function getNextFigure(_state: GameState): FigureIdentifier | null {
  throw new Error('Not implemented — Phase 1B');
}
