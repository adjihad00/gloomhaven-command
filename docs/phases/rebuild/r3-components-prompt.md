# R3 — Asset Population + Core Shared Preact Components

> Paste into Claude Code. First populates the assets directory from .staging,
> verifies asset paths, then builds the shared component library. Components
> use GHS assets exclusively — no text fallbacks. Missing assets fail visibly.

---

Read CLAUDE.md, then docs/APP_MODE_ARCHITECTURE.md, then docs/GHS_AUDIT.md
(Sections 3-7: Character System, Monster System, Round Flow, Elements, Modifier
Decks — especially the character bar layout at lines 136-190).

Then read these files:
- `app/hooks/useGameState.ts`, `app/hooks/useCommands.ts`, `app/hooks/useDataApi.ts`
- `app/shared/context.ts`, `app/shared/assets.ts`, `app/shared/formatName.ts`
- `clients/shared/lib/commandSender.ts` — **every method signature**
- `packages/shared/src/types/gameState.ts` — entity types
- `packages/shared/src/types/commands.ts` — CommandTarget
- `packages/shared/src/utils/conditions.ts` — condition lists
- `packages/shared/src/utils/elements.ts` — ELEMENT_TYPES
- `packages/shared/src/engine/turnOrder.ts` — OrderedFigure, OrderedSummon
- `packages/shared/src/data/types.ts` — MonsterLevelStats, MonsterAbilityCard
- `packages/shared/src/data/levelCalculation.ts` — deriveLevelValues
- `server/src/staticServer.ts` — current static routes

## STEP 0 — Populate assets from .staging and verify paths

### 0a. Investigate .staging structure

First, map the exact file layout in `.staging/ghs-client/`:

```powershell
# Top-level structure
Get-ChildItem "C:\Projects\gloomhaven-command\.staging\ghs-client" -Depth 1 | Select-Object FullName

# Find where images actually live
Get-ChildItem "C:\Projects\gloomhaven-command\.staging\ghs-client" -Recurse -Directory | Where-Object { $_.Name -eq 'images' } | Select-Object FullName

# Find condition SVGs
Get-ChildItem "C:\Projects\gloomhaven-command\.staging\ghs-client" -Recurse -Filter "stun.svg" | Select-Object FullName

# Find element SVGs
Get-ChildItem "C:\Projects\gloomhaven-command\.staging\ghs-client" -Recurse -Filter "fire.svg" | Select-Object FullName

# Find character thumbnails
Get-ChildItem "C:\Projects\gloomhaven-command\.staging\ghs-client" -Recurse -Filter "gh-brute*" | Select-Object FullName

# Find monster thumbnails
Get-ChildItem "C:\Projects\gloomhaven-command\.staging\ghs-client" -Recurse -Filter "gh-bandit*" | Select-Object FullName
```

Document the exact paths found. The GHS client release may structure images as:
- `assets/images/condition/*.svg`
- `assets/images/element/*.svg`
- `assets/images/character/thumbnail/*.png`
- `assets/images/monster/thumbnail/*.png`

Or it may be a different layout. The investigation determines the copy commands.

### 0b. Copy assets to the project

Based on what you find, copy the image directories into `assets/`. The goal is
for the server to serve them at predictable URLs.

```powershell
# Create target directories
New-Item -ItemType Directory -Force "C:\Projects\gloomhaven-command\assets\images"

# Copy the images directory tree (adjust source path based on 0a findings)
# If images are at .staging/ghs-client/assets/images/:
Copy-Item -Recurse "C:\Projects\gloomhaven-command\.staging\ghs-client\assets\images\*" "C:\Projects\gloomhaven-command\assets\images\"

# If images are elsewhere, adjust accordingly
```

Also ensure the data directory is accessible (R1 already handles this via .staging,
but having it in assets/ too is cleaner):

```powershell
# Copy data files if not already present
if (-not (Test-Path "C:\Projects\gloomhaven-command\assets\data")) {
    Copy-Item -Recurse "C:\Projects\gloomhaven-command\.staging\ghs-client\data" "C:\Projects\gloomhaven-command\assets\data"
}
```

### 0c. Update server static routes

