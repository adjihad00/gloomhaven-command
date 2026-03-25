# Phase 2D — Monster Management Tab

> Paste into Claude Code. Implements the Monsters tab: add/remove monster groups,
> add/remove standees, monster ability card draw, and the monster modifier deck.

---

Read CLAUDE.md, then docs/PROJECT_CONTEXT.md, then docs/GHS_STATE_MAP.md.

Then read these files in full — exact APIs matter:
- `clients/shared/lib/commandSender.ts` — **every method signature**. This is your command API. Do NOT guess names from the 2A prompt — read the actual file.
- `clients/shared/lib/stateStore.ts` — derived getters
- `clients/controller/src/main.ts` — `getStore()`, `getCommands()`, `getGameCode()`
- `clients/controller/src/tabs/activePlay.ts` — reference for patterns: global handler registration, render-on-subscribe, event delegation, `formatName()` utility, asset URL patterns
- `packages/shared/src/types/gameState.ts` — Monster, MonsterEntity, AttackModifierDeck types
- `packages/shared/src/types/commands.ts` — command payloads for monster operations
- `packages/shared/src/utils/conditions.ts` — NEGATIVE_CONDITIONS

Also browse the GHS data files to understand monster data structure:
```powershell
Get-ChildItem "C:\Projects\gloomhaven-command\.staging\ghs-client\assets\data" -Recurse -Filter "*.json" | Select-Object Name -First 20
```
Read one edition data file (e.g. `gh.json` or the file containing monster definitions) to see the monster name/stat structure. The controller needs to know what monsters are available for the "Add Monster" feature.

## Architecture

The Monsters tab is separate from Active Play. Active Play shows monsters in a compact read/mutate view for in-round gameplay. The Monsters tab is for **setup and management** between rounds or during scenario prep:

- Add new monster groups to the scenario
- Add/remove individual standees (choose number + normal/elite/boss)
- View and draw monster ability cards
- Manage the monster attack modifier deck (draw, shuffle, bless/curse)
- Set monster level
- Remove entire monster groups

The tab renders into `#tabMonsters`. It exports `initMonsterTab()` called by main.ts.

## STEP 1 — Create `clients/controller/src/tabs/monsterMgmt.ts`

Replace the stub.

### Structure

```
#tabMonsters
├── Add Monster Section (top)
│   ├── Edition selector (dropdown)
│   ├── Monster name selector (dropdown, filtered by edition)
│   ├── Level display (matches scenario level)
│   └── "Add Monster Group" button
│
├── Active Monster Groups
│   ├── Monster Group Card (for each monster in state)
│   │   ├── Header: name + level + remove group button (✕)
│   │   ├── Add Standee Row: number input + type selector (normal/elite) + add button
│   │   ├── Standee List (existing standees)
│   │   │   ├── Standee: # + type badge + HP display + remove button
│   │   │   └── ... more standees
│   │   ├── Ability Card Section
│   │   │   ├── Current ability (index display)
│   │   │   ├── "Draw Ability" button
│   │   │   └── "Shuffle Abilities" button (if applicable)
│   │   └── Expand/collapse toggle
│   └── ... more groups
│
├── Monster Modifier Deck Section
│   ├── Deck status: cards remaining / total
│   ├── Last drawn card display
│   ├── "Draw Card" button
│   ├── "Shuffle Deck" button
│   ├── Bless/Curse controls: add/remove bless, add/remove curse
│   └── Deck composition summary
│
└── Empty state (if no monsters)
```

### Imports

```typescript
import { getStore, getCommands, getGameCode } from '../main.js';
import type { GameState, Monster, MonsterEntity } from '@gloomhaven-command/shared';
import { NEGATIVE_CONDITIONS } from '@gloomhaven-command/shared';
```

### `initMonsterTab(): void`

1. Subscribe to store: `getStore().subscribe(renderMonsterTab)`
2. Register global event handlers for this tab
3. Load monster name list from GHS data files (see Step 2)
4. Initial render

### Monster Name Data

The "Add Monster" feature needs a list of available monster names per edition. Two approaches:

