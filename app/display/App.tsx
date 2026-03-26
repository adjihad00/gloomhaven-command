import { useState, useEffect } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { useConnection } from '../hooks/useConnection';
import { ConnectionScreen } from './ConnectionScreen';
import { ScenarioView } from './ScenarioView';
import { TownView } from './TownView';
import type { GameState, AppMode } from '@gloomhaven-command/shared';

export function App() {
  const { connection, store, commands, state, status, error, connect, disconnect } = useConnection();
  const [gameCode, setGameCode] = useState(localStorage.getItem('gc_gameCode') || '');

  // Auto-connect on mount if game code is saved
  useEffect(() => {
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
  const mode: AppMode = state.mode ?? 'scenario';

  return (
    <AppContext.Provider value={{
      connection, store, commands, state, connectionStatus: status,
      gameCode, error, disconnect,
    }}>
      <div class="app-shell">
        {mode === 'town'
          ? <TownView />
          : <ScenarioView />
        }
      </div>
    </AppContext.Provider>
  );
}
