# Batch 1 — Critical Condition Engine & Combat Fixes

> Paste into Claude Code. Fixes 6 gameplay-breaking bugs in the condition
> processing, damage mechanics, and dead entity handling. All server-side
> engine changes — no UI modifications.

---

Read CLAUDE.md, then docs/GHS_AUDIT.md Section 8 (Conditions — Complete Reference)
for the authoritative rules on every condition.

Then read these files in full:
- `packages/shared/src/utils/conditions.ts` — processConditionEndOfRound, processConditionEndOfTurn, toggleCondition
- `packages/shared/src/engine/applyCommand.ts` — toggleTurn handler (where turn-start/turn-end conditions are processed), advancePhase handler (end-of-round)
- `packages/shared/src/engine/turnOrder.ts` — startRound, endRound, activateNextFigure, getInitiativeOrder, isRoundComplete
- `packages/shared/src/types/gameState.ts` — EntityCondition type, ConditionState values

## Context — What the Playtest Found

1. **Conditions never expire.** Strengthen applied to a character persists forever — it should clear at end of the character's next turn.
2. **Regenerate + Wound interaction broken.** Regenerate heals 1 at turn start, wound deals 1 at turn start. But per game rules, ANY heal removes wound (and poison). Currently both fire independently — wound should be cleared by the regenerate heal.
3. **Bane (FH) doesn't fire.** Should deal 10 damage at end of the affected figure's next turn.
4. **Poison has no mechanical effect.** Poison should add +1 to all damage suffered. Currently it's just a visual icon with no combat impact.
5. **Dead standees at 0 HP remain visible.** Should be removed or heavily dimmed.
6. **Dead monster groups still appear in turn order.** When all standees are dead, the group shouldn't draw ability cards or be sorted into initiative order.

## BUG 1 — Condition Expiry

### Rules (from GHS Audit Section 8)

**Expire at "end of next turn":** Stun, Immobilize, Disarm, Muddle, Invisible, Strengthen, Bane, Brittle, Impair, Infect, Regenerate, Ward, Dodge

These conditions last through the figure's NEXT turn, then expire at the END of that turn.

**Expire "when healed":** Wound, Poison

These persist until the figure receives any heal effect.

**Applied then removed:** Bless, Curse (added to AMD, then the condition itself is removed — these are deck modifications, not persistent conditions)

### The State Machine

GHS conditions use a `state` field: `'new' | 'normal' | 'expire' | 'turn'`

The correct lifecycle for a "next turn" condition (e.g., Strengthen):
1. **Applied:** `state = 'new'` (just added this turn)
2. **End of the turn it was applied:** `state = 'new'` → `state = 'normal'` (survives the application turn)
3. **Figure's NEXT turn begins:** condition is active during this turn
4. **End of figure's NEXT turn:** `state = 'normal'` → `state = 'expire'`
5. **Next processing pass:** condition removed from array

Wait — verify against the actual GHS behavior. The audit says conditions expire
at "end of next turn." This means:

- Turn 1: Strengthen applied (state: 'new')
- End of Turn 1: state transitions to 'normal' (the condition now "counts down")
- Turn 2 (figure's next turn): Strengthen is active, figure benefits from it
- End of Turn 2: state transitions to 'expire' or is removed

The key question: does `processConditionEndOfTurn` fire at the end of EVERY
figure's turn, or only for the conditions on THAT specific figure?

It should fire for the figure whose turn is ending. Only that figure's conditions
advance through the state machine.

### Fix

Read `processConditionEndOfTurn()` in `conditions.ts`. It should:

```typescript
export function processConditionEndOfTurn(
  conditions: EntityCondition[]
): { conditions: EntityCondition[]; woundDamage: number } {
  let woundDamage = 0;
  
  const updated = conditions
    .filter(c => {
      // Remove fully expired conditions
      if (c.state === 'expire' || c.state === 'removed') return false;
      return true;
    })
    .map(c => {
      const copy = { ...c };
      
      if (copy.state === 'new') {
        // Condition was applied this turn — transition to 'normal'
        // It will be active during the figure's NEXT turn
        copy.state = 'normal';
      } else if (copy.state === 'normal') {
        // Condition has been active for a full turn — mark for expiry
        // ONLY for conditions that expire at "end of next turn"
        if (isEndOfNextTurnCondition(copy.name)) {
          copy.state = 'expire';
        }
        // Wound and poison DON'T expire here — they expire on heal
      }
      
      return copy;
    });
  
  return { conditions: updated, woundDamage };
}

function isEndOfNextTurnCondition(name: string): boolean {
  // These conditions expire at end of the affected figure's next turn
  const endOfNextTurn = [
    'stun', 'immobilize', 'disarm', 'muddle', 'invisible', 'strengthen',
    'bane', 'brittle', 'impair', 'infect', 'regenerate', 'ward', 'dodge',
    'empower', 'enfeeble', 'safeguard'
  ];
  return endOfNextTurn.includes(name);
}
```

Then in `applyCommand.ts`, where `toggleTurn` ends a figure's turn (the
deactivation path), call `processConditionEndOfTurn()` on that figure's
conditions:

