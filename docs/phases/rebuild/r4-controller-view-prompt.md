# R4 — Controller Single-Screen ScenarioView

> Paste into Claude Code. Composes the R3 shared components into the controller's
> GHS-style single-screen view. After R4, the controller shows a working scenario
> play screen with real GHS assets, initiative-sorted figures, and overlay-based
> detail views. This replaces the old 5-tab controller entirely.

---

Read CLAUDE.md, then docs/APP_MODE_ARCHITECTURE.md (Controller Scenario Mode section),
then docs/GHS_AUDIT.md (Sections 1, 3-5 for layout reference).

Then read ALL of these — you need exact APIs and prop interfaces:
- Every component in `app/components/` — read each `.tsx` file, note the prop interfaces
- `app/hooks/useConnection.ts`, `useGameState.ts`, `useCommands.ts`, `useDataApi.ts`
- `app/shared/context.ts` — AppContext
- `app/shared/assets.ts` — URL helpers
- `app/shared/formatName.ts`
- `app/controller/App.tsx` — current root component
- `clients/shared/lib/commandSender.ts` — **every method signature**
- `packages/shared/src/engine/turnOrder.ts` — getInitiativeOrder, OrderedFigure
- `packages/shared/src/data/types.ts` — MonsterLevelStats, MonsterAbilityCard, ScenarioData
- `packages/shared/src/data/levelCalculation.ts` — calculateScenarioLevel, deriveLevelValues

## Architecture

The controller ScenarioView is a single-screen layout:

```
┌──────────────────────────────────────────────────────┐
│ ScenarioHeader                                        │
│ [☰] [Round 3 — Playing] [#1 Black Barrow — Lv 2]    │
│ [Trap:4 Gold:3 XP:8] [●]                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│ FigureList (scrollable)                              │
│                                                      │
│ ┌─ CharacterBar: Brute (active, gold glow) ────────┐│
│ │ [portrait] [15] [Brute  10/12] [★3] [💰2]       ││
│ │  └─ SummonCard: Bear                              ││
│ ├─ MonsterGroup: Bandit Guard ──────────────────────┤│
│ │ [thumbnail] [50] N:5hp E:9hp  │ #1(N) 5/5        ││
│ │  Move+1, Attack+0             │ #2(E) 9/9        ││
│ ├─ CharacterBar: Spellweaver (done, dimmed) ────────┤│
│ │ [portrait] [07] [Spellweaver  6/8] [★1]          ││
│ ├─ MonsterGroup: Living Bones ──────────────────────┤│
│ │ ...                                                ││
│                                                      │
├──────────────────────────────────────────────────────┤
│ ScenarioFooter (fixed bottom)                        │
│ [▶ Next Turn] [#1 Black Barrow 🚪🚪] [🔥❄💨⛰☀🌑] [AMD 18] │
└──────────────────────────────────────────────────────┘

── Overlays (rendered on top when triggered) ──
│ CharacterDetailOverlay  │
│ ScenarioSetupOverlay    │
│ MenuOverlay             │
```

No tabs. Everything on one screen. Overlays for detail/setup.

## STEP 1 — Create overlay components

### `app/controller/overlays/CharacterDetailOverlay.tsx`

Opens when tapping the name/HP area of a CharacterBar. Shows the full character
management panel (matching GHS audit Section 3: Character Menu Overlay).

```tsx
interface CharacterDetailOverlayProps {
  character: Character;
  edition: string;
  availableConditions: string[];
  isDrawPhase: boolean;
  onClose: () => void;
}
```

Layout (overlay panel, slides in from right or centers on screen):

**Left column** (counters with −/+ buttons):
1. HP — HealthControl (full size)
2. XP — counter with −/+ (uses `commands.changeStat(name, edition, 'experience', ±1)`)
3. Gold/Loot — counter with −/+ (uses `commands.changeStat(name, edition, 'gold', ±1)`)
4. Exhaust button — toggles exhausted state
5. Level display

**Right column** (conditions):
- ConditionGrid (full size) with all `availableConditions`

**Top-right**: "Mark Absent" button