**Option A (preferred):** Load the GHS edition data JSON from `/assets/ghs/data/` via fetch at tab init. These files contain monster definitions with names and stat blocks. Parse the JSON, extract monster names grouped by edition. Cache the result.

```typescript
let monsterDatabase: Map<string, string[]> = new Map(); // edition → monster names

async function loadMonsterData(): Promise<void> {
  // Try loading edition data files
  const editions = ['gh', 'fh', 'jotl', 'fc', 'cs'];
  for (const ed of editions) {
    try {
      const resp = await fetch(`/assets/ghs/data/${ed}.json`);
      if (resp.ok) {
        const data = await resp.json();
        // GHS edition data has a "monsters" array with name fields
        // Inspect the actual JSON structure and extract accordingly
        const names = extractMonsterNames(data);
        if (names.length > 0) monsterDatabase.set(ed, names);
      }
    } catch { /* edition not available */ }
  }
}
```

Read the actual GHS data JSON structure to implement `extractMonsterNames()`. The format varies — it might be `data.monsters[].name` or a different path. Inspect the file.

**Option B (fallback):** If data files aren't available or the structure is unclear, allow free-text monster name input instead of a dropdown. The server doesn't validate monster names — any string works.

Implement Option A with Option B as fallback (if fetch fails, show a text input instead of a dropdown).

### Rendering

#### Add Monster Section

```typescript
function renderAddMonster(state: GameState): string {
  const editions = Array.from(monsterDatabase.keys());
  const currentEdition = state.edition || editions[0] || 'gh';
  const monsterNames = monsterDatabase.get(currentEdition) || [];

  // Filter out monsters already in the game
  const existingNames = state.monsters.map(m => m.name);
  const availableNames = monsterNames.filter(n => !existingNames.includes(n));

  if (monsterDatabase.size === 0) {
    // Fallback: free text input
    return `
      <div class="mgmt-add-section">
        <h3 class="section-title heading-sm">Add Monster Group</h3>
        <div class="add-monster-row">
          <input type="text" id="monsterNameInput" class="form-input" placeholder="Monster name">
          <input type="text" id="monsterEditionInput" class="form-input" placeholder="Edition" value="${currentEdition}" style="width:80px">
          <button class="btn btn-primary btn-sm" onclick="window._gcAddMonsterGroup()">Add</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="mgmt-add-section">
      <h3 class="section-title heading-sm">Add Monster Group</h3>
      <div class="add-monster-row">
        <select id="monsterEditionSelect" class="form-input form-select" onchange="window._gcEditionChanged()">
          ${editions.map(ed => `<option value="${ed}" ${ed === currentEdition ? 'selected' : ''}>${ed.toUpperCase()}</option>`).join('')}
        </select>
        <select id="monsterNameSelect" class="form-input form-select flex-grow">
          ${availableNames.map(n => `<option value="${n}">${formatName(n)}</option>`).join('')}
          ${availableNames.length === 0 ? '<option disabled>All monsters added</option>' : ''}
        </select>
        <button class="btn btn-primary btn-sm" onclick="window._gcAddMonsterGroup()"
                ${availableNames.length === 0 ? 'disabled' : ''}>Add</button>
      </div>
    </div>
  `;
}
```

#### Monster Group Cards

Each active monster gets a management card:

