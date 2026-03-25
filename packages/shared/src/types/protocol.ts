// TODO: WebSocket message envelope types
import type { GameState } from './gameState.js';
import type { CommandPayload } from './commands.js';

export interface ConnectMessage {
  type: 'connect';
  gameCode: string;
  sessionToken: string | null;
}

export interface ConnectedMessage {
  type: 'connected';
  sessionToken: string;
  revision: number;
  state: GameState;
}

export interface ReconnectedMessage {
  type: 'reconnected';
  sessionToken: string;
  revision: number;
  diffs: DiffMessage[];
}

export interface CommandMessage {
  type: 'command';
  action: string;
  payload: CommandPayload;
}

export interface DiffChange {
  path: string;
  value: unknown;
}

export interface DiffMessage {
  type: 'diff';
  revision: number;
  changes: DiffChange[];
  action: string;
}

export interface RegisterMessage {
  type: 'register';
  role: 'phone' | 'controller' | 'display';
  characterName?: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ClientMessage = ConnectMessage | CommandMessage | RegisterMessage;
export type ServerMessage = ConnectedMessage | ReconnectedMessage | DiffMessage | ErrorMessage;
