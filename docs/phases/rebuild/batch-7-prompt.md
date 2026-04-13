# Batch 7 — Game Logic Correctness

> Paste this entire file into Claude Code. Read `RESPONSE_CONTRACT.md` and
> `docs/GAME_RULES_REFERENCE.md` before implementing. Execute all 5 fixes,
> then run the verification checklist.

---

## Fix 7.1 — Poison +1 fires per tap instead of per damage source

### Problem
`handleChangeHealth()` in `packages/shared/src/engine/applyCommand.ts` (line 333-339)
adds `delta -= 1` for poison on EVERY `changeHealth` command with a negative delta.
The UI sends `changeHealth(target, -1)` per tap of the minus button
(`app/components/CharacterBar.tsx` line 95, `app/components/MonsterGroup.tsx` line 124).
Each tap therefore deals 2 damage instead of 1, because poison fires on every call.

Per game rules (GAME_RULES_REFERENCE.md §4): Poison means "all attacks on this figure
gain +1 Attack." Poison adds +1 per damage SOURCE, not per HP point. In the companion
app, each minus-tap is NOT a separate attack — it's the user manually entering a known
damage value. Poison's +1 should be opt-in at the UI level, not automatic in the engine.

### Fix
1. **Remove** the automatic poison `-1` from `handleChangeHealth()` in
   `packages/shared/src/engine/applyCommand.ts` (lines 332-339). Delete the entire
   `// Poison: +1 damage from all damage sources` block. Leave the heal-clears-conditions
   block (lines 342-354) untouched.

2. **Add a poison indicator** to the health controls in `app/components/CharacterBar.tsx`
   and `app/components/MonsterGroup.tsx`. When the entity has an active poison condition,
   show a small `+1` badge or text next to the minus button as a visual reminder. This
   is informational only — the user manually taps one extra minus to account for poison.
   This matches GHS behavior where poison is a visual reminder, not auto-applied to
   manual HP changes.

3. **Keep** poison +1 on wound damage at turn start in `applyTurnStartConditions()`
   (line 712). Wound is an automated damage source (not user-initiated), so poison
   correctly adds +1 there. That code path is:
   ```
   const hasPoisonActive = entity.entityConditions?.some(
     (c) => (c.name === 'poison' || c.name === 'poison_x') && ...
   );
   ```
   at ~line 710-715. This stays. Only the `handleChangeHealth` poison block is removed.

### Files
- `packages/shared/src/engine/applyCommand.ts`
- `app/components/CharacterBar.tsx`
- `app/components/MonsterGroup.tsx`

---

## Fix 7.2 — Monster attack modifier deck shows 0/0

### Problem
`handleSetScenario()` in `packages/shared/src/engine/applyCommand.ts` (line 1183)
does not populate `state.monsterAttackModifierDeck`. The deck is created by
`createEmptyAttackModifierDeck()` in `packages/shared/src/utils/ghsCompat.ts` with
`cards: []`. The modifier deck UI shows 0/0 because no cards exist.

### Fix
1. **Add** a `buildStandardModifierDeck()` function to
   `packages/shared/src/utils/ghsCompat.ts` (or a new file
   `packages/shared/src/utils/modifierDeck.ts`). The standard 20-card deck is:

   ```
   +0  × 6  (ids: "am-plus0-1" through "am-plus0-6")
   +1  × 5  (ids: "am-plus1-1" through "am-plus1-5")
   -1  × 5  (ids: "am-minus1-1" through "am-minus1-5")
   +2  × 1  (id:  "am-plus2-1")
   -2  × 1  (id:  "am-minus2-1")
   2×  × 1  (id:  "am-double-1")
   ∅   × 1  (id:  "am-null-1")
   ```

   Return an `AttackModifierDeckModel` with `cards` as a shuffled array of these 20
   string IDs, `current: 0`, `active: false`, `lastVisible: -1`, `bb: false`,
   `discarded: []`.

   Shuffle using Fisher-Yates on the cards array.

2. **Call** `buildStandardModifierDeck()` inside `handleSetScenario()` after line 1220
   (`recalculateLevel(state)`):
   ```typescript
   state.monsterAttackModifierDeck = buildStandardModifierDeck();
   state.allyAttackModifierDeck = buildStandardModifierDeck();
   ```

3. **Update** `handleDrawModifierCard()` and `handleShuffleModifierDeck()` to work
   with the string-ID card array. Currently `handleDrawModifierCard` increments
   `deck.current` — verify this correctly advances through the `cards[]` array and
   that the UI reads `cards[current]` to determine the drawn card type.

4. **Export** `buildStandardModifierDeck` from the shared package barrel
   (`packages/shared/src/index.ts`) if placed in a new file.