**Bottom**: Summon management
- List of active summons with SummonCard components
- "Add Summon" button (shows summon input form)

Read `commandSender.ts` for exact method names for all interactions.

### `app/controller/overlays/ScenarioSetupOverlay.tsx`

Opens from the menu or when no scenario is loaded. Handles scenario selection,
character management, and level configuration.

```tsx
interface ScenarioSetupOverlayProps {
  state: GameState;
  onClose: () => void;
}
```

Sections (scrollable overlay panel):

**1. Scenario Selection**
- Edition dropdown (from `useEditions()` hook)
- Scenario list/search (from `useScenarioList(edition)` hook)
- Selecting a scenario calls `commands.setScenario(index, edition)`
- Shows scenario name + monster list preview before confirming

**2. Character Management**
- Character class dropdown (from `useCharacterList(edition)` hook) — real class names
- Level selector (1-9)
- "Add Character" button
- Current character list with remove buttons
- Characters show their class color and HP for the selected level

**3. Level & Settings**
- Auto-calculated level display (from `calculateScenarioLevel`)
- Manual adjustment (−2 to +2)
- Derived values display (trap, gold, XP, hazardous)
- Manual override buttons (0-7)

**4. Active Scenario Info** (when a scenario is loaded)
- Scenario name + edition
- Monster groups loaded
- Rooms revealed vs total
- Room door buttons for manual reveal

Use `useDataApi` hooks to fetch character/monster/scenario lists from the
server's data API endpoints.

### `app/controller/overlays/MenuOverlay.tsx`

Simple menu panel.

```tsx
interface MenuOverlayProps {
  gameCode: string;
  onClose: () => void;
  onDisconnect: () => void;
}
```

Items:
- Undo (`commands.undoAction()`)
- Scenario Setup (opens ScenarioSetupOverlay)
- Export Game State (`window.open('/api/export/' + gameCode)`)
- Disconnect

### `app/controller/overlays/OverlayBackdrop.tsx`

Shared backdrop component for all overlays:

```tsx
interface OverlayBackdropProps {
  onClose: () => void;
  children: ComponentChildren;
  position?: 'center' | 'right' | 'full';
}
```

- Dark semi-transparent backdrop (click to close)
- Content panel positioned per `position` prop
- Slide-in animation for 'right', fade for 'center'

## STEP 2 — Implement the ScenarioView

Replace `app/controller/ScenarioView.tsx`. This is the main controller view
that composes all R3 components.

```tsx
import { useState, useMemo } from 'preact/hooks';
import { useGameState } from '../hooks/useGameState';
import { useCommands } from '../hooks/useCommands';
import { useDataApi } from '../hooks/useDataApi';
import { FigureList } from '../components/FigureList';
import { ScenarioHeader } from '../components/ScenarioHeader';
import { ScenarioFooter } from '../components/ScenarioFooter';
import { CharacterDetailOverlay } from './overlays/CharacterDetailOverlay';
import { ScenarioSetupOverlay } from './overlays/ScenarioSetupOverlay';
import { MenuOverlay } from './overlays/MenuOverlay';
// ... other imports
```

### State management

```tsx
export function ScenarioView() {
  const gameState = useGameState();
  const commands = useCommands();
  const { state, characters, monsters, elementBoard, round, phase, level, edition } = gameState;

  // Overlay state
  const [activeOverlay, setActiveOverlay] = useState<
    | { type: 'none' }
    | { type: 'characterDetail'; characterName: string }
    | { type: 'scenarioSetup' }
    | { type: 'menu' }
  >({ type: 'none' });

  // ... data fetching and computed values
}
```

### Data fetching

The controller needs monster stats and ability cards to display resolved values
on MonsterGroup components. Fetch these from the data API:

```tsx
// Fetch monster stats for all active monster groups
// This could be a custom hook that batches requests
const monsterStatsMap = useMemo(() => {
  const map = new Map<string, { normal: any; elite: any }>();
  // For each monster in state, we need its stats at current level
  // Use useDataApi or direct fetch
  return map;
}, [monsters, level, edition]);
```

