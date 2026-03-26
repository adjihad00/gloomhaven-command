# R5 — Scenario Automation

> Paste into Claude Code. Wires the data layer into the controller UI for
> end-to-end scenario automation: select scenario → auto-spawn monsters,
> add characters from data-driven dropdowns, auto-calculate level, reveal
> rooms with auto-spawn. Fixes Critical gaps #2, #3, #6, #7, #9 from audit.

---

Read CLAUDE.md, then docs/GHS_AUDIT.md (Sections 2-4: Scenario Setup, Character
System, Monster System — especially the auto-spawn rules, level calculation,
and room reveal behavior).

Then read ALL of these — you need exact APIs:
- `app/controller/ScenarioView.tsx` — current implementation
- `app/controller/overlays/ScenarioSetupOverlay.tsx` — current implementation
- `app/components/ScenarioFooter.tsx` — current props and door rendering
- `app/components/ScenarioHeader.tsx` — current props
- `app/components/MonsterGroup.tsx` — how monster stats are passed
- `app/hooks/useDataApi.ts` — data fetch hooks
- `app/controller/hooks/useMonsterData.ts` — if it exists (from R4)
- `clients/shared/lib/commandSender.ts` — setScenario, revealRoom, addCharacter, setScenarioLevel method signatures
- `packages/shared/src/engine/applyCommand.ts` — how setScenario and revealRoom handlers work with DataContext
- `packages/shared/src/data/index.ts` — DataManager API (resolveRoomSpawns, getScenario, etc.)
- `packages/shared/src/data/types.ts` — ScenarioData, ScenarioRoom, ScenarioMonsterSpawn
- `packages/shared/src/data/levelCalculation.ts` — calculateScenarioLevel, deriveLevelValues, getPlayerCount
- `packages/shared/src/types/gameState.ts` — GameState.scenario, how rooms are tracked
- `server/src/index.ts` — data API endpoints

## What R1 Already Built (server-side)

The server's `applyCommand` with `DataContext` already handles:
- `setScenario`: loads scenario from data, auto-spawns Room 1 monsters based on
  player count, sets monster HP from stat tables
- `revealRoom`: loads room from scenario data, spawns room monsters based on
  current player count
- `addCharacter`: looks up maxHealth from character data by level
- `addEntity`: auto-fills maxHealth from monster stats

Level auto-calculation exists in `levelCalculation.ts` but may not be wired into
`setScenario` or the UI.

## What R5 Adds

1. **ScenarioSetupOverlay** rebuilt with real data-driven UI
2. **Scenario level auto-calculation** wired end-to-end
3. **Door controls** in ScenarioFooter using real scenario room data
4. **Scenario room state** tracked in GameState
5. **Shared ability deck** resolution on round start
6. **Player count** properly driving spawn counts

## STEP 1 — Investigate current state of scenario tracking

Read `packages/shared/src/types/gameState.ts` to understand how scenario room
state is tracked. Check:
- Does `GameState.scenario` have room data?
- Is there a `revealedRooms` array?
- How does the server know which rooms have been revealed?

If scenario room state isn't tracked in GameState, it needs to be added.

Read `packages/shared/src/engine/applyCommand.ts` to see the actual `setScenario`
handler. Check:
- Does it store the scenario data (rooms, monster list) on the state?
- Does it track which rooms are revealed?
- Does it auto-calculate level?

Document exactly what exists vs what's missing before making changes.

## STEP 2 — Add scenario room tracking to GameState (if needed)

If `GameState.scenario` doesn't track rooms and revealed state, enhance it.

Read the current `ScenarioModel` or scenario-related types in `gameState.ts`.
The state needs to track:

```typescript
// Minimum needed for room reveal automation
interface ScenarioRoomState {
  roomNumber: number;
  ref: string;           // tile reference (e.g., "G1b")
  revealed: boolean;
  initial: boolean;      // Room 1
  connectedRooms: number[];  // doors leading to these rooms
  marker?: string;       // section marker to read
}
```

