# Batch 12 — Game Logic + Combat Fixes

> Paste this entire file into Claude Code. Read `RESPONSE_CONTRACT.md` and
> `docs/GAME_RULES_REFERENCE.md` §3 (Resting), §5 (Attack Modifier Deck),
> and §11 (Ending a Scenario) before implementing. Execute all 4 fixes,
> then run the verification checklist.

---

## Fix 12.1 — Long Rest doesn't heal 2 HP

### Problem
`activateFigure()` in `packages/shared/src/engine/applyCommand.ts` (line 652-681)
calls `applyTurnStartConditions()` for characters but never checks `char.longRest`.
Per GAME_RULES_REFERENCE.md §3:

> **Long Rest** (declared during card selection, initiative 99):
> 1. Lose one card of CHOICE from discard; return rest to hand (mandatory)
> 2. Perform "Heal 2, self" (optional)
> 3. Recover all spent items (optional)

The heal happens when the character's turn activates. The companion app should
auto-apply the heal. Card loss and item recovery are player-managed.

### Fix
In `activateFigure()`, inside the `if (type === 'character')` block (line 660-669),
add long rest healing BEFORE `applyTurnStartConditions()`:

```typescript
if (type === 'character') {
  const c = figure as Character;

  // Long rest: Heal 2, self (per rules §3)
  if (c.longRest) {
    // Heal clears wound/poison/bane/brittle INSTEAD of restoring HP
    const hasHealBlocker = c.entityConditions.some(
      (cond) => (cond.name === 'wound' || cond.name === 'wound_x' ||
                 cond.name === 'poison' || cond.name === 'poison_x' ||
                 cond.name === 'bane' || cond.name === 'brittle')
        && !cond.expired && cond.state !== 'expire' && cond.state !== 'removed',
    );
    if (hasHealBlocker) {
      // Remove wound, poison, bane, brittle — heal consumed
      c.entityConditions = c.entityConditions.filter(
        (cond) => !(
          (cond.name === 'wound' || cond.name === 'wound_x' ||
           cond.name === 'poison' || cond.name === 'poison_x' ||
           cond.name === 'bane' || cond.name === 'brittle')
          && !cond.expired && cond.state !== 'expire' && cond.state !== 'removed'
        ),
      );
    } else {
      // No blocking conditions — heal 2 HP
      c.health = Math.min(c.maxHealth, c.health + 2);
    }
    // Clear long rest flag after processing
    c.longRest = false;
  }

  // Turn start: wound/regenerate processing (existing)
  applyTurnStartConditions(c);
  // ... rest of summon activation unchanged
}
```

Key rule: the heal fires BEFORE wound/regenerate processing. Regenerate is a
separate heal that runs at turn start regardless. Long rest heal is in addition
to regenerate, but both follow the same heal-clears-conditions rule.

Clear `c.longRest = false` after the heal so the character doesn't long-rest again
next round.

### Files
- `packages/shared/src/engine/applyCommand.ts`

---

## Fix 12.2 — Bless/Curse cards not removed after drawing

### Problem
`handleDrawModifierCard()` in `packages/shared/src/engine/applyCommand.ts`
(line 1198-1209) advances `deck.current` but doesn't check if the drawn card is
a bless or curse. Per GAME_RULES_REFERENCE.md §5:

> **Bless:** 2x modifier, returned to supply when drawn
> **Curse:** Null modifier, returned to supply when drawn

Bless/curse cards should be REMOVED from the deck array after being drawn —
they do not go into the discard and are not reshuffled back in.

Additionally, `handleShuffleModifierDeck()` (line 1186-1196) reshuffles ALL
cards including any undrawn bless/curse. Per rules, bless/curse are only removed
when drawn. Undrawn bless/curse should survive a shuffle. BUT: at end of scenario,
all bless/curse are removed from all decks (§11). This is handled by
`handleSetScenario` which rebuilds the deck from scratch — so shuffle behavior
is correct as-is.

### Fix
Update `handleDrawModifierCard()` to splice out bless/curse after drawing:

