import { h } from 'preact';
import { useState, useRef, useCallback, useContext } from 'preact/hooks';
import { AppContext } from '../../shared/context';
import { HealthIcon, XPIcon, GoldIcon, LongRestIcon } from '../../components/Icons';
import { conditionIcon, elementIcon, lootCardIcon } from '../../shared/assets';
import { formatName } from '../../shared/formatName';
import { ElementBoard } from '../../components/ElementBoard';
import {
  getConditionsForEdition,
  isPositiveCondition,
  isNegativeCondition,
  AM_DECK_CONDITIONS,
} from '@gloomhaven-command/shared';
import { XP_THRESHOLDS } from '@gloomhaven-command/shared';
import type { Character, ConditionName, ElementModel, ElementType, ElementState, LootDeck, LootCard } from '@gloomhaven-command/shared';

const LOOT_TYPE_DISPLAY: Record<string, { label: string; color: string }> = {
  'money':       { label: 'Gold',        color: '#c8a92c' },
  'lumber':      { label: 'Lumber',      color: '#8b6914' },
  'metal':       { label: 'Metal',       color: '#8c8c8c' },
  'hide':        { label: 'Hide',        color: '#a0522d' },
  'arrowvine':   { label: 'Arrowvine',   color: '#4a7c59' },
  'axenut':      { label: 'Axenut',      color: '#8b4513' },
  'corpsecap':   { label: 'Corpsecap',   color: '#556b2f' },
  'flamefruit':  { label: 'Flamefruit',  color: '#cc4422' },
  'rockroot':    { label: 'Rockroot',    color: '#708090' },
  'snowthistle': { label: 'Snowthistle', color: '#87ceeb' },
  'random_item': { label: 'Random Item', color: '#9966cc' },
};

interface PhoneCharacterDetailProps {
  character: Character;
  edition: string;
  characterColor?: string;
  elements?: ElementModel[];
  lootDeck?: LootDeck | null;
  isActive?: boolean;
  onChangeHealth: (delta: number) => void;
  onSetXP: (value: number) => void;
  onToggleCondition: (name: ConditionName) => void;
  onToggleLongRest: () => void;
  onToggleAbsent: () => void;
  onToggleExhausted: () => void;
  onMoveElement?: (element: ElementType, newState: ElementState) => void;
  onSwitchCharacter?: () => void;
  onClose: () => void;
}

