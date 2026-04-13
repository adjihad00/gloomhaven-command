// WebSocket client — connect, reconnect, send commands, localStorage persistence
import type {
  ServerMessage, ConnectMessage, CommandMessage,
  ConnectedMessage, ReconnectedMessage, DiffMessage, ErrorMessage,
  GameState, Command, ClientRole,
} from '@gloomhaven-command/shared';
import { applyDiff } from '@gloomhaven-command/shared';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ConnectionOptions {
  gameCode: string;
  onStateUpdate: (state: GameState) => void;
  onConnectionChange: (status: ConnectionStatus) => void;
  onError: (message: string) => void;
}

export class Connection {
  private ws: WebSocket | null = null;
  private state: GameState | null = null;
  private sessionToken: string | null = null;
  private lastRevision: number = 0;
  private gameCode: string;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 20;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect: boolean = false;
  private healthCheckTimeout: ReturnType<typeof setTimeout> | null = null;
  private awaitingHealthCheck: boolean = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private options: ConnectionOptions;

  constructor(options: ConnectionOptions) {
    this.options = options;
    this.gameCode = options.gameCode;

    // Restore session from localStorage if it matches the game code
    const storedCode = localStorage.getItem('gc_gameCode');
    if (storedCode === this.gameCode) {
      this.sessionToken = localStorage.getItem('gc_sessionToken');
      const storedRevision = localStorage.getItem('gc_lastRevision');
      if (storedRevision) {
        this.lastRevision = parseInt(storedRevision, 10) || 0;
      }
    }

    // Reconnect when returning from background
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (this.manualDisconnect) return;

      if (this.status !== 'connected') {
        this.reconnectAttempts = 0;
        this.connect();
        return;
      }

      // Status says connected, but WS may be silently dead (iOS background kill)
      this.checkConnectionHealth();
    });
  }

  connect(): void {
    // Clean up any existing connection
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
    }

    this.manualDisconnect = false;
    this.setStatus('connecting');

    // Use saved server URL for PWA standalone mode, or detect from location
    const savedHost = localStorage.getItem('gc_serverHost');
    const host = savedHost || location.host;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${host}/`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      const msg: ConnectMessage = {
        type: 'connect',
        gameCode: this.gameCode,
        sessionToken: this.sessionToken,
        ...(this.sessionToken && this.lastRevision > 0 ? { lastRevision: this.lastRevision } : {}),
      };
      this.ws!.send(JSON.stringify(msg));
    };

    this.ws.onmessage = (event: MessageEvent) => {
      // Any message from server means connection is alive
      if (this.awaitingHealthCheck) {
        this.awaitingHealthCheck = false;
        if (this.healthCheckTimeout) {
          clearTimeout(this.healthCheckTimeout);
          this.healthCheckTimeout = null;
        }
      }

      const message = JSON.parse(event.data as string) as ServerMessage;

      switch (message.type) {
        case 'connected': {
          const msg = message as ConnectedMessage;
          this.sessionToken = msg.sessionToken;
          this.state = msg.state;
          this.lastRevision = msg.revision;
          this.persistToStorage();
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeatMonitor();
          this.options.onStateUpdate(this.state);
          break;
        }
        case 'reconnected': {
          const msg = message as ReconnectedMessage;
          this.sessionToken = msg.sessionToken;
          if (this.state) {
            for (const diff of msg.diffs) {
              this.state = applyDiff(this.state, diff.changes);
            }
          }
          this.lastRevision = msg.revision;
          this.persistToStorage();
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeatMonitor();
          if (this.state) {
            this.options.onStateUpdate(this.state);
          }
          break;
        }
        case 'diff': {
          const msg = message as DiffMessage;
          if (this.state) {
            this.state = applyDiff(this.state, msg.changes);
            this.lastRevision = msg.revision;
            localStorage.setItem('gc_lastRevision', String(this.lastRevision));
            this.options.onStateUpdate(this.state);
          }
          break;
        }
        case 'error': {
          const msg = message as ErrorMessage;
          this.options.onError(msg.message);
          break;
        }
        case 'ping': {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'pong' }));
          }
          break;
        }
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeatMonitor();
      if (!this.manualDisconnect) {
        this.setStatus('reconnecting');
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose fires after onerror — don't double-handle
      console.error('WebSocket error');
    };
  }

  disconnect(): void {
    this.manualDisconnect = true;
    this.stopHeartbeatMonitor();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.healthCheckTimeout) {
      clearTimeout(this.healthCheckTimeout);
      this.healthCheckTimeout = null;
    }
    this.awaitingHealthCheck = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  sendCommand(command: Command): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.options.onError('Not connected');
      return;
    }
    const msg: CommandMessage = {
      type: 'command',
      action: command.action,
      payload: command.payload,
    };
    this.ws.send(JSON.stringify(msg));
  }

  register(role: ClientRole, characterName?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.options.onError('Not connected');
      return;
    }
    this.ws.send(JSON.stringify({
      type: 'register',
      role,
      ...(characterName ? { characterName } : {}),
    }));
  }

  getState(): GameState | null {
    return this.state;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getRevision(): number {
    return this.lastRevision;
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.options.onConnectionChange(status);
  }

  private persistToStorage(): void {
    localStorage.setItem('gc_gameCode', this.gameCode);
    localStorage.setItem('gc_sessionToken', this.sessionToken ?? '');
    localStorage.setItem('gc_lastRevision', String(this.lastRevision));
    // Save server host for PWA standalone mode reconnection
    localStorage.setItem('gc_serverHost', location.host);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('disconnected');
      this.options.onError('Connection lost. Please reconnect manually.');
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 15000);
    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }

  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor();
    this.heartbeatInterval = setInterval(() => {
      if (this.status !== 'connected' || this.manualDisconnect) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        // WebSocket already dead — reconnect immediately
        this.reconnectAttempts = 0;
        this.connect();
        return;
      }
      // Send keep-alive pong to prevent server-side stale timeout.
      // Don't use checkConnectionHealth() here — the server uses
      // protocol-level pings (invisible to JS onmessage) and won't
      // reply to application-level pongs.
      try {
        this.ws.send(JSON.stringify({ type: 'pong' }));
      } catch {
        this.reconnectAttempts = 0;
        this.connect();
      }
    }, 30000);
  }

  private stopHeartbeatMonitor(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private checkConnectionHealth(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.reconnectAttempts = 0;
      this.connect();
      return;
    }

    this.awaitingHealthCheck = true;
    try {
      this.ws.send(JSON.stringify({ type: 'pong' }));
    } catch {
      this.reconnectAttempts = 0;
      this.connect();
      return;
    }

    this.healthCheckTimeout = setTimeout(() => {
      if (this.awaitingHealthCheck) {
        console.warn('Health check timeout — forcing reconnect');
        this.awaitingHealthCheck = false;
        this.reconnectAttempts = 0;
        this.connect();
      }
    }, 5000);
  }
}
