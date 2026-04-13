# Batch 5 — Workflow + Campaign Setup

> Paste into Claude Code. Adds edition selection flow, party persistence across
> scenarios, scenario list filtering, character name editing, difficulty modifier
> labels, and auto-close overlay on scenario start. Fixes W1-W4, W6, V4.

---

## PRE-STEP — Read design skills

Before ANY code changes, read all design skill sources:

```
Read /mnt/skills/public/frontend-design/SKILL.md
```

```powershell
Get-ChildItem "C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill" -Recurse -Filter "*.md" | ForEach-Object { Write-Host "=== $($_.FullName) ==="; Get-Content $_.FullName }
```

```powershell
Get-ChildItem "C:\Users\Kyle Diaz\.agents\skills" -Recurse -Filter "*.md" | ForEach-Object { Write-Host "=== $($_.FullName) ==="; Get-Content $_.FullName }
```

Then read the project context:
- CLAUDE.md (includes design conventions section)
- docs/GHS_AUDIT.md Section 3 (Scenario Setup Flow), Section 13 (Campaign Management)
- docs/GHS_STATE_MAP.md (Party structure, GameState fields)
- docs/APP_MODE_ARCHITECTURE.md
- `app/CONVENTIONS.md` — BEM naming, spacing tokens

Then read these implementation files:
- `app/controller/App.tsx` — current root component with connection/state flow
- `app/controller/ConnectionScreen.tsx` — current connection screen
- `app/controller/ScenarioView.tsx` — where overlays are managed
- `app/controller/overlays/ScenarioSetupOverlay.tsx` — current scenario setup
- `app/hooks/useConnection.ts` — connection hook
- `app/hooks/useDataApi.ts` — useEditions, useCharacterList, useScenarioList
- `clients/shared/lib/commandSender.ts` — all command method signatures
- `packages/shared/src/types/gameState.ts` — GameState, Party, Character types
- `packages/shared/src/engine/applyCommand.ts` — setScenario, addCharacter handlers
- `packages/shared/src/data/types.ts` — ScenarioData (initial, unlocks, links fields)

## Playtest Issues Being Fixed

| # | Issue | Summary |
|---|-------|---------|
| W1 | Edition selection after connection | Edition sets context for session — should happen before setup |
| W2 | Party persistence | Characters shouldn't need re-adding every scenario |
| W3 | Campaign filtering | Scenario list: unlocked only, hide completed, treasure filter |
| W4 | Character name editing | Players want custom names for their characters |
| W6 | Difficulty modifier labels | "-2 to +4" is unclear, should show Easy/Normal/Hard labels |
| V4 | Auto-close overlay on Start Scenario | Setup overlay stays open after confirming — should dismiss |

## STEP 1 — Edition Selection Screen

### The Problem

Currently, after connecting, the controller goes directly to the ScenarioView
(or shows an empty state). The user noted: "Edition selection should occur
immediately after connection screen."

GHS does this too — first screen after opening is edition selection (GH, FH,
JotL, etc.).

### Implementation

Add an edition selection step between ConnectionScreen and ScenarioView in
`app/controller/App.tsx`.

Read `App.tsx` to understand the current flow. It likely looks like:

```
Not connected → ConnectionScreen
Connected, no state → ConnectionScreen (with setup options)
Connected, has state → AppContext.Provider → ScenarioView or TownView
```

Add a new state: "connected but no edition selected":

```tsx
// In App.tsx
const [selectedEdition, setSelectedEdition] = useState<string | null>(
  localStorage.getItem('gc_edition') || null
);

// Flow:
// 1. Not connected → ConnectionScreen
// 2. Connected, no edition → EditionSelector
// 3. Connected, has edition → ScenarioView/TownView
```

If the game state already has an edition set (`state.edition`), skip the
selector and use that. The selector is for fresh games or when starting a
new campaign.

### EditionSelector Component

Create `app/controller/EditionSelector.tsx`:

