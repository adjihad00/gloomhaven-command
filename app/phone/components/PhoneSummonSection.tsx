import { h } from 'preact';
import { useState } from 'preact/hooks';
import { PawIcon, HealthIcon } from '../../components/Icons';
import { conditionIcon } from '../../shared/assets';
import type { Summon, ConditionName } from '@gloomhaven-command/shared';

interface PhoneSummonSectionProps {
  summons: Summon[];
  characterName: string;
  characterEdition: string;
  onChangeHealth: (summonUuid: string, delta: number) => void;
  onRemoveSummon: (summonUuid: string) => void;
  onToggleCondition: (summonUuid: string, condition: ConditionName) => void;
}

export function PhoneSummonSection({
  summons, characterName, characterEdition,
  onChangeHealth, onRemoveSummon, onToggleCondition,
}: PhoneSummonSectionProps) {
  const liveSummons = summons.filter(s => !s.dead);
  if (liveSummons.length === 0) return null;

  return (
    <div class="phone-summons">
      <div class="phone-summons__header">
        <PawIcon size={16} />
        <span class="phone-summons__title">Summons</span>
      </div>
      {liveSummons.map(s => (
        <PhoneSummonCard
          key={s.uuid}
          summon={s}
          onChangeHealth={(delta) => onChangeHealth(s.uuid, delta)}
          onRemove={() => onRemoveSummon(s.uuid)}
        />
      ))}
    </div>
  );
}

interface PhoneSummonCardProps {
  summon: Summon;
  onChangeHealth: (delta: number) => void;
  onRemove: () => void;
}

function PhoneSummonCard({ summon, onChangeHealth, onRemove }: PhoneSummonCardProps) {
  const [expanded, setExpanded] = useState(false);
  const ratio = summon.maxHealth > 0 ? summon.health / summon.maxHealth : 0;
  const activeConditions = summon.entityConditions.filter(
    c => c.state !== 'removed' && !c.expired
  );

  return (
    <div class="phone-summon-card">
      <button
        class="phone-summon-card__row"
        onClick={() => setExpanded(!expanded)}
        aria-label={`${summon.name} - ${summon.health}/${summon.maxHealth} HP`}
        aria-expanded={expanded}
      >
        <span class="phone-summon-card__name">{summon.name || `Summon #${summon.number}`}</span>
        <div class="phone-summon-card__hp-mini">
          <div class="phone-summon-card__hp-bar" style={{ width: `${ratio * 100}%` }} />
          <span class="phone-summon-card__hp-text">{summon.health}/{summon.maxHealth}</span>
        </div>
        {activeConditions.length > 0 && (
          <div class="phone-summon-card__conditions">
            {activeConditions.map(c => (
              <img key={c.name} src={conditionIcon(c.name)} alt={c.name} width={18} height={18} />
            ))}
          </div>
        )}
      </button>

      {expanded && (
        <div class="phone-summon-card__detail">
          <div class="phone-summon-card__controls">
            <button
              class="phone-summon-card__btn"
              onClick={() => onChangeHealth(-1)}
              disabled={summon.health <= 0}
              aria-label="Decrease summon health"
            >
              &minus;
            </button>
            <span class="phone-summon-card__hp-value">
              <HealthIcon size={14} /> {summon.health}/{summon.maxHealth}
            </span>
            <button
              class="phone-summon-card__btn"
              onClick={() => onChangeHealth(1)}
              disabled={summon.health >= summon.maxHealth}
              aria-label="Increase summon health"
            >
              +
            </button>
          </div>
          <button
            class="phone-summon-card__kill"
            onClick={onRemove}
            aria-label={`Remove ${summon.name}`}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
