import { h } from 'preact';
import { conditionIcon } from '../../shared/assets';
import { formatName } from '../../shared/formatName';
import {
  getConditionsForEdition,
  isPositiveCondition,
  isNegativeCondition,
  AM_DECK_CONDITIONS,
} from '@gloomhaven-command/shared';
import type { EntityCondition, ConditionName } from '@gloomhaven-command/shared';

interface PhoneConditionPickerProps {
  edition: string;
  activeConditions: EntityCondition[];
  onToggle: (name: ConditionName) => void;
  onClose: () => void;
}

export function PhoneConditionPicker({
  edition, activeConditions, onToggle, onClose,
}: PhoneConditionPickerProps) {
  const allConditions = getConditionsForEdition(edition)
    .filter(c => !(AM_DECK_CONDITIONS as readonly string[]).includes(c));

  const positive = allConditions.filter(c => isPositiveCondition(c));
  const negative = allConditions.filter(c => isNegativeCondition(c));

  const isActive = (name: ConditionName) =>
    activeConditions.some(c => c.name === name && c.state !== 'removed' && !c.expired);

  const handleToggle = (name: ConditionName) => {
    onToggle(name);
    onClose();
  };

  return (
    <div class="phone-picker-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div class="phone-picker" onClick={(e) => e.stopPropagation()}>
        <div class="phone-picker__header">
          <span class="phone-picker__title">Conditions</span>
          <button class="phone-picker__close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {positive.length > 0 && (
          <div class="phone-picker__section">
            <span class="phone-picker__section-label">Positive</span>
            <div class="phone-picker__grid">
              {positive.map(name => (
                <button
                  key={name}
                  class={`phone-picker__tile ${isActive(name) ? 'phone-picker__tile--active' : ''}`}
                  onClick={() => handleToggle(name)}
                  aria-label={`${isActive(name) ? 'Remove' : 'Add'} ${name}`}
                  aria-pressed={isActive(name)}
                >
                  <img src={conditionIcon(name)} alt="" width={40} height={40} loading="lazy" />
                  <span class="phone-picker__name">{formatName(name)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div class="phone-picker__section">
          <span class="phone-picker__section-label">Negative</span>
          <div class="phone-picker__grid">
            {negative.map(name => (
              <button
                key={name}
                class={`phone-picker__tile phone-picker__tile--negative ${isActive(name) ? 'phone-picker__tile--active' : ''}`}
                onClick={() => handleToggle(name)}
                aria-label={`${isActive(name) ? 'Remove' : 'Add'} ${name}`}
                aria-pressed={isActive(name)}
              >
                <img src={conditionIcon(name)} alt="" width={40} height={40} loading="lazy" />
                <span class="phone-picker__name">{formatName(name)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
