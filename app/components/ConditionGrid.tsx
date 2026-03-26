import { h } from 'preact';
import type { EntityCondition, ConditionName } from '@gloomhaven-command/shared';
import { isNegativeCondition } from '@gloomhaven-command/shared';
import { conditionIcon } from '../shared/assets';

interface ConditionGridProps {
  conditions: EntityCondition[];
  availableConditions: ConditionName[];
  onToggleCondition: (conditionName: string) => void;
  readonly?: boolean;
  size?: 'normal' | 'compact';
}

export function ConditionGrid({ conditions, availableConditions, onToggleCondition, readonly, size = 'normal' }: ConditionGridProps) {
  const compact = size === 'compact';

  const isActive = (name: ConditionName) =>
    conditions.some(c => c.name === name && c.state !== 'removed' && !c.expired);

  if (readonly) {
    const active = availableConditions.filter(isActive);
    if (active.length === 0) return null;
    return (
      <div class={`condition-grid ${compact ? 'condition-grid--compact' : ''}`}>
        {active.map(name => (
          <div
            key={name}
            class={`condition-btn active ${isNegativeCondition(name) ? 'negative' : 'positive'}`}
          >
            <img src={conditionIcon(name)} alt={name} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div class={`condition-grid ${compact ? 'condition-grid--compact' : ''}`}>
      {availableConditions.map(name => {
        const active = isActive(name);
        const negative = isNegativeCondition(name);
        return (
          <button
            key={name}
            class={`condition-btn ${active ? 'active' : ''} ${active ? (negative ? 'negative' : 'positive') : ''}`}
            onClick={() => onToggleCondition(name)}
          >
            <img src={conditionIcon(name)} alt={name} />
          </button>
        );
      })}
    </div>
  );
}