```tsx
interface EditionSelectorProps {
  editions: string[];
  onSelect: (edition: string) => void;
  loading?: boolean;
}

export function EditionSelector({ editions, onSelect, loading }: EditionSelectorProps) {
  // Edition display info
  const editionInfo: Record<string, { name: string; abbrev: string; color: string }> = {
    'gh': { name: 'Gloomhaven', abbrev: 'GH', color: '#c8a92c' },
    'fh': { name: 'Frosthaven', abbrev: 'FH', color: '#4a9bd9' },
    'jotl': { name: 'Jaws of the Lion', abbrev: 'JotL', color: '#d4553a' },
    'fc': { name: 'Forgotten Circles', abbrev: 'FC', color: '#9b59b6' },
    'cs': { name: 'Crimson Scales', abbrev: 'CS', color: '#c0392b' },
    'toa': { name: 'Trail of Ashes', abbrev: 'ToA', color: '#e67e22' },
  };

  return (
    <div class="edition-selector">
      <h1 class="edition-title">Gloomhaven Command</h1>
      <p class="edition-subtitle">Select Edition</p>

      {loading && <div class="loading">Loading editions...</div>}

      <div class="edition-grid">
        {editions.map(ed => {
          const info = editionInfo[ed] || { name: ed, abbrev: ed.toUpperCase(), color: 'var(--accent-copper)' };
          return (
            <button
              key={ed}
              class="edition-card"
              style={{ '--edition-color': info.color }}
              onClick={() => {
                localStorage.setItem('gc_edition', ed);
                onSelect(ed);
              }}
            >
              <span class="edition-abbrev">{info.abbrev}</span>
              <span class="edition-name">{info.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

Fetch available editions using `useEditions()` from `useDataApi.ts` — this
calls `GET /api/data/editions` which returns the list of loaded editions.

### CSS for EditionSelector

```css
.edition-selector {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-6);
}

.edition-title {
  font-family: 'Cinzel', serif;
  font-size: 2rem;
  font-weight: 900;
  color: var(--accent-gold);
  text-align: center;
  margin-bottom: var(--space-2);
}

.edition-subtitle {
  font-family: 'Crimson Pro', serif;
  font-size: 1.1rem;
  color: var(--text-secondary);
  margin-bottom: var(--space-6);
}

.edition-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
  width: 100%;
  max-width: 680px;
}

.edition-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-4);
  background: var(--bg-card);
  border: 2px solid var(--edition-color, var(--accent-copper));
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  touch-action: manipulation;
}

.edition-card:active {
  transform: scale(0.96);
  box-shadow: 0 0 20px color-mix(in srgb, var(--edition-color) 30%, transparent);
}

.edition-abbrev {
  font-family: 'Cinzel', serif;
  font-size: 1.8rem;
  font-weight: 900;
  color: var(--edition-color, var(--accent-gold));
}

.edition-name {
  font-family: 'Crimson Pro', serif;
  font-size: 0.95rem;
  color: var(--text-secondary);
}
```

### Wiring into App.tsx

```tsx
// In App.tsx, after connection established:

// If state already has an edition, use it
const activeEdition = state?.edition || selectedEdition;

if (!activeEdition) {
  // Show edition selector
  const { data: editions, loading } = useEditions();
  return (
    <EditionSelector
      editions={editions || []}
      onSelect={(ed) => {
        setSelectedEdition(ed);
        // Optionally set edition on the game state via command
        // if a setEdition command exists
      }}
      loading={loading}
    />
  );
}

