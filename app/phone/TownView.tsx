import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useGameState } from '../hooks/useGameState';
import { characterThumbnail } from '../shared/assets';
import { PlayerSheet } from './sheets/PlayerSheet';

interface TownViewProps {
  selectedCharacter: string;
  onSwitchCharacter?: () => void;
}

export function TownView({ selectedCharacter, onSwitchCharacter }: TownViewProps) {
  const { state } = useGameState();
  const [showSheet, setShowSheet] = useState(false);

  const isVictory = state?.finish === 'success';
  const edition = state?.edition ?? 'gh';
  const myChar = state?.characters?.find(c => c.name === selectedCharacter);
  const charEdition = myChar?.edition || edition;

  return (
    <div class="phone-lobby phone-lobby--waiting">
      <button
        class="phone-lobby__menu-portrait"
        onClick={() => setShowSheet(true)}
        aria-label="Open character sheet"
      >
        <img src={characterThumbnail(charEdition, selectedCharacter)} alt="" />
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
      {showSheet && myChar && (
        <PlayerSheet
          character={myChar}
          edition={charEdition}
          onClose={() => setShowSheet(false)}
          onSwitchCharacter={onSwitchCharacter}
        />
      )}
    </div>
  );
}
