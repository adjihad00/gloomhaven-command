import { WebSocket } from 'ws';
import type { Command, DiffMessage, ErrorMessage, DataContext } from '@gloomhaven-command/shared';
import { validateCommand, applyCommand, DataManager } from '@gloomhaven-command/shared';
import { GameStore } from './gameStore.js';
import { SessionManager } from './sessionManager.js';
import type { ReferenceDb } from './referenceDb.js';

export class CommandHandler {
  public broadcastFn: ((
    gameCode: string,
    message: DiffMessage,
    excludeSocket?: WebSocket
  ) => void) | null = null;

  private dataContext: DataContext | undefined;

  constructor(
    private gameStore: GameStore,
    private sessionManager: SessionManager,
    dataManager?: DataManager,
    refDb?: ReferenceDb,
  ) {
    if (dataManager) {
      this.dataContext = {
        getCharacterMaxHealth: (ed, name, level) => dataManager.getCharacterMaxHealth(ed, name, level),
        getMonsterMaxHealth: (ed, name, level, type) => dataManager.getMonsterMaxHealth(ed, name, level, type),
        getMonsterStats: (ed, name, level, type) => dataManager.getMonsterStats(ed, name, level, type),
        getScenario: (ed, index) => dataManager.getScenario(ed, index),
        resolveRoomSpawns: (scenario, room, count) => dataManager.resolveRoomSpawns(scenario, room, count),
        getMonsterDeckForMonster: (ed, name) => dataManager.getMonsterDeckForMonster(ed, name),
        getMonsterDeck: (ed, deckName) => dataManager.getMonsterDeck(ed, deckName),
        getMonster: (ed, name) => dataManager.getMonster(ed, name),
        getBattleGoals: (ed) => dataManager.getBattleGoals(ed),
        ...(refDb ? {
          getCampaignData: (ed: string, key: string) => refDb.getCampaignData(ed, key),
          getTreasure: (ed: string, idx: string) => refDb.getTreasure(ed, idx),
        } : {}),
      };
    } else if (refDb) {
      // Ref-DB-only context (no edition data loaded). Rare but valid.
      this.dataContext = {
        getCharacterMaxHealth: () => 0,
        getMonsterMaxHealth: () => 0,
        getMonsterStats: () => null,
        getScenario: () => null,
        resolveRoomSpawns: () => [],
        getMonsterDeckForMonster: () => null,
        getMonsterDeck: () => null,
        getMonster: () => null,
        getCampaignData: (ed, key) => refDb.getCampaignData(ed, key),
        getTreasure: (ed, idx) => refDb.getTreasure(ed, idx),
      };
    }
  }

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

    const { state: newState, changes } = applyCommand(state, command, this.dataContext);

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
