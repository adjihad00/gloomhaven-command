import { h } from 'preact';
import { useGameState } from '../hooks/useGameState';

export function TownView() {
  const { state } = useGameState();

  const isVictory = state?.finish === 'success';

  return (
    <div class="phone-lobby phone-lobby--waiting">
      <h2 class="phone-lobby__heading">
        {isVictory ? 'Victory!' : state?.finish === 'failure' ? 'Defeat' : 'Town Phase'}
      </h2>
      <p class="phone-lobby__waiting-text">
        Complete town activities and prepare for the next scenario.
      </p>
      <p class="phone-lobby__waiting-text">
        Waiting for GM to proceed...
      </p>
    </div>
  );
}
