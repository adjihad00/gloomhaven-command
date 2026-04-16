# Phase 5.2: Wire Consumers & Ability Renderer — Claude Code Prompt

## Context

You are continuing work on **Gloomhaven Command** (`adjihad00/gloomhaven-command`). Phase 5.1 built a reference SQLite database (`data/reference.db`) with 42,948 rows across 17 tables, an import script, and 8 new `/api/ref/` endpoints. The database contains:
- 11,432 label entries (flattened dot-notation keys from GHS `label/en.json`)
- 1,666 monster ability cards with full action trees and label-resolved names
- 663 scenarios with structured `rules_json` and `sections_json`
- 6,800 monster stat rows, 557 monsters, 270 ability decks
- 11,188 asset manifest entries

**Goal of this prompt:** Wire all consumer components to fetch real data from the `/api/ref/` endpoints, replacing every "See Scenario Book" placeholder and extending the display's monster ability card renderer from 5 action types to all 30+.

---

## CRITICAL: Codebase State at Commit `eb89650`

### New from Phase 5.1 — DO NOT recreate these:
- `server/src/referenceDb.ts` — `ReferenceDb` class with schema, insert helpers, query methods
- `scripts/import-data.ts` — Import pipeline from `.staging/` sources
- `server/src/index.ts` lines 56-59 — `refDb` loaded at startup
- `server/src/index.ts` lines 175-223 — 8 `/api/ref/` endpoints

### Available API endpoints (reference data):
```
GET /api/ref/scenario-text/:edition/:index
    Returns: { name, rules (parsed JSON array), rulesLabels (Record<string, string>) }
    - rules = structured rule objects from scenario JSON (triggers, conditions, spawns)
    - rulesLabels = human-readable text from labels matching prefix "scenario.rules.{edition}.{scenarioIndex}"
    - Label values may contain %game.action.X% placeholders for inline icons

GET /api/ref/ability-cards/:edition/:deck
    Returns: Array<{ card_id, name (from labels or null), initiative, shuffle, actions_json }>
    - actions_json = full action tree including sub-actions, conditions, elements, summons

GET /api/ref/labels/:edition?prefix=...
    Returns: Record<string, string> — all labels matching prefix

GET /api/ref/label/:edition/:key
    Returns: { value } — single label value

GET /api/ref/section/:edition/:sectionId
    Returns: { section_id, parent_scenario, name, conclusion, monsters_json, rooms_json, rewards_json, rules_json }

GET /api/ref/items/:edition
GET /api/ref/assets/:edition/:category
GET /api/ref/asset/:edition/:category/:name
```

### Existing API endpoints (still needed — DataManager in-memory):
```
GET /api/data/:edition/monster/:name       — used by useDisplayMonsterData for innate stats
GET /api/data/:edition/monster-deck/:name  — currently used for ability cards (will be replaced)
GET /api/data/:edition/scenario/:index     — used by controller/phone for scenario metadata
```

### Consumer components that need wiring (verified placeholder locations):
```
app/display/ScenarioView.tsx:276-283
  → footerRules: { specialRules, winConditions, lossConditions } = 'See Scenario Book'
  → Needs: fetch /api/ref/scenario-text, parse rulesLabels, render in footer

app/display/hooks/useDisplayMonsterData.ts:64-91
  → Ability card: uses /api/data/ endpoint, extracts only move/attack/range/shield/heal
  → Card name: shows "Card ${cardId}" — no label lookup
  → Needs: switch to /api/ref/ability-cards, extract ALL action types, get real card names

app/display/components/DisplayFigureCard.tsx:54-93 (MonsterAbilityActions)
  → Renders action.type + action.value with actionIcon() + normal/elite totalization
  → Only handles numeric value actions — no conditions, elements, summons, targets, etc.
  → Needs: render all action types including non-numeric ones

app/display/components/DisplayMonsterAbility.tsx
  → Standalone ability display — only used by mock/prototype? Check usage.
  → Uses MockMonsterAbility type

app/controller/LobbyView.tsx:560-570 (step='rules')
  → "See Scenario Book for special rules and win conditions."
  → Has access to setupData.edition, setupData.scenarioIndex
  → Needs: fetch /api/ref/scenario-text, display real rules text

app/controller/overlays/SetupPhaseOverlay.tsx:119-131
  → Shows rule count + "Read from Scenario Book" or "See Scenario Book for details"
  → Has scenarioData from useDataApi
  → Needs: fetch /api/ref/scenario-text, display real text

app/controller/overlays/ScenarioSetupOverlay.tsx:389
  → "See Scenario Book for rules and win conditions" (deprecated overlay but still in repo)

app/phone/overlays/PhoneRulesOverlay.tsx:59-75
  → Shows rule count or "See Scenario Book"
  → Has setupData.edition, setupData.scenarioIndex, scenarioData from useDataApi
  → Needs: fetch /api/ref/scenario-text, display real text

app/phone/LobbyView.tsx:117-119
  → "See Scenario Book for details."
  → Has setupData.edition, setupData.scenarioIndex
  → Needs: fetch /api/ref/scenario-text, display real text
```