```typescript
function renderMonsterGroup(monster: Monster, state: GameState): string {
  const entities = (monster.entities || []).sort((a, b) => a.number - b.number);
  const liveEntities = entities.filter(e => !e.dead);
  const deadEntities = entities.filter(e => e.dead);

  // Find next available standee number
  const usedNumbers = entities.map(e => e.number);
  let nextNumber = 1;
  while (usedNumbers.includes(nextNumber)) nextNumber++;

  return `
    <div class="mgmt-monster-card">
      <div class="mgmt-monster-header">
        <div class="mgmt-monster-info">
          <img src="/assets/ghs/images/monster/thumbnail/${monster.edition}-${monster.name}.png"
               class="mgmt-monster-icon" alt="${monster.name}"
               onerror="this.style.display='none'">
          <div>
            <span class="mgmt-monster-name">${formatName(monster.name)}</span>
            <span class="mgmt-monster-level">Lv ${monster.level}</span>
          </div>
        </div>
        <div class="mgmt-monster-actions">
          <span class="mgmt-entity-count">${liveEntities.length} active</span>
          <button class="btn-icon danger" onclick="window._gcRemoveMonsterGroup('${monster.name}', '${monster.edition}')"
                  title="Remove group">✕</button>
        </div>
      </div>

      <!-- Add Standee -->
      <div class="mgmt-add-standee">
        <span class="mgmt-label">Add Standee:</span>
        <input type="number" class="form-input form-input-sm standee-number-input"
               id="standeeNum_${monster.name}" value="${nextNumber}" min="1" max="20" style="width:60px">
        <select class="form-input form-select form-input-sm" id="standeeType_${monster.name}">
          <option value="normal">Normal</option>
          <option value="elite">Elite</option>
          <option value="boss">Boss</option>
        </select>
        <button class="btn btn-secondary btn-sm"
                onclick="window._gcAddStandee('${monster.name}', '${monster.edition}')">+</button>
      </div>

      <!-- Live Standees -->
      ${liveEntities.length > 0 ? `
        <div class="mgmt-standee-list">
          ${liveEntities.map(e => renderStandeeRow(monster, e, false)).join('')}
        </div>
      ` : '<div class="mgmt-empty">No standees</div>'}

      <!-- Dead Standees (collapsed) -->
      ${deadEntities.length > 0 ? `
        <details class="mgmt-dead-section">
          <summary class="mgmt-dead-summary">${deadEntities.length} dead</summary>
          <div class="mgmt-standee-list dead-list">
            ${deadEntities.map(e => renderStandeeRow(monster, e, true)).join('')}
          </div>
        </details>
      ` : ''}

      <!-- Ability Cards -->
      <div class="mgmt-ability-section">
        <div class="mgmt-ability-header">
          <span class="mgmt-label">Ability:</span>
          <span class="mgmt-ability-value">
            ${monster.ability !== undefined && monster.ability >= 0
              ? `Card #${monster.ability}`
              : 'Not drawn'}
          </span>
        </div>
        <div class="mgmt-ability-actions">
          <button class="btn btn-secondary btn-sm"
                  onclick="window._gcDrawAbility('${monster.name}', '${monster.edition}')">Draw</button>
          <button class="btn btn-secondary btn-sm"
                  onclick="window._gcShuffleAbilities('${monster.name}', '${monster.edition}')">Shuffle</button>
        </div>
      </div>
    </div>
  `;
}
```

#### Standee Row (compact)

```typescript
function renderStandeeRow(monster: Monster, entity: MonsterEntity, isDead: boolean): string {
  const typeBadge = entity.type === 'elite' ? 'E' : entity.type === 'boss' ? 'B' : 'N';
  const typeClass = entity.type === 'elite' ? 'elite' : entity.type === 'boss' ? 'boss' : 'normal';

  return `
    <div class="mgmt-standee-row ${typeClass} ${isDead ? 'dead' : ''}">
      <span class="mgmt-standee-number">${entity.number}</span>
      <span class="mgmt-standee-type ${typeClass}">${typeBadge}</span>
      <span class="mgmt-standee-hp">${entity.health}/${entity.maxHealth}</span>
      <button class="btn-icon small" title="Remove standee"
              onclick="window._gcRemoveStandee('${monster.name}', '${monster.edition}', ${entity.number})">✕</button>
    </div>
  `;
}
```

#### Monster Modifier Deck Section

