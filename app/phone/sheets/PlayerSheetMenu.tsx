import { h } from 'preact';
import { useContext, useEffect, useRef } from 'preact/hooks';
import { AppContext } from '../../shared/context';
import { formatName } from '../../shared/formatName';

interface PlayerSheetMenuProps {
  characterName: string;
  onClose: () => void;
  /** When provided, menu offers "Switch Character". */
  onSwitchCharacter?: () => void;
}

/**
 * Phase T0a: dropdown anchored to the Player Sheet's `⋯` header button.
 *
 * Hosts the disconnect flow (previously `PhoneDisconnectOverlay` opened
 * by tapping the lobby/town portrait) and the optional switch-character
 * action. Lives here because the portrait button now opens the sheet,
 * so the disconnect affordance needs a new home that's always reachable.
 *
 * Keyboard: Escape closes. Tab stays within the dropdown (inside the
 * sheet modal's focus trap). Click-outside closes via the click-catcher.
 */
export function PlayerSheetMenu({
  characterName,
  onClose,
  onSwitchCharacter,
}: PlayerSheetMenuProps) {
  const { disconnect, gameCode } = useContext(AppContext);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Click-catcher pattern: the backdrop is the PARENT of the panel, and we
  // close only when the click target IS the backdrop itself (not a descendant).
  // Sibling-backdrop attempts don't close reliably because the panel's flex
  // placement leaves large "holes" in the containing fixed div that swallow
  // clicks without bubbling to the sibling.
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      class="player-sheet__menu"
      role="menu"
      aria-label="Sheet menu"
      onClick={handleBackdropClick}
    >
      <div class="player-sheet__menu-panel" onClick={(e) => e.stopPropagation()}>
        <div class="player-sheet__menu-header">
          <span class="player-sheet__menu-name">{formatName(characterName)}</span>
          {gameCode && (
            <span class="player-sheet__menu-code">Game: {gameCode}</span>
          )}
        </div>
        {onSwitchCharacter && (
          <button
            ref={firstRef}
            class="player-sheet__menu-item"
            role="menuitem"
            onClick={() => {
              onClose();
              onSwitchCharacter();
            }}
          >
            Switch Character
          </button>
        )}
        <button
          ref={!onSwitchCharacter ? firstRef : undefined}
          class="player-sheet__menu-item player-sheet__menu-item--danger"
          role="menuitem"
          onClick={() => {
            onClose();
            disconnect();
          }}
        >
          Disconnect
        </button>
        <button
          class="player-sheet__menu-item player-sheet__menu-item--cancel"
          role="menuitem"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
