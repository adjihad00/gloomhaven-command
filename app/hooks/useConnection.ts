import { useState, useCallback, useRef, useEffect } from 'preact/hooks';
import { Connection } from '../../clients/shared/lib/connection';
import { StateStore } from '../../clients/shared/lib/stateStore';
import { CommandSender } from '../../clients/shared/lib/commandSender';
import type { ConnectionStatus } from '../../clients/shared/lib/connection';
import type { GameState } from '@gloomhaven-command/shared';

export interface UseConnectionReturn {
  connection: Connection | null;
  store: StateStore | null;
  commands: CommandSender | null;
  state: GameState | null;
  status: ConnectionStatus;
  error: string | null;
  connect: (gameCode: string) => void;
  disconnect: () => void;
}

export function useConnection(): UseConnectionReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<Connection | null>(null);
  const storeRef = useRef<StateStore | null>(null);
  const commandsRef = useRef<CommandSender | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      connectionRef.current?.disconnect();
    };
  }, []);

  const connect = useCallback((gameCode: string) => {
    // Disconnect existing
    connectionRef.current?.disconnect();

    const store = new StateStore();
    storeRef.current = store;

    const connection = new Connection({
      gameCode,
      onStateUpdate: (newState: GameState) => {
        store.setState(newState);
        setState(newState);
      },
      onConnectionChange: (newStatus: ConnectionStatus) => {
        setStatus(newStatus);
      },
      onError: (message: string) => {
        setError(message);
      },
    });

    connectionRef.current = connection;
    commandsRef.current = new CommandSender(connection);

    setError(null);
    connection.connect();
  }, []);

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    commandsRef.current = null;
    setState(null);
    setStatus('disconnected');
  }, []);

  return {
    connection: connectionRef.current,
    store: storeRef.current,
    commands: commandsRef.current,
    state,
    status,
    error,
    connect,
    disconnect,
  };
}
