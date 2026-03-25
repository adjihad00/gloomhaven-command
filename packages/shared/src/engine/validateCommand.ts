// TODO: Command validation logic
import type { GameState } from '../types/gameState.js';
import type { CommandPayload } from '../types/commands.js';

export function validateCommand(_state: GameState, _command: CommandPayload): boolean {
  throw new Error('validateCommand not implemented');
}
