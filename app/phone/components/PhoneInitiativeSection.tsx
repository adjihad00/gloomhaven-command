import { h } from 'preact';
import { LongRestIcon } from '../../components/Icons';

interface PhoneInitiativeSectionProps {
  initiative: number;
  longRest: boolean;
  phase: string;
  isActive: boolean;
  isDone: boolean;
  onOpenNumpad?: () => void;
}

export function PhoneInitiativeSection({
  initiative, longRest, phase, isActive, isDone, onOpenNumpad,
}: PhoneInitiativeSectionProps) {
  const isDrawPhase = phase === 'draw';
  const hasValue = initiative > 0 || longRest;

  // Determine display state
  let stateClass = '';
  let subtext = '';

  if (isDrawPhase) {
    stateClass = hasValue ? 'phone-init--set' : 'phone-init--waiting';
    subtext = hasValue ? 'Tap to change' : 'Set initiative';
  } else if (isActive) {
    stateClass = 'phone-init--active';
    subtext = 'Your Turn';
  } else if (isDone) {
    stateClass = 'phone-init--done';
    subtext = 'Done';
  } else {
    stateClass = 'phone-init--queued';
    subtext = 'Waiting...';
  }

  const handleClick = () => {
    if (isDrawPhase && onOpenNumpad) {
      onOpenNumpad();
    }
  };

  return (
    <button
      class={`phone-init ${stateClass}`}
      onClick={handleClick}
      disabled={!isDrawPhase}
      aria-label={longRest ? 'Long Rest' : `Initiative ${initiative}`}
    >
      <div class="phone-init__value">
        {longRest ? (
          <LongRestIcon size={32} class="phone-init__rest-icon" />
        ) : (
          <span class="phone-init__number">{initiative > 0 ? initiative : '\u2014'}</span>
        )}
      </div>
      <span class="phone-init__label">{subtext}</span>
    </button>
  );
}