```typescript
function renderModifierDeck(state: GameState): string {
  const deck = state.monsterAttackModifierDeck;
  if (!deck) return '';

  const totalCards = deck.cards?.length || 0;
  const drawn = deck.drawn?.length || deck.current || 0;
  const remaining = Math.max(0, totalCards - drawn);

  return `
    <div class="mgmt-modifier-section">
      <h3 class="section-title heading-sm">Monster Modifier Deck</h3>

      <div class="mgmt-modifier-status">
        <span class="mgmt-modifier-count">${remaining} / ${totalCards} remaining</span>
      </div>

      <div class="mgmt-modifier-controls">
        <button class="btn btn-secondary btn-sm" onclick="window._gcDrawModifier()">
          Draw Card
        </button>
        <button class="btn btn-secondary btn-sm" onclick="window._gcShuffleModifier()">
          Shuffle Deck
        </button>
      </div>

      <div class="mgmt-modifier-bless-curse">
        <div class="mgmt-bc-row">
          <span class="mgmt-label">Bless:</span>
          <button class="btn-icon small" onclick="window._gcRemoveModifierCard('bless')">−</button>
          <button class="btn-icon small" onclick="window._gcAddModifierCard('bless')">+</button>
        </div>
        <div class="mgmt-bc-row">
          <span class="mgmt-label">Curse:</span>
          <button class="btn-icon small" onclick="window._gcRemoveModifierCard('curse')">−</button>
          <button class="btn-icon small" onclick="window._gcAddModifierCard('curse')">+</button>
        </div>
      </div>
    </div>
  `;
}
```

### Global Event Handlers

Register on `window` in `initMonsterTab()`. Read `commandSender.ts` for exact method signatures:

```typescript
function registerMonsterHandlers(): void {
  const commands = getCommands();

  window._gcAddMonsterGroup = () => {
    // Read from dropdown or text input, call the correct addMonsterGroup command
    // Check if commandSender has addMonsterGroup. If not, this may be part of
    // a different command. Read the actual file.
  };

  window._gcRemoveMonsterGroup = (name: string, edition: string) => {
    commands.removeMonsterGroup(name, edition);
  };

  window._gcAddStandee = (monsterName: string, edition: string) => {
    const numInput = document.getElementById(`standeeNum_${monsterName}`) as HTMLInputElement;
    const typeSelect = document.getElementById(`standeeType_${monsterName}`) as HTMLSelectElement;
    const number = parseInt(numInput.value) || 1;
    const type = typeSelect.value as 'normal' | 'elite' | 'boss';
    commands.addEntity(monsterName, edition, number, type);
  };

  window._gcRemoveStandee = (monsterName: string, edition: string, entityNumber: number) => {
    commands.removeEntity(monsterName, edition, entityNumber);
  };

  window._gcDrawAbility = (monsterName: string, edition: string) => {
    commands.drawMonsterAbility(monsterName, edition);
  };

  window._gcShuffleAbilities = (monsterName: string, edition: string) => {
    // Check commandSender for the correct shuffle abilities method name
    commands.shuffleMonsterAbilities(monsterName, edition);
  };

  window._gcDrawModifier = () => {
    commands.drawModifierCard('monster');
  };

  window._gcShuffleModifier = () => {
    commands.shuffleModifierDeck('monster');
  };

  window._gcAddModifierCard = (cardType: 'bless' | 'curse') => {
    commands.addModifierCard('monster', cardType);
  };

  window._gcRemoveModifierCard = (cardType: 'bless' | 'curse') => {
    commands.removeModifierCard('monster', cardType);
  };

  window._gcEditionChanged = () => {
    // Re-render monster name dropdown
    renderMonsterTab(getStore().getState()!);
  };
}
```

**CRITICAL:** Read `commandSender.ts` to confirm every method exists with the exact name and signature shown above. Phase 2A corrections noted that some commands were renamed or removed. If `addMonsterGroup`, `removeMonsterGroup`, `shuffleMonsterAbilities`, `addModifierCard`, `removeModifierCard`, or `drawModifierCard` don't exist on CommandSender, find the correct method or add them.

If any commands are missing from CommandSender, add them to `clients/shared/lib/commandSender.ts`. If the corresponding command action doesn't exist in `commands.ts`, it needs to be added there too plus handled in `applyCommand.ts` and `validateCommand.ts` on the server. Flag which commands you had to add in the commit message.

Add TypeScript declarations for all `window._gc*` handlers.

