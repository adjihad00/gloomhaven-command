import { h } from 'preact';
import { useState } from 'preact/hooks';
import { LongRestIcon } from '../../components/Icons';

interface PhoneActionBarProps {
  phase: string;
  isActive: boolean;
  isDone: boolean;
  longRest: boolean;
  onEndTurn: () => void;
  onToggleLongRest: () => void;
  onExhaust: () => void;
}

export function PhoneActionBar({
  phase, isActive, isDone, longRest, onEndTurn, onToggleLongRest, onExhaust,
}: PhoneActionBarProps) {
  const [confirmExhaust, setConfirmExhaust] = useState(false);
  const isDrawPhase = phase === 'draw';
  const isPlayPhase = phase === 'play';

  const handleExhaust = () => {
    if (confirmExhaust) {
      onExhaust();
      setConfirmExhaust(false);
    } else {
      setConfirmExhaust(true);
    }
  };

  return (
    <div class="phone-actions">
      {/* Long Rest toggle — draw phase only */}
      {isDrawPhase && (
        <button
          class={`phone-actions__btn phone-actions__btn--rest ${longRest ? 'phone-actions__btn--active' : ''}`}
          onClick={onToggleLongRest}
          aria-label={longRest ? 'Cancel Long Rest' : 'Declare Long Rest'}
          aria-pressed={longRest}
        >
          <LongRestIcon size={20} />
          <span>{longRest ? 'Cancel Rest' : 'Long Rest'}</span>
        </button>
      )}

      {/* End Turn — play phase, active turn only */}
      {isPlayPhase && isActive && !isDone && (
        <button
          class="phone-actions__btn phone-actions__btn--end-turn"
          onClick={onEndTurn}
          aria-label="End Turn"
        >
          <span>End Turn</span>
        </button>
      )}

      {/* Exhaust — always available, needs confirmation */}
      <button
        class={`phone-actions__btn phone-actions__btn--exhaust ${confirmExhaust ? 'phone-actions__btn--danger' : ''}`}
        onClick={handleExhaust}
        onBlur={() => setConfirmExhaust(false)}
        aria-label={confirmExhaust ? 'Confirm Exhaust' : 'Exhaust'}
      >
        <span>{confirmExhaust ? 'Confirm Exhaust?' : 'Exhaust'}</span>
      </button>
    </div>
  );
}