### Files
- `packages/shared/src/utils/ghsCompat.ts` (or new `modifierDeck.ts`)
- `packages/shared/src/engine/applyCommand.ts`
- `packages/shared/src/index.ts` (if new file)

---

## Fix 7.3 — FH conditions (bane, brittle, impair, ward) showing in GH scenarios

### Problem
`app/controller/ScenarioView.tsx` lines 69-77 compute `availableConditions`. The
fallback list (line 72-76) hardcodes 15 conditions including FH-only ones (regenerate,
ward, bane, brittle, impair). When `state.conditions` is empty (common for new games),
all 15 show regardless of edition.

GH has 10 conditions: stun, immobilize, disarm, wound, muddle, poison, strengthen,
invisible, curse, bless.

FH adds 6 more: regenerate, ward, bane, brittle, impair, infect.

### Fix
1. **Add** a `getEdition()` method to `DataManager` in
   `packages/shared/src/data/index.ts`:
   ```typescript
   getEdition(edition: string): EditionData | null {
     return this.editions.get(edition) ?? null;
   }
   ```

2. **Add** a server API endpoint in `server/src/index.ts`:
   ```typescript
   app.get('/api/data/:edition/edition', (req, res) => {
     const data = dataManager.getEdition(req.params.edition);
     data ? res.json(data) : res.status(404).json({ error: 'Edition not found' });
   });
   ```

3. **Add** edition-specific condition constants to
   `packages/shared/src/utils/conditions.ts`:
   ```typescript
   /** Gloomhaven conditions (10) */
   export const GH_CONDITIONS: readonly ConditionName[] = [
     'stun', 'immobilize', 'disarm', 'wound', 'muddle',
     'poison', 'strengthen', 'invisible', 'curse', 'bless',
   ] as const;

   /** Frosthaven conditions (16) */
   export const FH_CONDITIONS: readonly ConditionName[] = [
     'stun', 'immobilize', 'disarm', 'wound', 'muddle',
     'poison', 'strengthen', 'invisible', 'curse', 'bless',
     'regenerate', 'ward', 'bane', 'brittle', 'impair', 'infect',
   ] as const;

   /** Get conditions for an edition */
   export function getConditionsForEdition(edition: string): readonly ConditionName[] {
     switch (edition) {
       case 'fh': return FH_CONDITIONS;
       case 'gh':
       case 'jotl':
       default: return GH_CONDITIONS;
     }
   }
   ```

4. **Update** `app/controller/ScenarioView.tsx` lines 69-77:
   ```typescript
   const availableConditions = useMemo<ConditionName[]>(() => {
     if (state?.conditions && state.conditions.length > 0)
       return state.conditions;
     return [...getConditionsForEdition(edition)];
   }, [state?.conditions, edition]);
   ```
   Add the import: `import { getConditionsForEdition } from '@gloomhaven-command/shared';`

### Files
- `packages/shared/src/utils/conditions.ts`
- `packages/shared/src/data/index.ts`
- `server/src/index.ts`
- `app/controller/ScenarioView.tsx`

---

## Fix 7.4 — 35 scenarios unlocked at new game start

### Problem
`app/controller/overlays/ScenarioSetupOverlay.tsx` lines 45-57 compute
`unlockedIndices`. It adds every scenario with `s.initial === true` to the unlocked
set (line 49). In GHS data, multiple GH scenarios may have `initial: true` (solo
scenarios, linked scenarios, etc.), causing far more than Scenario 1 to appear.

### Fix
1. **Change** the unlock logic (lines 45-57) so that `initial` scenarios only unlock
   if `completedIndices` is empty (fresh campaign). When the player has completed at
   least one scenario, only unlocked-via-completion scenarios plus `initial` scenarios
   should appear. But the real fix: for GH, only scenario "1" should be initial. The
   data might have incorrect `initial` flags.

   Replace the `unlockedIndices` memo with:
   ```typescript
   const unlockedIndices = useMemo(() => {
     if (!scenarios) return new Set<string>();
     const unlocked = new Set<string>();

     // Always include initial scenarios (typically just scenario 1)
     for (const s of scenarios as any[]) {
       if (s.initial) unlocked.add(s.index);
     }

     // Add scenarios unlocked by completing other scenarios
     for (const s of scenarios as any[]) {
       if (completedIndices.has(s.index) && s.unlocks) {
         for (const u of s.unlocks) unlocked.add(u);
       }
       // Also add completed scenarios themselves (they're known/unlocked)
       if (completedIndices.has(s.index)) unlocked.add(s.index);
     }

     return unlocked;
   }, [scenarios, completedIndices]);
   ```

