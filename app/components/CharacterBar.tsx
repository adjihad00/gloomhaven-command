import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { Character, EntityCondition, ConditionName } from '@gloomhaven-command/shared';
import { isNegativeCondition } from '@gloomhaven-command/shared';
import { useCommands } from '../hooks/useCommands';
import { characterThumbnail, conditionIcon } from '../shared/assets';
import { formatName } from '../shared/formatName';
import { InitiativeDisplay } from './InitiativeDisplay';
import { InitiativeNumpad } from '../controller/overlays/InitiativeNumpad';
import { ConditionIcons } from './ConditionIcons';
import { HeartIcon, StarIcon, CoinIcon, PawIcon } from './Icons';

interface CharacterBarProps {
  character: Character;
  edition: string;
  isActive: boolean;
  isDone: boolean;
  isDrawPhase: boolean;
  availableConditions?: ConditionName[];
  readonly?: boolean;
  characterColor?: string;
  onOpenDetail?: () => void;
}

function isConditionActive(conditions: EntityCondition[], name: string): boolean {
  return conditions.some(
    c => c.name === name && !c.expired && c.state !== 'removed' && c.state !== 'expire'
  );
}

export function CharacterBar({ character, edition, isActive, isDone, isDrawPhase, availableConditions, readonly, characterColor, onOpenDetail }: CharacterBarProps) {
  const commands = useCommands();
  const { name, health, maxHealth, initiative, experience, loot, exhausted, longRest, summons, entityConditions } = character;
  const ed = character.edition || edition;
  const [showNumpad, setShowNumpad] = useState(false);

  const target = { type: 'character' as const, name, edition: ed };

  const hpPercent = maxHealth > 0 ? (health / maxHealth) * 100 : 0;
  const hpColor = hpPercent > 50 ? 'var(--health-green)'
    : hpPercent > 25 ? '#c8a92c' : 'var(--negative-red)';

  const liveSummons = summons.filter(s => !s.dead);

  if (exhausted) {
    return (
      <div class="char-card exhausted">
        <div class="char-header" style={{ background: 'var(--text-muted)' }}>
          <span class="char-name">{formatName(name)}</span>
          <span class="char-hp-text">EXHAUSTED</span>
        </div>
      </div>
    );
  }

  return (
    <div
      class={`char-card ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
      style={{ '--char-color': characterColor || 'var(--accent-copper)' } as any}
    >
      {/* HP Bar Header */}
      <div class="char-header" onClick={onOpenDetail}>
        <div class="char-hp-bar" style={{ width: `${hpPercent}%`, background: hpColor }} />
        <span class="char-name">{formatName(name)}</span>
        <span class="char-hp-text">{health}/{maxHealth}</span>
      </div>

      {/* Body */}
      <div class="char-body">
        {/* Main Row: portrait, initiative, HP +/- */}
        <div class="char-main-row">
          <img
            src={characterThumbnail(ed, name)}
            alt={formatName(name)}
            class="char-portrait"
            onClick={() => !readonly && commands.toggleTurn({ type: 'character', name, edition: ed })}
            title={isActive ? 'End turn' : isDone ? 'Turn complete' : 'Activate'}
          />

          <div
            class={`char-init-area ${isDrawPhase && !readonly ? 'char-init-area--editable' : ''}`}
            onClick={() => isDrawPhase && !readonly && setShowNumpad(true)}
          >
            <InitiativeDisplay
              value={initiative}
              editable={false}
              longRest={longRest}
            />
          </div>

          {!readonly && (
            <div class="char-hp-control">
              <button class="hp-btn minus" aria-label="Decrease health"
                onClick={() => commands.changeHealth(target, -1)}>−</button>
              <HeartIcon size={16} class="hp-icon" />
              <button class="hp-btn plus" aria-label="Increase health"
                onClick={() => commands.changeHealth(target, 1)}>+</button>
            </div>
          )}
        </div>

        {/* Condition Toggles — inline on card */}
        {!readonly && (
          <ConditionRow
            conditions={entityConditions}
            target={target}
            availableConditions={availableConditions}
          />
        )}
        {readonly && entityConditions.some(c => !c.expired && c.state !== 'removed') && (
          <ConditionIcons conditions={entityConditions} size={20} />
        )}

        {/* XP + Loot counters */}
        <div class="char-counters">
          <span class="counter" onClick={() => !readonly && commands.setExperience(name, ed, experience + 1)}>
            <StarIcon size={14} /> {experience || 0}
          </span>
          <span class="counter" onClick={() => !readonly && commands.setLoot(name, ed, loot + 1)}>
            <CoinIcon size={14} /> {loot || 0}
          </span>
          {liveSummons.length > 0 && (
            <span class="counter summon-badge"><PawIcon size={14} /> {liveSummons.length}</span>
          )}
        </div>

        {/* Summon summaries */}
        {liveSummons.map(summon => (
          <SummonSummary
            key={summon.uuid}
            summon={summon}
            characterName={name}
            characterEdition={ed}
            readonly={readonly}
          />
        ))}
      </div>

      {showNumpad && (
        <InitiativeNumpad
          characterName={name}
          currentInitiative={initiative}
          onSet={(value) => {
            commands.setInitiative(name, ed, value);
            setShowNumpad(false);
          }}
          onLongRest={() => {
            commands.toggleLongRest(name, ed);
            setShowNumpad(false);
          }}
          onClose={() => setShowNumpad(false)}
        />
      )}
    </div>
  );
}

// ── ConditionRow ────────────────────────────────────────────────────────────

const DEFAULT_CONDITIONS: ConditionName[] = [
  'stun', 'immobilize', 'disarm', 'wound', 'muddle', 'poison',
  'strengthen', 'invisible', 'regenerate', 'ward',
];

function ConditionRow({ conditions, target, availableConditions }: {
  conditions: EntityCondition[];
  target: { type: 'character'; name: string; edition: string };
  availableConditions?: ConditionName[];
}) {
  const commands = useCommands();

  // Use edition-filtered conditions, excluding bless/curse (deck-only)
  const deckOnly = new Set(['bless', 'curse']);
  const toShow = (availableConditions || DEFAULT_CONDITIONS).filter(n => !deckOnly.has(n));

  const negatives = toShow.filter(n => isNegativeCondition(n));
  const positives = toShow.filter(n => !isNegativeCondition(n));

  const renderBtn = (name: ConditionName) => {
    const active = isConditionActive(conditions, name);
    const positive = !isNegativeCondition(name);
    return (
      <button
        key={name}
        class={`cond-btn ${active ? (positive ? 'active-pos' : 'active-neg') : ''}`}
        onClick={() => commands.toggleCondition(target, name)}
        title={name}
      >
        <img src={conditionIcon(name)} alt={name} class="cond-icon" />
      </button>
    );
  };

  return (
    <div class="condition-rows">
      <div class="condition-row">{negatives.map(renderBtn)}</div>
      {positives.length > 0 && (
        <div class="condition-row">{positives.map(renderBtn)}</div>
      )}
    </div>
  );
}

// ── SummonSummary ───────────────────────────────────────────────────────────

function SummonSummary({ summon, characterName, characterEdition, readonly }: {
  summon: { uuid: string; name: string; health: number; maxHealth: number; entityConditions: EntityCondition[] };
  characterName: string;
  characterEdition: string;
  readonly?: boolean;
}) {
  const commands = useCommands();
  const target = { type: 'summon' as const, characterName, characterEdition, summonUuid: summon.uuid };

  return (
    <div class="summon-summary">
      <span class="summon-name">{formatName(summon.name)}</span>
      <span class="summon-hp">{summon.health}/{summon.maxHealth}</span>
      {!readonly && (
        <>
          <button class="hp-btn mini minus" aria-label="Decrease summon health"
            onClick={() => commands.changeHealth(target, -1)}>−</button>
          <button class="hp-btn mini plus" aria-label="Increase summon health"
            onClick={() => commands.changeHealth(target, 1)}>+</button>
        </>
      )}
      <ConditionIcons conditions={summon.entityConditions || []} size={16} />
    </div>
  );
}
