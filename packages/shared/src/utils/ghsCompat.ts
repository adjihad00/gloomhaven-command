// TODO: Import/export GHS JSON saves
import type { GameState } from '../types/gameState.js';

export function importGhsSave(_json: unknown): GameState {
  throw new Error('importGhsSave not implemented');
}

export function exportGhsSave(_state: GameState): unknown {
  throw new Error('exportGhsSave not implemented');
}
