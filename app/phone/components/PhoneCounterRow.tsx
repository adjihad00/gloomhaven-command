import { h } from 'preact';
import { XPIcon, GoldIcon } from '../../components/Icons';

interface PhoneCounterRowProps {
  xp: number;
  loot: number;
  lootCards?: number[];
  onSetXP: (value: number) => void;
  onDrawLoot?: () => void;
  hasLootDeck?: boolean;
  canDrawLoot?: boolean;
}

export function PhoneCounterRow({ xp, loot, lootCards, onSetXP, onDrawLoot, hasLootDeck, canDrawLoot }: PhoneCounterRowProps) {
  return (
    <div class="phone-counters">
      <div class="phone-counters__item">
        <XPIcon size={20} class="phone-counters__icon" />
        <span class="phone-counters__label">XP</span>
        <div class="phone-counters__controls">
          <button
            class="phone-counters__btn"
            onClick={() => onSetXP(Math.max(0, xp - 1))}
            disabled={xp <= 0}
            aria-label="Decrease XP"
          >
            &minus;
          </button>
          <span class="phone-counters__value">{xp}</span>
          <button
            class="phone-counters__btn"
            onClick={() => onSetXP(xp + 1)}
            aria-label="Increase XP"
          >
            +
          </button>
        </div>
      </div>

      <div class="phone-counters__divider" />

      <div class="phone-counters__item">
        <GoldIcon size={20} class="phone-counters__icon" />
        <span class="phone-counters__label">Loot</span>
        <div class="phone-counters__controls">
          <span class="phone-counters__value">{loot}</span>
          {hasLootDeck && onDrawLoot && (
            <button
              class="phone-counters__btn phone-counters__btn--draw"
              onClick={onDrawLoot}
              disabled={!canDrawLoot}
              aria-label="Draw Loot Card"
              title="Draw Loot Card"
            >
              Draw
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