For R4, a pragmatic approach: fetch stats for each unique monster type when the
component mounts or when monsters change. Create a custom hook:

```tsx
// app/controller/hooks/useMonsterData.ts
function useMonsterData(monsters: Monster[], edition: string, level: number) {
  const [statsMap, setStatsMap] = useState(new Map());
  const [abilitiesMap, setAbilitiesMap] = useState(new Map());

  useEffect(() => {
    const fetchData = async () => {
      const newStats = new Map();
      const newAbilities = new Map();

      for (const m of monsters) {
        const ed = m.edition || edition;
        try {
          const resp = await fetch(`/api/data/${ed}/monster/${m.name}`);
          if (resp.ok) {
            const data = await resp.json();
            // Extract stats for current level
            const normal = data.stats?.find(s => s.level === level && !s.type);
            const elite = data.stats?.find(s => s.level === level && s.type === 'elite');
            newStats.set(m.name, { normal: normal || null, elite: elite || null });

            // Fetch ability deck if available
            if (data.deck) {
              const deckResp = await fetch(`/api/data/${ed}/monster-deck/${data.deck}`);
              if (deckResp.ok) {
                const deckData = await deckResp.json();
                // Resolve current ability card from monster's ability index
                if (m.ability !== undefined && m.ability >= 0 && deckData.abilities) {
                  newAbilities.set(m.name, deckData.abilities[m.ability] || null);
                }
              }
            }
          }
        } catch { /* skip */ }
      }

      setStatsMap(newStats);
      setAbilitiesMap(newAbilities);
    };

    if (monsters.length > 0) fetchData();
  }, [monsters, edition, level]);

  return { statsMap, abilitiesMap };
}
```

### Initiative order

Use the shared engine to get the figure order:

```tsx
import { getInitiativeOrder } from '@gloomhaven-command/shared';

const orderedFigures = useMemo(() => {
  if (!state) return [];
  return getInitiativeOrder(state);
}, [state]);
```

### Phase advancement logic

Determine the footer's advance button state and label:

```tsx
const advanceInfo = useMemo(() => {
  if (!state) return { canAdvance: false, label: '...' };

  const activeFigure = orderedFigures.find(f => f.active);
  const nonAbsentFigures = orderedFigures.filter(f => !f.absent);
  const allDone = nonAbsentFigures.length > 0 && nonAbsentFigures.every(f => f.off);

  if (activeFigure) {
    return { canAdvance: true, label: 'Next Turn' };
  }
  if (allDone) {
    return { canAdvance: true, label: 'Next Round' };
  }
  if (phase === 'draw') {
    const activeChars = characters.filter(c => !c.absent && !c.exhausted);
    const allInitSet = activeChars.length > 0 && activeChars.every(c => c.initiative > 0);
    return {
      canAdvance: allInitSet,
      label: allInitSet ? 'Start Round' : 'Set Initiatives...'
    };
  }
  return { canAdvance: false, label: '...' };
}, [state, orderedFigures, characters, phase]);
```

### Level-derived values

```tsx
import { deriveLevelValues } from '@gloomhaven-command/shared';

const levelValues = useMemo(() => deriveLevelValues(level), [level]);
```

### Scenario door data

Build door info from scenario data for the footer:

```tsx
const doorInfo = useMemo(() => {
  if (!state?.scenario) return [];
  // Get scenario rooms from data API if available
  // For now, use whatever room info is in the state
  return []; // R5 fills this in with real scenario room data
}, [state?.scenario]);
```

### Empty state

If no scenario is loaded and no characters exist, show a setup prompt:

```tsx
if (!state) return <div>Loading...</div>;

if (characters.length === 0 && !state.scenario) {
  return (
    <div class="scenario-empty">
      <h2>No Game in Progress</h2>
      <p>Set up a scenario to begin.</p>
      <button class="btn btn-primary" onClick={() => setActiveOverlay({ type: 'scenarioSetup' })}>
        Scenario Setup
      </button>
      {activeOverlay.type === 'scenarioSetup' && (
        <ScenarioSetupOverlay state={state} onClose={() => setActiveOverlay({ type: 'none' })} />
      )}
    </div>
  );
}
```

