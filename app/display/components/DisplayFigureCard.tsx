import { h } from 'preact';
import type { Character, Monster, MonsterEntity, EntityCondition } from '@gloomhaven-command/shared';
import type { MonsterLevelStats, MonsterStatAction } from '@gloomhaven-command/shared';
import type { MonsterAbilityAction } from '@gloomhaven-command/shared';
import { characterThumbnail, monsterThumbnail, conditionIcon, actionIcon, elementIcon } from '../../shared/assets';
import { formatName } from '../../shared/formatName';
import { getCharacterTheme } from '../../shared/characterThemes';
import type { DisplayAbility, DisplayBaseStats } from '../hooks/useDisplayMonsterData';

// ── Types for real monster stat data ───────────────────────────────────────

export interface MonsterInnateStats {
  flying: boolean;
  normalStats: MonsterLevelStats | null;
  eliteStats: MonsterLevelStats | null;
}

interface DisplayFigureCardProps {
  type: 'character' | 'monster';
  name: string;
  edition: string;
  initiative: number;
  active: boolean;
  done: boolean;
  compact?: boolean;
  phase?: string;  // 'draw' | 'next' — used to hide initiatives during draw phase
  character?: Character;
  monster?: Monster;
  ability?: DisplayAbility;
  baseStats?: DisplayBaseStats;
  innateStats?: MonsterInnateStats;
}

function hpColor(ratio: number): string {
  if (ratio > 0.5) return 'high';
  if (ratio > 0.25) return 'mid';
  return 'low';
}

function ActiveConditions({ conditions, size = 24 }: { conditions: EntityCondition[]; size?: number }) {
  const active = conditions.filter(c => c.state !== 'removed' && !c.expired);
  if (active.length === 0) return null;
  return (
    <div class="figure-card__conditions">
      {active.map(c => (
        <img key={c.name} src={conditionIcon(c.name)} alt={c.name}
          width={size} height={size} class="figure-card__condition-icon" />
      ))}
    </div>
  );
}

// ── Monster Ability Actions (totalized with icons) ──────────────────────────

/** Types where the value is numeric and can be totalized against base stats */
const TOTALIZABLE_TYPES = new Set(['move', 'attack', 'range']);
/** Types where the value is numeric and should show icon + value */
const NUMERIC_ACTION_TYPES = new Set([
  'move', 'attack', 'range', 'shield', 'heal', 'retaliate',
  'pierce', 'push', 'pull', 'loot', 'target', 'damage', 'suffer',
]);

