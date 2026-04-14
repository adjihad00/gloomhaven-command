import { h } from 'preact';
import { useState } from 'preact/hooks';
import { HealthIcon, XPIcon, GoldIcon, LongRestIcon } from '../../components/Icons';
import { conditionIcon } from '../../shared/assets';
import { formatName } from '../../shared/formatName';
import {
  getConditionsForEdition,
  isPositiveCondition,
  isNegativeCondition,
  AM_DECK_CONDITIONS,
} from '@gloomhaven-command/shared';
import { XP_THRESHOLDS } from '@gloomhaven-command/shared';
import type { Character, ConditionName } from '@gloomhaven-command/shared';

interface PhoneCharacterDetailProps {
  character: Character;
  edition: string;
  characterColor?: string;
  onChangeHealth: (delta: number) => void;
  onSetXP: (value: number) => void;
  onSetLoot: (value: number) => void;
  onToggleCondition: (name: ConditionName) => void;
  onToggleLongRest: () => void;
  onToggleAbsent: () => void;
  onToggleExhausted: () => void;
  onClose: () => void;
}

export function PhoneCharacterDetail({
  character, edition, characterColor,
  onChangeHealth, onSetXP, onSetLoot,
  onToggleCondition, onToggleLongRest, onToggleAbsent, onToggleExhausted,
  onClose,
}: PhoneCharacterDetailProps) {
  const [confirmExhaust, setConfirmExhaust] = useState(false);

  const allConditions = getConditionsForEdition(edition)
    .filter(c => !(AM_DECK_CONDITIONS as readonly string[]).includes(c));

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

  return (
    <div class="phone-detail-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div class="phone-detail" onClick={(e) => e.stopPropagation()}>
        <div class="phone-detail__handle" aria-hidden="true" />

        {/* Header */}
        <div class="phone-detail__header">
          <span class="phone-detail__name" style={{ color: characterColor || 'var(--accent-gold)' }}>
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

        {/* Loot */}
        <div class="phone-detail__section">
          <div class="phone-detail__section-label"><GoldIcon size={16} /> Loot</div>
          <div class="phone-detail__hp-controls">
            <button class="phone-detail__btn" onClick={() => onSetLoot(Math.max(0, character.loot - 1))} disabled={character.loot <= 0} aria-label="Decrease loot">&minus;</button>
            <span class="phone-detail__hp-value">{character.loot}</span>
            <button class="phone-detail__btn" onClick={() => onSetLoot(character.loot + 1)} aria-label="Increase loot">+</button>
          </div>
        </div>

        {/* Conditions */}
        <div class="phone-detail__section">
          <div class="phone-detail__section-label">Conditions</div>
          <div class="phone-detail__condition-grid">
            {allConditions.map(name => (
              <button
                key={name}
                class={`phone-detail__cond ${isConditionActive(name) ? 'phone-detail__cond--active' : ''} ${isNegativeCondition(name) ? 'phone-detail__cond--negative' : ''}`}
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
      </div>
    </div>
  );
}
