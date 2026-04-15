import { h } from 'preact';
import type { Character, Monster, MonsterEntity, EntityCondition } from '@gloomhaven-command/shared';
import type { MonsterLevelStats, MonsterStatAction } from '@gloomhaven-command/shared';
import { characterThumbnail, monsterThumbnail, conditionIcon, actionIcon } from '../../shared/assets';
import { formatName } from '../../shared/formatName';
import { getCharacterTheme } from '../../phone/characterThemes';
import type { MockMonsterAbility, MockMonsterBaseStats } from '../mockData';

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
  character?: Character;
  monster?: Monster;
  ability?: MockMonsterAbility;
  baseStats?: MockMonsterBaseStats;
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

function MonsterAbilityActions({ ability, baseStats, abilityName }: {
  ability: MockMonsterAbility;
  baseStats?: MockMonsterBaseStats;
  abilityName?: string;
}) {
  return (
    <div class="figure-card__ability-card">
      {abilityName && (
        <div class="figure-card__ability-name">{abilityName}</div>
      )}
      <div class="figure-card__ability-actions">
        {ability.actions.map((action, i) => {
          const normalBase = baseStats?.normal?.[action.type as keyof typeof baseStats.normal] as number | undefined;
          const eliteBase = baseStats?.elite?.[action.type as keyof typeof baseStats.elite] as number | undefined;
          const normalTotal = normalBase != null ? normalBase + action.value : action.value;
          const eliteTotal = eliteBase != null ? eliteBase + action.value : action.value;
          const showBoth = normalTotal !== eliteTotal;

          return (
            <div key={i} class="figure-card__ability-action">
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
            </div>
          );
        })}
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
        // Identical — show once
        items.push(<StatActionItem key={statType} action={normalAction} />);
      } else {
        // Different — show both labeled
        items.push(
          <div key={statType} class="figure-card__innate-split">
            <StatActionItem action={normalAction} />
            <span class="figure-card__innate-sep">/</span>
            <StatActionItem action={eliteAction} eliteColored />
          </div>
        );
      }
    } else if (normalAction) {
      // Normal only
      items.push(<StatActionItem key={`n-${statType}`} action={normalAction} />);
    } else if (eliteAction) {
      // Elite only — render in gold
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
  type, name, edition, initiative, active, done, compact,
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
                {(innateShield ? Number(innateShield.value) : 0) + (abilityShield ? abilityShield.value : 0)}
              </span>
            </div>
          )}
          {(innateRetaliate || abilityRetaliate) && (
            <div class="figure-card__innate-item">
              <img src={actionIcon('retaliate')} alt="retaliate" class="figure-card__innate-icon" />
              <span class="figure-card__innate-value">
                {(innateRetaliate ? Number(innateRetaliate.value) : 0) + (abilityRetaliate ? abilityRetaliate.value : 0)}
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
        <div class="figure-card__initiative">{initiative}</div>
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
          <div class="figure-card__initiative">{initiative}</div>
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
