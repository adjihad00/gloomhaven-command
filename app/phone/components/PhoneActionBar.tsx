import { h } from 'preact';
import { XPIcon, GoldIcon } from '../../components/Icons';

interface PhoneActionBarProps {
  phase: string;
  isActive: boolean;
  isDone: boolean;
  xp: number;
  loot: number;
  onEndTurn: () => void;
  onSetXP: (value: number) => void;
  hasLootDeck?: boolean;
  canDrawLoot?: boolean;
  onDrawLoot?: () => void;
}

export function PhoneActionBar({
  xp, loot, onSetXP, hasLootDeck, canDrawLoot, onDrawLoot,
}: PhoneActionBarProps) {
  return (
    <div class="phone-actions">
      {/* XP counter with +/- */}
      <div class="phone-actions__counter">
        <XPIcon size={16} />
        <button
          class="phone-actions__counter-btn"
          onClick={() => onSetXP(Math.max(0, xp - 1))}
          disabled={xp <= 0}
          aria-label="Decrease XP"
        >
          &minus;
        </button>
        <span class="phone-actions__counter-val">{xp}</span>
        <button
          class="phone-actions__counter-btn"
          onClick={() => onSetXP(xp + 1)}
          aria-label="Increase XP"
        >
          +
        </button>
      </div>

      {/* Spacer */}
      <div class="phone-actions__spacer" />

      {/* Loot counter (read-only) + optional draw button */}
      <div class="phone-actions__counter">
        <GoldIcon size={16} />
        <span class="phone-actions__counter-val">{loot}</span>
        {hasLootDeck && onDrawLoot && (
          <button
            class="phone-actions__counter-btn phone-actions__counter-btn--draw"
            onClick={onDrawLoot}
            disabled={!canDrawLoot}
            aria-label="Draw Loot Card"
          >
            Draw
          </button>
        )}
      </div>
    </div>
  );
}
