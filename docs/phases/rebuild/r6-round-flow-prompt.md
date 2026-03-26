# R6 — Round Flow Automation

> Paste into Claude Code. Implements the full round lifecycle: draw phase with
> initiative input, monster ability card draw + resolution, play phase with
> initiative-sorted turns and auto-advance, end-of-round automation (element
> decay, condition processing, deck shuffling). Fixes Critical #4, High #8,
> #11, #12 from audit. Completes Phase R.

---

Read CLAUDE.md, then docs/GHS_AUDIT.md (Section 6: Round Flow — Complete
Lifecycle, Section 5: Monster Ability Cards, Section 8: Conditions).

Then read ALL of these:
- `packages/shared/src/engine/applyCommand.ts` — advancePhase, toggleTurn, drawMonsterAbility handlers
- `packages/shared/src/engine/turnOrder.ts` — startRound, endRound, activateNextFigure, getInitiativeOrder, isRoundComplete, canAdvancePhase
- `packages/shared/src/utils/conditions.ts` — processConditionEndOfRound, processConditionEndOfTurn
- `packages/shared/src/utils/elements.ts` — decayElements
- `packages/shared/src/data/types.ts` — MonsterAbilityCard, MonsterAbilityAction
- `packages/shared/src/data/index.ts` — DataManager methods for ability decks
- `app/controller/ScenarioView.tsx` — current implementation
- `app/controller/hooks/useMonsterData.ts` — how monster stats/abilities are fetched
- `app/components/ScenarioFooter.tsx` — phase button
- `app/components/FigureList.tsx` — figure rendering
- `app/components/CharacterBar.tsx` — initiative display, turn toggle
- `app/components/MonsterGroup.tsx` — ability card display
- `app/components/InitiativeDisplay.tsx` — initiative input
- `clients/shared/lib/commandSender.ts` — advancePhase, toggleTurn, drawMonsterAbility, setInitiative signatures

## What Exists vs What's Needed

### Already built (server-side engine):
- `startRound()` — sorts figures by initiative, activates first
- `endRound()` — increments round, decays elements, processes conditions, clears initiative
- `activateNextFigure()` — deactivates current, activates next
- `advancePhase` command handler — calls startRound or endRound based on state
- `toggleTurn` command handler — toggles active/off on a figure
- `drawMonsterAbility` command handler — advances ability index on a monster
- `processConditionEndOfRound()` / `processConditionEndOfTurn()` — condition state transitions

### Missing or incomplete:
1. **Auto-draw monster abilities on round start** — when advancePhase transitions draw→play, all monster ability cards should be drawn automatically
2. **Monster initiative from ability card** — after drawing, monsters need their initiative set from the drawn card's initiative value
3. **Resolved ability values** — the UI needs to show base stat + card modifier for each action (e.g., "Move 3" when base=2, card=+1)
4. **Shared deck handling** — multiple monster groups using same deck name must draw the same card
5. **Figure re-sort after ability draw** — figures array needs re-sorting once monster initiatives are known
6. **Auto-advance on turn end** — toggleTurn should auto-activate next figure
7. **Condition damage** — wound damage at turn start, bane damage at turn end (FH)
8. **Deck shuffle tracking** — if drawn ability has `shuffle: true`, shuffle at end of round
9. **Long rest initiative** — characters with longRest get initiative 99
10. **UI: initiative input during draw phase** — already exists but verify it works
11. **UI: ability card display on MonsterGroup** — already has the prop, verify data flows

## STEP 1 — Server: Auto-draw monster abilities on advancePhase (draw → play)

Read the `advancePhase` handler in `applyCommand.ts`. When transitioning from
`draw` to `next` (start of round), it should:

1. Draw ability cards for all active monster groups
2. Set each monster's initiative from the drawn card
3. Handle shared ability decks correctly
4. Re-sort the `figures` array by initiative
5. Activate the first figure

Check if this already happens. If not, implement it.

### Shared ability deck logic

