import { h } from 'preact';
import { useCommands } from '../../hooks/useCommands';
import { OverlayBackdrop } from './OverlayBackdrop';

interface MenuOverlayProps {
  gameCode: string;
  hasScenario: boolean;
  onClose: () => void;
  onDisconnect: () => void;
  onOpenSetup: () => void;
}

export function MenuOverlay({ gameCode, hasScenario, onClose, onDisconnect, onOpenSetup }: MenuOverlayProps) {
  const commands = useCommands();

  return (
    <OverlayBackdrop onClose={onClose} position="center">
      <div class="menu-overlay">
        <h2 class="menu-overlay__title">Menu</h2>

        <button class="menu-overlay__item" onClick={() => { commands.undoAction(); onClose(); }}>
          Undo
        </button>

        <button class="menu-overlay__item" onClick={() => { onClose(); onOpenSetup(); }}>
          Scenario Setup
        </button>

        <button
          class="menu-overlay__item"
          onClick={() => window.open(`/api/export/${gameCode}`, '_blank')}
        >
          Export Game State
        </button>

        {hasScenario && (
          <div class="menu-overlay__section">
            <h3 class="menu-overlay__section-title">End Scenario</h3>
            <button class="menu-overlay__item menu-overlay__item--victory"
              onClick={() => { commands.completeScenario('victory'); onClose(); }}>
              Scenario Complete (Victory)
            </button>
            <button class="menu-overlay__item menu-overlay__item--defeat"
              onClick={() => { commands.completeScenario('defeat'); onClose(); }}>
              Scenario Failed (Defeat)
            </button>
          </div>
        )}

        <button class="menu-overlay__item menu-overlay__item--danger" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    </OverlayBackdrop>
  );
}