### Types that need updating:
```
app/display/mockData.ts — MockAbilityAction (type: string, value: number)
  → value is number-only — real actions have string values, objects, sub-actions
  → Used by: DisplayFigureCard, DisplayMonsterAbility, useDisplayMonsterData

packages/shared/src/data/types.ts — MonsterAbilityAction (already has full structure)
  → type, value (string|number), valueType, small, subActions[], valueObject[]
  → This is the CORRECT type — display components should use this instead of Mock types
```

### Action icon availability:
`app/shared/assets.ts` line 36: `actionIcon(type)` → `/assets/ghs/images/action/{type}.svg`
GHS client has SVG icons for most action types. Before rendering, verify which icons exist by checking the asset_manifest table or falling back to text for missing icons.

---

## Task 1: Scenario Text Wiring

### 1a. Create a shared hook: `useScenarioText`

Create `app/hooks/useScenarioText.ts`:
```typescript
// Fetches scenario rules, win/loss conditions from /api/ref/scenario-text
// Returns parsed, display-ready text strings
```

This hook should:
1. Accept `edition` and `scenarioIndex` params
2. Fetch `/api/ref/scenario-text/{edition}/{scenarioIndex}`
3. Parse the `rulesLabels` Record into display strings
4. Build `specialRules`, `winCondition`, and `lossCondition` text from the labels

**Key: Understanding GHS label key patterns.** Before implementing, query the reference DB to discover the actual label key patterns for scenario text. Run these exploratory queries:

```sql
-- Find ALL label keys containing "scenario" for edition 'fh' scenario '0'
SELECT key, value FROM labels WHERE edition = 'fh' AND key LIKE '%scenario%0%' LIMIT 20;

-- Find label keys for win/loss/goal conditions
SELECT key, value FROM labels WHERE edition = 'fh' AND (key LIKE '%goal%' OR key LIKE '%victory%' OR key LIKE '%conclusion%') LIMIT 20;

-- Find label keys for rules text  
SELECT key, value FROM labels WHERE edition = 'fh' AND key LIKE 'scenario.rules%' LIMIT 20;

-- Check label key patterns for GH scenario 1 "Black Barrow"
SELECT key, value FROM labels WHERE edition = 'gh' AND key LIKE 'scenario%1%' LIMIT 30;

-- Find ALL distinct top-level label prefixes
SELECT DISTINCT SUBSTR(key, 1, INSTR(key || '.', '.') - 1) AS prefix, COUNT(*) FROM labels WHERE edition = 'fh' GROUP BY prefix;
```

Use these findings to determine:
- What key pattern gives scenario special rules text?
- What key pattern gives win condition text?
- What key pattern gives loss condition text?
- Do all scenarios have these labels, or only some editions?

**Label text may contain `%game.action.X%` placeholders** (e.g., `%game.action.move%`, `%game.action.attack%`). These should be replaced with `<img>` tags pointing to `actionIcon('move')` etc. Build a `renderLabelText(text: string): string` utility that handles this interpolation.

### 1b. Wire display ScenarioView footer

In `app/display/ScenarioView.tsx`:
- Replace the hardcoded `footerRules` object (lines 276-283) with data from `useScenarioText`
- Pass real `specialRules`, `winConditions`, `lossConditions` to `DisplayScenarioFooter`
- Falls back to "See Scenario Book" if the API returns no data (graceful degradation)

### 1c. Wire controller LobbyView rules step

In `app/controller/LobbyView.tsx` (step='rules', around line 560):
- Fetch scenario text using `useScenarioText(setupData.edition, setupData.scenarioIndex)`
- Replace the "See Scenario Book" paragraph with real rules text
- Display win condition (from labels) instead of omitting it
- Keep "All characters exhausted." as default loss condition (append any scenario-specific loss conditions)

### 1d. Wire controller SetupPhaseOverlay

In `app/controller/overlays/SetupPhaseOverlay.tsx` (lines 118-131):
- Fetch scenario text
- Replace "Read from Scenario Book" / "See Scenario Book" with real text
- Show real win condition

### 1e. Wire phone PhoneRulesOverlay

In `app/phone/overlays/PhoneRulesOverlay.tsx` (lines 59-75):
- Fetch scenario text
- Replace "See Scenario Book" with real rules text
- Show real win condition

### 1f. Wire phone LobbyView

In `app/phone/LobbyView.tsx` (line 119):
- Fetch scenario text
- Replace "See Scenario Book for details." with real text

