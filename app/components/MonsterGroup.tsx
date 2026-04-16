import { h } from 'preact';
import { useState, useRef } from 'preact/hooks';
import type { Monster, MonsterEntity, MonsterLevelStats, MonsterAbilityCard, MonsterAbilityAction, ConditionName, EntityCondition } from '@gloomhaven-command/shared';
import { isNegativeCondition, getConditionsForEdition } from '@gloomhaven-command/shared';
import { useCommands } from '../hooks/useCommands';
import { monsterThumbnail, conditionIcon } from '../shared/assets';
import { formatName } from '../shared/formatName';
import { ConditionIcons } from './ConditionIcons';

interface MonsterGroupProps {
  monster: Monster;
  monsterStats?: { normal: MonsterLevelStats | null; elite: MonsterLevelStats | null };
  abilityCard?: MonsterAbilityCard | null;
  isActive: boolean;
  isDone: boolean;
  readonly?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── AbilityActions ──────────────────────────────────────────────────────────

function AbilityActions({ card, normalStats, eliteStats }: {
  card: MonsterAbilityCard;
  normalStats: MonsterLevelStats | null;
  eliteStats: MonsterLevelStats | null;
}) {
  return (
    <div class="ability-actions-compact">
      {card.actions.map((action, i) => {
        if (action.type === 'condition') {
          return (
            <span key={i} class="ability-action-pill">
              <span class="condition-val">{String(action.value)}</span>
            </span>
          );
        }

        const label = formatActionType(action.type);

        if (action.valueType === 'plus') {
          const normalBase = getBaseStat(normalStats, action.type);
          const eliteBase = getBaseStat(eliteStats, action.type);
          const val = Number(action.value);

          if (normalBase !== null) {
            const normalResolved = normalBase + val;
            const eliteResolved = eliteBase !== null ? eliteBase + val : null;

            return (
              <span key={i} class="ability-action-pill">
                {label} <span class="normal-val">{normalResolved}</span>
                {eliteResolved !== null && eliteResolved !== normalResolved && (
                  <span class="elite-val">/{eliteResolved}</span>
                )}
              </span>
            );
          }
        }

        return (
          <span key={i} class="ability-action-pill">
            {label} <span class="normal-val">{action.value}</span>
          </span>
        );
      })}
      {card.shuffle && <span class="shuffle-icon">♻</span>}
    </div>
  );
}

// ── StandeeRow ──────────────────────────────────────────────────────────────

function StandeeRow({ entity, monsterName, edition, readonly }: {
  entity: MonsterEntity;
  monsterName: string;
  edition: string;
  readonly?: boolean;
}) {
  const commands = useCommands();
  const target = { type: 'monster' as const, name: monsterName, edition, entityNumber: entity.number };

  const isElite = entity.type === 'elite';
  const isBoss = entity.type === 'boss';
  const activeConditions = (entity.entityConditions || []).filter(
    c => !c.expired && c.state !== 'removed' && c.state !== 'expire'
  );

  return (
    <div class={`standee-row ${isElite ? 'elite' : ''} ${isBoss ? 'boss' : ''}`}>
      <span class={`standee-num ${isElite ? 'elite' : ''} ${isBoss ? 'boss' : ''}`}>
        {entity.number}
      </span>

      <span class={`type-badge ${entity.type}`}>
        {isElite ? 'E' : isBoss ? 'B' : 'N'}
      </span>

      <span class="standee-hp">{entity.health}/{entity.maxHealth}</span>

      {!readonly && (
        <>
          <button class="hp-btn mini minus" aria-label="Decrease health"
            onClick={() => commands.changeHealth(target, -1)}>−</button>
          {activeConditions.some(c => c.name === 'poison' || c.name === 'poison_x') && (
            <span class="poison-reminder" title="Poison: +1 damage per attack">+1</span>
          )}
          <button class="hp-btn mini plus" aria-label="Increase health"
            onClick={() => commands.changeHealth(target, 1)}>+</button>
        </>
      )}

      <div class="standee-conditions">
        {activeConditions.map(c => (
          <button key={c.name}
            class={`cond-btn mini ${isNegativeCondition(c.name) ? 'active-neg' : 'active-pos'}`}
            onClick={() => !readonly && commands.toggleCondition(target, c.name)}
            title={`Remove ${c.name}`}
          >
            <img src={conditionIcon(c.name)} alt={c.name} class="cond-icon mini" />
          </button>
        ))}
        {!readonly && (
          <StandeeConditionAdder target={target} existingConditions={activeConditions} />
        )}
      </div>

      {!readonly && !isBoss && (
        <button
          class="standee-remove-btn"
          aria-label={`Remove standee ${entity.number}`}
          onClick={() => commands.removeEntity(monsterName, edition, entity.number, entity.type)}
          title="Remove standee"
        >×</button>
      )}
    </div>
  );
}

// ── StandeeConditionAdder ───────────────────────────────────────────────────

function StandeeConditionAdder({ target, existingConditions }: {
  target: { type: 'monster'; name: string; edition: string; entityNumber: number };
  existingConditions: EntityCondition[];
}) {
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const commands = useCommands();

  const AM_DECK_ONLY = new Set(['bless', 'curse', 'empower', 'enfeeble']);
  const conditionsToShow = getConditionsForEdition(target.edition).filter(
    name => !AM_DECK_ONLY.has(name) && !existingConditions.some(c => c.name === name)
  );

  if (conditionsToShow.length === 0) return null;

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPopupPos({
        top: rect.top - 8,
        left: Math.max(8, rect.right - 200),
      });
    }
    setOpen(!open);
  };

  return (
    <div class="cond-adder">
      <button ref={btnRef} class="cond-add-btn" onClick={handleOpen}
        aria-label="Add condition">+</button>
      {open && popupPos && (
        <div class="cond-adder-portal"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div class="cond-adder-popup"
            style={{
              position: 'fixed',
              bottom: `${window.innerHeight - popupPos.top}px`,
              left: `${popupPos.left}px`,
            }}
          >
            {conditionsToShow.map(name => (
              <button key={name} class="cond-btn mini"
                onClick={() => { commands.toggleCondition(target, name); setOpen(false); }}
                title={name}
              >
                <img src={conditionIcon(name)} alt={name} class="cond-icon mini" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Standee number helper ──────────────────────────────────────────────────

const MAX_STANDEES = 10;

function getNextStandeeNumber(entities: MonsterEntity[]): number {
  const used = new Set(entities.map((e) => e.number));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

// ── MonsterGroup ────────────────────────────────────────────────────────────

export function MonsterGroup({ monster, monsterStats, abilityCard, isActive, isDone, readonly }: MonsterGroupProps) {
  const commands = useCommands();
  const { name, edition, entities } = monster;

  const liveEntities = entities
    .filter(e => !e.dead && e.number !== undefined)
    .sort((a, b) => a.number - b.number);
  const deadEntities = entities
    .filter(e => e.dead)
    .sort((a, b) => a.number - b.number);

  if (liveEntities.length === 0 && deadEntities.length === 0) return null;

  const handleToggleTurn = () => {
    if (!readonly) {
      commands.toggleTurn({ type: 'monster', name, edition });
    }
  };

  const canAddMore = entities.length < MAX_STANDEES;

  const handleAddStandee = (type: 'normal' | 'elite') => {
    const nextNumber = getNextStandeeNumber(entities);
    commands.addEntity(name, edition, nextNumber, type);
  };

  return (
    <div class={`monster-card ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
      {/* Header: portrait + name + ability actions + initiative */}
      <div class="monster-header" onClick={handleToggleTurn}>
        <img
          src={monsterThumbnail(edition, name)}
          alt={formatName(name)}
          class="monster-portrait"
        />
        <div class="monster-info">
          <span class="monster-name">{formatName(name)}</span>
          {abilityCard && (
            <AbilityActions
              card={abilityCard}
              normalStats={monsterStats?.normal ?? null}
              eliteStats={monsterStats?.elite ?? null}
            />
          )}
        </div>
        {abilityCard && (
          <span class="monster-init">{abilityCard.initiative}</span>
        )}
      </div>

      {/* Live standees */}
      <div class="standee-list">
        {liveEntities.map(entity => (
          <StandeeRow
            key={entity.number}
            entity={entity}
            monsterName={name}
            edition={edition}
            readonly={readonly}
          />
        ))}
      </div>

      {/* Add standee controls */}
      {!readonly && canAddMore && (
        <div class="standee-add-row">
          <button
            class="standee-add-btn normal"
            aria-label="Add normal standee"
            onClick={() => handleAddStandee('normal')}
          >+ Normal</button>
          <button
            class="standee-add-btn elite"
            aria-label="Add elite standee"
            onClick={() => handleAddStandee('elite')}
          >+ Elite</button>
        </div>
      )}

      {/* Dead standees — collapsed */}
      {deadEntities.length > 0 && (
        <div class="dead-standees">
          {deadEntities.map(e => (
            <span key={e.number} class="dead-badge">☠{e.number}</span>
          ))}
        </div>
      )}
    </div>
  );
}