### Main render

```tsx
return (
  <div class="controller-scenario">
    <ScenarioHeader
      round={round}
      phase={phase}
      scenarioName={state.scenario?.name}
      level={level}
      levelValues={levelValues}
      connectionStatus="connected"
      onMenuOpen={() => setActiveOverlay({ type: 'menu' })}
    />

    <div class="scenario-content">
      <FigureList
        figures={orderedFigures}
        state={state}
        monsterStats={monsterStatsMap}
        monsterAbilities={abilitiesMap}
        isDrawPhase={phase === 'draw'}
      />
    </div>

    <ScenarioFooter
      phase={phase}
      canAdvance={advanceInfo.canAdvance}
      advanceLabel={advanceInfo.label}
      onAdvance={() => commands.advancePhase()}
      scenarioName={state.scenario?.name}
      doors={doorInfo}
      onRevealRoom={(roomNum) => commands.revealRoom(roomNum)}
      elementBoard={elementBoard}
      onCycleElement={(type, currentState) => {
        const cycle = { 'inert': 'new', 'new': 'strong', 'strong': 'waning', 'waning': 'inert' };
        commands.moveElement(type, cycle[currentState] || 'inert');
      }}
      modifierDeck={state.monsterAttackModifierDeck}
      onDrawModifier={() => commands.drawModifierCard('monster')}
    />

    {/* Overlays */}
    {activeOverlay.type === 'characterDetail' && (
      <CharacterDetailOverlay
        character={characters.find(c => c.name === activeOverlay.characterName)!}
        edition={edition}
        availableConditions={state.conditions || []}
        isDrawPhase={phase === 'draw'}
        onClose={() => setActiveOverlay({ type: 'none' })}
      />
    )}

    {activeOverlay.type === 'scenarioSetup' && (
      <ScenarioSetupOverlay
        state={state}
        onClose={() => setActiveOverlay({ type: 'none' })}
      />
    )}

    {activeOverlay.type === 'menu' && (
      <MenuOverlay
        gameCode={gameCode}
        onClose={() => setActiveOverlay({ type: 'none' })}
        onDisconnect={onDisconnect}
      />
    )}
  </div>
);
```

Wait — `gameCode` and `onDisconnect` need to come from somewhere. Read `App.tsx`
to see how ScenarioView is rendered and what props it receives. If it's rendered
inside `AppContext.Provider`, add `gameCode` to the context or pass as prop.
Adjust accordingly.

### Wiring CharacterBar interactions to overlays

The `CharacterBar` component (from R3) has `onOpenDetail` prop. In FigureList,
when rendering a CharacterBar, pass:

```tsx
onOpenDetail={() => setActiveOverlay({ type: 'characterDetail', characterName: char.name })}
```

But FigureList is a shared component that doesn't know about controller overlays.
Two approaches:

**Approach A**: FigureList accepts an `onCharacterDetail` callback:
```tsx
<FigureList
  ...
  onCharacterDetail={(name) => setActiveOverlay({ type: 'characterDetail', characterName: name })}
/>
```
FigureList passes it through to CharacterBar's `onOpenDetail`.

**Approach B**: CharacterBar uses a Preact context callback. Controller provides
the context, display doesn't.

Go with **Approach A** — explicit prop threading is cleaner for one level of nesting.
Add `onCharacterDetail?: (name: string) => void` to FigureList props. Pass it
through to CharacterBar.

## STEP 3 — Controller-specific CSS

Create or update `app/controller/styles/controller.css`:

```css
/* Controller scenario layout */
.controller-scenario {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.scenario-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 8px 16px;
  padding-bottom: 80px;  /* space for fixed footer */
}

/* Empty state */
.scenario-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
  color: var(--text-secondary);
}

/* Overlay styles */
.overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease;
}

.overlay-panel {
  background: var(--bg-card);
  border: 2px solid var(--accent-copper);
  border-radius: var(--radius-lg);
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  padding: 24px;
  position: relative;
}

.overlay-panel.right {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  max-width: 420px;
  width: 90vw;
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  animation: slideInRight 0.2s ease;
}

.overlay-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--accent-copper);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* iPad landscape optimizations */
@media (min-width: 768px) {
  .scenario-content {
    padding: 12px 24px;
  }

  .overlay-panel {
    max-width: 520px;
  }
}

@media (min-width: 1024px) {
  .scenario-content {
    padding: 16px 32px;
  }
}
```