---

## Task 2: Monster Ability Card Renderer

### 2a. Define proper shared ability display types

In `packages/shared/src/data/types.ts`, the `MonsterAbilityAction` interface already has the right shape. Create a display-oriented type alongside it (or use it directly):

```typescript
// Display-ready ability action (resolved from raw action + base stats)
export interface ResolvedAbilityAction {
  type: string;
  value: string | number;
  valueType?: string;       // 'plus', 'minus', or absent (absolute)
  normalTotal?: number;     // base stat + card modifier (for move/attack/range)
  eliteTotal?: number;
  subActions?: ResolvedAbilityAction[];
  conditionName?: string;   // for type='condition'
  elementName?: string;     // for type='element' or 'elementHalf'
  summonName?: string;      // for type='summon'
  small?: boolean;          // render smaller (sub-action)
}
```

### 2b. Upgrade `useDisplayMonsterData` hook

In `app/display/hooks/useDisplayMonsterData.ts`:

1. **Switch ability card fetch** from `/api/data/{edition}/monster-deck/{name}` to `/api/ref/ability-cards/{edition}/{deckName}`
   - The ref endpoint returns cards with `name` (label-resolved) and `actions_json` (full tree)
   
2. **Extract ALL action types**, not just the 5 currently handled. Build a recursive action resolver:
   ```
   For each action in card.actions:
     - move, attack, range: resolve against base stats (normalTotal = base + cardModifier)
     - shield, heal, retaliate: pass through with value
     - condition: extract condition name from value
     - element: extract element name (infuse)
     - elementHalf: extract element name (consume, format is "element:element")
     - summon: extract summon name from valueObject
     - target, specialTarget, push, pull, pierce, jump, flying, teleport, loot, suffer, etc.: pass through
     - Recurse into subActions[]
   ```

3. **Use real card name** from the API response instead of `Card ${cardId}`

4. **Replace MockMonsterAbility/MockAbilityAction types** with proper types. Either use `MonsterAbilityAction` from shared directly, or use a new `ResolvedAbilityAction` type.

### 2c. Upgrade `MonsterAbilityActions` in DisplayFigureCard

In `app/display/components/DisplayFigureCard.tsx`, the `MonsterAbilityActions` component (lines 54-93) currently:
- Maps over `ability.actions` and renders `actionIcon(type)` + numeric value
- Totalizes against base stats for normal/elite differentiation

Upgrade to handle all action types:

**Numeric actions (move, attack, range, shield, heal, retaliate, pierce, push, pull, loot):**
- Keep the existing pattern: icon + totalized value + normal/elite colors

**Condition actions (type='condition'):**
- Render condition icon from `conditionIcon(value)` — no numeric value, just the icon
- Example: an ability card that says "Attack +1, WOUND" renders attack icon with value, then wound icon

**Element actions (type='element'):**
- Render element icon from `elementIcon(value)` — shows element infusion
- Example: "Move +1, Infuse Fire" renders move icon, then fire element icon

**Element consume actions (type='elementHalf'):**
- Render element icon with a consume indicator (the value is "element:element" format)
- This indicates the card benefits from consuming an element

**Summon actions (type='summon'):**
- Render a summon icon or text with the summoned monster name

**Sub-actions:**
- Render indented or smaller below the parent action (use the `small` flag)
- Common pattern: `{ type: "attack", value: 2, subActions: [{ type: "range", value: 3 }] }`
  means "Attack 2 at Range 3"

**Fallback for unknown types:**
- Render type name as text (e.g., "Special") — don't crash on unrecognized types

### 2d. Handle `%game.action.X%` in ability card names

If a card name from labels contains `%game.action.X%` patterns, interpolate them to icons. Use the same `renderLabelText()` utility from Task 1.

---

## Task 3: Remove Mock Type Dependencies

### 3a. Update import paths across display components

Replace all `MockMonsterAbility`, `MockAbilityAction`, `MockMonsterBaseStats` imports with proper types. Files to update:

```
app/display/hooks/useDisplayMonsterData.ts   — remove MockMonsterAbility, MockAbilityAction, MockMonsterBaseStats
app/display/components/DisplayFigureCard.tsx — remove MockMonsterAbility, MockMonsterBaseStats
app/display/components/DisplayMonsterAbility.tsx — remove MockMonsterAbility
```

### 3b. Keep mockData.ts for prototype mode only

The mock data in `app/display/mockData.ts` is still used for `?prototype=true` mode. Keep the file but update the prototype code path to convert mock data to the new types, or keep a thin compatibility layer.

---

## Task 4: Label Interpolation Engine

### 4a. Build `renderLabelText` utility

Create `app/shared/labelRenderer.ts` (or add to an existing shared module):

