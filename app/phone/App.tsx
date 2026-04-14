import { useState, useEffect, useRef } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useConnection } from '../hooks/useConnection';
import { ConnectionScreen } from './ConnectionScreen';
import { CharacterPicker } from './CharacterPicker';
import { ScenarioView } from './ScenarioView';
import { TownView } from './TownView';
import type { GameState, AppMode } from '@gloomhaven-command/shared';

export function App() {
  const { connection, store, commands, state, status, error, connect, disconnect } = useConnection();
  const [gameCode, setGameCode] = useState(localStorage.getItem('gc_gameCode') || '');
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(
    localStorage.getItem('gc_selectedCharacter')
  );
  const autoConnectAttempted = useRef(false);

  // Auto-reconnect on startup if we have a saved game code + session token
  useEffect(() => {
    if (autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;

    const savedCode = localStorage.getItem('gc_gameCode');
    const savedToken = localStorage.getItem('gc_sessionToken');
    if (savedCode && savedToken && status === 'disconnected') {
      connect(savedCode);
    }
  }, []);

  // Re-register character after reconnection if we have a saved selection
  useEffect(() => {
    if (status === 'connected' && selectedCharacter && connection) {
      connection.register('phone', selectedCharacter);
    }
  }, [status, selectedCharacter, connection]);

  const handleConnect = (code: string) => {
    setGameCode(code);
    localStorage.setItem('gc_gameCode', code);
    connect(code);
  };

  const handleSelectCharacter = (name: string) => {
    setSelectedCharacter(name);
    localStorage.setItem('gc_selectedCharacter', name);
    // Register as phone with character name
    connection?.register('phone', name);
  };

  const handleDisconnect = () => {
    setSelectedCharacter(null);
    localStorage.removeItem('gc_selectedCharacter');
    disconnect();
  };

  // Not connected — show connection screen
  if (!state || status === 'disconnected') {
    return (
      <ConnectionScreen
        gameCode={gameCode}
        status={status}
        error={error}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
    );
  }

  // Connected but no character selected — show picker
  if (!selectedCharacter) {
    return (
      <CharacterPicker
        characters={state.characters}
        onSelect={handleSelectCharacter}
        onDisconnect={handleDisconnect}
      />
    );
  }

  // Connected with character — provide context and route by mode
  const mode: AppMode = state.mode ?? 'scenario';

  return (
    <ErrorBoundary>
      <AppContext.Provider value={{
        connection, store, commands, state, connectionStatus: status,
        gameCode, error, disconnect: handleDisconnect,
      }}>
        <div class="app-shell">
          {mode === 'town'
            ? <TownView />
            : <ScenarioView selectedCharacter={selectedCharacter} />
          }
        </div>
      </AppContext.Provider>
    </ErrorBoundary>
  );
}