Read `server/src/staticServer.ts` and verify it serves `assets/` correctly.
The images need to be accessible at these URLs:

```
/assets/images/condition/stun.svg
/assets/images/condition/wound.svg
/assets/images/element/fire.svg
/assets/images/character/thumbnail/gh-brute.png
/assets/images/monster/thumbnail/gh-bandit-guard.png
```

If the current static route uses a different base path, adjust. The critical thing
is that `app/shared/assets.ts` URL helpers match what the server actually serves.

### 0d. Update asset URL helpers

Read the current `app/shared/assets.ts`. Update the URL patterns to match the
actual file locations found in 0a. If condition icons are actually at
`/assets/images/condition/stun.svg`, confirm that's what `conditionIcon('stun')`
returns.

### 0e. Verify with curl

Start the server and verify at least one asset from each category loads:

```powershell
npx tsx server/src/index.ts
# In another terminal:
curl -I http://localhost:3000/assets/images/condition/stun.svg
curl -I http://localhost:3000/assets/images/element/fire.svg
curl -I http://localhost:3000/assets/images/character/thumbnail/gh-brute.png
curl -I http://localhost:3000/assets/images/monster/thumbnail/gh-bandit-guard.png
```

All should return 200. If any return 404, fix the path mapping before proceeding.
Do NOT continue to component building until all four asset categories resolve.

### 0f. Document the asset mapping

Create `assets/ASSET_PATHS.md`:

```markdown
# Asset Path Reference

Assets populated from `.staging/ghs-client/`.
Server serves `assets/` at `/assets/`.

## Image URLs

| Category | URL Pattern | Example |
|----------|-------------|---------|
| Condition icons | `/assets/images/condition/{name}.svg` | `/assets/images/condition/stun.svg` |
| Element icons | `/assets/images/element/{name}.svg` | `/assets/images/element/fire.svg` |
| Character thumbnails | `/assets/images/character/thumbnail/{edition}-{name}.png` | `/assets/images/character/thumbnail/gh-brute.png` |
| Monster thumbnails | `/assets/images/monster/thumbnail/{edition}-{name}.png` | `/assets/images/monster/thumbnail/gh-bandit-guard.png` |

## Data URLs
| Category | URL Pattern |
|----------|-------------|
| Edition data | `/api/data/{edition}/characters` etc. (served by API, not static files) |
```

Adjust the table based on what you actually found. This is the canonical reference
for all components.

## STEP 1 — HealthControl component

`app/components/HealthControl.tsx`

```tsx
interface HealthControlProps {
  current: number;
  max: number;
  onChangeHealth: (delta: number) => void;
  readonly?: boolean;
  size?: 'normal' | 'compact';
}
```

Renders: `[ − ]  8 / 12  [ + ]`

- Minus button disabled at 0, plus disabled at max.
- Current shown prominently, max smaller/dimmer.
- `compact` reduces sizes for standees/summons.
- `readonly` hides buttons, shows value only.
- Thin HP bar behind the numbers: green >50%, yellow 25-50%, red <25%.
- NO text fallback. Numbers render as HTML text, not images.

## STEP 2 — ConditionGrid component

`app/components/ConditionGrid.tsx`

```tsx
interface ConditionGridProps {
  conditions: EntityCondition[];
  availableConditions: string[];
  onToggleCondition: (conditionName: string) => void;
  readonly?: boolean;
  size?: 'normal' | 'compact';
}
```

- One button per condition in `availableConditions`
- Each button: `<img src={conditionIcon(name)} />` — NO onerror fallback, NO text
  replacement. If the SVG is missing, the broken image is the signal to fix paths.
- Active = red border+glow (negative) or green (positive)
- Inactive = 30% opacity
- `readonly` shows active only, no toggles
- `compact` = 28px buttons

## STEP 3 — ConditionIcons component (inline)

`app/components/ConditionIcons.tsx`

```tsx
interface ConditionIconsProps {
  conditions: EntityCondition[];
  size?: number;  // icon size px, default 18
}
```

- Shows ONLY active conditions as small `<img>` icons in flex row
- No fallback. No interaction. Display only.
- Filter: `!c.expired && c.state !== 'removed' && c.state !== 'expired'`

