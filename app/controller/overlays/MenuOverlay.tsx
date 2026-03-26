import { h } from 'preact';
import { useCommands } from '../../hooks/useCommands';
import { OverlayBackdrop } from './OverlayBackdrop';

interface MenuOverlayProps {
  gameCode: string;
  onClose: () => void;
  onDisconnect: () => void;
  onOpenSetup: () => void;
}

export function MenuOverlay({ gameCode, onClose, onDisconnect, onOpenSetup }: MenuOverlayProps) {
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

        <button class="menu-overlay__item menu-overlay__item--danger" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    </OverlayBackdrop>
  );
}
