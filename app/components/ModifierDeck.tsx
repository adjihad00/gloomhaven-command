import { h } from 'preact';
import { useState, useRef } from 'preact/hooks';
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

const modifierDisplay: Record<string, { label: string; color: string }> = {
  'plus0':  { label: '+0',       color: 'var(--text-secondary)' },
  'plus1':  { label: '+1',       color: 'var(--health-green)' },
  'plus2':  { label: '+2',       color: 'var(--health-green)' },
  'plus3':  { label: '+3',       color: 'var(--health-green)' },
  'plus4':  { label: '+4',       color: 'var(--health-green)' },
  'minus1': { label: '-1',       color: 'var(--negative-red)' },
  'minus2': { label: '-2',       color: 'var(--negative-red)' },
  'null':   { label: '\u2205 MISS',  color: 'var(--negative-red)' },
  'double': { label: '2\u00D7 CRIT', color: 'var(--accent-gold)' },
  'bless':  { label: '2\u00D7 BLESS', color: 'var(--accent-gold)' },
  'curse':  { label: '\u2205 CURSE',  color: 'var(--negative-red)' },
};

function parseCardType(cardId: string): string {
  // "am-plus1-3" → "plus1", "am-null-1" → "null", "am-double-1" → "double"
  const match = cardId.match(/^am-(.+?)-\d+$/);
  return match ? match[1] : cardId;
}

export function ModifierDeck({
  deck, deckName, onDraw, onShuffle,
  onAddBless, onRemoveBless, onAddCurse, onRemoveCurse,
  readonly, compact,
}: ModifierDeckProps) {
  const [expanded, setExpanded] = useState(false);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const remaining = deck.cards.length - deck.current;
  const total = deck.cards.length;

  // Last drawn card — use lastDrawn field (handles bless/curse removal correctly)
  const lastDrawnCard = deck.lastDrawn ?? (deck.current > 0 ? deck.cards[deck.current - 1] : null);
  const lastDrawnDisplay = lastDrawnCard
    ? (modifierDisplay[parseCardType(lastDrawnCard)] || { label: lastDrawnCard, color: 'var(--text-muted)' })
    : null;

  // Count bless/curse in remaining cards
  const remainingCards = deck.cards.slice(deck.current);
  const blessCount = remainingCards.filter(c => c.includes('bless')).length;
  const curseCount = remainingCards.filter(c => c.includes('curse')).length;

  if (compact) {
    return (
      <>
        <div ref={badgeRef} class="deck-badge"
          title={`${deckName}: ${remaining}/${total}${lastDrawnDisplay ? ` | Last: ${lastDrawnDisplay.label}` : ''}`}>
          <button class="deck-badge__draw" onClick={onDraw}
            disabled={remaining <= 0 || readonly} aria-label="Draw modifier card">
            <img src="/assets/ghs/images/attackmodifier/am-back.png" alt="" />
          </button>
          <button class="deck-badge__count" onClick={() => setExpanded(!expanded)}
            aria-label="Open modifier deck">
            {remaining}/{total}
          </button>
        </div>

        {expanded && (
          <div class="modifier-deck-overlay-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}
          >
            <div class="modifier-deck-overlay">
              <div class="modifier-deck__header">
                <span class="modifier-deck__name">{deckName}</span>
                <span class="modifier-deck__count">{remaining}/{total}</span>
                <button class="modifier-deck__close"
                  onClick={() => setExpanded(false)} aria-label="Close">&times;</button>
              </div>

              {lastDrawnDisplay && (
                <div class="modifier-deck__last-drawn">
                  <span class="modifier-deck__drawn-label">Last drawn:</span>
                  <span class="modifier-deck__drawn-card"
                    style={{ color: lastDrawnDisplay.color }}>
                    {lastDrawnDisplay.label}
                  </span>
                </div>
              )}

              {!readonly && (
                <>
                  <div class="modifier-deck__actions">
                    <button class="btn" onClick={onDraw}
                      disabled={remaining <= 0}>Draw</button>
                    <button class="btn" onClick={onShuffle}>Shuffle</button>
                  </div>
                  <div class="modifier-deck__bless-curse">
                    <div class="modifier-deck__bc-row">
                      <span class="modifier-deck__bc-label">Bless: {blessCount}</span>
                      <button class="btn modifier-deck__bc-btn"
                        onClick={onAddBless} aria-label="Add Bless">+</button>
                      <button class="btn modifier-deck__bc-btn"
                        onClick={onRemoveBless} aria-label="Remove Bless">&minus;</button>
                    </div>
                    <div class="modifier-deck__bc-row">
                      <span class="modifier-deck__bc-label">Curse: {curseCount}</span>
                      <button class="btn modifier-deck__bc-btn"
                        onClick={onAddCurse} aria-label="Add Curse">+</button>
                      <button class="btn modifier-deck__bc-btn"
                        onClick={onRemoveCurse} aria-label="Remove Curse">&minus;</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // Non-compact mode: render expanded inline
  return (
    <div class="modifier-deck modifier-deck--expanded">
      <div class="modifier-deck__header">
        <span class="modifier-deck__name">{deckName}</span>
        <span class="modifier-deck__count">{remaining}/{total}</span>
      </div>

      {lastDrawnDisplay && (
        <div class="modifier-deck__last-drawn">
          <span class="modifier-deck__drawn-label">Last drawn:</span>
          <span class="modifier-deck__drawn-card" style={{ color: lastDrawnDisplay.color }}>
            {lastDrawnDisplay.label}
          </span>
        </div>
      )}

      {!readonly && (
        <>
          <div class="modifier-deck__actions">
            <button class="btn" onClick={onDraw} disabled={remaining <= 0}>Draw</button>
            <button class="btn" onClick={onShuffle}>Shuffle</button>
          </div>

          <div class="modifier-deck__bless-curse">
            <div class="modifier-deck__bc-row">
              <span class="modifier-deck__bc-label">Bless: {blessCount}</span>
              <button class="btn modifier-deck__bc-btn" onClick={onAddBless} aria-label="Add Bless">+</button>
              <button class="btn modifier-deck__bc-btn" onClick={onRemoveBless} aria-label="Remove Bless">&minus;</button>
            </div>
            <div class="modifier-deck__bc-row">
              <span class="modifier-deck__bc-label">Curse: {curseCount}</span>
              <button class="btn modifier-deck__bc-btn" onClick={onAddCurse} aria-label="Add Curse">+</button>
              <button class="btn modifier-deck__bc-btn" onClick={onRemoveCurse} aria-label="Remove Curse">&minus;</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