If this isn't on GameState, add it. The `setScenario` handler should populate
this from the scenario data when a scenario is selected. The `revealRoom`
handler should set `revealed = true` for the specified room.

**IMPORTANT**: Read the actual types before modifying. The types may already
have this — `GameState` has `sections`, `scenarioRules`, etc. from the GHS
investigation. Use what exists rather than adding parallel structures.

## STEP 3 — Ensure setScenario stores room data on state

Read the `setScenario` handler in `applyCommand.ts`. After R1, it should:
1. Load scenario from DataContext
2. Auto-spawn Room 1 monsters
3. Set scenario name/edition on state

Verify it ALSO:
4. Stores room list on `state.scenario` (with revealed flags)
5. Auto-calculates scenario level from character levels
6. Sets `state.level` from the calculated level

If steps 4-6 are missing, add them. The level calculation should use:
```typescript
import { calculateScenarioLevel } from '../data/levelCalculation';

const characterLevels = state.characters
  .filter(c => !c.absent)
  .map(c => c.level);
const calculatedLevel = calculateScenarioLevel(characterLevels, state.levelAdjustment || 0);
state.level = calculatedLevel;
```

## STEP 4 — Ensure revealRoom auto-spawns and updates room state

Read the `revealRoom` handler. After R1, it should auto-spawn monsters.
Verify it ALSO:
- Marks the room as revealed in state
- Uses current player count (non-absent characters) for spawn resolution
- Assigns standee numbers correctly (continue from existing standees of same type)
- Adds new monster groups to `state.figures` array if the room introduces a new type

If the handler uses a raw `roomId` number, ensure the room data is looked up
from `state.scenario.rooms` or via DataContext.

## STEP 5 — Add scenario data API endpoint (if missing)

The client needs to fetch scenario room data to render door controls. Check if
`GET /api/data/:edition/scenario/:index` returns room information.

If it returns the full `ScenarioData` including rooms, good — the client can
use it directly.

If not, add the room data to the response.

Also add an endpoint to get a scenario's preview info (monster list, room count)
for the setup overlay:

```typescript
// This may already exist — check
app.get('/api/data/:edition/scenario/:index', (req, res) => {
  const data = dataManager.getScenario(req.params.edition, req.params.index);
  if (!data) return res.status(404).json({ error: 'Scenario not found' });
  // Return full scenario data including rooms and monster list
  res.json(data);
});
```

## STEP 6 — Rebuild ScenarioSetupOverlay with data-driven UI

This is the primary UI work. Replace the current `ScenarioSetupOverlay` content.

### Scenario Selection Section

