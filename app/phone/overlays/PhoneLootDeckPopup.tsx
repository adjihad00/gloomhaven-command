import { h } from 'preact';
import { useState } from 'preact/hooks';
import { GoldIcon } from '../../components/Icons';
import { lootCardIcon } from '../../shared/assets';
import type { LootDeck } from '@gloomhaven-command/shared';

interface PhoneLootDeckPopupProps {
  lootDeck: LootDeck;
  characterName: string;
  characterEdition: string;
  isActive: boolean;
  onDrawLootCard: () => void;
  onAssignLoot: (cardIndex: number, characterName: string, edition: string) => void;
  onClose: () => void;
}

export function PhoneLootDeckPopup({
  lootDeck, characterName, characterEdition, isActive,
  onDrawLootCard, onAssignLoot, onClose,
}: PhoneLootDeckPopupProps) {
  const [drawnCard, setDrawnCard] = useState<{ index: number; type: string; value?: number } | null>(null);

  const remaining = (lootDeck.cards?.length ?? 0) - (lootDeck.current ?? 0);

  const handleDraw = () => {
    const cardIndex = lootDeck.current ?? 0;
    onDrawLootCard();
    // After draw, show the card that was at the current index
    const card = lootDeck.cards?.[cardIndex];
    if (card) {
      setDrawnCard({ index: cardIndex, type: card.type ?? 'money', value: card.value });
    }
  };

  const handleAssign = () => {
    if (drawnCard) {
      onAssignLoot(drawnCard.index, characterName, characterEdition);
      setDrawnCard(null);
      onClose();
    }
  };

  return (
    <div class="loot-popup-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div class="loot-popup" onClick={(e) => e.stopPropagation()}>
        <div class="loot-popup__header">
          <GoldIcon size={20} />
          <span class="loot-popup__title">Loot Deck</span>
          <span class="loot-popup__remaining">{remaining} cards remaining</span>
          <button class="loot-popup__close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div class="loot-popup__body">
          {!drawnCard ? (
            <button
              class="loot-popup__draw-btn"
              onClick={handleDraw}
              disabled={!isActive || remaining <= 0}
              aria-label="Draw Loot Card"
            >
              Draw Loot Card
            </button>
          ) : (
            <div class="loot-popup__drawn">
              <div class="loot-popup__card-display">
                <img
                  src={lootCardIcon(drawnCard.type, drawnCard.value)}
                  alt={`${drawnCard.type}${drawnCard.value ? ` (${drawnCard.value})` : ''}`}
                  class="loot-popup__card-img"
                />
                <span class="loot-popup__card-label">
                  {drawnCard.type === 'money'
                    ? `${drawnCard.value} Coin${(drawnCard.value ?? 1) > 1 ? 's' : ''}`
                    : drawnCard.type.charAt(0).toUpperCase() + drawnCard.type.slice(1)
                  }
                </span>
              </div>
              <button
                class="loot-popup__assign-btn"
                onClick={handleAssign}
                aria-label="Claim this loot card"
              >
                Claim
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