export function PhoneCharacterDetail({
  character, edition, characterColor, elements, lootDeck, isActive,
  onChangeHealth, onSetXP,
  onToggleCondition, onToggleLongRest, onToggleAbsent, onToggleExhausted,
  onMoveElement, onSwitchCharacter,
  onClose,
}: PhoneCharacterDetailProps) {
  const { disconnect, gameCode } = useContext(AppContext);
  const [confirmExhaust, setConfirmExhaust] = useState(false);
  const [showLootCards, setShowLootCards] = useState(false);

  // Swipe-to-close state
  const touchStartY = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimatingClose, setIsAnimatingClose] = useState(false);

  const allConditions = getConditionsForEdition(edition)
    .filter(c => !(AM_DECK_CONDITIONS as readonly string[]).includes(c));
  const hasFhLoot = character.lootCards?.length > 0 && lootDeck?.cards?.length > 0;
  const positiveConditions = allConditions.filter(c => isPositiveCondition(c));
  const negativeConditions = allConditions.filter(c => isNegativeCondition(c));

  const isConditionActive = (name: ConditionName) =>
    character.entityConditions.some(c => c.name === name && c.state !== 'removed' && !c.expired);

  // XP progress toward next level
  const careerXP = character.progress?.experience ?? 0;
  const currentLevel = character.level;
  const nextLevelXP = currentLevel < 9 ? (XP_THRESHOLDS[currentLevel + 1] ?? 500) : 500;
  const currentLevelXP = XP_THRESHOLDS[currentLevel] ?? 0;
  const xpProgress = nextLevelXP > currentLevelXP
    ? (careerXP - currentLevelXP) / (nextLevelXP - currentLevelXP)
    : 1;

  const handleExhaust = () => {
    if (confirmExhaust) {
      onToggleExhausted();
      setConfirmExhaust(false);
      onClose();
    } else {
      setConfirmExhaust(true);
    }
  };

  const handleElementTap = (type: string, currentState: string) => {
    if (!onMoveElement || !isActive) return;
    if (currentState === 'inert') {
      onMoveElement(type as ElementType, 'strong' as ElementState);
    } else {
      onMoveElement(type as ElementType, 'inert' as ElementState);
    }
  };

  // Swipe gesture handlers
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setSwipeOffset(delta);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeOffset > 80) {
      setIsAnimatingClose(true);
      setTimeout(onClose, 250);
    } else {
      setSwipeOffset(0);
    }
    touchStartY.current = null;
  }, [swipeOffset, onClose]);

  const panelStyle = swipeOffset > 0 || isAnimatingClose
    ? { transform: `translateY(${isAnimatingClose ? '100%' : `${swipeOffset}px`})`, transition: isAnimatingClose || swipeOffset === 0 ? 'transform 0.25s ease' : 'none' }
    : {};

  return (
    <div
      class="phone-detail-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{ overscrollBehavior: 'none', touchAction: 'none' }}
    >
      <div
        class="phone-detail"
        ref={panelRef}
        style={{ ...panelStyle, touchAction: 'pan-y', overscrollBehavior: 'contain' }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div class="phone-detail__handle" aria-hidden="true" />

        {/* Header */}
        <div class="phone-detail__header">
          <span class="phone-detail__name" style={{ color: 'var(--phone-accent, var(--accent-gold))' }}>
            {formatName(character.name)}
          </span>
          <button class="phone-detail__close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {/* HP */}
        <div class="phone-detail__section">
          <div class="phone-detail__section-label"><HealthIcon size={16} /> Health</div>
          <div class="phone-detail__hp-controls">
            <button class="phone-detail__btn" onClick={() => onChangeHealth(-1)} disabled={character.health <= 0} aria-label="Decrease health">&minus;</button>
            <span class="phone-detail__hp-value">{character.health} / {character.maxHealth}</span>
            <button class="phone-detail__btn" onClick={() => onChangeHealth(1)} disabled={character.health >= character.maxHealth} aria-label="Increase health">+</button>
          </div>
        </div>

        {/* XP */}
        <div class="phone-detail__section">
          <div class="phone-detail__section-label"><XPIcon size={16} /> Experience</div>
          <div class="phone-detail__xp-row">
            <div class="phone-detail__xp-controls">
              <button class="phone-detail__btn" onClick={() => onSetXP(Math.max(0, character.experience - 1))} disabled={character.experience <= 0} aria-label="Decrease XP">&minus;</button>
              <span class="phone-detail__xp-value">{character.experience}</span>
              <button class="phone-detail__btn" onClick={() => onSetXP(character.experience + 1)} aria-label="Increase XP">+</button>
            </div>
            <span class="phone-detail__xp-career">Career: {careerXP} XP</span>
          </div>
          <div class="phone-detail__xp-bar">
            <div class="phone-detail__xp-fill" style={{ width: `${Math.min(1, Math.max(0, xpProgress)) * 100}%` }} />
            <span class="phone-detail__xp-label">Lv {currentLevel} &rarr; {currentLevel < 9 ? currentLevel + 1 : 'MAX'}</span>
          </div>
        </div>

        {/* Loot — tappable to show claimed FH cards */}
        <div class="phone-detail__section">
          <div class="phone-detail__section-label"><GoldIcon size={16} /> Loot</div>
          {hasFhLoot ? (
            <div class="phone-detail__loot">
              <button
                class="phone-detail__loot-toggle"
                onClick={() => setShowLootCards(!showLootCards)}
                aria-expanded={showLootCards}
                aria-label={`${character.lootCards.length} loot cards claimed. Tap to ${showLootCards ? 'hide' : 'show'}`}
              >
                <span class="phone-detail__hp-value">{character.lootCards.length} cards</span>
                <span class="phone-detail__loot-chevron">{showLootCards ? '▲' : '▼'}</span>
              </button>
              {showLootCards && (
                <div class="phone-detail__loot-cards">
                  {character.lootCards.map((cardIdx, i) => {
                    const card = lootDeck?.cards?.[cardIdx];
                    if (!card) return null;
                    const display = LOOT_TYPE_DISPLAY[card.type] || { label: card.type, color: 'var(--text-muted)' };
                    const coinValue = card.type === 'money' ? card.value4P : 0;
                    const label = card.type === 'money' ? `Gold ×${coinValue}` : display.label;
                    return (
                      <div key={i} class="phone-detail__loot-card" style={{ borderColor: display.color }}>
                        <img
                          src={lootCardIcon(card.type, coinValue || undefined)}
                          alt={label}
                          class="phone-detail__loot-card-img"
                          loading="lazy"
                        />
                        <span class="phone-detail__loot-card-label">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div class="phone-detail__hp-controls">
              <span class="phone-detail__hp-value">{character.loot}</span>
            </div>
          )}
        </div>

        {/* Elements — above conditions */}
        {elements && elements.length > 0 && (
          <div class="phone-detail__section">
            <div class="phone-detail__section-label">Elements</div>
            <div class="phone-detail__elements">
              <ElementBoard
                elements={elements}
                onCycleElement={handleElementTap}
                layout="horizontal"
                readonly={!isActive}
                size="normal"
              />
            </div>
          </div>
        )}

        {/* Positive Conditions */}
        <div class="phone-detail__section">
          <div class="phone-detail__section-label">Positive Conditions</div>
          <div class="phone-detail__condition-grid">
            {positiveConditions.map(name => (
              <button
                key={name}
                class={`phone-detail__cond ${isConditionActive(name) ? 'phone-detail__cond--active' : ''}`}
                onClick={() => onToggleCondition(name)}
                aria-label={`${isConditionActive(name) ? 'Remove' : 'Add'} ${name}`}
                aria-pressed={isConditionActive(name)}
              >
                <img src={conditionIcon(name)} alt="" width={32} height={32} loading="lazy" />
                <span class="phone-detail__cond-name">{formatName(name)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Negative Conditions */}
        <div class="phone-detail__section">
          <div class="phone-detail__section-label">Negative Conditions</div>
          <div class="phone-detail__condition-grid">
            {negativeConditions.map(name => (
              <button
                key={name}
                class={`phone-detail__cond phone-detail__cond--negative ${isConditionActive(name) ? 'phone-detail__cond--active' : ''}`}
                onClick={() => onToggleCondition(name)}
                aria-label={`${isConditionActive(name) ? 'Remove' : 'Add'} ${name}`}
                aria-pressed={isConditionActive(name)}
              >
                <img src={conditionIcon(name)} alt="" width={32} height={32} loading="lazy" />
                <span class="phone-detail__cond-name">{formatName(name)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div class="phone-detail__toggles">
          <button
            class={`phone-detail__toggle ${character.longRest ? 'phone-detail__toggle--active' : ''}`}
            onClick={onToggleLongRest}
            aria-pressed={character.longRest}
          >
            <LongRestIcon size={18} /> Long Rest
          </button>
          <button
            class={`phone-detail__toggle ${character.absent ? 'phone-detail__toggle--active' : ''}`}
            onClick={onToggleAbsent}
            aria-pressed={character.absent}
          >
            Absent
          </button>
          <button
            class={`phone-detail__toggle phone-detail__toggle--danger ${confirmExhaust ? 'phone-detail__toggle--confirm' : ''}`}
            onClick={handleExhaust}
            onBlur={() => setConfirmExhaust(false)}
          >
            {confirmExhaust ? 'Confirm Exhaust?' : 'Exhaust'}
          </button>
        </div>

        {/* Switch Character + Disconnect */}
        <div class="phone-detail__switch">
          {onSwitchCharacter && (
            <button
              class="phone-detail__switch-btn"
              onClick={() => { onSwitchCharacter(); onClose(); }}
              aria-label="Switch character"
            >
              Switch Character
            </button>
          )}
          <button
            class="phone-detail__disconnect-btn"
            onClick={() => { onClose(); disconnect(); }}
            aria-label="Disconnect from game"
          >
            Disconnect{gameCode ? ` (${gameCode})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
