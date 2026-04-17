import { useState, useEffect, useRef } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useConnection } from '../hooks/useConnection';
import { useDataApi } from '../hooks/useDataApi';
import { ConnectionScreen } from './ConnectionScreen';
import { CharacterPicker } from './CharacterPicker';
import { ScenarioView } from './ScenarioView';
import { TownView } from './TownView';
import { LobbyView } from './LobbyView';
import { getCharacterTheme } from './characterThemes';
import type { GameState, AppMode } from '@gloomhaven-command/shared';

export function App() {
  const { connection, store, commands, state, status, error, connect, disconnect } = useConnection();
  const [gameCode, setGameCode] = useState(localStorage.getItem('gc_gameCode') || '');
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(
    localStorage.getItem('gc_selectedCharacter')
  );
  const autoConnectAttempted = useRef(false);

  // Fetch character class data for theming fallback color
  const edition = state?.edition ?? 'gh';
  const { data: classData } = useDataApi<any>(
    `${edition}/character/${selectedCharacter}`,
    !!edition && !!selectedCharacter && !!state
  );
  const ghsColor = classData?.color;

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

  // Apply rich character theme as CSS custom properties on document root
  useEffect(() => {
    const root = document.documentElement;
    if (selectedCharacter) {
      const theme = getCharacterTheme(selectedCharacter, ghsColor);
      root.style.setProperty('--phone-bg', theme.bg);
      root.style.setProperty('--phone-accent', theme.accent);
      root.style.setProperty('--phone-flair', theme.flair);
    } else {
      root.style.removeProperty('--phone-bg');
      root.style.removeProperty('--phone-accent');
      root.style.removeProperty('--phone-flair');
    }
    return () => {
      root.style.removeProperty('--phone-bg');
      root.style.removeProperty('--phone-accent');
      root.style.removeProperty('--phone-flair');
    };
  }, [selectedCharacter, ghsColor]);

  const handleConnect = (code: string) => {
    setGameCode(code);
    localStorage.setItem('gc_gameCode', code);
    connect(code);
  };

  const handleSelectCharacter = (name: string) => {
    setSelectedCharacter(name);
    localStorage.setItem('gc_selectedCharacter', name);
    connection?.register('phone', name);
  };

  const handleSwitchCharacter = () => {
    setSelectedCharacter(null);
    localStorage.removeItem('gc_selectedCharacter');
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

  const mode: AppMode = state.mode ?? 'lobby';

  return (
    <ErrorBoundary>
      <AppContext.Provider value={{
        connection, store, commands, state, connectionStatus: status,
        gameCode, error, disconnect: handleDisconnect,
      }}>
        <div class="app-shell">
          {mode === 'lobby'
            ? <LobbyView selectedCharacter={selectedCharacter} />
            : mode === 'town'
            ? <TownView selectedCharacter={selectedCharacter} />
            : <ScenarioView
                selectedCharacter={selectedCharacter}
                onSwitchCharacter={handleSwitchCharacter}
              />
          }
        </div>
      </AppContext.Provider>
    </ErrorBoundary>
  );
}
