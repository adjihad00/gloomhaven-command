import { h } from 'preact';
import { HealthIcon } from '../../components/Icons';

interface PhoneHealthBarProps {
  current: number;
  max: number;
  onChangeHealth: (delta: number) => void;
  readonly?: boolean;
}

function getBarColor(ratio: number): string {
  if (ratio > 0.5) return 'var(--health-green)';
  if (ratio > 0.25) return 'var(--accent-gold)';
  return 'var(--negative-red)';
}

export function PhoneHealthBar({ current, max, onChangeHealth, readonly }: PhoneHealthBarProps) {
  const ratio = max > 0 ? current / max : 0;
  const barColor = getBarColor(ratio);

  return (
    <div class="phone-hp">
      <div class="phone-hp__bar-track">
        <div
          class="phone-hp__bar-fill"
          style={{ width: `${ratio * 100}%`, backgroundColor: barColor }}
        />
        <div class="phone-hp__bar-overlay">
          <HealthIcon size={22} class="phone-hp__icon" />
          <span class="phone-hp__value">{current}</span>
          <span class="phone-hp__separator">/</span>
          <span class="phone-hp__max">{max}</span>
        </div>
      </div>
      {!readonly && (
        <div class="phone-hp__controls">
          <button
            class="phone-hp__btn phone-hp__btn--minus"
            onClick={() => onChangeHealth(-1)}
            disabled={current <= 0}
            aria-label="Decrease health"
          >
            &minus;
          </button>
          <button
            class="phone-hp__btn phone-hp__btn--plus"
            onClick={() => onChangeHealth(1)}
            disabled={current >= max}
            aria-label="Increase health"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
