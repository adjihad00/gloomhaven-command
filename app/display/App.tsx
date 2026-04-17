import { useState, useEffect, useRef } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useConnection } from '../hooks/useConnection';
import { ConnectionScreen } from './ConnectionScreen';
import { ScenarioView } from './ScenarioView';
import { TownView } from './TownView';
import { LobbyWaitingView } from './LobbyWaitingView';
import { DisplayRewardsOverlay } from './overlays/DisplayRewardsOverlay';
import type { GameState, AppMode } from '@gloomhaven-command/shared';
import { mockState } from './mockData';

// Prototype mode: use mock data + keyboard controls for design iteration
const PROTOTYPE_MODE = new URLSearchParams(window.location.search).get('prototype') === 'true';

export function App() {
  const { connection, store, commands, state, status, error, connect, disconnect } = useConnection();
  const [gameCode, setGameCode] = useState(localStorage.getItem('gc_gameCode') || '');
  const [showMenu, setShowMenu] = useState(false);
  const isReconnectRef = useRef(false);
  const hasConnectedOnce = useRef(false);

  // Auto-connect on mount if game code is saved
  useEffect(() => {
    if (PROTOTYPE_MODE) return;
    const saved = localStorage.getItem('gc_gameCode');
    if (saved && status === 'disconnected') {
      connect(saved);
    }
  }, []);

  // Register as display role after connection + re-register on reconnect
  useEffect(() => {
    if (PROTOTYPE_MODE) return;
    if (connection && status === 'connected') {
      connection.register('display');
      if (hasConnectedOnce.current) {
        isReconnectRef.current = true;
      }
      hasConnectedOnce.current = true;
    }
  }, [connection, status]);

  // Apply edition theming on document root
  useEffect(() => {
    const edition = state?.edition || 'gh';
    document.documentElement.setAttribute('data-edition', edition);
  }, [state?.edition]);

  const handleConnect = (code: string) => {
    setGameCode(code);
    localStorage.setItem('gc_gameCode', code);
    connect(code);
  };

  const handleDisconnect = () => {
    setShowMenu(false);
    localStorage.removeItem('gc_gameCode');
    localStorage.removeItem('gc_sessionToken');
    disconnect();
  };

  const handleOpenMenu = () => setShowMenu(true);

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
              ? <LobbyWaitingView onOpenMenu={handleOpenMenu} />
              : mode === 'town'
              ? <TownView onOpenMenu={handleOpenMenu} />
              : <ScenarioView prototypeMode={true} onOpenMenu={handleOpenMenu} />
            }

            {showMenu && (
              <DisplayConfigMenu
                gameCode="PROTO"
                onDisconnect={() => setShowMenu(false)}
                onClose={() => setShowMenu(false)}
              />
            )}
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

  // Connected — render game view with connection status dot
  const mode: AppMode = state.mode ?? 'lobby';
  const showStatusDot = status !== 'connected';

  // Clear reconnect flag after first render with state
  if (isReconnectRef.current) {
    setTimeout(() => { isReconnectRef.current = false; }, 100);
  }

  // Phase T1.1: hide the display rewards tableau once the pending window has
  // closed (finish is final) AND every non-absent character's phone has
  // dismissed. finishData itself is preserved until completeTownPhase so any
  // phone that reconnects mid-town can still read the claimed snapshot.
  const isFinal = state.finish === 'success' || state.finish === 'failure';
  const allRelevantDismissed = (() => {
    if (!state.finishData) return false;
    const relevant = state.finishData.characters.filter((row) => {
      const live = state.characters.find(
        (c) => c.name === row.name && c.edition === row.edition,
      );
      return live && !live.absent;
    });
    return relevant.length > 0 && relevant.every((r) => r.dismissed);
  })();
  const shouldShowRewards = Boolean(state.finishData) && !(isFinal && allRelevantDismissed);

  return (
    <ErrorBoundary>
      <AppContext.Provider value={{
        connection, store, commands, state, connectionStatus: status,
        gameCode, error, disconnect,
      }}>
        <div class="app-shell">
          {mode === 'lobby'
            ? <LobbyWaitingView onOpenMenu={handleOpenMenu} />
            : mode === 'town'
            ? <TownView onOpenMenu={handleOpenMenu} />
            : <ScenarioView isReconnect={isReconnectRef} onOpenMenu={handleOpenMenu} />
          }

          {showStatusDot && (
            <div
              class={`display-connection-dot ${
                status === 'reconnecting' ? 'display-connection-dot--reconnecting' :
                status === 'disconnected' ? 'display-connection-dot--disconnected' : ''
              }`}
              aria-label={`Connection: ${status}`}
            />
          )}

          {showMenu && (
            <DisplayConfigMenu
              gameCode={gameCode}
              onDisconnect={handleDisconnect}
              onClose={() => setShowMenu(false)}
            />
          )}

          {/* Phase T1: rewards tableau — layered above whichever view is current.
              Phase T1.1: hides once all connected phones have dismissed + finish
              is final, but finishData itself persists until completeTownPhase. */}
          {shouldShowRewards && state.finishData && (
            <DisplayRewardsOverlay
              finishData={state.finishData}
              edition={state.edition || 'gh'}
            />
          )}
        </div>
      </AppContext.Provider>
    </ErrorBoundary>
  );
}

// ── Config Menu Overlay ─────────────────────────────────────────────────────

function DisplayConfigMenu({ gameCode, onDisconnect, onClose }: {
  gameCode: string;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  return (
    <div class="display-menu" onClick={onClose} role="dialog" aria-modal="true">
      <div class="display-menu__panel" onClick={(e) => e.stopPropagation()}>
        <h2 class="display-menu__title">Display Settings</h2>

        <div class="display-menu__info">
          <span class="display-menu__label">Game Code</span>
          <span class="display-menu__value">{gameCode}</span>
        </div>

        <button class="display-menu__disconnect" onClick={onDisconnect}>
          Disconnect
        </button>

        <button class="display-menu__close" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