```typescript
function handleDrawModifierCard(
  state: GameState,
  payload: { deck: 'monster' | 'ally' | { character: string; edition: string } },
): void {
  const deck = resolveModifierDeck(state, payload.deck);
  if (!deck || deck.current >= deck.cards.length) return;

  const drawnCardId = deck.cards[deck.current];

  // Check if drawn card is bless or curse — these are removed from the game
  const isBlessCurse = drawnCardId === 'bless' || drawnCardId === 'curse';

  if (isBlessCurse) {
    // Remove the card from the deck entirely (returned to supply)
    deck.cards.splice(deck.current, 1);
    // deck.current stays the same — next card has shifted into position
    // Set lastVisible to show the removed card type
    deck.lastVisible = deck.current - 1; // Will be -1 on first draw, handled by UI
    // Store the last drawn card type for UI display
    deck.lastDrawnBlessCurse = drawnCardId;
  } else {
    // Normal card: advance past it (stays in deck for reshuffle)
    deck.discarded.push(deck.current);
    deck.current += 1;
    deck.lastVisible = deck.current - 1;
  }
}
```

The `lastDrawnBlessCurse` field doesn't exist on `AttackModifierDeckModel`.
Instead of adding a new field, use a simpler approach — store the drawn card ID
in a way the UI can read it. Two options:

**Option A (simpler, recommended):** Don't add a new field. Instead, move the
bless/curse card to the discarded area THEN splice it out:
```typescript
function handleDrawModifierCard(
  state: GameState,
  payload: { deck: 'monster' | 'ally' | { character: string; edition: string } },
): void {
  const deck = resolveModifierDeck(state, payload.deck);
  if (!deck || deck.current >= deck.cards.length) return;

  const drawnCard = deck.cards[deck.current];
  const isBlessCurse = drawnCard === 'bless' || drawnCard === 'curse';

  // Advance past the drawn card
  deck.discarded.push(deck.current);
  deck.current += 1;
  deck.lastVisible = deck.current - 1;

  if (isBlessCurse) {
    // Remove the bless/curse card from the deck (returned to supply)
    // Adjust: the card was at index (deck.current - 1) before we advanced
    const cardIndex = deck.current - 1;
    deck.cards.splice(cardIndex, 1);
    // Adjust current and discarded indices since we removed an element
    deck.current -= 1;
    deck.discarded = deck.discarded
      .filter(i => i !== cardIndex)
      .map(i => i > cardIndex ? i - 1 : i);
    // lastVisible points to the card that was shown — but it's been removed
    // Set lastVisible to -1 and track the type separately
    deck.lastVisible = -1;
  }
}
```

Actually, both options create complexity with index shifting. **Simplest correct
approach:** splice the card out and don't track indices at all. The UI already
reads `deck.cards[deck.lastVisible]` to get the last drawn card. So:

```typescript
function handleDrawModifierCard(
  state: GameState,
  payload: { deck: 'monster' | 'ally' | { character: string; edition: string } },
): void {
  const deck = resolveModifierDeck(state, payload.deck);
  if (!deck || deck.current >= deck.cards.length) return;

  const drawnCard = deck.cards[deck.current];
  const isBlessCurse = drawnCard === 'bless' || drawnCard === 'curse';

  if (isBlessCurse) {
    // Remove bless/curse from deck (returned to supply per rules)
    deck.cards.splice(deck.current, 1);
    // deck.current unchanged — next card shifts into this position
    // For UI: store drawn card info so ModifierDeck can display it
    // Use a temporary marker in the discarded array
    deck.lastVisible = -2; // sentinel: check lastDrawnType
    (deck as any)._lastDrawnType = drawnCard; // transient, not persisted
  } else {
    deck.discarded.push(deck.current);
    deck.current += 1;
    deck.lastVisible = deck.current - 1;
  }
}
```

This gets messy. **Final approach — keep it clean:**

The real issue is simpler than the index gymnastics suggest. The drawn cards array
is a stack. Instead of tracking indices, just track the card ID of the last drawn
card separately. Add a field to the draw handler's scope:

