# Batch 18a: Server Logic Bugs + Controller Standee Management

Five gameplay-critical issues. No new data required. No UI redesign. Surgical fixes to the shared engine, server, and controller.

## Skills to Read FIRST

1. **Project conventions** — Read `app/CONVENTIONS.md`
2. **Game rules** — Read `docs/GAME_RULES_REFERENCE.md` sections 2 (Round Structure), 7 (Spawning & Revealing), 8 (Summons)
3. **Command protocol** — Read `docs/COMMAND_PROTOCOL.md` for current command shapes

---

## Issue 1: Round Count Starts at 0 Instead of 1

### Problem
New scenarios initialize with `state.round = 0`. Gloomhaven rules say round numbering starts at 1 — the first round is "Round 1," not "Round 0." This shows up on the display, controller header, and phone as "Round 0" on scenario start.

### Fix Location
The `setScenario` and `startScenario` command handlers in `packages/shared/src/engine/applyCommand.ts`. Also check `scenario-setup` code paths — anywhere a scenario is initialized from scratch.

### Expected Behavior
- `state.round` initializes to `1` when a scenario starts
- The existing `advancePhase` / round-advance logic already increments correctly once you fix the starting value
- `completeScenario` should still reset `round` to 0 (or null) during cleanup — the reset happens during scenario teardown, new scenario starts at 1

### Audit Steps
1. Grep for `round = 0`, `round: 0`, `round =` in `packages/shared/src/`
2. Find every place a scenario initialization sets `state.round`
3. Change initialization to `1`
4. Grep for comparisons like `round === 0` or `round === 1` that might be semantically affected — particularly round-start logic that treats round 0 as "not yet started"

### Verification
- [ ] Start a new scenario on controller → display/controller/phone all show "Round 1"
- [ ] Advance phase → "Round 2" after end-of-round processing
- [ ] Complete scenario → start new scenario → shows "Round 1" again (not 0, not 2)
- [ ] Lobby view before scenario starts should not show "Round 1" prematurely — verify round counter only displays during scenario mode

---

## Issue 2: Room Reveal Doesn't Spawn Ability Cards or Set Monster Initiative

### Problem
Per GH rules (Section 7 of GAME_RULES_REFERENCE.md): **"Revealed/spawned monsters ACT during the round they appear."** This means when a door is opened mid-round:
1. The new monster group must have an ability card drawn immediately
2. The monster's initiative must be set (from the drawn ability card)
3. The monster is inserted into the current round's turn order
4. If the new monster's initiative has already passed in the current round, it acts immediately after the current figure

Current behavior: door reveal spawns monsters but doesn't draw their ability card or set initiative, so they sit idle until next round.

### Fix Location
The `revealRoom` command handler in `packages/shared/src/engine/applyCommand.ts`. Cross-reference with:
- `drawMonsterAbility` command handler (same file) — same logic needs to fire automatically during reveal
- `packages/shared/src/engine/turnOrder.ts` — for initiative insertion logic

### Expected Behavior

```
When revealRoom fires during play phase (state.state === 'next'):
  For each new monster group spawned:
    1. Draw its ability card (same logic as drawMonsterAbility)
    2. Set monster.ability to the drawn card index
    3. The monster's initiative value comes from the drawn card
    4. Insert into state.figures at the correct position per initiative order
    5. If the monster's initiative has already passed in the current round:
         - Mark it as if its turn is pending (not completed)
         - It should act immediately after the current active figure completes their turn
```

### Edge Cases
- **Door opened during draw phase** (`state.state === 'draw'`): Don't draw ability card yet — the next round's draw phase handles it. Just spawn the monsters and let them sit in the draw phase queue.
- **Multiple monster types revealed simultaneously**: Each gets its own ability card drawn.
- **Monster type already present in scenario** (door reveals more Bandit Guards when Bandit Guards already acting): The ability card is already drawn for that round. Don't redraw — add the new standees to the existing group.
- **Shared ability decks** (e.g., multiple Bandit types sharing the "Guard" deck): Respect the deck-sharing logic — don't double-draw from the shared deck.

