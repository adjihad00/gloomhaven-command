import { WebSocket } from 'ws';
import type { Command, DiffMessage, ErrorMessage } from '@gloomhaven-command/shared';
import { validateCommand, applyCommand } from '@gloomhaven-command/shared';
import { GameStore } from './gameStore.js';
import { SessionManager } from './sessionManager.js';

export class CommandHandler {
  public broadcastFn: ((
    gameCode: string,
    message: DiffMessage,
    excludeSocket?: WebSocket
  ) => void) | null = null;

  constructor(
    private gameStore: GameStore,
    private sessionManager: SessionManager
  ) {}

  handleCommand(ws: WebSocket, gameCode: string, command: Command): void {
    const state = this.gameStore.load(gameCode);
    if (!state) {
      this.sendError(ws, 'Game not found');
      return;
    }

    const validation = validateCommand(state, command);
    if (!validation.valid) {
      this.sendError(ws, validation.error ?? 'Invalid command');
      return;
    }

    const { state: newState, changes } = applyCommand(state, command);

    this.gameStore.save(gameCode, newState);

    const diff: DiffMessage = {
      type: 'diff',
      revision: newState.revision,
      changes,
      action: command.action,
    };

    this.sessionManager.pushDiff(gameCode, diff);

    if (this.broadcastFn) {
      this.broadcastFn(gameCode, diff);
    }

    console.log(`[${gameCode}] ${command.action} → rev ${newState.revision} (${changes.length} changes)`);
  }

  private sendError(ws: WebSocket, message: string): void {
    const error: ErrorMessage = { type: 'error', message };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(error));
    }
  }
}