From the audit: multiple monster types share one deck (e.g., bandit-guard and
city-guard both use "guard" deck). When drawing, all groups sharing a deck
draw the SAME card.

Implementation:

```typescript
function drawMonsterAbilities(state: GameState, dataContext?: DataContext): void {
  if (!dataContext) return;

  // Group monsters by their ability deck name
  const deckGroups = new Map<string, Monster[]>();

  for (const monster of state.monsters) {
    if (monster.entities.some(e => !e.dead)) {
      const monsterData = dataContext.getMonster(monster.edition, monster.name);
      const deckName = monsterData?.deck || monster.name;
      const key = `${monster.edition}:${deckName}`;

      if (!deckGroups.has(key)) {
        deckGroups.set(key, []);
      }
      deckGroups.get(key)!.push(monster);
    }
  }

  // For each unique deck, draw one card and apply to all groups using it
  for (const [deckKey, monsters] of deckGroups) {
    const [edition, deckName] = deckKey.split(':');
    const deckData = dataContext.getMonsterDeck(edition, deckName);

    if (!deckData || !deckData.abilities || deckData.abilities.length === 0) continue;

    // Advance ability index (draw next card from deck)
    // Each monster tracks its own ability index into the deck
    // For shared decks, all groups should point to the same card
    const firstMonster = monsters[0];

    // Get current deck position — use the first monster's tracking
    // Increment to next card
    let abilityIndex = (firstMonster.ability ?? -1) + 1;

    // If we've gone through the whole deck, reshuffle
    if (abilityIndex >= deckData.abilities.length) {
      abilityIndex = 0;
      // Shuffle the abilities array on the monsters (TODO: proper shuffle tracking)
    }

    const drawnCard = deckData.abilities[abilityIndex];

    // Apply to all monsters sharing this deck
    for (const monster of monsters) {
      monster.ability = abilityIndex;
      // Set monster initiative from the drawn card
      monster.initiative = drawnCard.initiative;
    }
  }
}
```

Call this function inside the `advancePhase` handler BEFORE sorting figures:

```typescript
// In handleAdvancePhase, when state.state === 'draw':
if (canAdvancePhase(state)) {
  // Draw monster ability cards (sets monster.initiative)
  drawMonsterAbilities(after, dataContext);

  // Now sort figures by initiative
  // startRound() should handle this, or do it here
  // ...
}
```

Read the actual `startRound()` function in `turnOrder.ts` to see if it sorts
figures. If it does, the monster initiatives need to be set BEFORE calling
startRound. If startRound doesn't sort, add sorting.

### Figure sorting logic

From the audit: "Characters + monsters sorted by initiative (ascending) —
visual vertical card order IS the turn order."

Tie-breaking rules:
1. Lower initiative goes first
2. Characters before monsters at same initiative (GH rule)
3. Within same type and initiative, preserve existing order

```typescript
function sortFiguresByInitiative(state: GameState): void {
  const figureData = new Map<string, { initiative: number; type: string }>();

  for (const c of state.characters) {
    const figId = `${c.edition}-${c.name}`;
    figureData.set(figId, {
      initiative: c.longRest ? 99 : (c.initiative || 99),
      type: 'character'
    });
  }

  for (const m of state.monsters) {
    const figId = `${m.edition}-${m.name}`;
    figureData.set(figId, {
      initiative: m.initiative || 99,
      type: 'monster'
    });
  }

  state.figures.sort((a, b) => {
    const fa = figureData.get(a);
    const fb = figureData.get(b);
    if (!fa || !fb) return 0;

    // Primary: initiative ascending
    if (fa.initiative !== fb.initiative) return fa.initiative - fb.initiative;

    // Tie-break: characters before monsters
    if (fa.type !== fb.type) {
      return fa.type === 'character' ? -1 : 1;
    }

    return 0; // preserve order
  });
}
```

### Long rest handling

Characters with `longRest = true` should get initiative 99. Check if this is
already handled in `setInitiative` or `startRound`. If not, add it to the
advancePhase logic:

