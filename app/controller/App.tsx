import { useState } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useConnection } from '../hooks/useConnection';
import { ConnectionScreen } from './ConnectionScreen';
import { ScenarioView } from './ScenarioView';
import { TownView } from './TownView';
import type { GameState, AppMode } from '@gloomhaven-command/shared';

export function App() {
  const { connection, store, commands, state, status, error, connect, disconnect } = useConnection();
  const [gameCode, setGameCode] = useState(localStorage.getItem('gc_gameCode') || '');

  const handleConnect = (code: string) => {
    setGameCode(code);
    localStorage.setItem('gc_gameCode', code);
    connect(code);
  };

  // Not connected — show connection screen
  if (!state || status === 'disconnected') {
    return (
      <ConnectionScreen
        gameCode={gameCode}
        status={status}
        error={error}
        onConnect={handleConnect}
        onDisconnect={disconnect}
        hasExistingGame={state !== null && (state.characters.length > 0 || state.round > 0)}
      />
    );
  }

  // Connected — provide context and route by mode
  return (
    <ErrorBoundary>
      <AppContext.Provider value={{
        connection, store, commands, state, connectionStatus: status,
        gameCode, error, disconnect,
      }}>
        <AppShell state={state} />
      </AppContext.Provider>
    </ErrorBoundary>
  );
}

function AppShell({ state }: { state: GameState }) {
  const mode: AppMode = state.mode ?? 'scenario';

  return (
    <div class="app-shell">
      {mode === 'town'
        ? <TownView />
        : <ScenarioView />
      }
    </div>
  );
}