Add any additional styles needed for the overlays and layout.

## STEP 4 — Update App.tsx to pass needed props

Read `app/controller/App.tsx`. Ensure `ScenarioView` has access to:
- `gameCode` (for export URL)
- `onDisconnect` callback
- These may come from context or props. Update App.tsx as needed.

If ScenarioView needs these and they're not in AppContext, either:
- Add them to AppContext, or
- Pass as props from App.tsx

## STEP 5 — Verify

### Build

```powershell
node app/build.mjs
```

Note the controller bundle size — it should increase significantly since it now
imports all R3 components.

### Type check

```powershell
npx tsc --noEmit --project app/tsconfig.json
```

### Boot and test

```powershell
npx tsx server/src/index.ts
```

Use the import API to set up a test game:

```powershell
curl -X POST http://localhost:3000/api/import -H "Content-Type: application/json" -d "{\"gameCode\":\"r4test\",\"ghsState\":{\"revision\":0,\"state\":\"draw\",\"round\":1,\"level\":2,\"edition\":\"gh\",\"figures\":[\"gh-brute\",\"gh-spellweaver\",\"gh-bandit-guard\",\"gh-living-bones\"],\"characters\":[{\"name\":\"brute\",\"edition\":\"gh\",\"level\":3,\"health\":14,\"maxHealth\":14,\"initiative\":0,\"experience\":3,\"loot\":2,\"entityConditions\":[],\"summons\":[{\"name\":\"bear\",\"cardId\":\"1\",\"number\":1,\"color\":\"blue\",\"health\":5,\"maxHealth\":8,\"attack\":3,\"movement\":2,\"range\":0,\"dead\":false,\"active\":false,\"off\":false,\"entityConditions\":[],\"tags\":[]}],\"absent\":false,\"exhausted\":false,\"longRest\":false,\"active\":false,\"off\":false,\"attackModifierDeck\":{\"cards\":[],\"current\":0,\"drawn\":[],\"discarded\":[]}},{\"name\":\"spellweaver\",\"edition\":\"gh\",\"level\":3,\"health\":8,\"maxHealth\":8,\"initiative\":0,\"experience\":1,\"loot\":0,\"entityConditions\":[{\"name\":\"strengthen\",\"value\":1,\"state\":\"normal\",\"lastState\":\"normal\",\"expired\":false,\"permanent\":false}],\"summons\":[],\"absent\":false,\"exhausted\":false,\"longRest\":false,\"active\":false,\"off\":false,\"attackModifierDeck\":{\"cards\":[],\"current\":0,\"drawn\":[],\"discarded\":[]}}],\"monsters\":[{\"name\":\"bandit-guard\",\"edition\":\"gh\",\"level\":2,\"entities\":[{\"number\":1,\"type\":\"normal\",\"health\":6,\"maxHealth\":6,\"dead\":false,\"active\":false,\"off\":false,\"dormant\":false,\"entityConditions\":[],\"markers\":[],\"tags\":[]},{\"number\":2,\"type\":\"elite\",\"health\":10,\"maxHealth\":10,\"dead\":false,\"active\":false,\"off\":false,\"dormant\":false,\"entityConditions\":[{\"name\":\"stun\",\"value\":1,\"state\":\"normal\",\"lastState\":\"normal\",\"expired\":false,\"permanent\":false}],\"markers\":[],\"tags\":[]}],\"abilities\":[],\"ability\":-1,\"active\":false,\"off\":false,\"isAlly\":false,\"isAllied\":false,\"drawExtra\":false,\"tags\":[]},{\"name\":\"living-bones\",\"edition\":\"gh\",\"level\":2,\"entities\":[{\"number\":1,\"type\":\"normal\",\"health\":5,\"maxHealth\":5,\"dead\":false,\"active\":false,\"off\":false,\"dormant\":false,\"entityConditions\":[],\"markers\":[],\"tags\":[]}],\"abilities\":[],\"ability\":-1,\"active\":false,\"off\":false,\"isAlly\":false,\"isAllied\":false,\"drawExtra\":false,\"tags\":[]}],\"elementBoard\":[{\"type\":\"fire\",\"state\":\"inert\"},{\"type\":\"ice\",\"state\":\"strong\"},{\"type\":\"air\",\"state\":\"inert\"},{\"type\":\"earth\",\"state\":\"waning\"},{\"type\":\"light\",\"state\":\"inert\"},{\"type\":\"dark\",\"state\":\"inert\"}],\"objectiveContainers\":[],\"monsterAttackModifierDeck\":{\"cards\":[],\"current\":0,\"drawn\":[],\"discarded\":[]},\"allyAttackModifierDeck\":{\"cards\":[],\"current\":0,\"drawn\":[],\"discarded\":[]},\"lootDeck\":{\"cards\":[],\"current\":0,\"drawn\":[],\"assigned\":[]}}}"
```