```typescript
for (const char of state.characters) {
  if (char.longRest) {
    char.initiative = 99;
  }
}
```

## STEP 2 — Server: Auto-advance on toggleTurn

From the audit: "Click portrait = end turn. Next in initiative order auto-activates."

Read the `toggleTurn` handler in `applyCommand.ts`. When a figure's turn is
ended (active → off), the next figure should auto-activate.

Check if this already happens. The `activateNextFigure()` function from
`turnOrder.ts` does this — verify it's called in the toggleTurn handler.

If toggleTurn just toggles the flag without auto-advance, add:

```typescript
// After setting current figure to off:
if (wasActive) {
  // Process end-of-turn conditions
  processEndOfTurn(entity);

  // Auto-activate next figure
  const nextFigure = findNextActiveFigure(state);
  if (nextFigure) {
    nextFigure.active = true;
  }
}
```

### End-of-turn condition processing

From the audit Section 8:
- **Wound**: suffer 1 damage at START of turn (not end)
- **Regenerate**: heal 1 at start of turn
- **Bane (FH)**: suffer 10 damage at end of next turn
- **Conditions with "End of next turn" expiry**: Stun, Immobilize, Disarm,
  Muddle, Invisible, Strengthen expire at end of their next turn

The existing `processConditionEndOfTurn()` in `conditions.ts` should handle
expiry. Read it and verify it:
1. Removes expired conditions (state === 'expire')
2. Transitions conditions that should expire next (state === 'normal' → 'expire'
   for single-turn conditions)

Wound damage should be applied at turn START, not end. This means when a figure
becomes active, check for wound:

```typescript
// When activating a figure:
if (entity.entityConditions.some(c => c.name === 'wound' && !c.expired)) {
  entity.health = Math.max(0, entity.health - 1);
  if (entity.health === 0 && entity.type !== undefined) {
    // Monster auto-kill at 0
    entity.dead = true;
  }
}

// Regenerate: heal 1 at turn start
if (entity.entityConditions.some(c => c.name === 'regenerate' && !c.expired)) {
  entity.health = Math.min(entity.maxHealth, entity.health + 1);
}
```

**IMPORTANT**: Read the actual condition utility functions before implementing.
They may already handle this. The key question is WHERE these are called —
at turn start (activation) or turn end (deactivation). GHS applies wound at
turn start and expires conditions at turn end.

## STEP 3 — Server: End-of-round automation in advancePhase

When `advancePhase` transitions from play to draw (end of round), verify these
all happen:

1. **Element decay**: strong → waning, waning → inert (via `decayElements()`)
2. **Condition end-of-round processing** (via `processConditionEndOfRound()`)
3. **Round counter increment**
4. **Clear all active/off flags**
5. **Clear character initiatives** (set to 0)
6. **Long rest processing**: characters with longRest lose 1 random card
   (we can skip hand management for now — just clear the longRest flag)
7. **Shuffle tracking**: if any drawn monster ability card had `shuffle: true`,
   shuffle that deck (reset ability index to random position)
8. **Shuffle AMD**: if any drawn AMD card had shuffle flag, shuffle the AMD

The existing `endRound()` in `turnOrder.ts` should handle most of this. Read
it and verify. Add any missing steps.

### Shuffle tracking for monster ability decks

When a monster ability card with `shuffle: true` is drawn, the deck should be
shuffled at end of round. This requires tracking a "needs shuffle" flag per deck.

Add to monster state or track in the advancePhase handler:

```typescript
// Check if any active monster group has a drawn card with shuffle flag
for (const monster of state.monsters) {
  if (monster.ability >= 0 && dataContext) {
    const monsterData = dataContext.getMonster(monster.edition, monster.name);
    const deckName = monsterData?.deck || monster.name;
    const deckData = dataContext.getMonsterDeck(monster.edition, deckName);

    if (deckData?.abilities[monster.ability]?.shuffle) {
      // Reset ability index — effectively shuffles the deck
      // (True shuffle would randomize the abilities array order)
      monster.ability = -1;
    }
  }
}
```