```typescript
// When deactivating a figure (ending their turn):
const { conditions: newConditions } = processConditionEndOfTurn(entity.entityConditions);
entity.entityConditions = newConditions;
```

Verify this is actually called. Read the toggleTurn handler — R6 added
end-of-turn condition processing. The bug may be that `processConditionEndOfTurn`
isn't advancing the state correctly, or isn't being called at the right time.

**IMPORTANT:** After fixing, verify the full lifecycle:
1. Apply Strengthen to Brute
2. End Brute's turn → Strengthen should still be active (state: new → normal)
3. Next round, Brute takes turn again → Strengthen active during this turn
4. End Brute's turn → Strengthen should expire (state: normal → expire, then removed)

## BUG 2 — Regenerate + Wound Interaction

### Rules
- ANY heal effect removes Wound and Poison INSTEAD of healing
- If a figure has Wound AND Regenerate, at turn start: Regenerate triggers a heal of 1. That heal removes Wound (and Poison if present). The figure does NOT gain 1 HP — the heal is "consumed" by removing the condition.

### Fix

In `applyCommand.ts`, where turn-start conditions are processed (the
`applyTurnStartConditions` function or equivalent):

```typescript
function applyTurnStartConditions(entity: any): void {
  const hasWound = entity.entityConditions.some(
    c => c.name === 'wound' && c.state !== 'expire' && c.state !== 'removed' && !c.expired
  );
  const hasPoison = entity.entityConditions.some(
    c => c.name === 'poison' && c.state !== 'expire' && c.state !== 'removed' && !c.expired
  );
  const hasRegenerate = entity.entityConditions.some(
    c => c.name === 'regenerate' && c.state !== 'expire' && c.state !== 'removed' && !c.expired
  );

  if (hasRegenerate) {
    if (hasWound || hasPoison) {
      // Heal is consumed by removing wound/poison — no HP gained
      entity.entityConditions = entity.entityConditions.filter(
        c => c.name !== 'wound' && c.name !== 'poison'
      );
    } else {
      // No wound/poison — heal 1 HP
      entity.health = Math.min(entity.maxHealth, entity.health + 1);
    }
  }

  // Wound damage (only if wound still present — not removed by regenerate)
  const stillHasWound = entity.entityConditions.some(
    c => c.name === 'wound' && c.state !== 'expire' && c.state !== 'removed' && !c.expired
  );
  if (stillHasWound) {
    entity.health = Math.max(0, entity.health - 1);
    // Auto-kill monsters at 0 HP
    if (entity.health === 0 && entity.dead !== undefined) {
      entity.dead = true;
    }
  }
}
```

The order matters: Regenerate processes FIRST (potentially removing wound),
THEN wound damage only fires if wound is still present.

## BUG 3 — Bane Not Firing

### Rules (FH)
- Bane: suffer 10 damage at end of affected figure's next turn
- It's an "end of next turn" condition — so it fires when the condition expires

### Fix

In the turn-end processing, when a Bane condition transitions to 'expire',
apply 10 damage:

```typescript
// In processConditionEndOfTurn or the toggleTurn handler:
const hasBane = entity.entityConditions.some(
  c => c.name === 'bane' && c.state === 'normal' && !c.expired
);

// After transitioning bane from 'normal' to 'expire':
if (hasBane) {
  entity.health = Math.max(0, entity.health - 10);
  if (entity.health === 0 && entity.dead !== undefined) {
    entity.dead = true;
  }
}
```

Alternatively, modify `processConditionEndOfTurn` to return bane damage
alongside wound damage:

