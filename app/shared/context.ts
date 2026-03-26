import { createContext } from 'preact';
import type { Connection, ConnectionStatus } from '../../clients/shared/lib/connection';
import type { StateStore } from '../../clients/shared/lib/stateStore';
import type { CommandSender } from '../../clients/shared/lib/commandSender';
import type { GameState } from '@gloomhaven-command/shared';

export interface AppContextValue {
  connection: Connection | null;
  store: StateStore | null;
  commands: CommandSender | null;
  state: GameState | null;
  connectionStatus: ConnectionStatus;
  gameCode: string;
  error: string | null;
  disconnect: () => void;
}

export const AppContext = createContext<AppContextValue>({
  connection: null,
  store: null,
  commands: null,
  state: null,
  connectionStatus: 'disconnected',
  gameCode: '',
  error: null,
  disconnect: () => {},
});
