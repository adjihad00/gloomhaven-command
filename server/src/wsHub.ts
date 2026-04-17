import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type {
  ClientMessage, ServerMessage, ConnectMessage,
  CommandMessage, DiffMessage, GameState,
} from '@gloomhaven-command/shared';
import { Command, CommandAction, createEmptyGameState } from '@gloomhaven-command/shared';
import { GameStore } from './gameStore.js';
import { SessionManager } from './sessionManager.js';

// ── Phone permission enforcement ────────────────────────────────────────────

/** Commands a phone client may send (must target their registered character). */
const PHONE_ALLOWED_ACTIONS: ReadonlySet<CommandAction> = new Set([
  'setInitiative',
  'toggleLongRest',
  'changeHealth',
  'toggleCondition',
  'setExperience',
  'setLoot',
  'toggleExhausted',
  'toggleAbsent',
  'addSummon',
  'removeSummon',
  'toggleTurn',
  'renameCharacter',
  'moveElement',
  'drawLootCard',
  'confirmChore',
  'setBattleGoalComplete',
  'claimTreasure',
  'dismissRewards',
]);

/** Phone commands that are global (not character-targeted) — skip character-name check. */
const PHONE_GLOBAL_ACTIONS: ReadonlySet<CommandAction> = new Set([
  'moveElement',
  'drawLootCard',
  'dealBattleGoals',
  'returnBattleGoals',
]);

/**
 * Extract the character name a command targets.
 * Returns the name if the command is character-scoped, or null if it targets
 * something a phone should not control (monsters, objectives, global actions).
 */
function getCommandCharacterName(cmd: Command): string | null {
  const p = cmd.payload as Record<string, unknown>;

  // Commands using payload.target (CommandTarget)
  if (cmd.action === 'changeHealth' || cmd.action === 'toggleCondition') {
    const target = p.target as { type: string; name?: string; characterName?: string } | undefined;
    if (!target) return null;
    if (target.type === 'character') return target.name ?? null;
    if (target.type === 'summon') return target.characterName ?? null;
    return null; // monster or objective — blocked
  }

  // toggleTurn uses payload.figure (FigureIdentifier)
  if (cmd.action === 'toggleTurn') {
    const fig = p.figure as { type: string; name?: string } | undefined;
    if (fig?.type === 'character') return fig.name ?? null;
    return null; // monster or objectiveContainer — blocked
  }

  // All other allowed commands use payload.characterName
  return (p.characterName as string) ?? null;
}

interface ClientInfo {
  sessionToken: string;
  gameCode: string;
  role?: 'display' | 'controller' | 'phone';
  characterName?: string;
}

export class WsHub {
  private wss!: WebSocketServer;
  private clients: Map<WebSocket, ClientInfo> = new Map();
  private heartbeatInterval!: ReturnType<typeof setInterval>;

  public onCommand: ((
    ws: WebSocket,
    gameCode: string,
    command: Command
  ) => void) | null = null;

  constructor(
    private httpServer: HttpServer,
    private gameStore: GameStore,
    private sessionManager: SessionManager
  ) {}

  init(): void {
    this.wss = new WebSocketServer({ server: this.httpServer, path: '/' });

    this.wss.on('connection', (ws: WebSocket) => {
      // Store socket without session info until connect message arrives
      this.clients.set(ws, { sessionToken: '', gameCode: '' });

      ws.on('message', (data: Buffer | string) => {
        try {
          const raw = typeof data === 'string' ? data : data.toString('utf-8');
          this.handleMessage(ws, raw);
        } catch (err) {
          console.error('WS message parse error:', err);
          this.sendTo(ws, { type: 'error', message: 'Invalid message format' });
        }
      });

      ws.on('close', () => {
        const info = this.clients.get(ws);
        if (info?.sessionToken) {
          console.log(`Client disconnected: ${info.sessionToken.slice(0, 8)}...`);
        }
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('WS error:', err);
        ws.close();
      });

      ws.on('pong', () => {
        const info = this.clients.get(ws);
        if (info?.sessionToken) {
          this.sessionManager.updatePong(info.sessionToken);
        }
      });
    });

    // Heartbeat: ping every 15s, disconnect stale after 20s
    this.heartbeatInterval = setInterval(() => {
      const staleTokens = this.sessionManager.getStaleTokens(20000);
      for (const token of staleTokens) {
        for (const [ws, info] of this.clients) {
          if (info.sessionToken === token) {
            console.log(`Disconnecting stale client: ${token.slice(0, 8)}...`);
            ws.terminate();
            this.clients.delete(ws);
            this.sessionManager.removeSession(token);
            break;
          }
        }
      }

      for (const [ws] of this.clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }
    }, 15000);
  }