### Assembly

```typescript
function renderMonsterTab(state: GameState | null): void {
  if (!state) return;
  const panel = document.getElementById('tabMonsters')!;

  const monsterGroups = state.monsters || [];

  panel.innerHTML = [
    renderAddMonster(state),
    monsterGroups.length > 0
      ? `<div class="mgmt-groups">${monsterGroups.map(m => renderMonsterGroup(m, state)).join('')}</div>`
      : '<div class="empty-state">No monster groups. Add one above.</div>',
    renderModifierDeck(state)
  ].join('');
}
```

### Utility

Reuse `formatName` from activePlay.ts. Either move it to a shared utility file (`clients/controller/src/utils.ts`) or re-declare it. Moving to a shared util is cleaner — both tabs import it.

## STEP 2 — Write Monster Management CSS

Append to `clients/controller/styles/controller.css`:

### Add Monster section
- Horizontal row: edition dropdown (80px) + monster name dropdown (flex-grow) + Add button
- Dropdowns styled to match theme: dark background, copper border, gold text
- Compact layout — this sits at the top of the tab

### Monster group cards
- Full-width cards with copper border, card background
- Header: monster thumbnail (40x40) + name + level + entity count + remove button
- Add Standee row: inline form with number input + type dropdown + add button
- Standee list: compact rows with number circle + type badge + HP + remove button
- Elite standees: gold-tinted type badge
- Boss standees: red-tinted type badge
- Dead standees: 30% opacity, collapsible `<details>` section
- Ability section: inline display with draw/shuffle buttons

### Modifier deck section
- Card with deck status, draw/shuffle buttons
- Bless/curse row: label + −/+ buttons inline

### Shared patterns
- `.btn-sm`: smaller padding variant of `.btn`
- `.btn-icon`: small square icon button (32x32), border only, no background
- `.btn-icon.danger`: red border/text
- `.btn-icon.small`: 24x24 variant
- `.form-select`: styled `<select>` matching `.form-input` theme
- `.form-input-sm`: smaller input variant
- `.mgmt-label`: small uppercase label text
- `.flex-grow`: `flex: 1`

## STEP 3 — Wire into main.ts

Edit `clients/controller/src/main.ts`:
1. Import `initMonsterTab` from `./tabs/monsterMgmt.js`
2. Call `initMonsterTab()` in `enterGameScreen()` alongside `initActivePlayTab()`

## STEP 4 — Verify

Build and test:
```powershell
npm run build --workspace=clients/controller
npx tsx server/src/index.ts
```

Connect to the test game. Switch to the Monsters tab. Verify:

1. Add Monster section shows edition dropdown and monster name list (or text input if data files aren't loaded)
2. Selecting a monster and clicking Add creates a new monster group
3. Monster group card appears with name, level, and empty standee list
4. Adding a standee (number + type) creates an entity
5. Standee appears in the list with correct type badge
6. Remove standee button (✕) removes the entity
7. Remove group button (✕) removes the entire monster group
8. Draw Ability button works (ability value updates)
9. Modifier deck section shows card count
10. Draw Card, Shuffle Deck, Bless +/-, Curse +/- buttons work
11. All changes are reflected in the Active Play tab (switch tabs to confirm)
12. All changes persist across reconnection

If any commands fail with server errors, check the server logs for validation failures and fix the command payloads.

## STEP 5 — Update ROADMAP.md

Mark complete:
- [x] Build Monster Management tab — ability cards, standees, modifier deck

## STEP 6 — Commit

```powershell
git add -A
git commit -m "feat(controller): implement Monster Management tab

- Add/remove monster groups with edition and name selection
- Add/remove individual standees (number, type: normal/elite/boss)
- Monster ability card draw and shuffle
- Monster modifier deck: draw, shuffle, bless/curse management
- GHS data file loading for monster name dropdowns
- Standee list with type badges and HP display
- Dead standees in collapsible section
- All mutations via server commands"
git push
```

Report: commit hash, bundle size, which of the 12 checks pass, and any commands that had to be added to CommandSender or the server.