```typescript
/**
 * Replaces %game.action.X% and %game.condition.X% patterns in label text
 * with <img> tags pointing to the appropriate icon SVGs.
 *
 * Input:  "Move %game.action.move% through enemies"
 * Output: 'Move <img src="/assets/ghs/images/action/move.svg" class="label-icon" /> through enemies'
 */
export function interpolateLabelIcons(text: string): string { ... }
```

Known placeholder patterns from GHS labels:
- `%game.action.move%` → action icon
- `%game.action.attack%` → action icon
- `%game.action.range%` → action icon
- `%game.action.shield%` → action icon
- `%game.action.heal%` → action icon
- `%game.action.target%` → action icon
- `%game.action.fly%` → action icon
- `%game.condition.wound%` → condition icon
- `%game.condition.poison%` → condition icon
- Other patterns may exist — check label values

The function should handle any `%game.{category}.{name}%` pattern generically.

### 4b. Add CSS for inline label icons

Add to the shared component styles:
```css
.label-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: text-bottom;
  filter: invert(1); /* make dark SVGs visible on dark background */
}
```

---

## Verification Checklist

After implementation, verify:

1. **Display footer** shows real scenario rules/conditions (not "See Scenario Book")
   - Test with GH scenario 1 (Black Barrow) and FH scenario 0
   - Confirm rules text renders with inline icons where labels have %game.action.X%

2. **Display ability cards** show:
   - Real card names (e.g., "Shield Bash" not "Card 524")
   - All action types rendered (move, attack, shield, heal, retaliate, condition, element, summon, etc.)
   - Normal/elite totalized values for move, attack, range
   - Sub-actions rendered (e.g., "Attack 2 at Range 3")

3. **Controller LobbyView** rules step shows real rules text
4. **Controller SetupPhaseOverlay** shows real rules text
5. **Phone PhoneRulesOverlay** shows real rules text
6. **Phone LobbyView** shows real rules text

7. **Prototype mode** (`?prototype=true`) still works with mock data
8. **No console errors** when reference DB is not present (graceful 503 handling)
9. **Build succeeds** (`npm run build`)

---

## Implementation Order

1. **Exploratory: Query reference DB** to discover label key patterns for scenario rules/conditions
2. **labelRenderer.ts** — Build interpolation engine (needed by everything else)
3. **useScenarioText hook** — Shared hook for scenario text fetching + parsing
4. **Wire display footer** — Highest visibility win
5. **Upgrade useDisplayMonsterData** — Switch to /api/ref/, extract all action types
6. **Upgrade MonsterAbilityActions** — Render all action types in display figure card
7. **Wire controller placeholders** — LobbyView + SetupPhaseOverlay
8. **Wire phone placeholders** — PhoneRulesOverlay + LobbyView
9. **Remove mock type deps** — Replace with shared types
10. **Verify + build**

---

## Commit Message

```
feat(phase-5.2): wire consumers to reference DB — real scenario text, full ability cards

- Add useScenarioText hook — fetches /api/ref/scenario-text, parses labels
- Add labelRenderer — interpolates %game.action.X% to inline icons
- Replace all "See Scenario Book" placeholders across display/controller/phone
- Upgrade useDisplayMonsterData to use /api/ref/ability-cards with full action trees
- Extend MonsterAbilityActions to render all 30+ action types (conditions, elements, summons, etc.)
- Replace MockMonsterAbility/MockAbilityAction with shared MonsterAbilityAction types
- Normal/elite totalization preserved for move/attack/range
- Sub-actions rendered inline with parent actions
- Graceful fallback when reference DB not available
```

---

## Design Skills

For ALL UI/UX work in this prompt (ability card renderer, scenario text display, inline icons), read these skill files before implementing:
- `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\` — UI/UX Pro Max skill (read all .md files)
- `C:\Users\Kyle Diaz\.agents\skills\` — frontend agent skills (read all .md files)
- `app/CONVENTIONS.md` — project CSS/component conventions

Priority when skills conflict: (1) app/CONVENTIONS.md, (2) UI/UX Pro Max, (3) agent skills.

Aesthetic: Dark fantasy tabletop. Action icons should be inverted white for visibility on dark backgrounds. Ability card area uses the existing `figure-card__ability-*` CSS class namespace. New styles should follow BEM naming and use the existing CSS variable system from `app/shared/styles/theme.css`.

---

## DO NOT

- Modify `server/src/referenceDb.ts` or `scripts/import-data.ts` (Phase 5.1 deliverables)
- Modify the mutable game DB (`data/ghs.sqlite`)
- Break existing `/api/data/` endpoints (still needed by DataManager consumers)
- Remove `mockData.ts` (still needed for `?prototype=true`)
- Hard-code scenario text that should come from the database
- Skip the exploratory DB queries — label key patterns MUST be discovered empirically
