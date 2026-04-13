# Batch 2 — Card Layout Redesign

> Paste into Claude Code. Redesigns the CharacterBar, MonsterGroup, and
> FigureList components for compact multi-column layout with inline health
> controls and condition toggles. Fixes B7, B8, L1-L5 from playtest.

---

Read CLAUDE.md, then the playtest issues document at `docs/PLAYTEST_ISSUES.md`
(if committed) or reference these issues:

| # | Issue | Summary |
|---|-------|---------|
| L1 | Multi-column | 3 columns landscape, 2 portrait. Cards currently full-width |
| L2 | Health bar redesign | HP bar as card header behind name. Blood drop +/- below |
| L3 | Remove monster stat card | Controller doesn't need HP/MOV/ATK/RNG. Just portrait, name, ability card, standees |
| L4 | Cards too wide | Narrower, more info density |
| L5 | Conditions on card | Condition toggles directly on card, not just in overlay |
| B7 | HP +/- opens overlay | Need quick HP adjust without opening overlay |
| B8 | Monster standee conditions | No way to add/remove conditions on standees |

Then read ALL current component files:
- `app/components/CharacterBar.tsx` — current character card
- `app/components/MonsterGroup.tsx` — current monster group card
- `app/components/MonsterStandeeRow.tsx` — current standee row
- `app/components/HealthControl.tsx` — current HP +/-
- `app/components/ConditionGrid.tsx` — current condition toggle grid
- `app/components/ConditionIcons.tsx` — current inline condition display
- `app/components/SummonCard.tsx` — current summon display
- `app/components/FigureList.tsx` — current figure list layout
- `app/components/MonsterStatCard.tsx` — current stat card (being removed from controller)
- `app/controller/ScenarioView.tsx` — how components are composed
- `app/controller/overlays/CharacterDetailOverlay.tsx` — current overlay
- `app/shared/styles/components.css` — current component CSS
- `app/controller/styles/controller.css` — current controller CSS

## Design Target

### Character Card — New Layout

```
┌─────────────────────────────────┐
│ ██████████ HP BAR ██████████████│  ← colored bar (green/yellow/red), full width
│ Brute                    10/14  │  ← name L-justified, HP R-justified ON the bar
├─────────────────────────────────┤
│ [portrait] [INIT] 🩸[−][+]     │  ← portrait small, initiative, blood drop +/-
│ [🤕][💀][🔇][🩹][😵][☠]       │  ← condition toggle icons, inline on card
│ [★3 XP] [💰2 Loot]             │  ← XP + loot counters (compact)
│ [🐻 Bear 5/8]                  │  ← summon summary (if any), click for detail
└─────────────────────────────────┘
```

Key changes:
- **HP bar is the card header** — colored bar spanning full width with name
  overlaid left and HP numbers overlaid right
- **Health +/- directly on card** — blood drop icon with − and + buttons.
  No overlay needed for basic HP changes
- **Conditions inline on card** — small toggle icons (24-28px). Tap to
  toggle. Active conditions highlighted. All on the card, no overlay required
  for common conditions
- **Portrait smaller** — 36-40px thumbnail, not the large clickable zone it was
- **Initiative inline** — next to portrait, compact
- **XP and Loot compact** — small counters, tap to increment
- **Summons as summary line** — name + HP, click to expand detail
- **Detail overlay still available** — tap the character name to open full
  detail overlay for less-common actions (mark absent, exhaust, full condition
  grid with modifiers, summon management)

### Monster Group Card — New Layout

```
┌─────────────────────────────────┐
│ [portrait] Bandit Guard  [INIT] │  ← portrait, name, initiative from ability
│ [Move 3/2] [Attack 2/3]        │  ← ability card actions (resolved), compact
├─────────────────────────────────┤
│ ①N 5/5 [−][+] [🤕💀]          │  ← standee: #, type, HP +/-, conditions
│ ②E 9/9 [−][+] [🤕💀🔇]       │  ← elite standee (gold #)
│ ③N 0/5 ☠                       │  ← dead standee (dimmed)
└─────────────────────────────────┘
```

Key changes:
- **No stat card on controller** — HP/MOV/ATK/RNG table removed. Display
  client will show this. Controller just needs portrait + name + ability actions