**Recommended implementation:**
```typescript
function handleDrawModifierCard(
  state: GameState,
  payload: { deck: 'monster' | 'ally' | { character: string; edition: string } },
): void {
  const deck = resolveModifierDeck(state, payload.deck);
  if (!deck || deck.current >= deck.cards.length) return;

  const drawnCard = deck.cards[deck.current];

  // Always advance past the drawn card
  deck.current += 1;
  deck.lastVisible = deck.current - 1;

  // Bless/curse: remove from deck after drawing (returned to supply)
  if (drawnCard === 'bless' || drawnCard === 'curse') {
    // Remove from cards array — it was at lastVisible position
    const removeIdx = deck.lastVisible;
    deck.cards.splice(removeIdx, 1);
    // Adjust current since array shrunk
    deck.current -= 1;
    // lastVisible now points to the card AFTER the removed one (or end)
    // But the UI needs to know what was drawn — the card is gone from the array
    // Store it at the END of the discarded array as a negative sentinel
    // Actually: just leave lastVisible as-is. The card at that index is now
    // the next undrawn card (shifted down). The UI will show the wrong card.
    // Best fix: store last drawn card ID on the deck object.
  }
}
```

**FINAL DECISION — cleanest approach:**

Store `lastDrawn` as a string on the deck model. This is a display-only field.

1. Add `lastDrawn?: string` to `AttackModifierDeckModel` in
   `packages/shared/src/types/gameState.ts` (after `lastVisible`).

2. Rewrite `handleDrawModifierCard`:
```typescript
function handleDrawModifierCard(
  state: GameState,
  payload: { deck: 'monster' | 'ally' | { character: string; edition: string } },
): void {
  const deck = resolveModifierDeck(state, payload.deck);
  if (!deck || deck.current >= deck.cards.length) return;

  const drawnCard = deck.cards[deck.current];
  deck.lastDrawn = drawnCard;

  if (drawnCard === 'bless' || drawnCard === 'curse') {
    // Bless/curse: remove from deck (returned to supply per rules §5)
    deck.cards.splice(deck.current, 1);
    // deck.current unchanged — next card shifted into this position
  } else {
    // Normal card: advance past it
    deck.current += 1;
  }
  deck.lastVisible = deck.current - 1;
}
```

3. Update `ModifierDeck.tsx` to read `deck.lastDrawn` instead of
   `deck.cards[deck.lastVisible]` for the last drawn card display:
```typescript
const lastDrawnCard = deck.lastDrawn ?? null;
const lastDrawnDisplay = lastDrawnCard
  ? (modifierDisplay[parseCardType(lastDrawnCard)]
    || { label: lastDrawnCard, color: 'var(--text-muted)' })
  : null;
```

### Files
- `packages/shared/src/types/gameState.ts`
- `packages/shared/src/engine/applyCommand.ts`
- `app/components/ModifierDeck.tsx`

---

## Fix 12.3 — Monsters remain on board after scenario complete

### Problem
`handleCompleteScenario()` (line 1421-1489) transfers XP and gold but never clears
`state.monsters`, `state.figures`, or resets character state. Monsters remain visible.

### Fix
Add cleanup at the end of `handleCompleteScenario()`, before the `state.finish`
assignment (line 1488):

```typescript
  // Clear scenario state — monsters, objectives, figures list
  state.monsters = [];
  state.objectiveContainers = [];
  // Keep only character figure references
  state.figures = state.figures.filter((figStr) =>
    state.characters.some((c) => `${c.edition}-${c.name}` === figStr)
  );

  // Reset character combat state (preserve progress)
  for (const char of state.characters) {
    char.initiative = 0;
    char.health = char.maxHealth;
    char.exhausted = false;
    char.longRest = false;
    char.entityConditions = [];
    char.summons = [];
    char.active = false;
    char.off = false;
  }

  // Reset round and phase
  state.state = 'draw';
  state.round = 0;

  // Clear element board
  if (state.elementBoard) {
    for (const el of state.elementBoard) {
      el.state = 'inert';
    }
  }
```

