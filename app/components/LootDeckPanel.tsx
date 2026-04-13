import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { LootDeck, Character } from '@gloomhaven-command/shared';
import { formatName } from '../shared/formatName';

const lootTypeDisplay: Record<string, { icon: string; label: string; color: string }> = {
  'money':       { icon: '\uD83D\uDCB0', label: 'Gold',        color: '#c8a92c' },
  'lumber':      { icon: '\uD83E\uDEB5', label: 'Lumber',      color: '#8b6914' },
  'metal':       { icon: '\u26CF',        label: 'Metal',       color: '#8c8c8c' },
  'hide':        { icon: '\uD83E\uDD8C', label: 'Hide',        color: '#b08040' },
  'arrowvine':   { icon: '\uD83C\uDF3F', label: 'Arrowvine',   color: '#4a8f3c' },
  'axenut':      { icon: '\uD83C\uDF30', label: 'Axenut',      color: '#7a5930' },
  'corpsecap':   { icon: '\uD83C\uDF44', label: 'Corpsecap',   color: '#6b4a6b' },
  'flamefruit':  { icon: '\uD83D\uDD25', label: 'Flamefruit',  color: '#d4553a' },
  'rockroot':    { icon: '\uD83E\uDEA8', label: 'Rockroot',    color: '#6b6b6b' },
  'snowthistle': { icon: '\u2744',        label: 'Snowthistle', color: '#4a9bd9' },
  'random_item': { icon: '\uD83C\uDF81', label: 'Random Item', color: '#9b59b6' },
  'special1':    { icon: '\u2B50',        label: 'Special',     color: '#c8a92c' },
  'special2':    { icon: '\u2B50',        label: 'Special',     color: '#c8a92c' },
};

interface LootDeckPanelProps {
  lootDeck: LootDeck;
  characters: Character[];
  edition: string;
  onDraw: () => void;
  onAssign: (cardIndex: number, characterName: string, edition: string) => void;
  readonly?: boolean;
}

export function LootDeckPanel({ lootDeck, characters, edition, onDraw, onAssign, readonly }: LootDeckPanelProps) {
  const remaining = lootDeck.cards.length - lootDeck.current;
  const total = lootDeck.cards.length;

  // Cards drawn but potentially unassigned
  const drawnCards = lootDeck.cards.slice(0, lootDeck.current);

  return (
    <div class="loot-panel">
      <div class="loot-panel__header">
        <span class="loot-panel__title">Loot Deck</span>
        <span class="loot-panel__count">{remaining}/{total}</span>
      </div>

      {!readonly && (
        <button class="btn btn-primary loot-panel__draw" onClick={onDraw} disabled={remaining <= 0}>
          Draw Card
        </button>
      )}

      {drawnCards.length > 0 && (
        <div class="loot-panel__drawn">
          <span class="loot-panel__section-label">Drawn Cards</span>
          <div class="loot-panel__cards">
            {drawnCards.map((card, i) => (
              <LootCardItem
                key={i}
                cardIndex={i}
                cardType={card.type}
                characters={characters}
                edition={edition}
                onAssign={onAssign}
                readonly={readonly}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LootCardItem({ cardIndex, cardType, characters, edition, onAssign, readonly }: {
  cardIndex: number;
  cardType: string;
  characters: Character[];
  edition: string;
  onAssign: (cardIndex: number, characterName: string, edition: string) => void;
  readonly?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const display = lootTypeDisplay[cardType] || { icon: '?', label: cardType, color: 'var(--text-muted)' };

  return (
    <div class="loot-card" style={{ borderColor: display.color }}>
      <span class="loot-card__icon">{display.icon}</span>
      <span class="loot-card__label">{display.label}</span>
      {!readonly && !showPicker && (
        <button class="loot-card__assign-btn" onClick={() => setShowPicker(true)}>
          Assign
        </button>
      )}
      {showPicker && (
        <div class="loot-card__picker">
          {characters.filter(c => !c.exhausted && !c.absent).map(c => (
            <button key={c.name} class="loot-card__char-btn"
              onClick={() => { onAssign(cardIndex, c.name, c.edition || edition); setShowPicker(false); }}>
              {c.title || formatName(c.name)}
            </button>
          ))}
          <button class="loot-card__char-btn loot-card__char-btn--cancel" onClick={() => setShowPicker(false)}>
            {'\u2715'}
          </button>
        </div>
      )}
    </div>
  );
}