### Verification
- [ ] Open a door mid-round → new monster group has ability card drawn immediately
- [ ] Display shows the new monster in the initiative column with its initiative value
- [ ] If the new initiative value has already passed, monster acts after current figure (test by setting up a scenario, advancing to a mid-round figure, then revealing)
- [ ] If the new initiative is later than the current figure, monster waits for its turn
- [ ] Opening a door during draw phase doesn't draw ability card prematurely
- [ ] Revealing a room where the same monster type is already active doesn't redraw the ability card

---

## Issue 3: Monster Special Abilities Not Wired

### Problem
Monster ability cards can contain actions like `summon`, `infuse`, `consume`, and others (heal self, area effects, special conditions). The shared engine has the command infrastructure (`addSummon`, `moveElement`), but monster ability cards that include these actions don't automatically trigger them when the monster acts.

### Scope Clarification
This is potentially a very large task — parsing monster ability JSON, mapping each action type to an engine command, handling targeting, edge cases, etc. For this batch, scope it to:

**In scope for Batch 18a:**
- **Monster `infuse` action**: When a monster's drawn ability card has an `infuse` action, automatically set the specified element to `strong` state when the monster activates
- **Monster `consume` action**: When a monster's drawn ability card consumes an element to enhance an attack/ability, mark the element as consumed (strong → inert, waning → inert) at activation
- **Monster `summon` action**: When a monster ability card has a summon action, create the summon standee(s) with correct stats (HP, attack, move) as a new monster entity in the monster group. The summon should have its own standee number and act as a normal/elite monster.

**Deferred to later batches:**
- Complex action chains (attack + condition + movement)
- Targeting logic (which characters are attacked)
- Area-of-effect resolution
- Damage calculation (this is already mostly manual via the controller)

### Fix Location
- `packages/shared/src/engine/applyCommand.ts` — likely a new internal function `processMonsterAbilityActivation(state, monster)` called when a monster becomes active
- Or extend the `toggleTurn` command handler to trigger special actions when a monster's turn begins

### Audit Steps
1. Check `packages/shared/src/types/gameState.ts` and any monster ability type definitions — understand the action schema (e.g., `{ type: 'infuse', element: 'fire' }`)
2. Look at GHS source if needed: `.staging/ghs-client/src/app/game/model/` for the `Action` type definitions
3. Find where `monster.active` is set to true (turn activation)
4. Add the action processing logic at that point
5. The action processing fires ONCE per monster turn activation — don't re-trigger on state reads

### Verification
- [ ] Monster ability card with "Infuse fire" → fire element goes to strong state when monster activates
- [ ] Monster ability card with "Consume ice" → ice element goes to inert when monster activates (if it was strong/waning)
- [ ] Monster ability card with "Summon [X]" → new entity appears in the monster group with the summon's stats
- [ ] Actions don't re-trigger if the GM toggles the monster's turn off and on
- [ ] Multiple monsters in a group with infuse/consume — the action fires once per monster activation, not once per group

---

## Issue 4: Controller Can't Add/Remove Elite or Normal Standees Mid-Game

### Problem
During play, the GM sometimes needs to add standees for a monster type:
- A summon ability produces new standees
- A scenario special rule spawns mid-round
- A standee was forgotten during setup
- An elite needs to be converted to normal (or vice versa)

The `addEntity` and `removeEntity` commands already exist in the protocol:
```
addEntity     | { monsterName, edition, entityNumber, type: MonsterType }
removeEntity  | { monsterName, edition, entityNumber, type: MonsterType }
```

But the controller UI doesn't expose a way to call them during a scenario.

### Fix Location
Controller's monster group UI, likely `app/controller/components/MonsterGroup.tsx` or wherever monster standees render. Check existing monster overlay components (`app/controller/overlays/`) for a pattern to follow.

### Expected UI
On each monster group card in the controller ScenarioView:
- **"+ Normal" button** — adds a new normal standee (next available standee number)
- **"+ Elite" button** — adds a new elite standee (next available standee number)
- **Standee management overlay** (alternative, cleaner design) — tapping monster group opens an overlay with all standees, each with "Kill," "Change to Elite/Normal," and "+" buttons

### Standee Numbering Logic
Per GH rules:
- Standees are numbered 1 to `monster.count` (from monster JSON data)
- Elites and normals share the same numbering pool per monster type
- When a standee dies, its number becomes available again
- When adding, pick the lowest available number

