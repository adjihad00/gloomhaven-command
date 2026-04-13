import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { LootDeck, LootCard, Character } from '@gloomhaven-command/shared';
import { formatName } from '../shared/formatName';
import { characterThumbnail, lootCardIcon } from '../shared/assets';

const lootTypeDisplay: Record<string, { label: string; color: string }> = {
  'money':       { label: 'Gold',        color: '#c8a92c' },
  'lumber':      { label: 'Lumber',      color: '#8b6914' },
  'metal':       { label: 'Metal',       color: '#8c8c8c' },
  'hide':        { label: 'Hide',        color: '#b08040' },
  'arrowvine':   { label: 'Arrowvine',   color: '#4a8f3c' },
  'axenut':      { label: 'Axenut',      color: '#7a5930' },
  'corpsecap':   { label: 'Corpsecap',   color: '#6b4a6b' },
  'flamefruit':  { label: 'Flamefruit',  color: '#d4553a' },
  'rockroot':    { label: 'Rockroot',    color: '#6b6b6b' },
  'snowthistle': { label: 'Snowthistle', color: '#4a9bd9' },
  'random_item': { label: 'Random Item', color: '#9b59b6' },
  'special1':    { label: 'Special',     color: '#c8a92c' },
  'special2':    { label: 'Special',     color: '#c8a92c' },
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
                card={card}
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

function LootCardItem({ cardIndex, card, characters, edition, onAssign, readonly }: {
  cardIndex: number;
  card: LootCard;
  characters: Character[];
  edition: string;
  onAssign: (cardIndex: number, characterName: string, edition: string) => void;
  readonly?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const display = lootTypeDisplay[card.type] || { label: card.type, color: 'var(--text-muted)' };

  // For money cards, show coin value (use 4P as the display value)
  const coinValue = card.type === 'money' ? card.value4P : 0;
  const label = card.type === 'money' ? `Gold ×${coinValue}` : display.label;

  // Find which character this card is assigned to
  const assignedChar = characters.find(c => c.lootCards.includes(cardIndex));

  return (
    <div class="loot-card" style={{ borderColor: display.color }}>
      <img src={lootCardIcon(card.type, coinValue || undefined)} alt={label}
        class="loot-card__icon-img" loading="lazy" />
      <span class="loot-card__label">{label}</span>
      {!readonly && !showPicker && assignedChar && (
        <button class="loot-card__assigned" onClick={() => setShowPicker(true)}
          title={`Assigned to ${assignedChar.title || formatName(assignedChar.name)} — click to reassign`}>
          <img src={characterThumbnail(assignedChar.edition || edition, assignedChar.name)}
            alt={formatName(assignedChar.name)} class="loot-card__assigned-img" />
        </button>
      )}
      {!readonly && !showPicker && !assignedChar && (
        <button class="loot-card__assign-btn" onClick={() => setShowPicker(true)}>
          Assign
        </button>
      )}
      {showPicker && (
        <div class="loot-card__picker">
          {characters.filter(c => !c.exhausted && !c.absent).map(c => (
            <button key={c.name} class="loot-card__char-btn"
              onClick={() => { onAssign(cardIndex, c.name, c.edition || edition); setShowPicker(false); }}>
              <img src={characterThumbnail(c.edition || edition, c.name)}
                alt={formatName(c.name)} class="loot-card__picker-img" />
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
