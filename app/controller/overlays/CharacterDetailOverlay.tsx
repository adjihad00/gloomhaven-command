import { h } from 'preact';
import type { Character, ConditionName } from '@gloomhaven-command/shared';
import { useCommands } from '../../hooks/useCommands';
import { OverlayBackdrop } from './OverlayBackdrop';
import { HealthControl } from '../../components/HealthControl';
import { ConditionGrid } from '../../components/ConditionGrid';
import { SummonCard } from '../../components/SummonCard';
import { formatName } from '../../shared/formatName';
import { characterThumbnail } from '../../shared/assets';

interface CharacterDetailOverlayProps {
  character: Character;
  edition: string;
  availableConditions: ConditionName[];
  isDrawPhase: boolean;
  onClose: () => void;
}

export function CharacterDetailOverlay({ character, edition, availableConditions, isDrawPhase, onClose }: CharacterDetailOverlayProps) {
  const commands = useCommands();
  const { name, health, maxHealth, experience, loot, exhausted, absent, level, entityConditions, summons } = character;
  const ed = character.edition || edition;
  const target = { type: 'character' as const, name, edition: ed };
  const aliveSummons = summons.filter(s => !s.dead);

  return (
    <OverlayBackdrop onClose={onClose} position="right">
      <div class="char-detail">
        {/* Header */}
        <div class="char-detail__header">
          <img class="char-detail__portrait" src={characterThumbnail(ed, name)} alt={name} />
          <div>
            <h2 class="char-detail__name">{formatName(name)}</h2>
            <span class="char-detail__level">Level {level}</span>
          </div>
        </div>

        {/* HP */}
        <div class="char-detail__section">
          <label class="char-detail__label">Health</label>
          <HealthControl
            current={health}
            max={maxHealth}
            onChangeHealth={delta => commands.changeHealth(target, delta)}
            readonly={exhausted}
          />
        </div>

        {/* XP */}
        <div class="char-detail__section">
          <label class="char-detail__label">Experience</label>
          <div class="char-detail__counter">
            <button class="btn" onClick={() => commands.setExperience(name, ed, Math.max(0, experience - 1))}>-</button>
            <span class="char-detail__counter-value">{experience}</span>
            <button class="btn" onClick={() => commands.setExperience(name, ed, experience + 1)}>+</button>
          </div>
        </div>

        {/* Gold/Loot */}
        <div class="char-detail__section">
          <label class="char-detail__label">Loot</label>
          <div class="char-detail__counter">
            <button class="btn" onClick={() => commands.setLoot(name, ed, Math.max(0, loot - 1))}>-</button>
            <span class="char-detail__counter-value">{loot}</span>
            <button class="btn" onClick={() => commands.setLoot(name, ed, loot + 1)}>+</button>
          </div>
        </div>

        {/* Exhaust */}
        <div class="char-detail__section">
          <button
            class={`btn ${exhausted ? 'btn-primary' : ''}`}
            onClick={() => commands.toggleExhausted(name, ed)}
          >
            {exhausted ? 'Unexhaust' : 'Exhaust'}
          </button>
        </div>

        {/* Conditions */}
        <div class="char-detail__section">
          <label class="char-detail__label">Conditions</label>
          <ConditionGrid
            conditions={entityConditions}
            availableConditions={availableConditions}
            onToggleCondition={cond => commands.toggleCondition(target, cond as ConditionName)}
          />
        </div>

        {/* Summons */}
        {aliveSummons.length > 0 && (
          <div class="char-detail__section">
            <label class="char-detail__label">Summons</label>
            {aliveSummons.map(summon => (
              <SummonCard
                key={summon.uuid}
                summon={summon}
                characterName={name}
                characterEdition={ed}
              />
            ))}
          </div>
        )}

        {/* Mark Absent — at bottom, clearly separated from close button */}
        <div class="overlay-danger-zone">
          <button
            class={`absent-btn ${absent ? 'absent-btn--active' : ''}`}
            onClick={() => commands.toggleAbsent(name, ed)}
          >
            {absent ? 'Return to Game' : 'Mark Absent'}
          </button>
        </div>
      </div>
    </OverlayBackdrop>
  );
}