## STEP 4 — ElementBoard component

`app/components/ElementBoard.tsx`

```tsx
interface ElementBoardProps {
  elements: ElementModel[];
  onCycleElement?: (elementType: string, currentState: string) => void;
  layout?: 'horizontal' | 'vertical' | 'grid';
  readonly?: boolean;
  size?: 'normal' | 'compact';
}
```

- 6 element buttons using `<img src={elementIcon(name)} />`
- NO fallback text. Missing SVG = broken image = fix paths.
- State visuals via CSS class: `.element-inert`, `.element-strong`, `.element-waning`, `.element-new`
- Inert: greyscale filter + low opacity
- Strong/new: full color, glow
- Waning: reduced opacity, subtle pulse animation
- Click cycles: inert → new → strong → waning → inert
- `compact` = 28px for footer, `normal` = 40px

## STEP 5 — InitiativeDisplay component

`app/components/InitiativeDisplay.tsx`

```tsx
interface InitiativeDisplayProps {
  value: number;
  onSetInitiative?: (value: number) => void;
  editable?: boolean;
  longRest?: boolean;
  size?: 'normal' | 'large';
}
```

- Non-editable: number display (or "—" if 0)
- Editable: styled number input 1-99
- Long rest: "REST" in blue
- Pure HTML/CSS — no images needed

## STEP 6 — CharacterBar component

`app/components/CharacterBar.tsx`

The most complex component. Matches GHS audit Section 3 character bar layout.

```tsx
interface CharacterBarProps {
  character: Character;
  edition: string;
  isActive: boolean;
  isDone: boolean;
  isDrawPhase: boolean;
  onChangeHealth: (delta: number) => void;
  onSetInitiative: (value: number) => void;
  onToggleTurn: () => void;
  onOpenDetail: () => void;
  onIncrementXP: () => void;
  onIncrementLoot: () => void;
  readonly?: boolean;
  showLoot?: boolean;
  characterColor?: string;
}
```

Layout (horizontal strip, left to right):
1. **Portrait**: `<img src={characterThumbnail(edition, name)} />` — NO fallback.
   Overlaid with thin HP bar at bottom. Click = end turn during play.
2. **Initiative**: `InitiativeDisplay` component
3. **Name + HP**: `formatName(name)`, HP as `current/max` with HealthControl
4. **Condition icons**: `ConditionIcons` component (inline, active only)
5. **XP star**: star icon (can be CSS/emoji ★) + count. Click = +1.
6. **Loot bag**: bag icon + count. Click = +1.
7. **Summon indicator**: badge with summon count if any alive

Visual states:
- Active: gold border, glow
- Done: 60% opacity
- Exhausted: greyed out, "EXHAUSTED" overlay
- `characterColor` sets left border accent

## STEP 7 — SummonCard component

`app/components/SummonCard.tsx`

```tsx
interface SummonCardProps {
  summon: Summon;
  parentName: string;
  isActive: boolean;
  isDone: boolean;
  onChangeHealth: (delta: number) => void;
  onToggleCondition: (conditionName: string) => void;
  onKill: () => void;
  readonly?: boolean;
}
```

- Name + parent ref
- HealthControl (compact)
- ConditionIcons (inline)
- Kill button ☠
- Blue-tinted border
- Attack/move/range stats if available

## STEP 8 — MonsterGroup component

`app/components/MonsterGroup.tsx`

```tsx
interface MonsterGroupProps {
  monster: Monster;
  monsterStats?: { normal: MonsterLevelStats | null; elite: MonsterLevelStats | null };
  abilityCard?: MonsterAbilityCard | null;
  isActive: boolean;
  isDone: boolean;
  onChangeHealth: (entityNumber: number, delta: number) => void;
  onToggleCondition: (entityNumber: number, conditionName: string) => void;
  onKillEntity: (entityNumber: number) => void;
  onOpenDetail?: () => void;
  readonly?: boolean;
}
```

1. Header: monster thumbnail `<img src={monsterThumbnail(edition, name)} />` — NO
   fallback. Name + initiative from ability card.