2. **Add a data-level guard**: If the GHS data files have excessive `initial: true`
   flags, add filtering in the data loading. In `packages/shared/src/data/index.ts`,
   add a method:
   ```typescript
   getInitialScenarioIndices(edition: string): string[] {
     const results: string[] = [];
     for (const [key, data] of this.scenarios) {
       if (key.startsWith(`${edition}:`) && data.initial) {
         results.push(data.index);
       }
     }
     return results;
   }
   ```
   Log this at startup in `server/src/index.ts` after edition loading to verify how
   many scenarios have `initial: true`. If it's more than expected (should be 1 for GH,
   ~1 for FH), the data files need a postprocessing step.

3. **Fallback**: If the data has too many `initial` flags and they can't be fixed at
   the data level, hardcode initial scenario indices per edition:
   ```typescript
   const EDITION_INITIAL_SCENARIOS: Record<string, string[]> = {
     gh: ['1'],
     fh: ['0'],
     jotl: ['1'],
   };
   ```
   Use this map instead of `s.initial` in the unlock calculation when
   `completedIndices.size === 0`.

### Files
- `app/controller/overlays/ScenarioSetupOverlay.tsx`
- `packages/shared/src/data/index.ts`
- `server/src/index.ts` (diagnostic log)

---

## Fix 7.5 — Characters created above L1 have 0 total XP

### Problem
`handleAddCharacter()` in `packages/shared/src/engine/applyCommand.ts` (line 899)
calls `createEmptyProgress()` which sets `experience: 0`. A Cragheart created at L4
should have `progress.experience = 150` (the L4 XP threshold).

XP thresholds per GAME_RULES_REFERENCE.md §3:
```
L1=0, L2=45, L3=95, L4=150, L5=210, L6=275, L7=345, L8=420, L9=500
```

### Fix
1. **Add** a `XP_THRESHOLDS` constant to
   `packages/shared/src/data/levelCalculation.ts`:
   ```typescript
   /** Minimum XP for each character level (index = level) */
   export const XP_THRESHOLDS = [0, 0, 45, 95, 150, 210, 275, 345, 420, 500] as const;

   /** Get minimum XP for a given level */
   export function getMinXPForLevel(level: number): number {
     return XP_THRESHOLDS[Math.min(level, XP_THRESHOLDS.length - 1)] ?? 0;
   }
   ```

2. **Update** `handleAddCharacter()` in
   `packages/shared/src/engine/applyCommand.ts` (after line 899):
   ```typescript
   const progress = createEmptyProgress();
   if (payload.level > 1) {
     progress.experience = getMinXPForLevel(payload.level);
   }
   ```
   Then use `progress` in the Character object instead of calling
   `createEmptyProgress()` inline.

3. **Import** `getMinXPForLevel` from the data package:
   ```typescript
   import { getMinXPForLevel } from '../data/levelCalculation.js';
   ```

### Files
- `packages/shared/src/data/levelCalculation.ts`
- `packages/shared/src/engine/applyCommand.ts`

---

## Verification Checklist

After implementing all 5 fixes, verify:

```
[ ] npm run build completes without errors
[ ] Poison: tap − on a poisoned entity → deals exactly 1 damage (not 2)
[ ] Poison: wound at turn start on poisoned entity → deals 2 damage (1 wound + 1 poison)
[ ] Poison: visual +1 indicator visible next to − button when poisoned
[ ] Modifier deck: start a scenario → deck shows 20/20 (not 0/0)
[ ] Modifier deck: draw → card advances, count decrements
[ ] Modifier deck: shuffle works
[ ] GH scenario: condition row shows exactly 10 conditions (no bane/brittle/impair/ward/regenerate/infect)
[ ] FH scenario: condition row shows 16 conditions (includes bane/brittle/impair/ward/regenerate/infect)
[ ] New GH game: scenario list shows only Scenario 1 unlocked (not 35)
[ ] Scenario 1 completed + unlocks: newly unlocked scenarios appear
[ ] Cragheart created at L4: character sheet shows 150 total XP
[ ] Brute created at L1: character sheet shows 0 total XP
[ ] Spellweaver created at L3: character sheet shows 95 total XP
```

## Commit Message

```
fix(batch-7): game logic correctness — poison, modifier deck, conditions, scenarios, XP

- Remove automatic poison +1 from handleChangeHealth (per-tap was wrong);
  keep poison +1 on automated wound damage; add visual poison indicator
- Populate standard 20-card monster attack modifier deck on scenario start
- Filter condition grid by edition (GH=10, FH=16)
- Fix scenario unlock logic for fresh campaigns
- Set minimum XP on characters created above level 1
```