### Files
- `packages/shared/src/engine/applyCommand.ts`

---

## Fix 12.4 — Gold not tracked for GH scenarios

### Problem
`handleCompleteScenario()` (line 1437-1458) derives gold from `char.lootCards` —
iterating over loot card indices and summing coin values from `state.lootDeck.cards`.
This works for FH scenarios that have a loot deck. For GH scenarios with NO loot deck
(`state.lootDeck.cards` is empty), `char.lootCards` is always empty, so zero gold
converts.

In GH, `char.loot` is the simple coin counter (incremented by tapping the gold icon).
Each loot token = 1 coin. Gold = coins × goldConversion.

### Fix
Update the gold conversion block in `handleCompleteScenario()` to handle BOTH
systems. After the existing loot card processing loop, add a fallback for
GH-style coin counting:

Replace the gold conversion section (lines 1437-1458) with:

```typescript
    // Transfer loot → gold and resources
    let totalCoins = 0;
    if (!char.progress.loot) char.progress.loot = {};

    if (char.lootCards && char.lootCards.length > 0 && state.lootDeck?.cards?.length > 0) {
      // FH system: derive gold and resources from loot cards
      for (const cardIndex of char.lootCards) {
        const card = state.lootDeck.cards[cardIndex];
        if (!card) continue;

        if (card.type === 'money') {
          const coinValue = playerCount <= 2 ? card.value2P
            : playerCount === 3 ? card.value3P
            : card.value4P;
          totalCoins += coinValue;
        } else {
          char.progress.loot[card.type] = (char.progress.loot[card.type] || 0) + 1;
        }
      }
    } else {
      // GH system: char.loot is a simple coin count (each = 1 coin)
      totalCoins = char.loot || 0;
    }

    // Convert total coins to gold at scenario level rate
    char.progress.gold += totalCoins * goldConversion;
```

This ensures GH coins (tracked via the counter) convert correctly, while FH
loot cards still use the detailed card-based system.

### Files
- `packages/shared/src/engine/applyCommand.ts`

---

## Verification Checklist

```
[ ] npm run build completes without errors

Long Rest (12.1):
[ ] Declare Long Rest on Brute (initiative 99, zzz icon)
[ ] Start round → Brute activates at initiative 99
[ ] Brute gains 2 HP when activated (or heals condition if wounded/poisoned)
[ ] Brute with wound + long rest: wound removed, no HP gain
[ ] longRest flag cleared after activation (doesn't repeat next round)

Bless/Curse (12.2):
[ ] Add a bless to monster deck (+1 card)
[ ] Draw until bless is drawn → "2× BLESS" displayed
[ ] Deck count decremented by 1 MORE than draws (bless removed)
[ ] Shuffle deck → bless NOT present (already removed by draw)
[ ] Add a curse → draw curse → "∅ CURSE" displayed → removed
[ ] ModifierDeck UI shows correct last-drawn card type

Scenario End (12.3):
[ ] Complete scenario (Victory) → all monsters disappear from board
[ ] Character cards remain with full HP
[ ] Round reset to 0, phase to "Card Selection"
[ ] Elements all inert
[ ] No monster groups in figure list

Gold Tracking GH (12.4):
[ ] GH scenario: give Brute 3 loot taps during play
[ ] Complete (Victory) at level 2 → Brute gets 3 × 3 = 9 gold
[ ] Character sheet shows Total Gold increased by 9
[ ] FH scenario: loot cards still convert correctly via card system
```

## Commit Message

```
fix(batch-12): game logic — long rest heal, bless/curse removal, scenario cleanup, GH gold

- Long rest heals 2 HP on character activation (clears wound/poison per rules)
- Bless/curse cards removed from modifier deck after drawing (returned to supply)
- Add lastDrawn field to AttackModifierDeckModel for UI display
- Clear monsters, reset characters, and restore elements on scenario complete
- GH gold conversion falls back to char.loot when no loot deck present
```
