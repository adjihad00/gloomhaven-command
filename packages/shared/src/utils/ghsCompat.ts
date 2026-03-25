// GHS import/export compatibility — stubs until Phase 1C
import type { GameState } from '../types/gameState.js';

/** Import a GHS JSON save into our GameState format */
export function importGhsState(_ghsJson: string): GameState {
  throw new Error('Not implemented — Phase 1C');
}

/** Export our GameState to GHS-compatible JSON format */
export function exportGhsState(_state: GameState): string {
  throw new Error('Not implemented — Phase 1C');
}
