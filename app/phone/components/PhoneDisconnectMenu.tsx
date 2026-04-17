import { h } from 'preact';
import { useContext } from 'preact/hooks';
import { AppContext } from '../../shared/context';
import { characterThumbnail } from '../../shared/assets';
import { formatName } from '../../shared/formatName';

interface PhoneDisconnectOverlayProps {
  characterName: string;
  edition: string;
  onClose: () => void;
}

/**
 * Disconnect menu overlay — opened by tapping character portrait on lobby screens
 * or via CharacterDetail overlay in scenario mode.
 */
export function PhoneDisconnectOverlay({ characterName, edition, onClose }: PhoneDisconnectOverlayProps) {
  const { gameCode, disconnect } = useContext(AppContext);

  return (
    <div class="phone-menu-overlay" role="dialog" aria-modal="true">
      <div class="phone-menu-overlay__backdrop" onClick={onClose} />
      <div class="phone-menu-overlay__panel">
        <div class="phone-menu-overlay__header">
          <img
            src={characterThumbnail(edition, characterName)}
            alt=""
            class="phone-menu-overlay__portrait"
          />
          <div>
            <div class="phone-menu-overlay__name">{formatName(characterName)}</div>
            <div class="phone-menu-overlay__code">Game: {gameCode}</div>
          </div>
        </div>
        <button
          class="phone-menu-overlay__disconnect"
          onClick={() => { onClose(); disconnect(); }}
        >
          Disconnect
        </button>
        <button
          class="phone-menu-overlay__cancel"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