2. MonsterStatCard (compact): dual normal/elite stats
3. Ability card: initiative + resolved actions. `valueType: "plus"` renders as
   `baseStat + cardValue = resolved`. Show both calculation and result.
4. Standee list: sorted by number, using MonsterStandeeRow

### MonsterStandeeRow sub-component

`app/components/MonsterStandeeRow.tsx`

```tsx
interface MonsterStandeeRowProps {
  entity: MonsterEntity;
  onChangeHealth: (delta: number) => void;
  onToggleCondition: (conditionName: string) => void;
  onKill: () => void;
  readonly?: boolean;
}
```

- Number circle (gold=elite, grey=normal, red=boss)
- HealthControl (compact)
- ConditionIcons (inline active conditions)
- Kill button
- Dead = 30% opacity

## STEP 9 — MonsterStatCard component

`app/components/MonsterStatCard.tsx`

```tsx
interface MonsterStatCardProps {
  normal: MonsterLevelStats | null;
  elite: MonsterLevelStats | null;
  level: number;
  monsterName: string;
}
```

Dual-column: Normal | Elite with HP, Move, Attack, Range, specials.
Pure HTML/CSS — stat labels as text, values as numbers.

## STEP 10 — ModifierDeck component

`app/components/ModifierDeck.tsx`

```tsx
interface ModifierDeckProps {
  deck: AttackModifierDeckModel;
  deckName: string;
  onDraw: () => void;
  onShuffle: () => void;
  onAddBless: () => void;
  onRemoveBless: () => void;
  onAddCurse: () => void;
  onRemoveCurse: () => void;
  readonly?: boolean;
  compact?: boolean;
}
```

- Full: remaining/total, draw button, shuffle, bless/curse +/-
- Compact: just remaining count as badge, click to expand
- Pure HTML/CSS controls

## STEP 11 — FigureList component

`app/components/FigureList.tsx`

```tsx
interface FigureListProps {
  figures: OrderedFigure[];
  state: GameState;
  monsterStats: Map<string, { normal: MonsterLevelStats | null; elite: MonsterLevelStats | null }>;
  monsterAbilities: Map<string, MonsterAbilityCard | null>;
  isDrawPhase: boolean;
  readonly?: boolean;
}
```

The core play area. Initiative-sorted list rendering:
- Character → CharacterBar + SummonCards
- Monster → MonsterGroup

Components use `useCommands()` directly for interactions — no callback prop
threading through FigureList. This is cleaner since all components are inside
AppContext.Provider.

## STEP 12 — ScenarioHeader component

`app/components/ScenarioHeader.tsx`

```tsx
interface ScenarioHeaderProps {
  round: number;
  phase: string;
  scenarioName?: string;
  level: number;
  levelValues: LevelDerivedValues;
  connectionStatus: string;
  onMenuOpen?: () => void;
}
```

`[☰] [Round N — Card Selection/Playing] [Scenario #1 — Level 2] [Trap:4 Gold:3 XP:8] [●]`

## STEP 13 — ScenarioFooter component

`app/components/ScenarioFooter.tsx`

```tsx
interface ScenarioFooterProps {
  phase: string;
  canAdvance: boolean;
  advanceLabel: string;
  onAdvance: () => void;
  scenarioName?: string;
  doors?: { roomNumber: number; ref: string; revealed: boolean }[];
  onRevealRoom?: (roomNumber: number) => void;
  elementBoard: ElementModel[];
  onCycleElement?: (elementType: string, currentState: string) => void;
  modifierDeck?: AttackModifierDeckModel;
  onDrawModifier?: () => void;
  readonly?: boolean;
}
```

Fixed bottom bar:
- Left: phase action button (gold when ready, dim when not)
- Center: scenario name + door icons (closed=clickable, open=dimmed)
- Right: ElementBoard (compact horizontal) + ModifierDeck (compact badge)

## STEP 14 — CSS for all components

Add to `app/shared/styles/components.css`:

Write complete styles for every component. Key design tokens:

