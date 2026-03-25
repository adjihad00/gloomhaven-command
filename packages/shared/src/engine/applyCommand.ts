// Command application engine — stub until Phase 1C
import type { GameState } from '../types/gameState.js';
import type { Command } from '../types/commands.js';
import type { StateChange } from '../types/protocol.js';

export interface ApplyResult {
  state: GameState;
  changes: StateChange[];
}

export function applyCommand(_state: GameState, _command: Command): ApplyResult {
  throw new Error('Not implemented — Phase 1C');
}