- **Ability card inline** — initiative number + resolved action values on the
  header row. Compact, not a separate card block
- **Standees are compact rows** — number circle + type badge + HP with +/- +
  condition icons, all on one line per standee
- **Standee conditions clickable** — tap a condition icon on a standee to toggle
  it. This fixes B8
- **Dead standees shown dimmed** at bottom, single line with ☠

### FigureList — Multi-Column Grid

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Spellweaver  │ │ Brute       │ │ Bandit Guard│
│ (character)  │ │ (character)  │ │ (monster)   │
│  ...         │ │  Bear summon│ │  ①②③       │
└─────────────┘ └─────────────┘ └─────────────┘
┌─────────────┐ ┌─────────────┐
│ Living Bones │ │ Cragheart   │
│ (monster)    │ │ (character)  │
│  ①           │ │  ...         │
└─────────────┘ └─────────────┘
```

- **3 columns landscape** (iPad), **2 columns portrait**, **1 column phone**
- Cards fill available width within their column
- Figures ordered by initiative (row-first: fills left to right, then wraps)
- Summons appear inside their parent character's card, not as separate cards
- Column count via CSS grid with `auto-fill, minmax(280px, 1fr)`

## STEP 1 — Redesign CharacterBar component

Rewrite `app/components/CharacterBar.tsx`.

The component name stays `CharacterBar` but the layout changes completely.

### Props

Keep existing props but add what's needed for inline interactions:

```tsx
interface CharacterBarProps {
  character: Character;
  edition: string;
  isActive: boolean;
  isDone: boolean;
  isDrawPhase: boolean;
  onSetInitiative: (value: number) => void;
  onToggleTurn: () => void;
  onOpenDetail: () => void;       // click name → full overlay
  readonly?: boolean;
  characterColor?: string;
}
```

Remove `onChangeHealth`, `onIncrementXP`, `onIncrementLoot` — the component
now calls `useCommands()` directly for all inline interactions (HP +/-, XP tap,
loot tap, condition toggle). This simplifies the prop interface.

### Render structure

```tsx
export function CharacterBar({ character, edition, isActive, isDone, isDrawPhase,
  onSetInitiative, onToggleTurn, onOpenDetail, readonly, characterColor }: CharacterBarProps) {

  const commands = useCommands();
  const target = { type: 'character' as const, name: character.name, edition };

  const hpPercent = character.maxHealth > 0
    ? (character.health / character.maxHealth) * 100 : 0;
  const hpColor = hpPercent > 50 ? 'var(--health-green)'
    : hpPercent > 25 ? '#c8a92c' : 'var(--negative-red)';

  const activeConditions = (character.entityConditions || []).filter(
    c => !c.expired && c.state !== 'removed' && c.state !== 'expire'
  );

  const liveSummons = (character.summons || []).filter(s => !s.dead);

  if (character.exhausted) {
    return (
      <div class={`char-card exhausted`}>
        <div class="char-header" style={{ background: 'var(--text-muted)' }}>
          <span class="char-name">{formatName(character.name)}</span>
          <span class="char-hp-text">EXHAUSTED</span>
        </div>
      </div>
    );
  }

  return (
    <div class={`char-card ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
         style={{ '--char-color': characterColor || 'var(--accent-copper)' }}>

      {/* HP Bar Header */}
      <div class="char-header" onClick={onOpenDetail}>
        <div class="char-hp-bar" style={{ width: `${hpPercent}%`, background: hpColor }} />
        <span class="char-name">{formatName(character.name)}</span>
        <span class="char-hp-text">{character.health}/{character.maxHealth}</span>
      </div>

      {/* Main Row: portrait, initiative, HP +/- */}
      <div class="char-body">
        <div class="char-main-row">
          <img
            src={characterThumbnail(edition, character.name)}
            class="char-portrait"
            onClick={onToggleTurn}
            title={isActive ? 'End turn' : isDone ? 'Turn complete' : 'Activate'}
          />

          <InitiativeDisplay
            value={character.initiative}
            onSetInitiative={onSetInitiative}
            editable={isDrawPhase && !readonly}
            longRest={character.longRest}
            size="normal"
          />

          {!readonly && (
            <div class="char-hp-control">
              <span class="hp-icon">🩸</span>
              <button class="hp-btn minus"
                onClick={() => commands.changeHealth(target, -1)}>−</button>
              <button class="hp-btn plus"
                onClick={() => commands.changeHealth(target, 1)}>+</button>
            </div>
          )}
        </div>

        {/* Condition Toggles — inline on card */}
        {!readonly && (
          <ConditionRow
            conditions={character.entityConditions || []}
            target={target}
            edition={edition}
          />
        )}
        {readonly && activeConditions.length > 0 && (
          <ConditionIcons conditions={character.entityConditions} size={20} />
        )}

        {/* XP + Loot counters */}
        <div class="char-counters">
          <span class="counter" onClick={() => !readonly && commands.changeStat(character.name, edition, 'experience', 1)}>
            ★ {character.experience || 0}
          </span>
          <span class="counter" onClick={() => !readonly && commands.changeStat(character.name, edition, 'loot', 1)}>
            💰 {character.loot || 0}
          </span>
          {liveSummons.length > 0 && (
            <span class="counter summon-badge">
              🐾 {liveSummons.length}
            </span>
          )}
        </div>

        {/* Summon summaries */}
        {liveSummons.map((summon, idx) => (
          <SummonSummary
            key={idx}
            summon={summon}
            summonIndex={character.summons.indexOf(summon)}
            characterName={character.name}
            edition={edition}
            readonly={readonly}
          />
        ))}
      </div>
    </div>
  );
}
```

### ConditionRow sub-component

A compact inline condition toggle row. Shows the most common conditions as
small icons. All toggleable.

```tsx
function ConditionRow({ conditions, target, edition }: {
  conditions: EntityCondition[];
  target: CommandTarget;
  edition: string;
}) {
  const commands = useCommands();

  // Show edition-appropriate conditions
  // GH: stun, immobilize, disarm, wound, muddle, poison, strengthen, invisible
  // FH: adds bane, brittle, impair, ward, regenerate, infect
  // For now show GH conditions; edition-aware filtering can come later
  const conditionsToShow = [
    'stun', 'immobilize', 'disarm', 'wound', 'muddle', 'poison',
    'strengthen', 'invisible', 'regenerate', 'ward'
  ];

  return (
    <div class="condition-row">
      {conditionsToShow.map(name => {
        const isActive = conditions.some(
          c => c.name === name && !c.expired &&
          c.state !== 'removed' && c.state !== 'expire'
        );
        const isPositive = ['strengthen', 'invisible', 'regenerate', 'ward', 'dodge'].includes(name);

        return (
          <button
            key={name}
            class={`cond-btn ${isActive ? (isPositive ? 'active-pos' : 'active-neg') : ''}`}
            onClick={() => commands.toggleCondition(target, name)}
            title={name}
          >
            <img src={conditionIcon(name)} class="cond-icon" />
          </button>
        );
      })}
    </div>
  );
}
```

### SummonSummary sub-component

Compact one-line summon display inside the character card.

```tsx
function SummonSummary({ summon, summonIndex, characterName, edition, readonly }: {
  summon: Summon;
  summonIndex: number;
  characterName: string;
  edition: string;
  readonly?: boolean;
}) {
  const commands = useCommands();
  const target = { type: 'summon' as const, characterName, edition, summonIndex };

  return (
    <div class="summon-summary">
      <span class="summon-name">{formatName(summon.name)}</span>
      <span class="summon-hp">{summon.health}/{summon.maxHealth}</span>
      {!readonly && (
        <>
          <button class="hp-btn mini minus"
            onClick={() => commands.changeHealth(target, -1)}>−</button>
          <button class="hp-btn mini plus"
            onClick={() => commands.changeHealth(target, 1)}>+</button>
        </>
      )}
      <ConditionIcons conditions={summon.entityConditions || []} size={16} />
    </div>
  );
}
```

## STEP 2 — Redesign MonsterGroup component

Rewrite `app/components/MonsterGroup.tsx`.

### Props

Simplify — remove `monsterStats` since we're not showing the stat card on controller.
Keep `abilityCard` for the ability actions display.

```tsx
interface MonsterGroupProps {
  monster: Monster;
  abilityCard?: MonsterAbilityCard | null;
  normalStats?: MonsterLevelStats | null;   // still needed for ability resolution
  eliteStats?: MonsterLevelStats | null;
  isActive: boolean;
  isDone: boolean;
  onToggleTurn: () => void;
  onOpenDetail?: () => void;
  readonly?: boolean;
}
```

### Render structure

```tsx
export function MonsterGroup({ monster, abilityCard, normalStats, eliteStats,
  isActive, isDone, onToggleTurn, onOpenDetail, readonly }: MonsterGroupProps) {

  const liveEntities = monster.entities
    .filter(e => !e.dead && e.number !== undefined)
    .sort((a, b) => a.number - b.number);
  const deadEntities = monster.entities
    .filter(e => e.dead)
    .sort((a, b) => a.number - b.number);

  if (liveEntities.length === 0 && deadEntities.length === 0) return null;

  return (
    <div class={`monster-card ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>

      {/* Header: portrait + name + initiative + ability actions */}
      <div class="monster-header" onClick={onToggleTurn}>
        <img
          src={monsterThumbnail(monster.edition, monster.name)}
          class="monster-portrait"
        />
        <div class="monster-info">
          <span class="monster-name">{formatName(monster.name)}</span>
          {abilityCard && (
            <AbilityActions card={abilityCard} normalStats={normalStats} eliteStats={eliteStats} />
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
            monsterName={monster.name}
            edition={monster.edition}
            readonly={readonly}
          />
        ))}
      </div>

      {/* Dead standees — collapsed */}
      {deadEntities.length > 0 && (
        <div class="dead-standees">
          {deadEntities.map(e => (
            <span key={e.number} class="dead-badge">
              ☠{e.number}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

### AbilityActions sub-component

Compact resolved action display:

```tsx
function AbilityActions({ card, normalStats, eliteStats }: {
  card: MonsterAbilityCard;
  normalStats?: MonsterLevelStats | null;
  eliteStats?: MonsterLevelStats | null;
}) {
  return (
    <div class="ability-actions-compact">
      {card.actions.map((action, i) => {
        const normalVal = resolveActionValue(action, normalStats);
        const eliteVal = resolveActionValue(action, eliteStats);
        const label = formatActionType(action.type);
        if (!label) return null;

        return (
          <span key={i} class="ability-action-pill">
            {label} <span class="normal-val">{normalVal}</span>
            {eliteVal !== normalVal && (
              <span class="elite-val">/{eliteVal}</span>
            )}
          </span>
        );
      })}
      {card.shuffle && <span class="shuffle-icon">♻</span>}
    </div>
  );
}
```

### StandeeRow sub-component (rewritten)

Compact single-line standee with inline condition toggles:

```tsx
function StandeeRow({ entity, monsterName, edition, readonly }: {
  entity: MonsterEntity;
  monsterName: string;
  edition: string;
  readonly?: boolean;
}) {
  const commands = useCommands();
  const target = {
    type: 'monsterEntity' as const,
    monsterName, edition,
    entityNumber: entity.number
  };

  const isElite = entity.type === 'elite';
  const isBoss = entity.type === 'boss';
  const activeConditions = (entity.entityConditions || []).filter(
    c => !c.expired && c.state !== 'removed' && c.state !== 'expire'
  );

  return (
    <div class={`standee-row ${isElite ? 'elite' : ''} ${isBoss ? 'boss' : ''}`}>
      {/* Number circle */}
      <span class={`standee-num ${isElite ? 'elite' : ''} ${isBoss ? 'boss' : ''}`}>
        {entity.number}
      </span>

      {/* Type badge */}
      <span class={`type-badge ${entity.type}`}>
        {isElite ? 'E' : isBoss ? 'B' : 'N'}
      </span>

      {/* HP + controls */}
      <span class="standee-hp">{entity.health}/{entity.maxHealth}</span>
      {!readonly && (
        <>
          <button class="hp-btn mini minus"
            onClick={() => commands.changeHealth(target, -1)}>−</button>
          <button class="hp-btn mini plus"
            onClick={() => commands.changeHealth(target, 1)}>+</button>
        </>
      )}

      {/* Active condition icons — clickable to toggle */}
      <div class="standee-conditions">
        {activeConditions.map(c => (
          <button key={c.name} class="cond-btn mini active-neg"
            onClick={() => !readonly && commands.toggleCondition(target, c.name)}
            title={`Remove ${c.name}`}>
            <img src={conditionIcon(c.name)} class="cond-icon mini" />
          </button>
        ))}
        {/* Add condition button — opens small picker */}
        {!readonly && (
          <StandeeConditionAdder target={target} existingConditions={activeConditions} />
        )}
      </div>
    </div>
  );
}
```

### StandeeConditionAdder sub-component

A small "+" button that expands to show available conditions for adding:

```tsx
function StandeeConditionAdder({ target, existingConditions }: {
  target: CommandTarget;
  existingConditions: EntityCondition[];
}) {
  const [open, setOpen] = useState(false);
  const commands = useCommands();

  const conditionsToShow = NEGATIVE_CONDITIONS.filter(
    name => !existingConditions.some(c => c.name === name)
  );

  if (conditionsToShow.length === 0) return null;

  return (
    <div class="cond-adder">
      <button class="cond-add-btn" onClick={() => setOpen(!open)}>+</button>
      {open && (
        <div class="cond-adder-popup">
          {conditionsToShow.map(name => (
            <button key={name} class="cond-btn mini"
              onClick={() => { commands.toggleCondition(target, name); setOpen(false); }}
              title={name}>
              <img src={conditionIcon(name)} class="cond-icon mini" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

## STEP 3 — Update FigureList for multi-column grid

Rewrite the `FigureList` layout in `app/components/FigureList.tsx`.

The key change: CSS grid with `auto-fill, minmax(280px, 1fr)` instead of a
single-column list. The figure order (initiative-sorted) fills left-to-right,
then wraps to the next row.

```tsx
export function FigureList({ figures, state, monsterStats, monsterAbilities,
  isDrawPhase, readonly, onCharacterDetail }: FigureListProps) {

  return (
    <div class="figure-grid">
      {figures.map(figure => {
        if (figure.type === 'character') {
          const char = state.characters.find(c => c.name === figure.name);
          if (!char || char.absent) return null;
          return (
            <CharacterBar
              key={figure.figureId}
              character={char}
              edition={figure.edition}
              isActive={figure.active}
              isDone={figure.off}
              isDrawPhase={isDrawPhase}
              onSetInitiative={(v) => /* commands.setInitiative */ }
              onToggleTurn={() => /* commands.toggleTurn */ }
              onOpenDetail={() => onCharacterDetail?.(char.name)}
              readonly={readonly}
              characterColor={char.color || undefined}
            />
          );
        }

        if (figure.type === 'monster') {
          const monster = state.monsters.find(m => m.name === figure.name);
          if (!monster) return null;
          const hasLive = monster.entities.some(e => !e.dead);
          if (!hasLive) return null;

          return (
            <MonsterGroup
              key={figure.figureId}
              monster={monster}
              abilityCard={monsterAbilities?.get(monster.name) || null}
              normalStats={monsterStats?.get(monster.name)?.normal || null}
              eliteStats={monsterStats?.get(monster.name)?.elite || null}
              isActive={figure.active}
              isDone={figure.off}
              onToggleTurn={() => /* commands.toggleTurn */ }
              readonly={readonly}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
```

The `onSetInitiative` and `onToggleTurn` callbacks should call the correct
command sender methods. Read `commandSender.ts` to verify exact signatures.
Alternatively, have CharacterBar and MonsterGroup use `useCommands()` directly
(which they now do for HP/conditions) — then the FigureList just passes
identity info and the components handle their own commands.

## STEP 4 — Complete CSS rewrite for card components

Replace the character bar, monster group, and figure list CSS in
`app/shared/styles/components.css`. Write the complete styles.

### Figure grid

```css
.figure-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  padding: 8px;
}

/* Single column on small screens */
@media (max-width: 600px) {
  .figure-grid {
    grid-template-columns: 1fr;
  }
}
```

### Character card

```css
.char-card {
  background: var(--bg-card);
  border: 2px solid var(--char-color, var(--accent-copper));
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: all var(--transition-fast);
}

.char-card.active {
  border-color: var(--accent-gold);
  box-shadow: 0 0 12px var(--accent-gold-dim);
}

.char-card.done {
  opacity: 0.55;
}

.char-card.exhausted {
  opacity: 0.3;
  filter: grayscale(0.8);
}

/* HP bar header */
.char-header {
  position: relative;
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 32px;
  overflow: hidden;
}

.char-hp-bar {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  transition: width 0.3s ease, background 0.3s ease;
  opacity: 0.35;
  z-index: 0;
}

.char-name {
  font-family: 'Cinzel', serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  z-index: 1;
  position: relative;
}

.char-hp-text {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  z-index: 1;
  position: relative;
}

/* Body */
.char-body {
  padding: 8px 10px;
}

.char-main-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.char-portrait {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--char-color, var(--accent-copper));
  cursor: pointer;
  flex-shrink: 0;
}

.char-portrait:hover {
  box-shadow: 0 0 8px var(--accent-gold-dim);
}

/* HP control */
.char-hp-control {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.hp-icon {
  font-size: 1rem;
}

.hp-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--accent-copper);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  /* Prevent double-tap zoom */
  touch-action: manipulation;
}

.hp-btn:active {
  transform: scale(0.9);
}

.hp-btn.minus { color: var(--negative-red); }
.hp-btn.plus { color: var(--health-green); }

.hp-btn.mini {
  width: 24px;
  height: 24px;
  font-size: 0.9rem;
}

/* Condition row */
.condition-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.cond-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1.5px solid transparent;
  background: var(--bg-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  opacity: 0.3;
  transition: all var(--transition-fast);
  touch-action: manipulation;
}

.cond-btn:hover { opacity: 0.6; }

.cond-btn.active-neg {
  opacity: 1;
  border-color: var(--negative-red);
  box-shadow: 0 0 6px rgba(197, 48, 48, 0.4);
}

.cond-btn.active-pos {
  opacity: 1;
  border-color: var(--health-green);
  box-shadow: 0 0 6px rgba(74, 124, 89, 0.4);
}

.cond-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.cond-btn.mini { width: 22px; height: 22px; padding: 2px; }
.cond-icon.mini { }

/* Counters */
.char-counters {
  display: flex;
  gap: 12px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.counter {
  cursor: pointer;
  transition: color var(--transition-fast);
  touch-action: manipulation;
}

.counter:active { color: var(--accent-gold); }

.summon-badge { color: var(--shield-blue); }

/* Summon summary */
.summon-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 0.8rem;
  color: var(--shield-blue);
  border-top: 1px solid var(--bg-secondary);
  margin-top: 4px;
}

.summon-name { font-weight: 600; }
.summon-hp { color: var(--text-muted); }
```

### Monster card

```css
.monster-card {
  background: var(--bg-card);
  border: 2px solid var(--accent-copper);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: all var(--transition-fast);
}

.monster-card.active {
  border-color: var(--accent-gold);
  box-shadow: 0 0 12px var(--accent-gold-dim);
}

.monster-card.done {
  opacity: 0.55;
}

/* Header */
.monster-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-secondary);
  cursor: pointer;
  touch-action: manipulation;
}

.monster-portrait {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--accent-copper);
  flex-shrink: 0;
}

.monster-info {
  flex: 1;
  min-width: 0;
}

.monster-name {
  font-family: 'Cinzel', serif;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--accent-gold);
  display: block;
}

.monster-init {
  font-family: 'Cinzel', serif;
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--accent-gold);
  flex-shrink: 0;
}

/* Ability actions compact */
.ability-actions-compact {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.ability-action-pill {
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 1px 6px;
  border-radius: 3px;
}

.normal-val { color: var(--text-primary); font-weight: 600; }
.elite-val { color: var(--elite-gold); font-weight: 600; }

.shuffle-icon { color: var(--accent-copper); font-size: 0.7rem; margin-left: 4px; }

/* Standee list */
.standee-list {
  padding: 6px 8px;
}

.standee-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid var(--bg-secondary);
}

.standee-row:last-child { border-bottom: none; }

.standee-row.elite { }
.standee-row.boss { }

.standee-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 2px solid var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-primary);
  flex-shrink: 0;
}

.standee-num.elite {
  border-color: var(--elite-gold);
  color: var(--elite-gold);
}

.standee-num.boss {
  border-color: var(--negative-red);
  color: var(--negative-red);
}

.type-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.type-badge.normal { color: var(--text-muted); }
.type-badge.elite { color: var(--elite-gold); }
.type-badge.boss { color: var(--negative-red); }

.standee-hp {
  font-size: 0.85rem;
  color: var(--text-secondary);
  min-width: 35px;
}

.standee-conditions {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
}

/* Condition adder */
.cond-adder {
  position: relative;
}

.cond-add-btn {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px dashed var(--text-muted);
  background: none;
  color: var(--text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  touch-action: manipulation;
}

.cond-adder-popup {
  position: absolute;
  bottom: 100%;
  right: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 6px;
  background: var(--bg-card);
  border: 1px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-medium);
  z-index: 30;
  max-width: 200px;
}

/* Dead standees */
.dead-standees {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 8px;
  opacity: 0.35;
}

.dead-badge {
  font-size: 0.7rem;
  color: var(--negative-red);
}
```

### touch-action: manipulation

Add to ALL interactive elements to prevent double-tap zoom:

```css
button, input, select, [onclick], .counter, .char-portrait,
.monster-header, .door-btn, .element-btn {
  touch-action: manipulation;
}
```

## STEP 5 — Remove MonsterStatCard from controller rendering

Read `app/controller/ScenarioView.tsx` and `app/components/FigureList.tsx`.
If `MonsterStatCard` is rendered anywhere in the controller view, remove those
references. The `MonsterStatCard` component itself stays in `app/components/`
(the display client will use it) — just don't render it on controller.

The `MonsterGroup` component no longer renders a stat card internally. Verify
this is the case after the rewrite.

## STEP 6 — Verify

### Build

```powershell
node app/build.mjs
```

### Boot and test

Import or connect to the test game with characters + monsters.

**Card layout checks:**
1. Figure grid shows multiple columns on iPad landscape (~3 cards across)
2. Cards are compact — not full width
3. Character cards: HP bar header visible with name/HP on the bar
4. Blood drop +/- buttons work for HP changes WITHOUT opening overlay
5. Condition icons visible on character cards
6. Tapping a condition icon toggles it (red/green highlight)
7. XP and Loot counters visible, tap to increment
8. Summon summary line inside character card
9. Tapping character name opens detail overlay (still works)
10. Tapping portrait ends turn (still works)

**Monster card checks:**
11. Monster cards show portrait + name + ability actions (no stat table)
12. Ability card resolved values displayed as compact pills
13. Standee rows are compact: number + type + HP + controls + conditions
14. Standee HP +/- works
15. Active standee conditions shown as icons
16. "+" button on standee opens condition picker
17. Tapping an active condition on standee removes it
18. Dead standees shown as small ☠ badges

**Multi-column checks:**
19. Grid wraps correctly when many figures present
20. Cards maintain readability at 280px minimum width
21. Portrait orientation shows 2 columns (or 1 on phone-width)

**Touch checks:**
22. No double-tap zoom on any button or interactive element
23. +/- buttons respond to rapid taps without missed inputs

## STEP 7 — Commit

```powershell
git add -A
git commit -m "feat: card layout redesign — compact multi-column with inline controls

- CharacterBar: HP bar header, inline +/- health, condition toggles on card,
  compact XP/loot counters, summon summary line
- MonsterGroup: portrait + name + ability actions (no stat table on controller),
  compact standee rows with inline HP +/- and condition management
- StandeeConditionAdder: popup condition picker on standees (fixes B8)
- FigureList: CSS grid multi-column (3 col landscape, 2 portrait, 1 phone)
- ConditionRow: inline toggleable condition icons on character cards
- SummonSummary: compact one-line summon display inside character card
- touch-action: manipulation on all interactive elements (fixes B7 zoom)
- HP +/- directly on cards without overlay (fixes B7)
- Monster stat card removed from controller view (L3)"
git push
```

Report: commit hash, bundle size, and which of the 23 checks pass. Specifically:
does the multi-column grid show ~3 cards across on iPad landscape, and do the
inline HP +/- buttons work without opening the overlay?