```typescript
export function processConditionEndOfTurn(
  conditions: EntityCondition[]
): { conditions: EntityCondition[]; woundDamage: number; baneDamage: number } {
  // ... existing logic ...
  let baneDamage = 0;
  
  // Check for bane transitioning to expire
  conditions.forEach(c => {
    if (c.name === 'bane' && c.state === 'normal' && isEndOfNextTurnCondition('bane')) {
      baneDamage = 10;
    }
  });
  
  return { conditions: updated, woundDamage, baneDamage };
}
```

Then in the toggleTurn handler, apply bane damage when returned.

## BUG 4 — Poison Damage Modifier

### Rules
- Poison: suffer +1 damage from ALL sources of damage
- This is a damage modifier, not a direct damage condition
- It means when a poisoned figure takes damage (from attacks, traps, wound, etc.), they take 1 extra

### Implementation Approach

Poison is a passive modifier — it doesn't deal damage directly. It modifies
incoming damage. This is harder to implement cleanly because it requires
intercepting all damage sources.

**Pragmatic approach for now:** Apply poison's +1 at the point where damage
is dealt. The main damage source in our engine is `changeHealth` with a
negative delta.

In `applyCommand.ts`, in the `changeHealth` handler:

```typescript
function handleChangeHealth(state: GameState, payload: ChangeHealthPayload): void {
  const entity = resolveTarget(state, payload.target);
  if (!entity) return;

  let delta = payload.delta;

  // Poison: +1 damage from all damage sources
  if (delta < 0) {  // taking damage
    const hasPoisonActive = entity.entityConditions?.some(
      c => c.name === 'poison' && c.state !== 'expire' && c.state !== 'removed' && !c.expired
    );
    if (hasPoisonActive) {
      delta -= 1;  // extra 1 damage
    }
  }

  entity.health = Math.max(0, Math.min(entity.maxHealth, entity.health + delta));
  
  // Auto-kill monsters at 0
  if (entity.health === 0 && entity.dead !== undefined) {
    entity.dead = true;
  }
}
```

Also apply poison modifier to wound damage at turn start:

```typescript
// In applyTurnStartConditions, when applying wound damage:
if (stillHasWound) {
  let woundDmg = 1;
  if (hasPoisonActive) woundDmg += 1;  // poison adds +1
  entity.health = Math.max(0, entity.health - woundDmg);
}
```

**Note:** This doesn't cover ALL damage sources perfectly (trap damage, retaliate,
etc.) but covers the primary sources managed by our engine: HP changes and wound.
A more complete implementation would require a `applyDamage` helper that all
damage sources funnel through.

For visual telegraph: the client can check if a figure has poison and show a
"+1" indicator near the damage display. This is a UI change — defer to Batch 2
when the card layout is redesigned. For now, the mechanical +1 is what matters.

## BUG 5 — Dead Standees Remain Visible

### Fix

This is partially a UI issue (Batch 2) but the engine should also clean up.

In `applyCommand.ts`, after any command that might kill an entity (changeHealth,
toggleTurn with wound damage), clean up dead entities:

Option A: Remove dead entities from the array entirely:
```typescript
monster.entities = monster.entities.filter(e => !e.dead);
```

Option B: Keep dead entities but mark them clearly. The UI filters them.

**Recommendation:** Keep dead entities in state (for undo support) but ensure
`getInitiativeOrder` and all turn-order logic skips them. The UI (Batch 2)
will hide or heavily dim them.

Check `getInitiativeOrder` in `turnOrder.ts` — it should already filter
`entity.dead` when determining if a monster group has active standees. Read
the function and verify.

Also: in the `toggleTurn` handler, when auto-advancing to the next figure,
skip monster groups where all entities are dead.

## BUG 6 — Dead Monster Groups in Turn Order

### Fix

In `getInitiativeOrder()` in `turnOrder.ts`:

```typescript
// When building ordered figures, skip monsters with all dead entities:
if (type === 'monster') {
  const monster = state.monsters.find(m => figureId matches);
  if (!monster) continue;
  const hasLiveEntities = monster.entities.some(e => !e.dead);
  if (!hasLiveEntities) continue;  // skip dead monster groups
}
```

Also in `drawMonsterAbilities()` in `applyCommand.ts`: skip drawing for monster
groups with no living entities:

