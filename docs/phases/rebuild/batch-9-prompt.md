# Batch 9 — XP System Overhaul

> Paste this entire file into Claude Code. Read `RESPONSE_CONTRACT.md` and
> `docs/GAME_RULES_REFERENCE.md` §3 (Experience) and §11 (Ending a Scenario)
> before implementing. Execute both fixes, then run the verification checklist.

---

## Context

The dual XP tracking structure already exists in the type system:

- `Character.experience` (gameState.ts line 244) = **in-scenario XP dial** — starts
  at 0 each scenario, incremented during play via ability card XP icons
- `Character.progress.experience` (CharacterProgress, line 215) = **total/career XP**
  — persists across scenarios, determines level-up eligibility

Current problems:
1. `handleSetScenario()` does NOT reset `character.experience` to 0 for new scenarios
2. No command exists to transfer in-scenario XP to total at scenario end
3. The character sheet shows XP as a flat number — no visual fill bar
4. Gold has the same gap: `character.loot` (in-scenario coins) never transfers to
   `character.progress.gold`

---

## Fix 9.1 — Scenario XP lifecycle: reset on start, transfer on end

### 9.1a — Reset in-scenario counters on scenario start

In `packages/shared/src/engine/applyCommand.ts`, `handleSetScenario()` (line 1205-1215)
resets character state but does NOT reset the in-scenario counters. Add to the existing
character reset loop:

```typescript
for (const char of state.characters) {
  char.initiative = 0;
  char.health = char.maxHealth;
  char.exhausted = false;
  char.longRest = false;
  char.entityConditions = [];
  char.summons = [];
  char.active = false;
  char.off = false;
  char.absent = false;
  // ── NEW: reset in-scenario counters ──
  char.experience = 0;
  char.loot = 0;
  char.lootCards = [];
  char.treasures = [];
}
```

### 9.1b — Add `completeScenario` command

This command transfers in-scenario rewards to permanent progress. Per
GAME_RULES_REFERENCE.md §11:

- Gain XP from dial → each character's `progress.experience`
- If completed (not lost): add bonus XP per scenario level
- Gain gold from loot (coins × gold conversion rate at scenario level)
- Gain resources from loot cards (FH)
- Reset scenario state

**1. Add command type** to `packages/shared/src/types/commands.ts`:

Add to the `CommandAction` union (after `'updateCampaign'`):
```typescript
| 'completeScenario';
```

Add interface:
```typescript
export interface CompleteScenarioCommand {
  action: 'completeScenario';
  payload: { outcome: 'victory' | 'defeat' };
}
```

Add to the `Command` union type:
```typescript
| CompleteScenarioCommand
```

**2. Add handler** to `packages/shared/src/engine/applyCommand.ts`:

Add case in the switch statement (after `case 'updateCampaign'`):
```typescript
case 'completeScenario':
  handleCompleteScenario(after, command.payload);
  break;
```

Add the handler function:
```typescript
function handleCompleteScenario(
  state: GameState,
  payload: { outcome: 'victory' | 'defeat' },
): void {
  const isVictory = payload.outcome === 'victory';
  const level = state.level ?? 0;
  const bonusXP = isVictory ? (4 + 2 * level) : 0;
  const goldConversion = [2, 2, 3, 3, 4, 4, 5, 6][level] ?? 2;

  for (const char of state.characters) {
    // Transfer in-scenario XP → total XP (always, even on defeat per rules)
    const scenarioXP = char.experience || 0;
    char.progress.experience += scenarioXP + bonusXP;

    // Transfer loot → gold (coins × conversion rate)
    const scenarioCoins = char.loot || 0;
    char.progress.gold += scenarioCoins * goldConversion;

    // Reset in-scenario counters
    char.experience = 0;
    char.loot = 0;
    char.lootCards = [];
  }

  // Record scenario completion in party data
  if (isVictory && state.scenario) {
    if (!state.party) {
      state.party = {} as any;
    }
    if (!state.party.scenarios) {
      state.party.scenarios = [];
    }
    const alreadyComplete = state.party.scenarios.some(
      (s: any) => s.index === state.scenario!.index && s.edition === state.scenario!.edition
    );
    if (!alreadyComplete) {
      state.party.scenarios.push({
        index: state.scenario.index,
        edition: state.scenario.edition,
        isCustom: false,
        custom: '',
      } as any);
    }
  }

  // Store finish state
  state.finish = {
    type: isVictory ? 'won' : 'lost',
    lootColumns: [],
  } as any;
}
```

