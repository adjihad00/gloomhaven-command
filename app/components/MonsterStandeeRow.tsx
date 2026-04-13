import { h } from 'preact';
import type { MonsterEntity } from '@gloomhaven-command/shared';
import { useCommands } from '../hooks/useCommands';
import { HealthControl } from './HealthControl';
import { ConditionIcons } from './ConditionIcons';

interface MonsterStandeeRowProps {
  entity: MonsterEntity;
  monsterName: string;
  monsterEdition: string;
  readonly?: boolean;
}

export function MonsterStandeeRow({ entity, monsterName, monsterEdition, readonly }: MonsterStandeeRowProps) {
  const commands = useCommands();
  const { number, type, dead, health, maxHealth, entityConditions } = entity;

  const target = { type: 'monster' as const, name: monsterName, edition: monsterEdition, entityNumber: number };
  const typeClass = type === 'elite' ? 'elite' : type === 'boss' ? 'boss' : 'normal';

  return (
    <div class={`standee-row ${typeClass} ${dead ? 'dead' : ''}`}>
      <span class={`standee-row__number standee-row__number--${typeClass}`}>{number}</span>

      <HealthControl
        current={health}
        max={maxHealth}
        onChangeHealth={delta => commands.changeHealth(target, delta)}
        readonly={readonly || dead}
        size="compact"
      />

      <ConditionIcons conditions={entityConditions} />

      {!readonly && !dead && (
        <button
          class="standee-row__kill"
          aria-label="Kill standee"
          onClick={() => commands.removeEntity(monsterName, monsterEdition, number, type)}
        >
          &#9760;
        </button>
      )}
    </div>
  );
}