function renderAction(
  action: MonsterAbilityAction,
  baseStats: DisplayBaseStats | undefined,
  index: number,
  isSub?: boolean,
): h.JSX.Element | null {
  const val = typeof action.value === 'number' ? action.value : parseInt(String(action.value), 10);
  const isNumeric = NUMERIC_ACTION_TYPES.has(action.type) && !isNaN(val);
  const canTotalize = TOTALIZABLE_TYPES.has(action.type) && !isNaN(val);
  const isAdditive = action.valueType === 'plus' || action.valueType === 'minus';
  const modClass = isSub ? ' figure-card__ability-action--sub' : '';

  // Condition action — colored icon, no value
  if (action.type === 'condition') {
    return (
      <div key={index} class={`figure-card__ability-action figure-card__ability-action--condition${modClass}`}>
        <img src={conditionIcon(String(action.value))} alt={String(action.value)}
          class="figure-card__ability-icon" />
      </div>
    );
  }

  // Element infuse — colored icon
  if (action.type === 'element') {
    return (
      <div key={index} class={`figure-card__ability-action figure-card__ability-action--element${modClass}`}>
        <img src={elementIcon(String(action.value))} alt={String(action.value)}
          class="figure-card__ability-icon" />
      </div>
    );
  }

  // Element consume — dimmed icon
  if (action.type === 'elementHalf') {
    const elName = String(action.value).split(':')[0];
    return (
      <div key={index} class={`figure-card__ability-action figure-card__ability-action--consume${modClass}`}>
        <img src={elementIcon(elName)} alt={`Consume ${elName}`}
          class="figure-card__ability-icon" />
      </div>
    );
  }

  // Summon — icon + monster name
  if (action.type === 'summon') {
    const summonName = action.valueObject?.[0]?.monster?.name;
    return (
      <div key={index} class={`figure-card__ability-action${modClass}`}>
        <span class="figure-card__ability-summon-name">
          Summon{summonName ? ` ${formatName(summonName)}` : ''}
        </span>
      </div>
    );
  }

  // Numeric actions — icon + totalized value
  if (isNumeric) {
    let normalTotal = val;
    let eliteTotal = val;
    if (canTotalize && isAdditive && baseStats) {
      const nBase = baseStats.normal[action.type];
      const eBase = baseStats.elite[action.type];
      if (nBase != null) normalTotal = nBase + val;
      if (eBase != null) eliteTotal = eBase + val;
    }
    const showBoth = normalTotal !== eliteTotal;

    return (
      <div key={index} class={`figure-card__ability-action${modClass}`}>
        <img src={actionIcon(action.type)} alt={action.type}
          class="figure-card__ability-icon" />
        {showBoth ? (
          <span class="figure-card__ability-values">
            <span class="figure-card__ability-value--normal">{normalTotal}</span>
            <span class="figure-card__ability-sep">/</span>
            <span class="figure-card__ability-value--elite">{eliteTotal}</span>
          </span>
        ) : (
          <span class="figure-card__ability-value--normal">{normalTotal}</span>
        )}
        {/* Render inline sub-actions (e.g., range after attack) */}
        {action.subActions?.map((sub, si) => renderAction(sub, baseStats, si, true))}
      </div>
    );
  }

  // Skip layout-only / internal types
  if (['specialTarget', 'area', 'grant', 'custom'].includes(action.type)) {
    return null;
  }

  // Unknown type — text fallback
  return (
    <div key={index} class={`figure-card__ability-action${modClass}`}>
      <span class="figure-card__ability-value--normal">
        {action.type.charAt(0).toUpperCase() + action.type.slice(1)}
        {action.value != null && action.value !== '' ? ` ${action.value}` : ''}
      </span>
    </div>
  );
}

function MonsterAbilityActions({ ability, baseStats, abilityName }: {
  ability: DisplayAbility;
  baseStats?: DisplayBaseStats;
  abilityName?: string;
}) {
  return (
    <div class="figure-card__ability-card">
      {abilityName && (
        <div class="figure-card__ability-name">{abilityName}</div>
      )}
      <div class="figure-card__ability-actions">
        {ability.actions.map((action, i) => renderAction(action, baseStats, i))}
        {ability.shuffle && (
          <div class="figure-card__ability-shuffle" title="Shuffle after round">{'\u27F3'}</div>
        )}
      </div>
    </div>
  );
}

// ── Monster Standee Mini-Card ───────────────────────────────────────────────

