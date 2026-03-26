import { h } from 'preact';
import type { EntityCondition } from '@gloomhaven-command/shared';
import { conditionIcon } from '../shared/assets';

interface ConditionIconsProps {
  conditions: EntityCondition[];
  size?: number;
}

export function ConditionIcons({ conditions, size = 18 }: ConditionIconsProps) {
  const active = conditions.filter(c => c.state !== 'removed' && !c.expired);
  if (active.length === 0) return null;

  return (
    <div class="condition-icons">
      {active.map(c => (
        <img
          key={c.name}
          src={conditionIcon(c.name)}
          alt={c.name}
          width={size}
          height={size}
          class="condition-icons__icon"
        />
      ))}
    </div>
  );
}
