// Command validation — stub until Phase 1C
import type { GameState } from '../types/gameState.js';
import type { Command } from '../types/commands.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateCommand(_state: GameState, _command: Command): ValidationResult {
  throw new Error('Not implemented — Phase 1C');
}