```typescript
for (const monster of state.monsters) {
  if (!monster.entities.some(e => !e.dead)) continue;  // skip all-dead groups
  // ... draw ability card
}
```

Also in `startRound()` or `advancePhase`: when activating the first figure,
skip dead monster groups.

## STEP 1 — Fix all 6 bugs

Read the actual current code for each file listed above. Then implement the
fixes. For each bug:

1. Read the current implementation
2. Identify what's wrong (the bug may be different from what I described above — the code may have evolved)
3. Fix it
4. Verify the fix doesn't break existing tests

## STEP 2 — Write a condition test

Create and run `_test_conditions.mts` at repo root:

```typescript
import { applyCommand, createEmptyGameState } from './packages/shared/src/index.js';

// Helper to apply commands without dataContext (use defaults)
function apply(state: any, command: any) {
  return applyCommand(state, command).state;
}

let state = createEmptyGameState('gh');

// Add a character
state = apply(state, { action: 'addCharacter', payload: { name: 'brute', edition: 'gh', level: 3 } });
// Manually set maxHealth since we don't have dataContext
state.characters[0].maxHealth = 14;
state.characters[0].health = 14;

// Add a monster group with one entity
state = apply(state, { action: 'addMonsterGroup', payload: { name: 'guard', edition: 'gh' } });
state.monsters[0].entities = [{
  number: 1, type: 'normal', health: 5, maxHealth: 5,
  dead: false, active: false, off: false, dormant: false,
  entityConditions: [], markers: [], tags: []
}];
state.figures = ['gh-brute', 'gh-guard'];

// === Test: Strengthen expires after next turn ===
console.log('Test: Strengthen expiry');

// Apply strengthen
state = apply(state, {
  action: 'toggleCondition',
  payload: { target: { type: 'character', name: 'brute', edition: 'gh' }, condition: 'strengthen' }
});
console.assert(
  state.characters[0].entityConditions.some(c => c.name === 'strengthen'),
  'Strengthen should be applied'
);

// Set initiatives and start round
state.characters[0].initiative = 10;
state.monsters[0].initiative = 50;
state = apply(state, { action: 'advancePhase', payload: {} });

// Brute is active (lowest initiative). End their turn.
state = apply(state, { action: 'toggleTurn', payload: { figure: 'gh-brute' } });

// Strengthen should still exist (was applied this turn, state went new → normal)
const strengthenAfterTurn1 = state.characters[0].entityConditions.find(c => c.name === 'strengthen');
console.assert(strengthenAfterTurn1, 'Strengthen should survive the turn it was applied');
console.log(`  After turn 1: strengthen state = ${strengthenAfterTurn1?.state}`);

// End monster turn, end round, start new round
state = apply(state, { action: 'toggleTurn', payload: { figure: 'gh-guard' } });
state = apply(state, { action: 'advancePhase', payload: {} }); // end round

// Set initiatives again, start round 2
state.characters[0].initiative = 10;
state.monsters[0].initiative = 50;
state = apply(state, { action: 'advancePhase', payload: {} }); // start round 2

// Brute's turn again — strengthen should be active during this turn
const strengthenDuringTurn2 = state.characters[0].entityConditions.find(c => c.name === 'strengthen');
console.assert(strengthenDuringTurn2, 'Strengthen should be active during next turn');
console.log(`  During turn 2: strengthen state = ${strengthenDuringTurn2?.state}`);

// End Brute's turn — strengthen should expire NOW
state = apply(state, { action: 'toggleTurn', payload: { figure: 'gh-brute' } });
const strengthenAfterTurn2 = state.characters[0].entityConditions.find(c => c.name === 'strengthen');
console.assert(!strengthenAfterTurn2 || strengthenAfterTurn2.state === 'expire',
  'Strengthen should be expired or removed after completing next turn');
console.log(`  After turn 2: ${strengthenAfterTurn2 ? `state = ${strengthenAfterTurn2.state}` : 'REMOVED'}`);
console.log('✓ Strengthen expiry test passed\n');

// === Test: Wound + Regenerate interaction ===
console.log('Test: Wound + Regenerate');

// Apply wound and regenerate to brute
state = apply(state, {
  action: 'toggleCondition',
  payload: { target: { type: 'character', name: 'brute', edition: 'gh' }, condition: 'wound' }
});
state = apply(state, {
  action: 'toggleCondition',
  payload: { target: { type: 'character', name: 'brute', edition: 'gh' }, condition: 'regenerate' }
});

const hpBefore = state.characters[0].health;

// End monster turn, end round, start new round, brute activates
state = apply(state, { action: 'toggleTurn', payload: { figure: 'gh-guard' } });
state = apply(state, { action: 'advancePhase', payload: {} });
state.characters[0].initiative = 10;
state.monsters[0].initiative = 50;
state = apply(state, { action: 'advancePhase', payload: {} });

// Brute activated — regenerate should have cleared wound, no HP change
const hpAfter = state.characters[0].health;
const hasWound = state.characters[0].entityConditions.some(c => c.name === 'wound');
console.assert(hpAfter === hpBefore, `HP should be unchanged: was ${hpBefore}, now ${hpAfter}`);
console.assert(!hasWound, 'Wound should be removed by regenerate');
console.log(`  HP: ${hpBefore} → ${hpAfter}, wound removed: ${!hasWound}`);
console.log('✓ Wound + Regenerate test passed\n');

// === Test: Poison adds +1 damage ===
console.log('Test: Poison +1 damage');

state = apply(state, {
  action: 'toggleCondition',
  payload: { target: { type: 'character', name: 'brute', edition: 'gh' }, condition: 'poison' }
});

const hpBeforePoison = state.characters[0].health;
state = apply(state, {
  action: 'changeHealth',
  payload: { target: { type: 'character', name: 'brute', edition: 'gh' }, delta: -2 }
});
const hpAfterPoison = state.characters[0].health;
const expectedDmg = 3; // 2 + 1 from poison
console.assert(hpBeforePoison - hpAfterPoison === expectedDmg,
  `Should take ${expectedDmg} damage (2 + poison), took ${hpBeforePoison - hpAfterPoison}`);
console.log(`  HP: ${hpBeforePoison} → ${hpAfterPoison} (${hpBeforePoison - hpAfterPoison} damage with poison)`);
console.log('✓ Poison +1 damage test passed\n');

// === Test: Dead monster group excluded from turn order ===
console.log('Test: Dead group excluded');

// Kill the guard
state.monsters[0].entities[0].health = 0;
state.monsters[0].entities[0].dead = true;

// Check initiative order
import { getInitiativeOrder } from './packages/shared/src/engine/turnOrder.js';
const order = getInitiativeOrder(state);
const guardInOrder = order.find(f => f.name === 'guard');
console.assert(!guardInOrder, 'Dead monster group should not be in turn order');
console.log(`  Guard in turn order: ${guardInOrder ? 'YES (BUG)' : 'NO (correct)'}`);
console.log('✓ Dead group exclusion test passed\n');

console.log('✓ All Batch 1 condition tests passed');
```

