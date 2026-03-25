// TODO: Initiative sorting and phase transition logic
import type { GameState } from '../types/gameState.js';

export interface TurnOrderEntry {
  name: string;
  initiative: number;
  type: 'character' | 'monster';
}

export function calculateTurnOrder(_state: GameState): TurnOrderEntry[] {
  throw new Error('calculateTurnOrder not implemented');
}

export function getNextPhase(_state: GameState): GameState['phase'] {
  throw new Error('getNextPhase not implemented');
}
