import { useState, useEffect } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useConnection } from '../hooks/useConnection';
import { ConnectionScreen } from './ConnectionScreen';
import { ScenarioView } from './ScenarioView';
import { TownView } from './TownView';
import { LobbyWaitingView } from './LobbyWaitingView';
import type { GameState, AppMode } from '@gloomhaven-command/shared';
import { mockState } from './mockData';

// Set to true to bypass WebSocket and render with mock data
const PROTOTYPE_MODE = true;

export function App() {
  const { connection, store, commands, state, status, error, connect, disconnect } = useConnection();
  const [gameCode, setGameCode] = useState(localStorage.getItem('gc_gameCode') || '');

  // Auto-connect on mount if game code is saved
  useEffect(() => {
    if (PROTOTYPE_MODE) return;
    const saved = localStorage.getItem('gc_gameCode');
    if (saved && status === 'disconnected') {
      connect(saved);
    }
  }, []);

  const handleConnect = (code: string) => {
    setGameCode(code);
    localStorage.setItem('gc_gameCode', code);
    connect(code);
  };

  // Prototype mode — render with mock data, no connection needed
  if (PROTOTYPE_MODE) {
    const protoState = mockState as GameState;
    const mode: AppMode = protoState.mode ?? 'scenario';
    return (
      <ErrorBoundary>
        <AppContext.Provider value={{
          connection: null, store: null, commands: null, state: protoState,
          connectionStatus: 'connected' as any, gameCode: 'PROTO',
          error: null, disconnect: () => {},
        }}>
          <div class="app-shell">
            {mode === 'lobby'
              ? <LobbyWaitingView />
              : mode === 'town'
              ? <TownView />
              : <ScenarioView />
            }
          </div>
        </AppContext.Provider>
      </ErrorBoundary>
    );
  }

  // Not connected — show connection screen
  if (!state) {
    return (
      <ConnectionScreen
        gameCode={gameCode}
        status={status}
        error={error}
        onConnect={handleConnect}
        onDisconnect={disconnect}
      />
    );
  }

  // Connected — immediately show game view (display is read-only, no setup)
  const mode: AppMode = state.mode ?? 'lobby';

  return (
    <ErrorBoundary>
      <AppContext.Provider value={{
        connection, store, commands, state, connectionStatus: status,
        gameCode, error, disconnect,
      }}>
        <div class="app-shell">
          {mode === 'lobby'
            ? <LobbyWaitingView />
            : mode === 'town'
            ? <TownView />
            : <ScenarioView />
          }
        </div>
      </AppContext.Provider>
    </ErrorBoundary>
  );
}