Open `http://localhost:3000/controller`, connect to game code `r4test`. Verify:

**Layout:**
1. ScenarioHeader shows Round 1, Card Selection phase, Level 2
2. ScenarioFooter fixed at bottom with phase button + elements + modifier deck
3. Main content area is scrollable

**Figures:**
4. Brute character bar shows portrait image, initiative (empty - draw phase), 14/14 HP, XP:3, Loot:2
5. Brute's bear summon shows below the character bar
6. Spellweaver character bar shows 8/8 HP, strengthen condition icon inline
7. Bandit Guard monster group shows with 2 standees (#1 normal, #2 elite with stun icon)
8. Living Bones shows with 1 standee

**Elements:**
9. Element board in footer shows ice=strong (glowing), earth=waning (pulsing), others dim

**Interactions:**
10. Tapping Brute's name/HP area opens CharacterDetailOverlay
11. CharacterDetailOverlay shows full HP control, XP +/-, Gold +/-, conditions grid
12. Closing overlay returns to main screen
13. Menu button (☰) opens MenuOverlay with Undo, Scenario Setup, Export, Disconnect
14. Scenario Setup overlay shows character/scenario management

**Phase flow:**
15. Setting initiatives for both characters enables "Start Round" button
16. Clicking "Start Round" advances phase, figures get initiative order
17. "Next Turn" advances through figures
18. Health +/- on character bars works
19. Health +/- on monster standees works (via MonsterGroup component)
20. Element cycling in footer works

**Assets:**
21. Character portraits load (real GHS PNGs, not broken images)
22. Condition icons load (real GHS SVGs)
23. Element icons load (real GHS SVGs)
24. Monster thumbnails load (real GHS PNGs)

## STEP 6 — Update ROADMAP.md

```markdown
- [x] R4: Controller single-screen view — ScenarioView with overlays
```

## STEP 7 — Commit

```powershell
git add -A
git commit -m "feat(controller): GHS-style single-screen ScenarioView with overlays

- ScenarioView: single-screen layout with header, scrollable figure list, fixed footer
- FigureList rendering initiative-sorted characters + monsters interleaved
- CharacterDetailOverlay: HP, XP, gold, conditions, summons, exhaust, absent
- ScenarioSetupOverlay: scenario picker, character management, level config
- MenuOverlay: undo, scenario setup, export, disconnect
- Monster data fetching: stats + ability cards from data API
- Phase advancement logic: Set Initiatives → Start Round → Next Turn → Next Round
- Level-derived values in header (trap, gold, XP)
- Element board + modifier deck in footer
- All interactions via useCommands() hook
- GHS assets rendering (portraits, conditions, elements — no fallbacks)"
git push
```

Report: commit hash, controller bundle size, and which of the 24 verification
checks pass. Flag any broken interactions or missing images.