```tsx
function ScenarioSelector({ edition, onSelect }: {
  edition: string;
  onSelect: (index: string, name: string) => void;
}) {
  const { data: scenarios, loading } = useScenarioList(edition);
  const [search, setSearch] = useState('');

  // Filter scenarios by search (number or name)
  const filtered = useMemo(() => {
    if (!scenarios) return [];
    if (!search) return scenarios;
    const q = search.toLowerCase();
    return scenarios.filter(s =>
      s.index.toLowerCase().includes(q) ||
      (s.name && s.name.toLowerCase().includes(q))
    );
  }, [scenarios, search]);

  return (
    <div class="setup-section">
      <h3 class="setup-section-title">Select Scenario</h3>
      <input
        type="text"
        class="form-input"
        placeholder="Search by number or name..."
        value={search}
        onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
      />
      {loading && <div class="loading">Loading scenarios...</div>}
      <div class="scenario-list">
        {filtered.slice(0, 50).map(s => (
          <button
            key={s.index}
            class="scenario-list-item"
            onClick={() => onSelect(s.index, s.name || `Scenario ${s.index}`)}
          >
            <span class="scenario-number">#{s.index}</span>
            <span class="scenario-name">{s.name || 'Unnamed'}</span>
            {s.monsters && (
              <span class="scenario-monster-count">{s.monsters.length} monster types</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Character Selection Section

```tsx
function CharacterSelector({ edition, existingCharacters, onAdd }: {
  edition: string;
  existingCharacters: Character[];
  onAdd: (name: string, edition: string, level: number) => void;
}) {
  const { data: characterList, loading } = useCharacterList(edition);
  const [selectedLevel, setSelectedLevel] = useState(1);

  // Filter out already-added characters
  const available = useMemo(() => {
    if (!characterList) return [];
    const existingNames = existingCharacters.map(c => c.name);
    return characterList.filter(c => !existingNames.includes(c.name));
  }, [characterList, existingCharacters]);

  return (
    <div class="setup-section">
      <h3 class="setup-section-title">Characters</h3>

      {/* Level selector */}
      <div class="level-selector">
        <span class="label">Level:</span>
        {[1,2,3,4,5,6,7,8,9].map(lvl => (
          <button
            key={lvl}
            class={`level-btn ${lvl === selectedLevel ? 'active' : ''}`}
            onClick={() => setSelectedLevel(lvl)}
          >
            {lvl}
          </button>
        ))}
      </div>

      {/* Available character classes */}
      {loading && <div class="loading">Loading classes...</div>}
      <div class="character-class-grid">
        {available.map(c => (
          <button
            key={c.name}
            class="character-class-btn"
            style={{ borderColor: c.color || 'var(--accent-copper)' }}
            onClick={() => onAdd(c.name, c.edition || edition, selectedLevel)}
          >
            <img
              src={characterThumbnail(c.edition || edition, c.name)}
              class="class-thumbnail"
            />
            <span class="class-name">{formatName(c.name)}</span>
            <span class="class-hp">HP: {c.stats?.find(s => s.level === selectedLevel)?.health ?? '?'}</span>
          </button>
        ))}
      </div>

      {/* Current party */}
      {existingCharacters.length > 0 && (
        <div class="current-party">
          <h4 class="label">Current Party ({existingCharacters.length})</h4>
          {existingCharacters.map(c => (
            <div key={c.name} class="party-member-row">
              <img src={characterThumbnail(c.edition, c.name)} class="party-thumbnail" />
              <span class="party-name">{formatName(c.name)}</span>
              <span class="party-level">Lv {c.level}</span>
              <span class="party-hp">{c.maxHealth} HP</span>
              <button
                class="btn-icon danger small"
                onClick={() => commands.removeCharacter(c.name, c.edition)}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Level Configuration Section

```tsx
function LevelConfig({ state, characters }: {
  state: GameState;
  characters: Character[];
}) {
  const commands = useCommands();

  const activeChars = characters.filter(c => !c.absent);
  const charLevels = activeChars.map(c => c.level);
  const autoLevel = calculateScenarioLevel(charLevels, 0);
  const adjustment = (state.levelAdjustment ?? 0);
  const effectiveLevel = Math.max(0, Math.min(7, autoLevel + adjustment));
  const levelValues = deriveLevelValues(effectiveLevel);

  return (
    <div class="setup-section">
      <h3 class="setup-section-title">Scenario Level</h3>

      <div class="level-auto">
        <span>Auto-calculated: <strong>{autoLevel}</strong></span>
        <span class="level-formula">
          (avg party level {(charLevels.reduce((a,b) => a+b, 0) / Math.max(1, charLevels.length)).toFixed(1)} ÷ 2, rounded up)
        </span>
      </div>

      <div class="level-adjustment">
        <span>Adjustment:</span>
        {[-2, -1, 0, 1, 2].map(adj => (
          <button
            key={adj}
            class={`adj-btn ${adj === adjustment ? 'active' : ''}`}
            onClick={() => commands.setScenarioLevel(Math.max(0, Math.min(7, autoLevel + adj)))}
          >
            {adj > 0 ? `+${adj}` : adj}
          </button>
        ))}
      </div>

      <div class="level-effective">
        <span>Effective Level: <strong>{effectiveLevel}</strong></span>
      </div>

      <div class="level-derived">
        <div class="derived-value">
          <span class="derived-label">Trap</span>
          <span class="derived-number">{levelValues.trapDamage}</span>
        </div>
        <div class="derived-value">
          <span class="derived-label">Gold</span>
          <span class="derived-number">{levelValues.goldConversion}</span>
        </div>
        <div class="derived-value">
          <span class="derived-label">XP</span>
          <span class="derived-number">{levelValues.bonusXP}</span>
        </div>
        <div class="derived-value">
          <span class="derived-label">Hazard</span>
          <span class="derived-number">{levelValues.hazardousTerrain}</span>
        </div>
      </div>

      {/* Manual override */}
      <div class="level-manual">
        <span class="label">Manual:</span>
        {[0,1,2,3,4,5,6,7].map(lvl => (
          <button
            key={lvl}
            class={`level-btn ${lvl === effectiveLevel ? 'active' : ''}`}
            onClick={() => commands.setScenarioLevel(lvl)}
          >
            {lvl}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Scenario Preview (shown after selecting a scenario, before confirming)

```tsx
function ScenarioPreview({ edition, scenarioIndex, playerCount, onConfirm, onCancel }: {
  edition: string;
  scenarioIndex: string;
  playerCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { data: scenario } = useDataApi<ScenarioData>(`${edition}/scenario/${scenarioIndex}`);

  if (!scenario) return <div class="loading">Loading scenario data...</div>;

  // Preview Room 1 spawns
  const room1 = scenario.rooms?.find(r => r.initial);
  const room1Spawns = room1 ? resolveSpawnsForPreview(room1, playerCount) : [];

  return (
    <div class="scenario-preview">
      <h3>#{scenario.index}: {scenario.name || 'Unnamed'}</h3>

      <div class="preview-info">
        <span>{scenario.rooms?.length ?? 0} rooms</span>
        <span>{scenario.monsters?.length ?? 0} monster types</span>
      </div>

      {scenario.monsters && (
        <div class="preview-monsters">
          <h4>Monsters in this scenario:</h4>
          {scenario.monsters.map(name => (
            <div key={name} class="preview-monster-row">
              <img src={monsterThumbnail(edition, name)} class="preview-monster-icon" />
              <span>{formatName(name)}</span>
            </div>
          ))}
        </div>
      )}

      {room1Spawns.length > 0 && (
        <div class="preview-spawns">
          <h4>Room 1 spawns ({playerCount} players):</h4>
          {room1Spawns.map((s, i) => (
            <span key={i} class={`spawn-badge ${s.type}`}>
              {formatName(s.monsterName)} ({s.type})
            </span>
          ))}
        </div>
      )}

      <div class="preview-actions">
        <button class="btn btn-secondary" onClick={onCancel}>Back</button>
        <button class="btn btn-primary" onClick={onConfirm}>Start Scenario</button>
      </div>
    </div>
  );
}

// Client-side spawn preview (mirrors server logic)
function resolveSpawnsForPreview(room: any, playerCount: number) {
  const spawns: { monsterName: string; type: string }[] = [];
  for (const m of room.monster || []) {
    if (m.type) spawns.push({ monsterName: m.name, type: m.type });
    if (m.player2 && playerCount >= 2) spawns.push({ monsterName: m.name, type: m.player2 });
    if (m.player3 && playerCount >= 3) spawns.push({ monsterName: m.name, type: m.player3 });
    if (m.player4 && playerCount >= 4) spawns.push({ monsterName: m.name, type: m.player4 });
  }
  return spawns;
}
```

### Assembly — Full ScenarioSetupOverlay

Wire these sub-components together with a step flow:
1. If no characters: show CharacterSelector first
2. If characters but no scenario: show ScenarioSelector
3. After selecting scenario: show ScenarioPreview with confirm
4. Level config always visible when characters exist
5. After confirming scenario: close overlay, game begins

The overlay should also show when a scenario IS active (for mid-game adjustments):
- Current scenario info
- Room door buttons (reveal unrevealed rooms)
- Add/remove characters
- Level adjustment
- Add/remove monster groups manually

## STEP 7 — Build door controls in ScenarioFooter

Update `app/components/ScenarioFooter.tsx` to show proper door icons.

The footer needs scenario room data to render doors. This data comes from
the game state (if rooms are tracked) or from a data API call.

```tsx
// Door rendering in footer
function DoorControls({ scenarioRooms, onRevealRoom }: {
  scenarioRooms: ScenarioRoomState[];
  onRevealRoom: (roomNumber: number) => void;
}) {
  if (!scenarioRooms || scenarioRooms.length <= 1) return null;

  // Separate revealed and unrevealed (skip Room 1 — always revealed)
  const nonInitialRooms = scenarioRooms.filter(r => !r.initial);

  return (
    <div class="door-controls">
      {nonInitialRooms.map(room => (
        <button
          key={room.roomNumber}
          class={`door-btn ${room.revealed ? 'revealed' : 'closed'}`}
          onClick={() => !room.revealed && onRevealRoom(room.roomNumber)}
          disabled={room.revealed}
          title={room.revealed
            ? `Room ${room.roomNumber} (${room.ref}) — revealed`
            : `Open door to ${room.ref}`
          }
        >
          <span class="door-icon">{room.revealed ? '🚪' : '🔒'}</span>
          <span class="door-ref">{room.ref}</span>
          {room.marker && !room.revealed && (
            <span class="door-section-marker">§</span>
          )}
        </button>
      ))}
    </div>
  );
}
```

Update ScenarioFooter props to accept `scenarioRooms: ScenarioRoomState[]`
instead of the simpler `doors` prop from R4. Update ScenarioView to pass
room data from state.

## STEP 8 — Wire scenario room data into ScenarioView

Update `app/controller/ScenarioView.tsx`:

```tsx
// Get scenario rooms from state
const scenarioRooms = useMemo(() => {
  if (!state?.scenario) return [];
  // Read rooms from state.scenario — however they're stored
  // This depends on what setScenario puts on the state
  return state.scenario.rooms || [];
}, [state?.scenario]);
```

If the state doesn't have room data, fetch it from the API:

```tsx
const { data: scenarioData } = useDataApi<ScenarioData>(
  state?.scenario ? `${edition}/scenario/${state.scenario.index}` : '',
  !!state?.scenario
);

const scenarioRooms = useMemo(() => {
  if (!scenarioData?.rooms) return [];
  const revealedSet = new Set(state?.scenario?.revealedRooms || []);
  return scenarioData.rooms.map(r => ({
    roomNumber: r.roomNumber,
    ref: r.ref,
    revealed: r.initial || revealedSet.has(r.roomNumber),
    initial: r.initial || false,
    connectedRooms: r.rooms || [],
    marker: r.marker,
  }));
}, [scenarioData, state?.scenario]);
```

## STEP 9 — Shared ability deck tracking

From the audit (Gap #6): multiple monster types can share one ability deck
(e.g., bandit-guard and city-guard both use "guard" deck).

Check how `drawMonsterAbility` works in `applyCommand.ts`. When drawing for
one monster, if another monster shares the same deck name, both should
reference the same drawn card.

Read the MonsterData type — it has a `deck` field pointing to the shared
deck name. Check if the server resolves this correctly.

If shared decks aren't handled:
1. When `setScenario` spawns monsters, group them by `deck` name
2. Store one ability deck state per unique deck name (not per monster group)
3. When drawing, resolve against the deck name, not the monster name
4. All monster groups referencing that deck get the same drawn ability

This may require changes to:
- How monster ability state is stored in GameState (currently `monster.ability` index)
- How `drawMonsterAbility` resolves the deck
- The `useMonsterData` hook to resolve ability cards via shared deck name

If this is too complex for R5, document what needs to change and defer to R6.
But at minimum, the correct ability deck name should be looked up and displayed.

## STEP 10 — Level auto-calculation on character add/remove

When a character is added or removed, the scenario level should auto-recalculate.
This happens server-side.

Check if `applyCommand` for `addCharacter` and `removeCharacter` recalculates
`state.level`. If not, add it — after adding/removing a character, recompute:

```typescript
const characterLevels = state.characters
  .filter(c => !c.absent && !c.exhausted)
  .map(c => c.level);
state.level = calculateScenarioLevel(characterLevels, state.levelAdjustment || 0);
```

Also recalculate when toggling absent/exhausted.

## STEP 11 — CSS for scenario setup

Add styles to `app/controller/styles/controller.css` or `app/shared/styles/components.css`:

- `.scenario-list`: scrollable list of scenario entries, max-height 300px
- `.scenario-list-item`: clickable row with number + name + monster count
- `.character-class-grid`: grid of character class cards (3-4 columns on iPad)
- `.character-class-btn`: card with thumbnail, name, HP preview
- `.level-selector`, `.level-btn`: row of numbered buttons, active = gold
- `.level-auto`, `.level-adjustment`, `.level-derived`: level config sections
- `.derived-value`: compact pill with label + number
- `.scenario-preview`: preview card with monster list and spawn preview
- `.spawn-badge`: colored pill (normal=grey, elite=gold, boss=red)
- `.party-member-row`: compact row with thumbnail, name, level, HP, remove
- `.door-btn.closed`: copper border, clickable, hover glow
- `.door-btn.revealed`: dimmed, open door icon, disabled
- `.door-section-marker`: small § indicator for sections to read

## STEP 12 — Verify

### Build

```powershell
node app/build.mjs
```

### Boot and test

```powershell
npx tsx server/src/index.ts
```

Open controller. Connect to a fresh game code.

**Scenario setup flow:**
1. Click ☰ → Scenario Setup
2. Character class grid shows real GH/FH classes with thumbnails and HP
3. Add 3 characters (e.g., Brute L3, Spellweaver L3, Cragheart L4)
4. Level auto-calculates (should be ~2 for those levels)
5. Level derived values show (Trap:4, Gold:3, XP:8 for L2)
6. Scenario list shows real scenarios with search
7. Select Scenario 1 (Black Barrow)
8. Preview shows monster types and Room 1 spawn preview
9. Confirm → monsters auto-spawn on the main screen
10. Monster groups appear with correct HP from data (not 0 or hardcoded)
11. Each monster standee has correct normal/elite type based on player count

**Door controls:**
12. Footer shows door icons for rooms 2 and 3 (Room 1 auto-revealed)
13. Clicking a door icon reveals the room
14. New monsters auto-spawn with correct HP
15. New standees added to existing groups or new groups created
16. Revealed doors show as open/dimmed

**Level recalculation:**
17. Adding/removing a character recalculates scenario level
18. Level adjustment buttons work (−2 to +2)
19. Manual level override works

**Monster stats:**
20. Monster stat cards show real stats from data (HP, Move, Attack, Range)
21. Normal and elite columns show different values
22. Stats match the current scenario level

## STEP 13 — Update ROADMAP.md

```markdown
- [x] R5: Scenario automation — data-driven setup, auto-spawn, room reveal, level calc
```

## STEP 14 — Commit

```powershell
git add -A
git commit -m "feat: scenario automation — data-driven setup, auto-spawn, room reveals

- ScenarioSetupOverlay: real character class grid from data API with
  thumbnails, HP preview, and level selector
- ScenarioSelector: searchable scenario list from data API
- ScenarioPreview: monster list and Room 1 spawn preview before confirming
- Level auto-calculation: avg party level / 2 with adjustment (−2 to +2)
- Level derived values: trap, gold, XP, hazardous terrain
- Door controls in footer: closed/revealed state, click to reveal
- Room reveal auto-spawns monsters from scenario data
- Monster HP auto-set from stat tables at scenario level
- Level recalculates on character add/remove/absent/exhausted
- Shared ability deck name resolution
- Fixes Critical gaps #2, #3, #7, #9 from GHS audit"
git push
```

Report: commit hash, bundle size, and which of the 22 verification checks pass.
Specifically: does selecting Scenario 1 with 3 players auto-spawn the correct
monsters with real HP values?
