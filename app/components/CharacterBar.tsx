import { h } from 'preact';
import type { Character } from '@gloomhaven-command/shared';
import { useCommands } from '../hooks/useCommands';
import { characterThumbnail } from '../shared/assets';
import { formatName } from '../shared/formatName';
import { HealthControl } from './HealthControl';
import { ConditionIcons } from './ConditionIcons';
import { InitiativeDisplay } from './InitiativeDisplay';

interface CharacterBarProps {
  character: Character;
  edition: string;
  isActive: boolean;
  isDone: boolean;
  isDrawPhase: boolean;
  readonly?: boolean;
  characterColor?: string;
}

export function CharacterBar({ character, edition, isActive, isDone, isDrawPhase, readonly, characterColor }: CharacterBarProps) {
  const commands = useCommands();
  const { name, health, maxHealth, initiative, experience, loot, exhausted, longRest, summons, entityConditions } = character;
  const ed = character.edition || edition;
  const aliveSummons = summons.filter(s => !s.dead);

  const stateClass = exhausted ? 'exhausted' : isDone ? 'done' : isActive ? 'active' : '';

  const target = { type: 'character' as const, name, edition: ed };

  return (
    <div
      class={`character-bar ${stateClass}`}
      style={characterColor ? { borderLeftColor: characterColor } : undefined}
    >
      {/* Portrait + HP overlay */}
      <div class="character-bar__portrait" onClick={() => !readonly && commands.toggleTurn({ type: 'character', name, edition: ed })}>
        <img src={characterThumbnail(ed, name)} alt={name} />
        {!exhausted && (
          <div
            class="character-bar__hp-overlay"
            style={{ width: `${maxHealth > 0 ? (health / maxHealth) * 100 : 0}%` }}
          />
        )}
        {exhausted && <div class="character-bar__exhausted-label">EXHAUSTED</div>}
      </div>

      {/* Initiative */}
      <InitiativeDisplay
        value={initiative}
        onSetInitiative={v => commands.setInitiative(name, ed, v)}
        editable={isDrawPhase && !readonly && !exhausted}
        longRest={longRest}
      />

      {/* Name + HP */}
      <div class="character-bar__info">
        <span class="character-bar__name">{formatName(name)}</span>
        <HealthControl
          current={health}
          max={maxHealth}
          onChangeHealth={delta => commands.changeHealth(target, delta)}
          readonly={readonly || exhausted}
          size="compact"
        />
      </div>

      {/* Condition icons */}
      <ConditionIcons conditions={entityConditions} />

      {/* XP */}
      {!exhausted && (
        <button
          class="character-bar__counter character-bar__xp"
          onClick={() => !readonly && commands.setExperience(name, ed, experience + 1)}
          disabled={readonly}
        >
          <span class="character-bar__counter-icon">&#9733;</span>
          <span class="character-bar__counter-value">{experience}</span>
        </button>
      )}

      {/* Loot */}
      {!exhausted && (
        <button
          class="character-bar__counter character-bar__loot"
          onClick={() => !readonly && commands.setLoot(name, ed, loot + 1)}
          disabled={readonly}
        >
          <span class="character-bar__counter-icon">&#128176;</span>
          <span class="character-bar__counter-value">{loot}</span>
        </button>
      )}

      {/* Summon indicator */}
      {aliveSummons.length > 0 && (
        <span class="character-bar__summon-badge">{aliveSummons.length}</span>
      )}
    </div>
  );
}
