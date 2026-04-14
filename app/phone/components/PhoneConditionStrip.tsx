import { h } from 'preact';
import { conditionIcon } from '../../shared/assets';
import type { EntityCondition, ConditionName } from '@gloomhaven-command/shared';

interface PhoneConditionStripProps {
  conditions: EntityCondition[];
  onToggleCondition: (name: ConditionName) => void;
  onOpenPicker: () => void;
  readonly?: boolean;
}

export function PhoneConditionStrip({
  conditions, onToggleCondition, onOpenPicker, readonly,
}: PhoneConditionStripProps) {
  const activeConditions = conditions.filter(
    c => c.state !== 'removed' && !c.expired
  );

  return (
    <div class="phone-conditions">
      <div class="phone-conditions__strip">
        {activeConditions.map(c => (
          <button
            key={c.name}
            class="phone-conditions__icon"
            onClick={() => !readonly && onToggleCondition(c.name)}
            aria-label={`Remove ${c.name}`}
            disabled={readonly}
          >
            <img
              src={conditionIcon(c.name)}
              alt={c.name}
              width={36}
              height={36}
              loading="lazy"
            />
          </button>
        ))}
        {!readonly && (
          <button
            class="phone-conditions__add"
            onClick={onOpenPicker}
            aria-label="Add condition"
          >
            +
          </button>
        )}
      </div>
      {activeConditions.length === 0 && !readonly && (
        <span class="phone-conditions__empty">No active conditions</span>
      )}
    </div>
  );
}
