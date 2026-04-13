import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { AttackModifierDeckModel, LevelDerivedValues, LootDeck } from '@gloomhaven-command/shared';
import { ModifierDeck } from './ModifierDeck';
import { DoorClosedIcon, DoorOpenIcon, TrapIcon, GoldIcon, XPIcon, HazardIcon } from './Icons';

interface DoorInfo {
  roomNumber: number;
  ref: string;
  revealed: boolean;
  marker?: string;
}

interface ScenarioFooterProps {
  phase: string;
  canAdvance: boolean;
  advanceLabel: string;
  onAdvance: () => void;
  doors?: DoorInfo[];
  onRevealRoom?: (roomNumber: number) => void;
  levelValues: LevelDerivedValues;
  modifierDeck?: AttackModifierDeckModel;
  onDrawModifier?: () => void;
  onShuffleModifier?: () => void;
  onAddBless?: () => void;
  onRemoveBless?: () => void;
  onAddCurse?: () => void;
  onRemoveCurse?: () => void;
  lootDeck?: LootDeck;
  onDrawLoot?: () => void;
  onOpenLootDeck?: () => void;
  readonly?: boolean;
}

export function ScenarioFooter({
  phase, canAdvance, advanceLabel, onAdvance,
  doors, onRevealRoom, levelValues,
  modifierDeck, onDrawModifier, onShuffleModifier,
  onAddBless, onRemoveBless, onAddCurse, onRemoveCurse,
  lootDeck, onDrawLoot, onOpenLootDeck,
  readonly,
}: ScenarioFooterProps) {
  const [pendingDoor, setPendingDoor] = useState<DoorInfo | null>(null);

  return (
    <div class="scenario-footer">
      {/* Left: phase action */}
      <button
        class={`phase-btn ${canAdvance ? 'ready' : 'waiting'}`}
        onClick={onAdvance}
        disabled={!canAdvance || readonly}
      >
        {advanceLabel}
      </button>

      {/* Center-left: door controls */}
      {doors && doors.length > 0 && (
        <div class="scenario-footer__doors">
          {doors.map(door => (
            <button
              key={door.roomNumber}
              class={`scenario-footer__door ${door.revealed ? 'revealed' : ''}`}
              onClick={() => !door.revealed && setPendingDoor(door)}
              disabled={door.revealed || readonly}
              title={door.revealed
                ? `Room ${door.roomNumber} (${door.ref}) - revealed`
                : `Open door to Room ${door.roomNumber} (${door.ref})`
              }
            >
              <span class="scenario-footer__door-icon">
                {door.revealed ? <DoorOpenIcon size={16} /> : <DoorClosedIcon size={16} />}
              </span>
              <span class="scenario-footer__door-ref">{door.ref}</span>
              {door.marker && !door.revealed && (
                <span class="scenario-footer__door-marker">&sect;</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Center: level-derived values */}
      <div class="footer-derived">
        <span class="derived-pill" title="Trap Damage">
          <TrapIcon size={14} class="derived-icon" />{levelValues.trapDamage}
        </span>
        <span class="derived-pill" title="Gold per Coin">
          <GoldIcon size={14} class="derived-icon" />{levelValues.goldConversion}
        </span>
        <span class="derived-pill" title="Bonus XP">
          <XPIcon size={14} class="derived-icon" />{levelValues.bonusXP}
        </span>
        <span class="derived-pill" title="Hazardous Terrain">
          <HazardIcon size={14} class="derived-icon" />{levelValues.hazardousTerrain}
        </span>
      </div>

      {/* Loot deck badge */}
      {lootDeck && lootDeck.cards && lootDeck.cards.length > 0 && (
        <div class="deck-badge">
          <button class="deck-badge__draw" onClick={onDrawLoot}
            disabled={lootDeck.current >= lootDeck.cards.length || readonly}
            aria-label="Draw loot card">
            <img src="/assets/ghs/images/fh/loot/loot-back.png" alt="" />
          </button>
          <button class="deck-badge__count" onClick={onOpenLootDeck}
            aria-label="Open loot deck">
            {lootDeck.cards.length - lootDeck.current}/{lootDeck.cards.length}
          </button>
        </div>
      )}

      {/* Right: modifier deck */}
      {modifierDeck && onDrawModifier && onShuffleModifier && (
        <ModifierDeck
          deck={modifierDeck}
          deckName="Monster"
          onDraw={onDrawModifier}
          onShuffle={onShuffleModifier}
          onAddBless={onAddBless ?? (() => {})}
          onRemoveBless={onRemoveBless ?? (() => {})}
          onAddCurse={onAddCurse ?? (() => {})}
          onRemoveCurse={onRemoveCurse ?? (() => {})}
          readonly={readonly}
          compact
        />
      )}

      {pendingDoor && (
        <div class="door-confirm-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setPendingDoor(null); }}
        >
          <div class="door-confirm-panel">
            <p class="door-confirm-text">
              Open door to Room {pendingDoor.roomNumber} ({pendingDoor.ref})?
            </p>
            <div class="door-confirm-actions">
              <button class="btn door-confirm-cancel"
                onClick={() => setPendingDoor(null)}>Cancel</button>
              <button class="btn door-confirm-ok"
                onClick={() => {
                  onRevealRoom?.(pendingDoor.roomNumber);
                  setPendingDoor(null);
                }}>Open Door</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
