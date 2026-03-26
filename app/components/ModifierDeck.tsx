import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { AttackModifierDeckModel } from '@gloomhaven-command/shared';

interface ModifierDeckProps {
  deck: AttackModifierDeckModel;
  deckName: string;
  onDraw: () => void;
  onShuffle: () => void;
  onAddBless: () => void;
  onRemoveBless: () => void;
  onAddCurse: () => void;
  onRemoveCurse: () => void;
  readonly?: boolean;
  compact?: boolean;
}

export function ModifierDeck({
  deck, deckName, onDraw, onShuffle,
  onAddBless, onRemoveBless, onAddCurse, onRemoveCurse,
  readonly, compact,
}: ModifierDeckProps) {
  const [expanded, setExpanded] = useState(false);
  const remaining = deck.cards.length - deck.current;
  const total = deck.cards.length;

  if (compact && !expanded) {
    return (
      <button class="modifier-deck modifier-deck--compact" onClick={() => setExpanded(true)}>
        <span class="modifier-deck__badge">{remaining}</span>
      </button>
    );
  }

  return (
    <div class="modifier-deck">
      <div class="modifier-deck__header">
        <span class="modifier-deck__name">{deckName}</span>
        <span class="modifier-deck__count">{remaining}/{total}</span>
        {compact && <button class="modifier-deck__close" onClick={() => setExpanded(false)}>&times;</button>}
      </div>
      {!readonly && (
        <div class="modifier-deck__controls">
          <button class="btn" onClick={onDraw} disabled={remaining <= 0}>Draw</button>
          <button class="btn" onClick={onShuffle}>Shuffle</button>
          <div class="modifier-deck__bless-curse">
            <button class="btn" onClick={onAddBless}>+B</button>
            <button class="btn" onClick={onRemoveBless}>-B</button>
            <button class="btn" onClick={onAddCurse}>+C</button>
            <button class="btn" onClick={onRemoveCurse}>-C</button>
          </div>
        </div>
      )}
    </div>
  );
}
