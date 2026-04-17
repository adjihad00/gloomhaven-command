import { h } from 'preact';
import { useState, useContext } from 'preact/hooks';
import type {
  Character,
  ConditionName,
  ElementModel,
  ElementType,
  ElementState,
  LootDeck,
} from '@gloomhaven-command/shared';
import {
  getConditionsForEdition,
  isPositiveCondition,
  isNegativeCondition,
  AM_DECK_CONDITIONS,
} from '@gloomhaven-command/shared';
import { HealthIcon, XPIcon, GoldIcon, LongRestIcon } from '../../../components/Icons';
import { ElementBoard } from '../../../components/ElementBoard';
import { conditionIcon, lootCardIcon } from '../../../shared/assets';
import { formatName } from '../../../shared/formatName';
import { PlayerSheetContext } from '../PlayerSheetContext';

interface OverviewActiveScenarioProps {
  character: Character;
  edition: string;
  elements?: ElementModel[];
  lootDeck?: LootDeck | null;
  isActive: boolean;
  onChangeHealth?: (delta: number) => void;
  onSetXP?: (value: number) => void;
  onToggleCondition?: (name: ConditionName) => void;
  onToggleLongRest?: () => void;
  onToggleAbsent?: () => void;
  onToggleExhausted?: () => void;
  onMoveElement?: (element: ElementType, newState: ElementState) => void;
}

const LOOT_TYPE_LABELS: Record<string, string> = {
  money: 'Gold', lumber: 'Lumber', metal: 'Metal', hide: 'Hide',
  arrowvine: 'Arrowvine', axenut: 'Axenut', corpsecap: 'Corpsecap',
  flamefruit: 'Flamefruit', rockroot: 'Rockroot', snowthistle: 'Snowthistle',
  random_item: 'Random Item',
};

/**
 * Phase T0a: Overview tab's "Active Scenario" section (scenario mode
 * only). Absorbs the full in-scenario control surface from the retired
 * `PhoneCharacterDetail` overlay: HP bar ±, XP ±, positive/negative
 * condition grids, element board, loot preview, Long Rest / Absent /
 * Exhaust toggles.
 *
 * Exhaust uses an inline confirm pattern (matches the old component).
 * `readOnly` from `PlayerSheetContext` is respected but does NOT
 * disable this section — the GM uses these controls via the controller
 * quick-view, same as today.
 */
