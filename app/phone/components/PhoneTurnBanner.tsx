import { h } from 'preact';

interface PhoneTurnBannerProps {
  phase: string;
  isActive: boolean;
  isDone: boolean;
  initiativePosition?: number;
  totalFigures?: number;
}

export function PhoneTurnBanner({
  phase, isActive, isDone, initiativePosition, totalFigures,
}: PhoneTurnBannerProps) {
  // Draw phase — no turn banner needed
  if (phase === 'draw') return null;

  let stateClass = '';
  let label = '';

  if (isActive) {
    stateClass = 'phone-turn--active';
    label = 'Your Turn';
  } else if (isDone) {
    stateClass = 'phone-turn--done';
    label = 'Turn Complete';
  } else {
    stateClass = 'phone-turn--waiting';
    const posText = initiativePosition && totalFigures
      ? `${initiativePosition} of ${totalFigures}`
      : '';
    label = posText ? `Waiting \u2014 ${posText}` : 'Waiting...';
  }

  return (
    <div class={`phone-turn ${stateClass}`} role="status" aria-live="polite">
      <span class="phone-turn__label">{label}</span>
      {isDone && <span class="phone-turn__check" aria-hidden="true">&#x2713;</span>}
    </div>
  );
}