export function StandeeMiniCard({ entity, edition, monsterName }: {
  entity: MonsterEntity;
  edition: string;
  monsterName: string;
}) {
  const isElite = entity.type === 'elite';
  const hpRatio = entity.maxHealth > 0 ? entity.health / entity.maxHealth : 0;
  const activeConditions = entity.entityConditions.filter(c => c.state !== 'removed' && !c.expired);

  return (
    <div class={`standee-mini ${isElite ? 'standee-mini--elite' : 'standee-mini--normal'}`}>
      <img src={monsterThumbnail(edition, monsterName)} alt=""
        class="standee-mini__portrait" />
      <div class="standee-mini__number">{entity.number}</div>
      <div class="standee-mini__hp-bar">
        <div class={`standee-mini__hp-fill standee-mini__hp-fill--${hpColor(hpRatio)}`}
          style={{ width: `${hpRatio * 100}%` }} />
      </div>
      <div class="standee-mini__hp-text">{entity.health}/{entity.maxHealth}</div>
      {activeConditions.length > 0 && (
        <div class="standee-mini__conditions">
          {activeConditions.map(c => (
            <img key={c.name} src={conditionIcon(c.name)} alt={c.name}
              width={16} height={16} class="standee-mini__condition" />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Innate Abilities Row (from real stat data) ─────────────────────────────

// Render a single stat action (shield, retaliate) with optional range sub-action
function StatActionItem({ action, eliteColored }: { action: MonsterStatAction; eliteColored?: boolean }) {
  const rangeSub = action.subActions?.find(s => s.type === 'range');
  const valClass = eliteColored ? 'figure-card__innate-value--elite' : 'figure-card__innate-value';
  return (
    <div class="figure-card__innate-item">
      <img src={actionIcon(action.type)} alt={action.type} class="figure-card__innate-icon" />
      <span class={valClass}>{action.value}</span>
      {rangeSub && (
        <span class="figure-card__innate-range">
          <img src={actionIcon('range')} alt="range" class="figure-card__innate-icon" />
          <span class={valClass}>{rangeSub.value}</span>
        </span>
      )}
    </div>
  );
}

function InnateAbilitiesRow({ innateStats }: { innateStats: MonsterInnateStats }) {
  const items: h.JSX.Element[] = [];

  // Flying
  if (innateStats.flying) {
    items.push(
      <div key="fly" class="figure-card__innate-item">
        <img src={actionIcon('fly')} alt="Flying" class="figure-card__innate-icon" />
      </div>
    );
  }

  const normalActions = innateStats.normalStats?.actions || [];
  const eliteActions = innateStats.eliteStats?.actions || [];

  // Collect conditions (shared across normal/elite)
  const conditionNames = new Set<string>();
  for (const a of [...normalActions, ...eliteActions].filter(a => a.type === 'condition')) {
    conditionNames.add(String(a.value));
  }
  for (const cName of conditionNames) {
    items.push(
      <div key={`cond-${cName}`} class="figure-card__innate-item figure-card__innate-attack-condition">
        <img src={actionIcon('attack')} alt="Attack" class="figure-card__innate-icon" />
        <img src={conditionIcon(cName)} alt={cName} class="figure-card__innate-condition-badge" />
      </div>
    );
  }

  // Shield and retaliate — show per-type when they differ
  const statTypes = ['shield', 'retaliate'] as const;
  for (const statType of statTypes) {
    const normalAction = normalActions.find(a => a.type === statType);
    const eliteAction = eliteActions.find(a => a.type === statType);

    if (normalAction && eliteAction) {
      // Both have it — check if same value
      const sameValue = normalAction.value === eliteAction.value;
      const sameRange = JSON.stringify(normalAction.subActions) === JSON.stringify(eliteAction.subActions);
      if (sameValue && sameRange) {
        // Identical — show once with single icon
        items.push(<StatActionItem key={statType} action={normalAction} />);
      } else {
        // Different — single icon, dual colored values (white normal / gold elite)
        const normalRange = normalAction.subActions?.find(s => s.type === 'range');
        const eliteRange = eliteAction.subActions?.find(s => s.type === 'range');
        items.push(
          <div key={statType} class="figure-card__innate-item">
            <img src={actionIcon(statType)} alt={statType} class="figure-card__innate-icon" />
            <span class="figure-card__innate-value">{normalAction.value}</span>
            <span class="figure-card__innate-sep">/</span>
            <span class="figure-card__innate-value--elite">{eliteAction.value}</span>
            {(normalRange || eliteRange) && (
              <span class="figure-card__innate-range">
                <img src={actionIcon('range')} alt="range" class="figure-card__innate-icon" />
                {normalRange && eliteRange && normalRange.value !== eliteRange.value ? (
                  <>
                    <span class="figure-card__innate-value">{normalRange.value}</span>
                    <span class="figure-card__innate-sep">/</span>
                    <span class="figure-card__innate-value--elite">{eliteRange.value}</span>
                  </>
                ) : (
                  <span class={eliteRange && !normalRange ? 'figure-card__innate-value--elite' : 'figure-card__innate-value'}>
                    {(normalRange || eliteRange)!.value}
                  </span>
                )}
              </span>
            )}
          </div>
        );
      }
    } else if (normalAction) {
      // Normal only — white
      items.push(<StatActionItem key={`n-${statType}`} action={normalAction} />);
    } else if (eliteAction) {
      // Elite only — gold
      items.push(<StatActionItem key={`e-${statType}`} action={eliteAction} eliteColored />);
    }
  }

  // Immunities
  const normalImmunities = innateStats.normalStats?.immunities || [];
  const eliteImmunities = innateStats.eliteStats?.immunities || [];
  const allImmunities = new Set([...normalImmunities, ...eliteImmunities]);

  if (allImmunities.size > 0) {
    items.push(
      <div key="immunities" class="figure-card__innate-item figure-card__innate-item--immunities">
        <span class="figure-card__innate-immunity-label">Immune:</span>
        {[...allImmunities].map(imm => (
          <img key={imm} src={conditionIcon(imm)} alt={`Immune: ${imm}`}
            class="figure-card__innate-icon figure-card__innate-icon--immunity" />
        ))}
      </div>
    );
  }

  if (items.length === 0) return null;
  return <div class="figure-card__innate-row">{items}</div>;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function DisplayFigureCard({
  type, name, edition, initiative, active, done, compact, phase,
  character, monster, ability, baseStats, innateStats,
}: DisplayFigureCardProps) {
  const stateClass = active ? 'figure-card--active' : done ? 'figure-card--done' : '';
  const thumbnail = type === 'character'
    ? characterThumbnail(edition, name)
    : monsterThumbnail(edition, name);

  // ── Compact Character Card ──
  if (compact && type === 'character' && character) {
    const hpRatio = character.maxHealth > 0 ? character.health / character.maxHealth : 0;
    const theme = getCharacterTheme(name);
    const charStyle = {
      '--char-accent': theme.accent,
      '--char-flair': theme.flair,
      '--char-bg': theme.bg,
    } as any;
    return (
      <div class="figure-card figure-card--character figure-card--compact" style={charStyle}>
        <img src={thumbnail} alt={name} class="figure-card__portrait figure-card__portrait--compact"
          data-character-name={name} />
        <div class="figure-card__info figure-card__info--compact">
          <div class="figure-card__hp-bar figure-card__hp-bar--compact">
            <div class={`figure-card__hp-fill figure-card__hp-fill--${hpColor(hpRatio)}`}
              style={{ width: `${hpRatio * 100}%` }} />
          </div>
          <div class="figure-card__hp-text">{character.health}/{character.maxHealth}</div>
          <ActiveConditions conditions={character.entityConditions} size={18} />
        </div>
      </div>
    );
  }

  // ── Compact Monster Card ──
  if (compact && type === 'monster' && monster) {
    // Collect shield/retaliate from both innate stats AND ability card
    const normalActions = innateStats?.normalStats?.actions || [];
    const eliteActions = innateStats?.eliteStats?.actions || [];
    const allStatActions = [...normalActions, ...eliteActions];

    // Ability card shield/retaliate (from drawn card)
    const abilityShield = ability?.actions.find(a => a.type === 'shield');
    const abilityRetaliate = ability?.actions.find(a => a.type === 'retaliate');

    // Innate shield/retaliate
    const innateShield = allStatActions.find(a => a.type === 'shield');
    const innateRetaliate = allStatActions.find(a => a.type === 'retaliate');

    return (
      <div class="figure-card figure-card--monster figure-card--compact">
        <img src={thumbnail} alt={name} class="figure-card__portrait figure-card__portrait--compact" />
        <div class="figure-card__info figure-card__info--compact">
          {innateStats?.flying && (
            <img src={actionIcon('fly')} alt="Flying" class="figure-card__innate-icon" />
          )}
          {(innateShield || abilityShield) && (
            <div class="figure-card__innate-item">
              <img src={actionIcon('shield')} alt="shield" class="figure-card__innate-icon" />
              <span class="figure-card__innate-value">
                {(innateShield ? Number(innateShield.value) : 0) + (abilityShield ? Number(abilityShield.value) : 0)}
              </span>
            </div>
          )}
          {(innateRetaliate || abilityRetaliate) && (
            <div class="figure-card__innate-item">
              <img src={actionIcon('retaliate')} alt="retaliate" class="figure-card__innate-icon" />
              <span class="figure-card__innate-value">
                {(innateRetaliate ? Number(innateRetaliate.value) : 0) + (abilityRetaliate ? Number(abilityRetaliate.value) : 0)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Character Card ──
  if (type === 'character' && character) {
    const hpRatio = character.maxHealth > 0 ? character.health / character.maxHealth : 0;
    const theme = getCharacterTheme(name);
    const charStyle = {
      '--char-accent': theme.accent,
      '--char-flair': theme.flair,
      '--char-bg': theme.bg,
    } as any;
    return (
      <div class={`figure-card figure-card--character ${stateClass}`} style={charStyle}>
        <div class={`figure-card__initiative${phase === 'draw' && initiative > 0 && !character.longRest ? ' figure-card__initiative--hidden' : ''}`}>
          {phase === 'draw'
            ? (initiative === 0 ? '' : character.longRest ? '99' : '??')
            : initiative}
        </div>
        <img src={thumbnail} alt={name} class="figure-card__portrait"
          data-character-name={name} />
        <div class="figure-card__info">
          <div class="figure-card__name-row">
            <div class="figure-card__name">{formatName(name)}</div>
            <div class="figure-card__counters">
              <span class="figure-card__xp">
                <img src={actionIcon('card/experience')} alt="XP" class="figure-card__counter-icon" />
                {character.experience}
              </span>
              <span class="figure-card__loot">
                <img src={actionIcon('loot')} alt="Loot" class="figure-card__counter-icon" />
                {character.loot}
              </span>
            </div>
          </div>
          <div class="figure-card__subtitle">Level {character.level}</div>
          <div class="figure-card__hp-bar">
            <div class={`figure-card__hp-fill figure-card__hp-fill--${hpColor(hpRatio)}`}
              style={{ width: `${hpRatio * 100}%` }} />
          </div>
          <div class="figure-card__stats">
            <span class="figure-card__hp-text">{character.health}/{character.maxHealth}</span>
            <ActiveConditions conditions={character.entityConditions} />
          </div>
        </div>
      </div>
    );
  }

  // ── Monster Card (header only — standees rendered externally) ──
  if (type === 'monster' && monster) {
    // Sort standees: elites first (ascending #), then normals (ascending #)
    const livingEntities = monster.entities
      .filter(e => !e.dead)
      .sort((a, b) => {
        if (a.type === 'elite' && b.type !== 'elite') return -1;
        if (a.type !== 'elite' && b.type === 'elite') return 1;
        return a.number - b.number;
      });

    return (
      <div class="figure-group">
        <div class={`figure-card figure-card--monster ${stateClass}`}>
          <div class="figure-card__initiative">{phase === 'draw' ? '' : initiative}</div>
          <img src={thumbnail} alt={name} class="figure-card__portrait" />
          <div class="figure-card__monster-info">
            <div class="figure-card__name">{formatName(name)}</div>
            {innateStats && <InnateAbilitiesRow innateStats={innateStats} />}
          </div>
          {ability && (
            <MonsterAbilityActions
              ability={ability}
              baseStats={baseStats}
              abilityName={ability.name}
            />
          )}
        </div>

        {livingEntities.length > 0 && (
          <div class="figure-group__standees">
            {livingEntities.map(entity => (
              <StandeeMiniCard
                key={entity.number}
                entity={entity}
                edition={edition}
                monsterName={name}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}