Run: `npx tsx _test_conditions.mts`

This test will likely FAIL before your fixes and PASS after. Use it to verify.

Delete after: `Remove-Item _test_conditions.mts -ErrorAction SilentlyContinue`

## STEP 3 — Run existing integration tests

```powershell
npx tsx server/src/__tests__/integration.test.mts
```

Ensure existing tests still pass after the condition engine changes.

## STEP 4 — Update BUGFIX_LOG.md

Append entries for all 6 bugs with symptom, root cause, and fix.

## STEP 5 — Commit

```powershell
git add -A
git commit -m "fix: condition engine — expiry, regenerate+wound, bane, poison, dead entity cleanup

- B1: Conditions now expire correctly at end of figure's next turn
  (new → normal at end of application turn, normal → expire at end of next turn)
- B2: Regenerate clears wound/poison instead of healing when both present
- B3: Bane deals 10 damage when expiring at end of next turn (FH)
- B4: Poison adds +1 to all damage from changeHealth and wound
- B5: Dead monster entities handled consistently (kept for undo, filtered from UI)
- B6: Dead monster groups excluded from initiative order and ability card draw
- Condition state machine: isEndOfNextTurnCondition() determines expiry type
- Turn-start processing order: regenerate → wound (regenerate can prevent wound)
- Tests: condition lifecycle, wound+regenerate, poison damage, dead group exclusion"
git push
```

Report: commit hash, test results (both the new condition tests and existing
integration tests), and confirm that Strengthen applied on Turn 1 expires at
end of Turn 2.