Import `deriveLevelValues` is NOT needed since we inline the calculation.

**3. Add to validateCommand** in `packages/shared/src/engine/validateCommand.ts`:

Add a case for `'completeScenario'` that validates the payload:
```typescript
case 'completeScenario': {
  const p = command.payload as any;
  if (!p.outcome || (p.outcome !== 'victory' && p.outcome !== 'defeat')) {
    return { valid: false, error: 'completeScenario requires outcome: victory|defeat' };
  }
  if (!state.scenario) {
    return { valid: false, error: 'No active scenario to complete' };
  }
  return { valid: true };
}
```

**4. Add to CommandSender** in `clients/shared/lib/commandSender.ts`:

```typescript
completeScenario(outcome: 'victory' | 'defeat'): void {
  this.send({ action: 'completeScenario', payload: { outcome } });
}
```

**5. Add UI trigger** — Add scenario end buttons to the menu overlay.

In `app/controller/overlays/MenuOverlay.tsx`, add scenario completion buttons
after the existing menu items (e.g., after the Scenario Setup button):

```tsx
{state.scenario && (
  <div class="menu-section">
    <h3 class="menu-section-title">End Scenario</h3>
    <button class="menu-btn victory"
      onClick={() => { commands.completeScenario('victory'); onClose(); }}>
      Scenario Complete (Victory)
    </button>
    <button class="menu-btn defeat"
      onClick={() => { commands.completeScenario('defeat'); onClose(); }}>
      Scenario Failed (Defeat)
    </button>
  </div>
)}
```

Add the `useCommands` hook and `state` prop to MenuOverlay if not already present.
Check the current MenuOverlay props and imports — it may need `state` passed from
ScenarioView.

### Files for 9.1
- `packages/shared/src/types/commands.ts`
- `packages/shared/src/engine/applyCommand.ts`
- `packages/shared/src/engine/validateCommand.ts`
- `clients/shared/lib/commandSender.ts`
- `app/controller/overlays/MenuOverlay.tsx`
- `app/controller/ScenarioView.tsx` (if MenuOverlay needs new props)

---

## Fix 9.2 — XP threshold fill bar

### Problem
`StatsTab` in `app/controller/overlays/CharacterSheetOverlay.tsx` (lines 59-104)
shows XP as a flat `{currentXP} / {nextThreshold}` text with a row of threshold
badges below. The user wants a visual progress bar that fills proportionally between
the current level's threshold and the next level's threshold.

### Fix

**1. Add a fill bar helper function** to `CharacterSheetOverlay.tsx`:

```typescript
function getXPBarInfo(totalXP: number, level: number) {
  // XP_THRESHOLDS: [0, 0, 45, 95, 150, 210, 275, 345, 420, 500]
  // Index = level, so level 1 = 0 XP, level 2 = 45, etc.
  const currentThreshold = XP_THRESHOLDS[level] ?? 0;
  const nextThreshold = XP_THRESHOLDS[level + 1] ?? XP_THRESHOLDS[XP_THRESHOLDS.length - 1];

  if (level >= 9 || nextThreshold <= currentThreshold) {
    // Max level — bar is full
    return { percent: 100, currentThreshold, nextThreshold, xpIntoLevel: 0, xpNeeded: 0 };
  }

  const xpIntoLevel = totalXP - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const percent = Math.min(100, Math.max(0, (xpIntoLevel / xpNeeded) * 100));

  return { percent, currentThreshold, nextThreshold, xpIntoLevel, xpNeeded };
}
```

**2. Replace the XP display** in `StatsTab` (lines 75-78 and 93-102):

Replace the current XP stat row and thresholds block with:

