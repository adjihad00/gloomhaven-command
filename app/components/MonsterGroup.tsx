import { h } from 'preact';
import type { Monster, MonsterLevelStats, MonsterAbilityCard } from '@gloomhaven-command/shared';
import { monsterThumbnail } from '../shared/assets';
import { formatName } from '../shared/formatName';
import { MonsterStatCard } from './MonsterStatCard';
import { MonsterStandeeRow } from './MonsterStandeeRow';

interface MonsterGroupProps {
  monster: Monster;
  monsterStats?: { normal: MonsterLevelStats | null; elite: MonsterLevelStats | null };
  abilityCard?: MonsterAbilityCard | null;
  isActive: boolean;
  isDone: boolean;
  readonly?: boolean;
}

function AbilityCardDisplay({ card, stats }: { card: MonsterAbilityCard; stats?: { normal: MonsterLevelStats | null; elite: MonsterLevelStats | null } }) {
  return (
    <div class="ability-card">
      <span class="ability-card__initiative">{card.initiative}</span>
      <div class="ability-card__actions">
        {card.actions.map((action, i) => {
          let display = `${action.type}: ${action.value}`;
          if (action.valueType === 'plus' && stats?.normal) {
            const baseStat = action.type === 'move' ? stats.normal.movement
              : action.type === 'attack' ? stats.normal.attack
              : null;
            if (baseStat !== null) {
              display = `${action.type}: ${baseStat} + ${action.value} = ${baseStat + Number(action.value)}`;
            }
          }
          return <span key={i} class="ability-card__action">{display}</span>;
        })}
      </div>
      {card.shuffle && <span class="ability-card__shuffle">&#x21BB;</span>}
    </div>
  );
}

export function MonsterGroup({ monster, monsterStats, abilityCard, isActive, isDone, readonly }: MonsterGroupProps) {
  const { name, edition, entities, level } = monster;
  const stateClass = isDone ? 'done' : isActive ? 'active' : '';

  const sorted = [...entities].sort((a, b) => a.number - b.number);

  return (
    <div class={`monster-group ${stateClass}`}>
      {/* Header */}
      <div class="monster-group__header">
        <img src={monsterThumbnail(edition, name)} alt={name} class="monster-group__thumb" />
        <span class="monster-group__name">{formatName(name)}</span>
        {abilityCard && <span class="monster-group__init">{abilityCard.initiative}</span>}
      </div>

      {/* Stat card */}
      {monsterStats && (
        <MonsterStatCard
          normal={monsterStats.normal}
          elite={monsterStats.elite}
          level={level}
          monsterName={formatName(name)}
        />
      )}

      {/* Ability card */}
      {abilityCard && <AbilityCardDisplay card={abilityCard} stats={monsterStats} />}

      {/* Standees */}
      <div class="monster-group__standees">
        {sorted.map(entity => (
          <MonsterStandeeRow
            key={entity.number}
            entity={entity}
            monsterName={name}
            monsterEdition={edition}
            readonly={readonly}
          />
        ))}
      </div>
    </div>
  );
}
