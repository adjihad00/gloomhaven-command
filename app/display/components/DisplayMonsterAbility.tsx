import { h } from 'preact';
import { formatName } from '../../shared/formatName';
import type { MockMonsterAbility } from '../mockData';

interface DisplayMonsterAbilityProps {
  ability: MockMonsterAbility;
}

export function DisplayMonsterAbility({ ability }: DisplayMonsterAbilityProps) {
  return (
    <div class="display-ability">
      <div class="display-ability__title">{formatName(ability.monsterName)}</div>
      <div class="display-ability__initiative">Initiative {ability.initiative}</div>
      <div class="display-ability__actions">
        {ability.actions.map((action, i) => (
          <div key={i} class="display-ability__action">
            <span class="display-ability__action-type">{action.type}</span>
            <span class="display-ability__action-value">
              {action.value > 0 ? '+' : ''}{action.value}
            </span>
          </div>
        ))}
      </div>
      {ability.shuffle && (
        <div class="display-ability__shuffle">Shuffle after round</div>
      )}
    </div>
  );
}
