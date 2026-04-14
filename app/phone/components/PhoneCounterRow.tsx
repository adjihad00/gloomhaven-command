import { h } from 'preact';
import { XPIcon, GoldIcon } from '../../components/Icons';

interface PhoneCounterRowProps {
  xp: number;
  loot: number;
  onSetXP: (value: number) => void;
  onSetLoot: (value: number) => void;
  readonly?: boolean;
}

export function PhoneCounterRow({ xp, loot, onSetXP, onSetLoot, readonly }: PhoneCounterRowProps) {
  return (
    <div class="phone-counters">
      <div class="phone-counters__item">
        <XPIcon size={20} class="phone-counters__icon" />
        <span class="phone-counters__label">XP</span>
        <div class="phone-counters__controls">
          {!readonly && (
            <button
              class="phone-counters__btn"
              onClick={() => onSetXP(Math.max(0, xp - 1))}
              disabled={xp <= 0}
              aria-label="Decrease XP"
            >
              &minus;
            </button>
          )}
          <span class="phone-counters__value">{xp}</span>
          {!readonly && (
            <button
              class="phone-counters__btn"
              onClick={() => onSetXP(xp + 1)}
              aria-label="Increase XP"
            >
              +
            </button>
          )}
        </div>
      </div>

      <div class="phone-counters__divider" />

      <div class="phone-counters__item">
        <GoldIcon size={20} class="phone-counters__icon" />
        <span class="phone-counters__label">Loot</span>
        <div class="phone-counters__controls">
          {!readonly && (
            <button
              class="phone-counters__btn"
              onClick={() => onSetLoot(Math.max(0, loot - 1))}
              disabled={loot <= 0}
              aria-label="Decrease Loot"
            >
              &minus;
            </button>
          )}
          <span class="phone-counters__value">{loot}</span>
          {!readonly && (
            <button
              class="phone-counters__btn"
              onClick={() => onSetLoot(loot + 1)}
              aria-label="Increase Loot"
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
