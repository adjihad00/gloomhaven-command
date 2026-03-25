// WebSocket protocol message envelopes
import type { GameState } from './gameState.js';
import type { Command, CommandAction } from './commands.js';

// ── Client roles ────────────────────────────────────────────────────────────

export type ClientRole = 'display' | 'controller' | 'phone';

// ── State change (diff path + value) ────────────────────────────────────────

export interface StateChange {
  path: string;
  value: unknown;
}

// ── Client session ──────────────────────────────────────────────────────────

export interface ClientSession {
  sessionToken: string;
  gameCode: string;
  role?: ClientRole;
  characterName?: string;
  lastRevision: number;
}

// ── Client → Server messages ────────────────────────────────────────────────

export interface ConnectMessage {
  type: 'connect';
  gameCode: string;
  sessionToken: string | null;
  lastRevision?: number;
}

export interface RegisterMessage {
  type: 'register';
  role: ClientRole;
  characterName?: string;
}

export interface CommandMessage {
  type: 'command';
  action: CommandAction;
  payload: Command['payload'];
}

export interface PongMessage {
  type: 'pong';
}

export type ClientMessage =
  | ConnectMessage
  | RegisterMessage
  | CommandMessage
  | PongMessage;

// ── Server → Client messages ────────────────────────────────────────────────

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

export interface DiffMessage {
  type: 'diff';
  revision: number;
  changes: StateChange[];
  action: CommandAction;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;
}

export interface PingMessage {
  type: 'ping';
}

export type ServerMessage =
  | ConnectedMessage
  | ReconnectedMessage
  | DiffMessage
  | ErrorMessage
  | PingMessage;
