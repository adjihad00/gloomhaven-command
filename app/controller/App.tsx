import { h } from 'preact';
import { useState } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useConnection } from '../hooks/useConnection';
import { ConnectionScreen } from './ConnectionScreen';
import { EditionSelector } from './EditionSelector';
import { ScenarioView } from './ScenarioView';
import { TownView } from './TownView';
import { LobbyView } from './LobbyView';
import { ControllerNav } from './ControllerNav';
import { PartySheetOverlay } from './overlays/PartySheetOverlay';
import { CampaignSheetOverlay } from './overlays/CampaignSheetOverlay';
import type { GameState, AppMode } from '@gloomhaven-command/shared';

export function App() {
  const { connection, store, commands, state, status, error, connect, disconnect } = useConnection();
  const [gameCode, setGameCode] = useState(localStorage.getItem('gc_gameCode') || '');
  const [selectedEdition, setSelectedEdition] = useState<string | null>(
    localStorage.getItem('gc_edition') || null
  );

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
  // Edition selection is now handled by the lobby view
  return (
    <ErrorBoundary>
      <AppContext.Provider value={{
        connection, store, commands, state, connectionStatus: status,
        gameCode, error, disconnect,
      }}>
        <AppShell state={state} gameCode={gameCode} onDisconnect={disconnect} />
      </AppContext.Provider>
    </ErrorBoundary>
  );
}

function AppShell({
  state,
  gameCode,
  onDisconnect,
}: {
  state: GameState;
  gameCode: string;
  onDisconnect: () => void;
}) {
  const mode: AppMode = state.mode ?? 'lobby';
  const [partySheetOpen, setPartySheetOpen] = useState(false);
  const [campaignSheetOpen, setCampaignSheetOpen] = useState(false);
  const openPartySheet = () => setPartySheetOpen(true);
  const openCampaignSheet = () => setCampaignSheetOpen(true);

  return (
    <div class="app-shell">
      {mode === 'lobby'
        ? <LobbyView />
        : mode === 'town'
        ? <TownView />
        : <ScenarioView
            onOpenPartySheet={openPartySheet}
            onOpenCampaignSheet={openCampaignSheet}
          />
      }
      {/*
        Phase T0b: floating ⋯ nav is only rendered in modes that lack their
        own header menu — Lobby and Town. ScenarioView already has a ☰ in
        its header (ScenarioHeader.menu-btn) that opens MenuOverlay; adding
        a second floating nav there would overlap the top-right element
        board. In Scenario, MenuOverlay gains the Party Sheet entry via a
        prop-drilled opener.
      */}
      {mode !== 'scenario' && (
        <ControllerNav
          gameCode={gameCode}
          hasScenario={!!state.scenario}
          onDisconnect={onDisconnect}
          onOpenPartySheet={openPartySheet}
          onOpenCampaignSheet={openCampaignSheet}
        />
      )}
      {partySheetOpen && (
        <PartySheetOverlay onClose={() => setPartySheetOpen(false)} />
      )}
      {campaignSheetOpen && (
        <CampaignSheetOverlay onClose={() => setCampaignSheetOpen(false)} />
      )}
    </div>
  );
}