// Otherwise proceed to ScenarioView/TownView with activeEdition as context
```

Also: add a small edition indicator in the ScenarioSetupOverlay so the user
can switch editions if needed (bottom of setup overlay, "Change Edition" link).

## STEP 2 — Party Persistence (Characters persist across scenarios)

### The Problem

Currently, characters exist only in the active game state. When a new scenario
is set, the `setScenario` handler may clear characters. The user wants to add
characters once and have them persist across scenarios.

### Investigation

Read `applyCommand.ts` — the `setScenario` handler. Check what it does to
`state.characters`. If it clears them, that's the bug.

Also read `GameState.party` — the party object should store persistent character
info. Check the Party type in `gameState.ts`.

### Implementation Approach

Characters should persist between scenarios. The `setScenario` handler should:
1. **Keep existing characters** — don't clear `state.characters`
2. **Reset scenario-specific state** — clear initiative, conditions, summons,
   reset health to maxHealth, clear exhausted/absent flags
3. **Keep persistent state** — name, edition, level, experience, loot, AMD

```typescript
// In handleSetScenario, instead of clearing characters:
for (const char of state.characters) {
  // Reset scenario-specific state
  char.initiative = 0;
  char.health = char.maxHealth;
  char.exhausted = false;
  char.longRest = false;
  char.entityConditions = [];
  char.summons = [];
  char.active = false;
  char.off = false;
  // Keep: name, edition, level, experience, loot, attackModifierDeck
}
```

If `setScenario` currently creates a fresh `GameState`, change it to preserve
the characters array while resetting scenario-specific fields.

### Party State

Also ensure characters are tracked on `state.party`. The party should have:

```typescript
// Party character entries (persistent across scenarios)
interface PartyCharacter {
  name: string;
  edition: string;
  level: number;
  experience: number;
  gold: number;
  // ... other persistent fields
}
```

If the Party type doesn't have character tracking, add it. When a character is
added, also add them to `state.party.characters`. When a scenario ends, sync
character experience/gold back to the party entry.

This may be complex — for Batch 5, the minimum viable version is:
1. `setScenario` does NOT clear `state.characters`
2. Characters reset their scenario-specific state (HP, conditions, initiative)
3. Characters persist between scenarios in the same game session

Full party/campaign persistence (saving between sessions, retirement, etc.) is
Phase T.

## STEP 3 — Scenario List Filtering

### The Problem

The scenario list in ScenarioSetupOverlay shows ALL scenarios. The user wants:
1. Only show **unlocked** scenarios (based on campaign state)
2. Option to **hide completed** scenarios
3. Option to filter for scenarios with **unlooted treasure chests**

### Data Available

From the scenario data files, each scenario has:
- `initial: true` — starting scenarios (always available)
- `unlocks: ["2", "3"]` — scenarios unlocked by completing this one
- `links: ["2"]` — related scenarios
- `treasures: [7, 38]` — treasure numbers in this scenario (per room)

From `GameState.party`:
- `party.scenarios` — should contain completed scenario info
- `party.achievements` — global/party achievements that may gate scenarios

### Implementation

Add filter controls to the scenario list in `ScenarioSetupOverlay`:

```tsx
function ScenarioSelector({ edition, playerCount, onSelect }: Props) {
  const { data: scenarios } = useScenarioList(edition);
  const [search, setSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const [treasureFilter, setTreasureFilter] = useState(false);

  // Get campaign state from game state
  const { state } = useGameState();
  const completedScenarios = new Set(
    state?.party?.scenarios?.filter(s => s.completed)?.map(s => s.index) || []
  );
  const unlockedScenarios = getUnlockedScenarios(scenarios || [], completedScenarios);

  const filtered = useMemo(() => {
    if (!scenarios) return [];
    return scenarios.filter(s => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        if (!s.index.toLowerCase().includes(q) &&
            !(s.name && s.name.toLowerCase().includes(q))) return false;
      }

      // Completed filter
      if (!showCompleted && completedScenarios.has(s.index)) return false;

      // Locked filter (unless showing all)
      if (!showLocked && !unlockedScenarios.has(s.index)) return false;

      // Treasure filter
      if (treasureFilter) {
        const hasTreasure = s.rooms?.some(r => r.treasures && r.treasures.length > 0);
        if (!hasTreasure) return false;
        // Could also check if treasures are unlooted from party state
      }

      return true;
    });
  }, [scenarios, search, showCompleted, showLocked, treasureFilter, completedScenarios]);

  return (
    <div class="setup-section">
      <h3 class="setup-section-title">Select Scenario</h3>

      {/* Search */}
      <input
        type="text"
        class="form-input"
        placeholder="Search by number or name..."
        value={search}
        onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
      />

      {/* Filters */}
      <div class="scenario-filters">
        <label class="filter-toggle">
          <input type="checkbox" checked={showCompleted}
            onChange={(e) => setShowCompleted((e.target as HTMLInputElement).checked)} />
          Show completed
        </label>
        <label class="filter-toggle">
          <input type="checkbox" checked={showLocked}
            onChange={(e) => setShowLocked((e.target as HTMLInputElement).checked)} />
          Show locked
        </label>
        <label class="filter-toggle">
          <input type="checkbox" checked={treasureFilter}
            onChange={(e) => setTreasureFilter((e.target as HTMLInputElement).checked)} />
          Has treasure
        </label>
      </div>

      {/* Scenario count */}
      <div class="scenario-count">
        {filtered.length} scenario{filtered.length !== 1 ? 's' : ''}
        {!showLocked && ` (unlocked)`}
      </div>

      {/* List */}
      <div class="scenario-list">
        {filtered.slice(0, 50).map(s => {
          const isCompleted = completedScenarios.has(s.index);
          return (
            <button
              key={`${s.edition || edition}:${s.index}`}
              class={`scenario-list-item ${isCompleted ? 'completed' : ''}`}
              onClick={() => onSelect(s.index, s.name || `Scenario ${s.index}`)}
            >
              <span class="scenario-number">#{s.index}</span>
              <span class="scenario-name">{s.name || 'Unnamed'}</span>
              {isCompleted && <span class="completed-badge">✓</span>}
              {s.monsters && (
                <span class="scenario-monster-count">{s.monsters.length} types</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Determine which scenarios are unlocked
function getUnlockedScenarios(
  allScenarios: ScenarioData[],
  completedScenarios: Set<string>
): Set<string> {
  const unlocked = new Set<string>();

  for (const s of allScenarios) {
    // Initial scenarios are always unlocked
    if (s.initial) {
      unlocked.add(s.index);
    }
  }

  // Scenarios unlocked by completed scenarios
  for (const s of allScenarios) {
    if (completedScenarios.has(s.index) && s.unlocks) {
      for (const u of s.unlocks) {
        unlocked.add(u);
      }
    }
  }

  return unlocked;
}
```

### CSS for filters

```css
.scenario-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: var(--space-3) 0;
}

.filter-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-family: 'Crimson Pro', serif;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.filter-toggle input[type="checkbox"] {
  accent-color: var(--accent-gold);
}

.scenario-count {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: var(--space-2);
}

.scenario-list-item.completed {
  opacity: 0.6;
}

.completed-badge {
  color: var(--health-green);
  font-weight: 700;
  margin-left: auto;
}
```

## STEP 4 — Auto-close overlay on Start Scenario

In `ScenarioSetupOverlay.tsx`, when the user confirms a scenario (clicks "Start
Scenario"), the overlay should auto-dismiss.

Find the confirmation handler. After calling the setScenario command, call
`onClose()`:

```tsx
const handleConfirmScenario = () => {
  commands.setScenario(selectedScenarioIndex, edition);
  onClose();  // ← add this
};
```

Verify this works for all paths: both the "Start Scenario" button in the preview
and any direct scenario selection.

## STEP 5 — Character Name Editing

### The Problem

Players want custom names (e.g., "Thorin" instead of just "Brute"). GHS supports
editable name fields on character cards.

### Implementation

Check if `Character` in `gameState.ts` has a `title` or `displayName` field.
From the GHS state map, there's a `title` field on Character. Use this.

Add a `renameCharacter` command if one doesn't exist:

**CommandSender:**
```typescript
renameCharacter(name: string, edition: string, title: string): void {
  this.send({ action: 'renameCharacter', payload: { name, edition, title } });
}
```

**applyCommand handler:**
```typescript
function handleRenameCharacter(state: GameState, payload: RenameCharacterPayload): void {
  const char = state.characters.find(c => c.name === payload.name && c.edition === payload.edition);
  if (char) {
    char.title = payload.title;
  }
}
```

Add the type to `commands.ts`.

### UI — Editable name in CharacterDetailOverlay

In `CharacterDetailOverlay.tsx`, make the character name at the top editable:

```tsx
const [editing, setEditing] = useState(false);
const [editName, setEditName] = useState(character.title || '');

// Display:
{editing ? (
  <input
    class="char-name-input"
    value={editName}
    onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
    onBlur={() => {
      if (editName.trim()) {
        commands.renameCharacter(character.name, edition, editName.trim());
      }
      setEditing(false);
    }}
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        (e.target as HTMLInputElement).blur();
      }
    }}
    autoFocus
  />
) : (
  <span class="char-detail-name" onClick={() => setEditing(true)}>
    {character.title || formatName(character.name)}
    <span class="edit-hint">✎</span>
  </span>
)}
```

### Display name in CharacterBar

Update `CharacterBar` to show `character.title` if set, falling back to
`formatName(character.name)`:

```tsx
const displayName = character.title || formatName(character.name);
```

## STEP 6 — Difficulty Modifier Labels

### The Problem

The level adjustment in ScenarioSetupOverlay shows "-2, -1, 0, +1, +2" which
is unclear. The user wants descriptive labels.

### Implementation

Update the level adjustment buttons in ScenarioSetupOverlay (the `LevelConfig`
section):

```tsx
const difficultyLabels: Record<number, string> = {
  [-2]: 'Very Easy (−2)',
  [-1]: 'Easy (−1)',
  [0]: 'Normal',
  [1]: 'Hard (+1)',
  [2]: 'Very Hard (+2)',
  [3]: 'Brutal (+3)',
  [4]: 'Nightmare (+4)',
};

// In the render:
<div class="difficulty-selector">
  <span class="label">Difficulty:</span>
  {[-2, -1, 0, 1, 2, 3, 4].map(adj => (
    <button
      key={adj}
      class={`difficulty-btn ${adj === adjustment ? 'active' : ''}`}
      onClick={() => {
        // Set level = autoLevel + adj
        const newLevel = Math.max(0, Math.min(7, autoLevel + adj));
        commands.setScenarioLevel(newLevel);
      }}
      title={difficultyLabels[adj]}
    >
      <span class="difficulty-label">{difficultyLabels[adj]}</span>
    </button>
  ))}
</div>
```

On iPad, showing all 7 buttons with labels may be too wide. Use a compact
format: show the label on the active button, show just the number on others:

```tsx
<button class={`difficulty-btn ${adj === adjustment ? 'active' : ''}`} ...>
  {adj === adjustment
    ? difficultyLabels[adj]
    : (adj > 0 ? `+${adj}` : adj)
  }
</button>
```

### CSS

```css
.difficulty-selector {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  margin: var(--space-3) 0;
}

.difficulty-btn {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-family: 'Crimson Pro', serif;
  font-size: 0.8rem;
  cursor: pointer;
  touch-action: manipulation;
  transition: all var(--transition-fast);
}

.difficulty-btn.active {
  border-color: var(--accent-gold);
  color: var(--accent-gold);
  background: linear-gradient(135deg, var(--bg-primary), rgba(212, 175, 55, 0.1));
  font-weight: 600;
}
```

## STEP 7 — CSS for all new components

Add styles to `app/controller/styles/controller.css`:
- EditionSelector (full-page centered grid)
- Scenario filters (checkbox toggles)
- Completed scenario badge
- Character name edit input
- Difficulty selector labels

Follow BEM naming from `app/CONVENTIONS.md`. Use spacing tokens from `theme.css`.

## STEP 8 — Verify

### Build

```powershell
node app/build.mjs
```

### Boot and test

**Edition selection:**
1. Connect to a fresh game code (no edition set)
2. Edition selector appears with available editions (GH, FH, etc.)
3. Edition cards show names and abbreviations with colored accents
4. Selecting an edition proceeds to the scenario view
5. Edition persists in localStorage — refresh doesn't re-prompt
6. Game state's edition is set after selection

**Party persistence:**
7. Add 3 characters
8. Set and complete a scenario (or just set a new scenario)
9. Characters persist — don't need to re-add
10. Character HP resets to maxHealth for new scenario
11. Character conditions/initiative cleared
12. XP and gold persist from previous scenario

**Scenario filtering:**
13. Scenario list shows only unlocked scenarios by default
14. "Show completed" checkbox reveals completed scenarios (dimmed with ✓)
15. "Show locked" checkbox reveals all scenarios
16. "Has treasure" checkbox filters to scenarios with treasure rooms
17. Search still works alongside filters
18. Filter counts update ("12 scenarios (unlocked)")

**Auto-close overlay:**
19. Select scenario → confirm → overlay auto-closes, main screen shows game

**Character names:**
20. Open character detail overlay
21. Click character name → editable input appears
22. Type custom name → blur or Enter saves
23. Character bar shows custom name
24. Custom name persists through round changes

**Difficulty modifier:**
25. Level adjustment shows descriptive labels (Very Easy, Easy, Normal, Hard, etc.)
26. Active difficulty shows full label
27. Selecting a difficulty updates the level correctly

## STEP 9 — Commit

```powershell
git add -A
git commit -m "feat: workflow — edition selection, party persistence, scenario filters, names

- EditionSelector: post-connection edition picker with colored cards,
  persists to localStorage, respects existing game state edition
- Party persistence: setScenario preserves characters, resets scenario-specific
  state (HP, conditions, initiative), keeps XP/gold/level
- Scenario filtering: unlocked/completed/treasure filters with checkbox toggles,
  getUnlockedScenarios() resolves from completed + unlock chains
- Auto-close overlay on scenario confirm
- Character name editing: renameCharacter command, editable name in detail overlay,
  displayName in CharacterBar (title || formatName)
- Difficulty modifier labels: Very Easy (-2) through Nightmare (+4)
- Fixes W1, W2, W3, W4, W6, V4 from playtest"
git push
```

Report: commit hash, bundle size, and which of the 27 verification checks pass.
Key items: does edition selection appear for fresh games, do characters persist
when setting a new scenario, and does the scenario filter default to unlocked only?
