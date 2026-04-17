import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useGameState } from '../hooks/useGameState';
import { characterThumbnail } from '../shared/assets';
import { PhoneDisconnectOverlay } from './components/PhoneDisconnectMenu';

interface TownViewProps {
  selectedCharacter: string;
}

export function TownView({ selectedCharacter }: TownViewProps) {
  const { state } = useGameState();
  const [showMenu, setShowMenu] = useState(false);

  const isVictory = state?.finish === 'success';
  const edition = state?.edition ?? 'gh';

  return (
    <div class="phone-lobby phone-lobby--waiting">
      <button class="phone-lobby__menu-portrait" onClick={() => setShowMenu(true)} aria-label="Open menu">
        <img src={characterThumbnail(edition, selectedCharacter)} alt="" />
      </button>
      <h2 class="phone-lobby__heading">
        {isVictory ? 'Victory!' : state?.finish === 'failure' ? 'Defeat' : 'Town Phase'}
      </h2>
      <p class="phone-lobby__waiting-text">
        Complete town activities and prepare for the next scenario.
      </p>
      <p class="phone-lobby__waiting-text">
        Waiting for GM to proceed...
      </p>
      {showMenu && (
        <PhoneDisconnectOverlay characterName={selectedCharacter} edition={edition}
          onClose={() => setShowMenu(false)} />
      )}
    </div>
  );
}