  private handleMessage(ws: WebSocket, raw: string): void {
    const msg = JSON.parse(raw) as ClientMessage;

    switch (msg.type) {
      case 'connect':
        this.handleConnect(ws, msg);
        break;
      case 'register':
        this.handleRegister(ws, msg);
        break;
      case 'command':
        this.handleCommand(ws, msg);
        break;
      case 'pong':
        // Client-level pong (in addition to native WS pong)
        {
          const info = this.clients.get(ws);
          if (info?.sessionToken) {
            this.sessionManager.updatePong(info.sessionToken);
          }
        }
        break;
    }
  }

  private handleConnect(ws: WebSocket, msg: ConnectMessage): void {
    const { gameCode, sessionToken, lastRevision } = msg;

    // Load or create game state
    let state = this.gameStore.load(gameCode);
    if (!state) {
      state = createEmptyGameState();
      state.gameCode = gameCode;
      this.gameStore.save(gameCode, state);
    }

    // Reconnection: reuse existing session
    if (sessionToken) {
      const existingSession = this.sessionManager.getSession(sessionToken);
      if (existingSession && existingSession.gameCode === gameCode) {
        this.sessionManager.updatePong(sessionToken);

        const rev = lastRevision ?? existingSession.lastRevision;
        const diffs = this.sessionManager.getDiffsSince(gameCode, rev);

        if (diffs && diffs.length > 0) {
          this.sendTo(ws, {
            type: 'reconnected',
            sessionToken,
            revision: state.revision,
            diffs,
          });
        } else {
          // Too far behind or no diffs — send full state
          this.sendTo(ws, {
            type: 'connected',
            sessionToken,
            revision: state.revision,
            state,
          });
        }

        this.sessionManager.updateRevision(sessionToken, state.revision);
        this.clients.set(ws, { sessionToken, gameCode });
        console.log(`Client reconnected: ${sessionToken.slice(0, 8)}... game=${gameCode}`);
        return;
      }
    }

    // New connection
    const session = this.sessionManager.createSession(gameCode);
    this.sendTo(ws, {
      type: 'connected',
      sessionToken: session.sessionToken,
      revision: state.revision,
      state,
    });

    this.sessionManager.updateRevision(session.sessionToken, state.revision);
    this.clients.set(ws, { sessionToken: session.sessionToken, gameCode });
    console.log(`Client connected: ${session.sessionToken.slice(0, 8)}... game=${gameCode}`);
  }

  private handleRegister(ws: WebSocket, msg: { type: 'register'; role: string; characterName?: string }): void {
    const info = this.clients.get(ws);
    if (!info?.sessionToken) {
      this.sendTo(ws, { type: 'error', message: 'Must connect before registering' });
      return;
    }

    // Store role per-WebSocket (not per-session) so multiple tabs
    // on the same browser don't overwrite each other's roles
    info.role = msg.role as 'display' | 'controller' | 'phone';
    info.characterName = msg.characterName;
    console.log(`Client registered: ${info.sessionToken.slice(0, 8)}... role=${msg.role}${msg.characterName ? ` char=${msg.characterName}` : ''}`);
  }

  private handleCommand(ws: WebSocket, msg: CommandMessage): void {
    const info = this.clients.get(ws);
    if (!info?.sessionToken || !info.gameCode) {
      this.sendTo(ws, { type: 'error', message: 'Must connect before sending commands' });
      return;
    }

    const command = { action: msg.action, payload: msg.payload } as Command;

    // Phone permission enforcement — uses per-WebSocket role, not per-session
    if (info.role === 'phone' && info.characterName) {
      if (!PHONE_ALLOWED_ACTIONS.has(command.action)) {
        console.log(`Phone blocked: ${info.sessionToken.slice(0, 8)}... action=${command.action}`);
        this.sendTo(ws, { type: 'error', message: `Phone cannot perform ${command.action}` });
        return;
      }

      // Global actions (moveElement, drawLootCard) skip character-name check
      if (!PHONE_GLOBAL_ACTIONS.has(command.action)) {
        const targetName = getCommandCharacterName(command);
        if (targetName !== info.characterName) {
          console.log(`Phone blocked: ${info.sessionToken.slice(0, 8)}... action=${command.action} target=${targetName} registered=${info.characterName}`);
          this.sendTo(ws, { type: 'error', message: 'Phone can only control registered character' });
          return;
        }
      }
    }

    if (this.onCommand) {
      this.onCommand(ws, info.gameCode, command);
    } else {
      this.sendTo(ws, { type: 'error', message: 'Command handler not ready', code: 'NOT_READY' });
    }
  }

  broadcast(gameCode: string, message: ServerMessage, excludeSocket?: WebSocket): void {
    const payload = JSON.stringify(message);
    for (const [ws, info] of this.clients) {
      if (info.gameCode === gameCode && ws !== excludeSocket && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  sendTo(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  getGameState(gameCode: string): GameState | null {
    return this.gameStore.load(gameCode);
  }

  shutdown(): void {
    clearInterval(this.heartbeatInterval);
    for (const [ws] of this.clients) {
      ws.terminate();
    }
    this.wss.close();
  }
}
