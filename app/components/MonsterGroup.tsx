import { h } from 'preact';
import type { Monster, MonsterLevelStats, MonsterAbilityCard, MonsterAbilityAction } from '@gloomhaven-command/shared';
import { useCommands } from '../hooks/useCommands';
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

function getBaseStat(stats: MonsterLevelStats | null, actionType: string): number | null {
  if (!stats) return null;
  switch (actionType) {
    case 'move': return stats.movement ?? null;
    case 'attack': return stats.attack ?? null;
    case 'range': return stats.range ?? null;
    default: return null;
  }
}

function formatActionType(type: string): string {
  const labels: Record<string, string> = {
    move: 'Move', attack: 'Attack', range: 'Range',
    heal: 'Heal', shield: 'Shield', retaliate: 'Retaliate',
    target: 'Target', push: 'Push', pull: 'Pull',
    pierce: 'Pierce',
  };
  return labels[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

function renderActionValue(
  action: MonsterAbilityAction,
  normalStats: MonsterLevelStats | null,
  eliteStats: MonsterLevelStats | null,
): h.JSX.Element {
  if (action.valueType === 'plus') {
    const normalBase = getBaseStat(normalStats, action.type);
    const eliteBase = getBaseStat(eliteStats, action.type);
    const val = Number(action.value);

    if (normalBase !== null) {
      const normalResolved = normalBase + val;
      const eliteResolved = eliteBase !== null ? eliteBase + val : null;

      return (
        <span class="ability-card__values">
          <span class="ability-card__normal-val">{normalResolved}</span>
          {eliteResolved !== null && eliteResolved !== normalResolved && (
            <span class="ability-card__elite-val">{eliteResolved}</span>
          )}
        </span>
      );
    }
  }

  return <span class="ability-card__abs-val">{action.value}</span>;
}

function AbilityCardDisplay({ card, stats }: { card: MonsterAbilityCard; stats?: { normal: MonsterLevelStats | null; elite: MonsterLevelStats | null } }) {
  return (
    <div class="ability-card">
      <span class="ability-card__initiative">{card.initiative}</span>
      <div class="ability-card__actions">
        {card.actions.map((action, i) => (
          <span key={i} class="ability-card__action">
            <span class="ability-card__action-type">{action.type === 'condition' ? '' : formatActionType(action.type)}</span>
            {action.type === 'condition'
              ? <span class="ability-card__condition">{String(action.value)}</span>
              : renderActionValue(action, stats?.normal ?? null, stats?.elite ?? null)
            }
          </span>
        ))}
      </div>
      {card.shuffle && <span class="ability-card__shuffle">&#x21BB;</span>}
    </div>
  );
}

export function MonsterGroup({ monster, monsterStats, abilityCard, isActive, isDone, readonly }: MonsterGroupProps) {
  const commands = useCommands();
  const { name, edition, entities, level } = monster;
  const stateClass = isDone ? 'done' : isActive ? 'active' : '';

  const sorted = [...entities].sort((a, b) => a.number - b.number);

  const handleToggleTurn = () => {
    if (!readonly) {
      commands.toggleTurn({ type: 'monster', name, edition });
    }
  };

  return (
    <div class={`monster-group ${stateClass}`}>
      {/* Header — clickable to toggle turn */}
      <div class="monster-group__header" onClick={handleToggleTurn}>
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