## STEP 4 — Client: Monster ability card display with resolved values

The `MonsterGroup` component receives `abilityCard` as a prop. R4's
`useMonsterData` hook fetches this data. Verify the data flows correctly:

1. `useMonsterData` fetches the ability deck for each monster
2. Uses `monster.ability` index to get the current drawn card
3. Passes it to `MonsterGroup` as `abilityCard` prop
4. `MonsterGroup` renders the ability card

The rendering needs to show **resolved values** — base stat + card modifier:

```tsx
// In MonsterGroup or a sub-component
function AbilityCardDisplay({ card, normalStats, eliteStats }: {
  card: MonsterAbilityCard;
  normalStats: MonsterLevelStats | null;
  eliteStats: MonsterLevelStats | null;
}) {
  return (
    <div class="ability-card">
      <div class="ability-initiative">{card.initiative}</div>
      <div class="ability-actions">
        {card.actions.map((action, i) => (
          <div key={i} class="ability-action">
            <span class="action-type">{formatActionType(action.type)}</span>
            {renderActionValue(action, normalStats, eliteStats)}
          </div>
        ))}
      </div>
      {card.shuffle && <span class="shuffle-indicator">♻</span>}
    </div>
  );
}

function renderActionValue(
  action: MonsterAbilityAction,
  normalStats: MonsterLevelStats | null,
  eliteStats: MonsterLevelStats | null
): preact.VNode {
  if (action.valueType === 'plus') {
    // Relative to base stat
    const normalBase = getBaseStat(normalStats, action.type);
    const eliteBase = getBaseStat(eliteStats, action.type);
    const normalResolved = normalBase + action.value;
    const eliteResolved = eliteBase + action.value;

    return (
      <span class="action-values">
        <span class="normal-value">{normalResolved}</span>
        {eliteStats && <span class="elite-value">{eliteResolved}</span>}
      </span>
    );
  } else {
    // Absolute value
    return <span class="action-value">{action.value}</span>;
  }
}

function getBaseStat(stats: MonsterLevelStats | null, actionType: string): number {
  if (!stats) return 0;
  switch (actionType) {
    case 'move': return stats.movement ?? 0;
    case 'attack': return stats.attack ?? 0;
    case 'range': return stats.range ?? 0;
    case 'heal': return 0;
    case 'shield': return 0;
    case 'retaliate': return 0;
    default: return 0;
  }
}

function formatActionType(type: string): string {
  const labels: Record<string, string> = {
    'move': 'Move', 'attack': 'Attack', 'range': 'Range',
    'heal': 'Heal', 'shield': 'Shield', 'retaliate': 'Retaliate',
    'target': 'Target', 'push': 'Push', 'pull': 'Pull',
    'pierce': 'Pierce', 'condition': '', // condition name shown separately
  };
  return labels[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}
```

Update `MonsterGroup` to use this sub-component for ability card display.

## STEP 5 — Client: Initiative input during draw phase

Verify `CharacterBar` shows editable initiative during draw phase. The
`InitiativeDisplay` component should:

- Show a number input when `editable={true}` (draw phase)
- Show the initiative number as read-only when `editable={false}` (play phase)
- Show "REST" when character has `longRest = true`

The `onSetInitiative` callback should call `commands.setInitiative(name, edition, value)`.

Check the connection: `ScenarioView` passes `isDrawPhase={phase === 'draw'}` to
`FigureList`, which passes it to `CharacterBar`, which passes `editable={isDrawPhase}`
to `InitiativeDisplay`.

If this chain isn't connected, wire it.

## STEP 6 — Client: Turn toggling via portrait click

From the audit: "Click portrait = end turn."

The `CharacterBar` has `onToggleTurn` prop. Verify:
1. Clicking the portrait area fires `onToggleTurn`
2. `onToggleTurn` calls `commands.toggleTurn(figureId)`
3. The server's toggleTurn handler ends the turn and auto-advances

