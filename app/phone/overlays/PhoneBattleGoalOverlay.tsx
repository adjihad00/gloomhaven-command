import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { useGameState } from '../../hooks/useGameState';

interface PhoneBattleGoalOverlayProps {
  selectedCharacter: string;
}

export function PhoneBattleGoalOverlay({ selectedCharacter }: PhoneBattleGoalOverlayProps) {
  const { state } = useGameState();
  const [visible, setVisible] = useState(false);
  const prevPhase = useRef<string | undefined>(undefined);

  const setupPhase = state?.setupPhase;
  const setupData = state?.setupData;

  useEffect(() => {
    if (setupPhase === 'goals' && prevPhase.current !== 'goals') {
      setVisible(true);
    }
    if (setupPhase !== 'goals' && prevPhase.current === 'goals') {
      setVisible(false);
    }
    if (!setupPhase && prevPhase.current) {
      setVisible(false);
    }
    prevPhase.current = setupPhase ?? undefined;
  }, [setupPhase]);

  if (!visible || !setupData || setupPhase !== 'goals') return null;

  const dealCount = setupData.edition === 'fh' ? 3 : 2;

  return (
    <div class="phone-battlegoal" role="dialog" aria-modal="true">
      <div class="phone-battlegoal__overlay" />
      <div class="phone-battlegoal__content">
        <h2 class="phone-battlegoal__heading">Choose Your Battle Goal</h2>

        <div class="phone-battlegoal__instructions">
          <p class="phone-battlegoal__rule">
            Deal yourself <strong>{dealCount}</strong> battle goal card{dealCount > 1 ? 's' : ''} from the deck.
          </p>
          <p class="phone-battlegoal__rule">
            Choose <strong>1</strong> to keep.
          </p>
          <p class="phone-battlegoal__rule">
            Return the rest to the bottom of the deck <strong>without showing</strong> other players.
          </p>
        </div>

        <div class="phone-battlegoal__edition-note">
          {setupData.edition.toUpperCase()}: Deal {dealCount}, keep 1
        </div>

        <div class="phone-battlegoal__waiting">
          Waiting for GM to start scenario...
        </div>
      </div>
    </div>
  );
}
