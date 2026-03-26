import { h } from 'preact';
import type { Summon } from '@gloomhaven-command/shared';
import { useCommands } from '../hooks/useCommands';
import { formatName } from '../shared/formatName';
import { HealthControl } from './HealthControl';
import { ConditionIcons } from './ConditionIcons';

interface SummonCardProps {
  summon: Summon;
  characterName: string;
  characterEdition: string;
  readonly?: boolean;
}

export function SummonCard({ summon, characterName, characterEdition, readonly }: SummonCardProps) {
  const commands = useCommands();
  const { name, uuid, health, maxHealth, entityConditions, attack, movement, range, dead } = summon;

  const target = { type: 'summon' as const, characterName, characterEdition, summonUuid: uuid };

  return (
    <div class={`summon-card ${dead ? 'summon-card--dead' : ''}`}>
      <div class="summon-card__header">
        <span class="summon-card__name">{formatName(name)}</span>
        {!readonly && !dead && (
          <button
            class="summon-card__kill"
            onClick={() => commands.removeSummon(characterName, characterEdition, uuid)}
          >
            &#9760;
          </button>
        )}
      </div>

      <div class="summon-card__body">
        <HealthControl
          current={health}
          max={maxHealth}
          onChangeHealth={delta => commands.changeHealth(target, delta)}
          readonly={readonly || dead}
          size="compact"
        />
        <ConditionIcons conditions={entityConditions} />
      </div>

      {(attack || movement > 0 || range > 0) && (
        <div class="summon-card__stats">
          {attack && <span class="summon-card__stat">ATK {attack}</span>}
          {movement > 0 && <span class="summon-card__stat">MOV {movement}</span>}
          {range > 0 && <span class="summon-card__stat">RNG {range}</span>}
        </div>
      )}
    </div>
  );
}