```css
/* Component sizes */
--char-bar-height: 64px;
--standee-row-height: 48px;
--condition-icon-size: 36px;
--condition-icon-compact: 24px;
--element-icon-size: 36px;
--element-icon-compact: 24px;
--health-btn-size: 36px;
--health-btn-compact: 28px;

/* Character bar */
.character-bar { }
.character-bar.active { border-color: var(--accent-gold); box-shadow: 0 0 12px var(--accent-gold-dim); }
.character-bar.done { opacity: 0.6; }
.character-bar.exhausted { opacity: 0.3; filter: grayscale(0.8); }

/* Monster group */
.monster-group { }
.monster-group.active { border-color: var(--accent-gold); }
.standee-row.elite { border-color: var(--elite-gold); background: linear-gradient(135deg, rgba(212,175,55,0.1), transparent); }
.standee-row.dead { opacity: 0.3; }

/* Condition icons */
.condition-btn { }
.condition-btn.active.negative { border-color: var(--negative-red); box-shadow: 0 0 8px rgba(197,48,48,0.4); }
.condition-btn.active.positive { border-color: var(--health-green); box-shadow: 0 0 8px rgba(74,124,89,0.4); }

/* Element states */
.element-btn.element-inert { opacity: 0.3; filter: grayscale(1); }
.element-btn.element-strong, .element-btn.element-new { filter: none; box-shadow: 0 0 10px currentColor; }
.element-btn.element-waning { opacity: 0.6; animation: pulse 2s ease-in-out infinite; }

/* Footer */
.scenario-footer { position: fixed; bottom: 0; left: 0; right: 0; }
```

Use CSS variables exclusively. Match the dark parchment aesthetic.
Write ALL the CSS — don't leave placeholders.

## STEP 15 — Verify

### Build

```powershell
node app/build.mjs
```

### Asset verification

```powershell
npx tsx server/src/index.ts
# Verify assets serve
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/assets/images/condition/stun.svg
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/assets/images/element/fire.svg
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/assets/images/character/thumbnail/gh-brute.png
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/assets/images/monster/thumbnail/gh-bandit-guard.png
```

All must return 200.

### Visual test

Temporarily update `app/controller/ScenarioView.tsx` to render a few components
with test data. Connect to a game that has characters and monsters (import the
test state from Phase 2C or use the API). Verify in browser:

1. Character portrait image loads (not broken)
2. Condition SVG icons load (not broken)
3. Element SVG icons load (not broken)
4. Monster thumbnail loads (not broken)
5. HealthControl renders with +/- buttons
6. ConditionGrid shows all conditions with proper opacity
7. ElementBoard shows 6 elements with state coloring
8. Character bar renders as horizontal strip with all zones

If ANY image shows as broken, fix the path in `app/shared/assets.ts` or the
server's static route before proceeding.

### Type check

```powershell
npx tsc --noEmit --project app/tsconfig.json
```

## STEP 16 — Update ROADMAP.md

```markdown
- [x] R3: Core shared components + asset population
```

## STEP 17 — Commit

```powershell
git add -A
git commit -m "feat: core Preact components + GHS asset population

- Asset pipeline: populated assets/ from .staging, verified all image paths
- HealthControl: +/- with HP bar, compact variant
- ConditionGrid: edition-aware toggle grid with GHS SVG icons (no fallbacks)
- ConditionIcons: inline active condition display
- ElementBoard: 6 elements with state CSS (inert/strong/waning/new)
- InitiativeDisplay: editable initiative with long rest
- CharacterBar: GHS-style horizontal strip with all interaction zones
- SummonCard: compact summon with health/conditions/kill
- MonsterGroup: stat card + ability card + standee list
- MonsterStandeeRow: number/health/conditions/kill
- MonsterStatCard: dual-column normal/elite stats
- ModifierDeck: draw/shuffle/bless/curse with compact variant
- FigureList: initiative-sorted character+monster interleaved list
- ScenarioHeader + ScenarioFooter: layout components
- All components use GHS assets exclusively — broken images signal path errors
- ASSET_PATHS.md documenting canonical URL patterns"
git push
```

Report: commit hash, bundle sizes, asset verification results (200 for all four
categories), and whether the visual test shows real GHS images in the components.
