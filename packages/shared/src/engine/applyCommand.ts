// TODO: Pure state mutation engine
import type { GameState } from '../types/gameState.js';
import type { CommandPayload } from '../types/commands.js';
import type { DiffChange } from '../types/protocol.js';

export interface ApplyResult {
  state: GameState;
  changes: DiffChange[];
}

export function applyCommand(_state: GameState, _command: CommandPayload): ApplyResult {
  throw new Error('applyCommand not implemented');
}