For monsters: the `MonsterGroup` header or portrait should also be clickable to
end the monster group's turn. Verify `MonsterGroup` has a turn toggle interaction.

## STEP 7 — Client: Phase button logic in ScenarioView

The phase button in `ScenarioFooter` needs correct state transitions. The
`advanceInfo` computation in `ScenarioView` already handles this. Verify the
full cycle works:

1. **Draw phase, initiatives not set**: Button shows "Set Initiatives...", disabled
2. **Draw phase, all initiatives set**: Button shows "Start Round", enabled, gold
3. **Play phase, figure active**: Button shows "Next Turn", enabled
4. **Play phase, all figures done**: Button shows "Next Round", enabled
5. **Clicking "Start Round"**: calls `commands.advancePhase()` → server draws
   monster abilities, sorts figures, activates first figure
6. **Clicking "Next Turn"**: calls `commands.advancePhase()` → server deactivates
   current, activates next (OR this could be `commands.toggleTurn(activeFigureId)`)
7. **Clicking "Next Round"**: calls `commands.advancePhase()` → server ends round,
   decays elements, processes conditions, clears initiatives

**Key question**: Does the "Next Turn" button call `advancePhase` or `toggleTurn`?

GHS uses portrait click (toggleTurn) for individual figure turn completion, and
the big button is "Next Round" which handles end-of-round. There's no "Next Turn"
button in GHS — turns advance by clicking portraits.

Recommendation: Change the footer button behavior:
- Draw phase: "Start Round" → `advancePhase()`
- Play phase: Show "Next Round" (enabled only when all done, or always with warning)
- Turn advancement: via portrait clicks on `CharacterBar` and `MonsterGroup`

This matches GHS behavior. The footer button handles phase transitions, portrait
clicks handle individual turns.

Update the `advanceInfo` computation and footer rendering accordingly.

## STEP 8 — Client: Visual states for turn tracking

Verify these visual states work on CharacterBar and MonsterGroup:
- **Active** (figure.active = true): gold border, glow effect
- **Done** (figure.off = true): dimmed to 60% opacity
- **Waiting** (neither): normal appearance

The `isActive` and `isDone` props should map directly from `OrderedFigure.active`
and `OrderedFigure.off` in `FigureList`.

For `CharacterBar`: when active, the portrait should have a glow. When done,
the entire bar dims. Check the CSS classes `.character-bar.active` and
`.character-bar.done`.

For `MonsterGroup`: same pattern. Active = gold border on the group card.
Done = dimmed.

## STEP 9 — CSS additions

Add or update CSS for:

**Ability card display:**
```css
.ability-card {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  margin: 8px 0;
}

.ability-initiative {
  font-family: 'Cinzel', serif;
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--accent-gold);
  float: left;
  margin-right: 12px;
}

.ability-action {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
  font-size: 0.9rem;
}

.action-type {
  color: var(--text-secondary);
  min-width: 60px;
}

.action-values {
  display: flex;
  gap: 8px;
}

.normal-value {
  color: var(--text-primary);
  font-weight: 600;
}

.elite-value {
  color: var(--elite-gold);
  font-weight: 600;
}

.shuffle-indicator {
  color: var(--accent-copper);
  font-size: 0.8rem;
}
```

**Turn state animations:**
```css
.character-bar.active .portrait-container,
.monster-group.active .monster-portrait {
  animation: activeGlow 2s ease-in-out infinite;
}

@keyframes activeGlow {
  0%, 100% { box-shadow: 0 0 8px var(--accent-gold-dim); }
  50% { box-shadow: 0 0 16px var(--accent-gold); }
}
```