export function OverviewActiveScenario({
  character, edition, elements, lootDeck, isActive,
  onChangeHealth, onSetXP, onToggleCondition,
  onToggleLongRest, onToggleAbsent, onToggleExhausted,
  onMoveElement,
}: OverviewActiveScenarioProps) {
  const { readOnly } = useContext(PlayerSheetContext);
  const [confirmExhaust, setConfirmExhaust] = useState(false);
  const [showLootCards, setShowLootCards] = useState(false);

  const allConditions = getConditionsForEdition(edition)
    .filter((c) => !(AM_DECK_CONDITIONS as readonly string[]).includes(c));
  const positive = allConditions.filter((c) => isPositiveCondition(c));
  const negative = allConditions.filter((c) => isNegativeCondition(c));

  const hasFhLoot = character.lootCards?.length > 0 && (lootDeck?.cards?.length ?? 0) > 0;

  const isConditionActive = (name: ConditionName) =>
    character.entityConditions.some(
      (c) => c.name === name && c.state !== 'removed' && !c.expired,
    );

  const handleExhaust = () => {
    if (confirmExhaust) {
      onToggleExhausted?.();
      setConfirmExhaust(false);
    } else {
      setConfirmExhaust(true);
    }
  };

  const handleElementTap = (type: string, currentState: string) => {
    if (!onMoveElement || !isActive) return;
    if (currentState === 'inert') onMoveElement(type as ElementType, 'strong' as ElementState);
    else onMoveElement(type as ElementType, 'inert' as ElementState);
  };

  return (
    <section class="overview-active" aria-labelledby="overview-active-heading">
      <div class="overview-active__title">
        <span class="overview-active__flourish" aria-hidden="true">&#x2766;</span>
        <h3 id="overview-active-heading" class="overview-active__heading">
          Active Scenario
        </h3>
        <span class="overview-active__flourish" aria-hidden="true">&#x2766;</span>
      </div>

      <div class="overview-active__panel">
        {/* HP */}
        <div class="overview-active__row">
          <div class="overview-active__row-label">
            <HealthIcon size={16} /> Health
          </div>
          <div class="overview-active__hp">
            <button
              type="button"
              class="overview-active__btn"
              onClick={() => onChangeHealth?.(-1)}
              disabled={!onChangeHealth || character.health <= 0}
              aria-label="Decrease health"
            >
              &minus;
            </button>
            <span class="overview-active__hp-value">
              {character.health} / {character.maxHealth}
            </span>
            <button
              type="button"
              class="overview-active__btn"
              onClick={() => onChangeHealth?.(1)}
              disabled={!onChangeHealth || character.health >= character.maxHealth}
              aria-label="Increase health"
            >
              +
            </button>
          </div>
        </div>

        {/* XP */}
        <div class="overview-active__row">
          <div class="overview-active__row-label">
            <XPIcon size={16} /> Scenario XP
          </div>
          <div class="overview-active__hp">
            <button
              type="button"
              class="overview-active__btn"
              onClick={() => onSetXP?.(Math.max(0, character.experience - 1))}
              disabled={!onSetXP || character.experience <= 0}
              aria-label="Decrease experience"
            >
              &minus;
            </button>
            <span class="overview-active__hp-value">{character.experience}</span>
            <button
              type="button"
              class="overview-active__btn"
              onClick={() => onSetXP?.(character.experience + 1)}
              disabled={!onSetXP}
              aria-label="Increase experience"
            >
              +
            </button>
          </div>
        </div>

        {/* Loot preview */}
        <div class="overview-active__row">
          <div class="overview-active__row-label">
            <GoldIcon size={16} /> Loot
          </div>
          {hasFhLoot ? (
            <button
              type="button"
              class="overview-active__loot-toggle"
              onClick={() => setShowLootCards((v) => !v)}
              aria-expanded={showLootCards}
            >
              <span class="overview-active__hp-value">
                {character.lootCards.length} cards
              </span>
              <span class="overview-active__loot-chevron">
                {showLootCards ? '\u25B2' : '\u25BC'}
              </span>
            </button>
          ) : (
            <span class="overview-active__hp-value">{character.loot}</span>
          )}
        </div>

        {hasFhLoot && showLootCards && (
          <div class="overview-active__loot-grid">
            {character.lootCards.map((idx, i) => {
              const card = lootDeck?.cards?.[idx];
              if (!card) return null;
              const label = LOOT_TYPE_LABELS[card.type] || card.type;
              const coin = card.type === 'money' ? card.value4P : 0;
              return (
                <div key={i} class="overview-active__loot-card">
                  <img
                    src={lootCardIcon(card.type, coin || undefined)}
                    alt={coin ? `Gold x${coin}` : label}
                    loading="lazy"
                  />
                  <span>{coin ? `Gold x${coin}` : label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Elements */}
        {elements && elements.length > 0 && (
          <div class="overview-active__row overview-active__row--stack">
            <div class="overview-active__row-label">Elements</div>
            <div class="overview-active__elements">
              <ElementBoard
                elements={elements}
                onCycleElement={handleElementTap}
                layout="horizontal"
                readonly={!isActive || readOnly}
                size="normal"
              />
            </div>
          </div>
        )}

        {/* Positive conditions */}
        <div class="overview-active__conditions">
          <div class="overview-active__row-label">Positive Conditions</div>
          <div class="overview-active__cond-grid">
            {positive.map((name) => {
              const active = isConditionActive(name);
              return (
                <button
                  key={name}
                  type="button"
                  class={`overview-active__cond${active ? ' overview-active__cond--active' : ''}`}
                  onClick={() => onToggleCondition?.(name)}
                  disabled={!onToggleCondition}
                  aria-pressed={active}
                  aria-label={`${active ? 'Remove' : 'Add'} ${name}`}
                >
                  <img src={conditionIcon(name)} alt="" width={32} height={32} loading="lazy" />
                  <span class="overview-active__cond-name">{formatName(name)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Negative conditions */}
        <div class="overview-active__conditions">
          <div class="overview-active__row-label">Negative Conditions</div>
          <div class="overview-active__cond-grid">
            {negative.map((name) => {
              const active = isConditionActive(name);
              return (
                <button
                  key={name}
                  type="button"
                  class={`overview-active__cond overview-active__cond--negative${active ? ' overview-active__cond--active' : ''}`}
                  onClick={() => onToggleCondition?.(name)}
                  disabled={!onToggleCondition}
                  aria-pressed={active}
                  aria-label={`${active ? 'Remove' : 'Add'} ${name}`}
                >
                  <img src={conditionIcon(name)} alt="" width={32} height={32} loading="lazy" />
                  <span class="overview-active__cond-name">{formatName(name)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggles */}
        <div class="overview-active__toggles">
          <button
            type="button"
            class={`overview-active__toggle${character.longRest ? ' overview-active__toggle--active' : ''}`}
            onClick={onToggleLongRest}
            disabled={!onToggleLongRest}
            aria-pressed={character.longRest}
          >
            <LongRestIcon size={18} /> Long Rest
          </button>
          <button
            type="button"
            class={`overview-active__toggle${character.absent ? ' overview-active__toggle--active' : ''}`}
            onClick={onToggleAbsent}
            disabled={!onToggleAbsent}
            aria-pressed={character.absent}
          >
            Absent
          </button>
          <button
            type="button"
            class={`overview-active__toggle overview-active__toggle--danger${
              confirmExhaust ? ' overview-active__toggle--confirm' : ''
            }`}
            onClick={handleExhaust}
            disabled={!onToggleExhausted}
            onBlur={() => setConfirmExhaust(false)}
          >
            {confirmExhaust ? 'Confirm Exhaust?' : 'Exhaust'}
          </button>
        </div>
      </div>
    </section>
  );
}