```tsx
{/* XP progress bar */}
{(() => {
  const bar = getXPBarInfo(currentXP, character.level);
  return (
    <div class="xp-bar-section">
      <div class="xp-bar-header">
        <span class="sheet__stat-label">
          XP — Level {character.level}
          {character.level < 9 ? ` → ${character.level + 1}` : ' (Max)'}
        </span>
        <span class="xp-bar-numbers">{currentXP} / {bar.nextThreshold}</span>
      </div>
      <div class="xp-bar-track">
        <div class="xp-bar-fill" style={{ width: `${bar.percent}%` }} />
      </div>
      {character.level < 9 && (
        <span class="xp-bar-remaining">
          {bar.xpNeeded - bar.xpIntoLevel} XP to next level
        </span>
      )}
    </div>
  );
})()}
```

Keep the existing Level, HP at level, Hand Size, and Gold stat rows. Remove the
old `sheet__thresholds` block (lines 93-102) since the fill bar replaces it.

**3. Import** `XP_THRESHOLDS` from the shared package if not already imported.
The `CharacterSheetOverlay.tsx` has a local `XP_THRESHOLDS` constant on line 59.
Replace it with the import:
```typescript
import { XP_THRESHOLDS } from '@gloomhaven-command/shared';
```
Then delete the local `const XP_THRESHOLDS = [0, 45, 95, 150, 210, 275, 345, 420, 500];`
on line 59.

**Note:** The local array is `[0, 45, 95, ...]` (9 entries, index 0 = level 1 threshold)
but the shared `XP_THRESHOLDS` is `[0, 0, 45, 95, ...]` (10 entries, index = level).
The `getXPBarInfo` function above uses the shared version (index = level). Verify
the import matches and update any remaining references in `StatsTab` that use the
old indexing.

**4. Add CSS** to `app/controller/styles/controller.css`:

```css
/* XP progress bar */
.xp-bar-section {
  padding: var(--space-2) 0;
}

.xp-bar-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-2);
}

.xp-bar-numbers {
  font-family: 'Cinzel', serif;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
}

.xp-bar-track {
  height: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--accent-copper);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.xp-bar-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--accent-copper) 0%,
    var(--accent-gold) 100%
  );
  border-radius: 6px;
  transition: width 0.4s ease;
  min-width: 0;
}

.xp-bar-remaining {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: var(--space-1);
  text-align: right;
}
```

### Files for 9.2
- `app/controller/overlays/CharacterSheetOverlay.tsx`
- `app/controller/styles/controller.css`

---

## Verification Checklist

```
[ ] npm run build completes without errors
[ ] Start new scenario: all character XP dials show 0
[ ] Start new scenario: all character loot counters show 0
[ ] During play: tap XP star on CharacterBar → increments character.experience (dial)
[ ] Character sheet during scenario: total XP unchanged (still shows progress.experience)
[ ] Menu → Scenario Complete (Victory): in-scenario XP transfers to progress.experience
[ ] Menu → Scenario Complete (Victory): bonus XP added (4 + 2*level)
[ ] Menu → Scenario Complete (Victory): loot × gold conversion added to progress.gold
[ ] Menu → Scenario Complete (Victory): scenario recorded in party.scenarios
[ ] Menu → Scenario Failed (Defeat): XP still transfers (no bonus XP)
[ ] Menu → Scenario Failed (Defeat): loot still converts to gold
[ ] After completion: character.experience reset to 0
[ ] After completion: character.loot reset to 0
[ ] Cragheart L4 (150 total XP): fill bar shows 0% (150 is the L4 floor, needs 210 for L5)
[ ] Cragheart L4 with 180 total XP: fill bar shows 50% (30/60 between 150→210)
[ ] Level 9 character: fill bar shows 100%, "Max" label
[ ] Fill bar gradient: copper→gold, rounded, 12px height
[ ] "X XP to next level" text below the bar
[ ] XP bar uses shared XP_THRESHOLDS (not local duplicate)
```

## Commit Message

```
feat(batch-9): XP system overhaul — dual tracking + scenario end + fill bar

- Reset in-scenario XP/loot to 0 on scenario start
- Add completeScenario command: transfers XP+loot to progress, records
  completion, applies bonus XP on victory
- Add scenario end buttons (Victory/Defeat) to menu overlay
- Replace flat XP display with gradient fill bar showing progress to next level
- Import shared XP_THRESHOLDS, remove local duplicate
```