**Initiative display during draw phase:**
```css
.initiative-input-editable {
  width: 48px;
  height: 48px;
  text-align: center;
  font-family: 'Cinzel', serif;
  font-size: 1.2rem;
  font-weight: 700;
  background: var(--bg-primary);
  border: 2px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  color: var(--accent-gold);
}

.initiative-input-editable:focus {
  border-color: var(--accent-gold);
  box-shadow: 0 0 8px var(--accent-gold-dim);
}

.long-rest-indicator {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  color: var(--shield-blue);
  text-transform: uppercase;
  letter-spacing: 1px;
}
```

## STEP 10 — End-to-end test scenario

After all changes, test the full round cycle:

### Setup
1. Open controller, connect to fresh game
2. Open Scenario Setup, add Brute (L3), Spellweaver (L3), Cragheart (L4)
3. Select Scenario 1 (Black Barrow)
4. Confirm — monsters auto-spawn

### Round 1 — Draw Phase
5. Phase shows "Card Selection", footer button says "Start Round" (disabled)
6. Set Brute initiative: 15
7. Set Spellweaver initiative: 07
8. Set Cragheart initiative: 42
9. Footer button becomes enabled: "Start Round" (gold)

### Round 1 — Start Round
10. Click "Start Round"
11. Monster ability cards auto-drawn (each monster group shows ability card with initiative)
12. Figures re-sorted by initiative: Spellweaver(7), Brute(15), [monster initiative], Cragheart(42)
13. First figure activated (lowest initiative, should be Spellweaver at 7)
14. Spellweaver's portrait glows gold
15. Monster groups show resolved ability values (Move X, Attack Y with normal/elite columns)
16. Footer button changes to "Next Round"

### Round 1 — Play Phase
17. Click Spellweaver's portrait → her turn ends, bar dims
18. Next figure auto-activates (Brute or monster, depending on initiative)
19. Continue clicking portraits to advance through all figures
20. After last figure completes, all figures dimmed

### Round 1 — End Round
21. Click "Next Round"
22. Elements decay (strong → waning, waning → inert)
23. Conditions processed (expired conditions removed)
24. Round counter increments to 2
25. All initiatives cleared
26. Phase returns to "Card Selection"
27. Process repeats for Round 2

### Condition automation
28. Add Wound to a monster standee (via condition grid)
29. When that monster's turn starts (auto-activates), wound deals 1 damage
30. Add Strengthen to a character
31. After character's next turn ends, strengthen should be marked for expiry

### Verify
32. Monster ability cards show different initiative values each round (different cards drawn)
33. Shared deck: if two monster groups share a deck, they show same initiative
34. Figure order changes each round based on new initiatives

## STEP 11 — Update ROADMAP.md

```markdown
- [x] R6: Round flow automation — ability draw, turn order, auto-advance, condition/element automation
```

All Phase R items should now be [x]. Add:

```markdown
## Phase R: Controller Rebuild — COMPLETE
```

Update PROJECT_CONTEXT.md current phase to:
```
Phase R COMPLETE. Next: Phone + Display views (R7-R8) or Phase T (Town mode).
```

## STEP 12 — Commit

```powershell
git add -A
git commit -m "feat: round flow automation — ability draw, turn order, conditions, elements

- advancePhase (draw→play): auto-draws monster ability cards, sets monster
  initiative from cards, handles shared ability decks, sorts figures by
  initiative, activates first figure
- advancePhase (play→draw): element decay, condition end-of-round processing,
  shuffle tracking for ability/modifier decks, round increment, clear initiatives
- toggleTurn: auto-advances to next figure, processes end-of-turn conditions
- Wound damage applied at turn start (auto-activate), regenerate heals
- Monster ability card display with resolved values (base stat + card modifier)
- Shared deck resolution: multiple monster groups → same drawn card + initiative
- Portrait click ends turn for characters and monsters
- Footer button: Start Round (draw) / Next Round (play) — matches GHS behavior
- Turn visual states: active glow, done dimmed, waiting normal
- Phase R rebuild COMPLETE"
git push
```

Report: commit hash, bundle size, and which of the 34 verification checks pass.
Specifically confirm: do monster ability cards auto-draw on "Start Round" with
correct initiative values, and does turn advancement work via portrait clicks?