### Verification
- [ ] Controller has "+ Normal" and "+ Elite" buttons accessible on each monster group
- [ ] Adding a normal creates a new standee at the next available number with normal stats
- [ ] Adding an elite creates a new standee at the next available number with elite stats
- [ ] Display updates to show the new standee
- [ ] If monster count is reached (6/6 for most monsters), buttons disable or show max reached indicator
- [ ] New standees get `health = maxHealth` for their type
- [ ] Dead standees' numbers are available for reuse

---

## Issue 5: Dead Standee Skulls Persist Across Rounds

### Problem
When a monster standee dies, the controller shows a skull icon indicating the kill. Per standard GH flow, the dead standee should clear at **end of round** (not immediately — the GM needs to see who died for loot token placement), but currently the skulls persist indefinitely across multiple rounds.

### Expected Behavior
Per GAME_RULES_REFERENCE.md Section 7:
- Monster dies during turn → standee shows as dead with skull
- End of round processing → dead standees are fully removed from `monster.entities[]`
- New round starts → only living standees present

### Fix Location
End-of-round processing in `packages/shared/src/engine/applyCommand.ts`. Find where the round advances (likely in `advancePhase` when transitioning from 'next' back to 'draw' for a new round) and add standee cleanup:

```typescript
// End of round cleanup
for (const monster of state.monsters) {
  monster.entities = monster.entities.filter(entity => !entity.dead);
}
```

### Edge Cases
- **Don't clear during the round** — dead standees during the round are still useful for tracking "X was killed by Y" and loot token placement
- **Only clear at end of round** — specifically during the 'next' → 'draw' phase transition
- **Handle the case where all standees are dead** — the monster group may need to be auto-removed from `state.figures` and `state.monsters` (or kept if the scenario might spawn more of that type later). Audit the current behavior — if the empty monster group causes display issues, remove it from `state.monsters` at end of round.

### Verification
- [ ] Kill a monster standee during a round → skull persists through the current round
- [ ] End of round (advance phase to next draw) → dead standee removed from display
- [ ] New round starts with only living standees
- [ ] If all monsters of a type are dead at end of round → group is removed cleanly (no empty monster card lingering)
- [ ] Standee number becomes reusable for future adds

---

## Implementation Order

1. **Issue 1 (round 0 → 1):** Smallest fix, verify first
2. **Issue 5 (dead standee cleanup):** Small fix, end-of-round processing
3. **Issue 4 (controller add standees):** UI work, independent of engine
4. **Issue 2 (room reveal ability cards):** Medium engine work
5. **Issue 3 (monster special actions):** Largest scope, save for last

---

## Files Likely to Change

```
packages/shared/src/engine/applyCommand.ts    # Issues 1, 2, 3, 5
packages/shared/src/engine/turnOrder.ts       # Issue 2 (initiative insertion)
packages/shared/src/types/gameState.ts        # Verify types, no changes expected
app/controller/components/MonsterGroup.tsx    # Issue 4 (or wherever monster UI lives)
app/controller/overlays/[MonsterOverlay].tsx  # Issue 4 (alternative approach)
```

---

## Verification Scenarios

Run a full playtest loop on iPad + display + one phone:

1. **Setup test scenario** with 2 characters, 2 monster groups (one of which has a card with infuse in the deck)
2. **Start scenario** → verify "Round 1" on all devices
3. **Complete round** → verify "Round 2"
4. **Kill a monster standee** → skull visible
5. **End round** → skull gone, monster.entities updated
6. **Add a new standee via controller** → appears with correct stats
7. **Reveal a door** → new monster group has ability card drawn, initiative set
8. **Monster with infuse ability activates** → element goes strong
9. **Monster with consume activates** → element goes inert
10. **Monster with summon activates** → new entity in group

---

## Docs to Update

- `docs/BUGFIX_LOG.md` — append entries for all 5 issues
- `docs/DESIGN_DECISIONS.md` — append if any new architectural decisions (e.g., where monster action processing lives)
- `docs/GAME_RULES_REFERENCE.md` — verify round start and spawning rules are clearly documented (should already be — just confirm)
- `docs/COMMAND_PROTOCOL.md` — note that `revealRoom` now triggers automatic `drawMonsterAbility` for new groups, and `addEntity`/`removeEntity` are now exposed in controller UI

**Commit message:** `fix: round start at 1, room reveal draws ability, monster actions, standee management`
