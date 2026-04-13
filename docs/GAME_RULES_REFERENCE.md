# Gloomhaven / Frosthaven Rules Reference

> Authoritative rules reference for Gloomhaven Command development.
> Source: Frosthaven Rulebook (2023 Cephalofair Games). GH rules are a subset
> unless noted. **Every feature must be verified against this document.**

---

## 1. Scenario Level & Derived Values

### Scenario Level Formula

```
Recommended Level = ceil(average_character_level / 2)
Solo Mode         = ceil((average_character_level + 1) / 2)
```

Can be manually set to any value 0-7. Only non-absent, non-exhausted characters
count toward the average.

### Level-Derived Values Table

| Level | Monster Lv | Trap Dmg | Gold/Coin | Hazard Dmg | Bonus XP |
|-------|-----------|----------|-----------|------------|----------|
| 0     | 0         | 2        | 2         | 1          | 4        |
| 1     | 1         | 3        | 2         | 2          | 6        |
| 2     | 2         | 4        | 3         | 2          | 8        |
| 3     | 3         | 5        | 3         | 2          | 10       |
| 4     | 4         | 6        | 4         | 3          | 12       |
| 5     | 5         | 7        | 4         | 3          | 14       |
| 6     | 6         | 8        | 5         | 3          | 16       |
| 7     | 7         | 9        | 6         | 4          | 18       |

**Formulas:**
- Trap damage = 2 + scenario_level
- Hazardous terrain = ceil(1 + scenario_level / 3)
- Bonus XP = 4 + (2 * scenario_level)
- Gold conversion: [2, 2, 3, 3, 4, 4, 5, 6] indexed by level

---

## 2. Round Structure

Each round follows this exact sequence:

1. **Start of Round** -- apply start-of-round effects (spawning, scenario rules)
2. **Card Selection** -- each character secretly selects 2 cards or declares long rest
3. **Ordering of Initiative** -- reveal cards, sort all figures by initiative (lowest first)
4. **Turns** -- each figure takes a turn in initiative order
5. **End of Round** -- see section below

### Card Selection Phase

- Select 2 ability cards from hand, played face down
- One card designated as **initiative card** (determines turn order)
- Alternative: declare **long rest** (requires 2+ cards in discard pile, initiative = 99)
- Players may discuss strategy generally but NOT share specific numbers or card names

### Initiative Ordering

- Sort all initiative values lowest (first) to highest (last)
- **Tie-breaking:**
  - Character vs character: compare second card's initiative; if still tied, party decides
  - Character vs monster: **character goes first**
  - All other ties: party decides
- **Within a monster set:** elites first (ascending standee number), then normals (ascending standee number)
- **Character summons:** act immediately BEFORE their summoner

### End of Round

Performed after all figures have taken turns:

1. Trigger end-of-round effects (scenario rules, items, character cards)
2. If any drawn attack modifier or monster ability card has shuffle icon, shuffle that discard back into deck
3. Round bonus cards in active area go to discard/lost pile
4. Characters with 2+ cards in discard may perform a **short rest**
5. **Elements wane:** Strong -> Waning, Waning -> Inert

---

## 3. Character Turns

- Perform **top action** of one card and **bottom action** of the other
- Cannot perform two top or two bottom actions
- Either action can be performed first
- Any card can be used for default **"Attack 2" (top)** or **"Move 2" (bottom)** instead of printed ability
- A character may skip an action entirely (card is discarded with no effect)

### Resting

**Short Rest** (end of round, requires 2+ cards in discard):
- Lose one RANDOM card from discard; return rest to hand
- May suffer 1 damage to lose a different random card instead (once per short rest)

**Long Rest** (declared during card selection, initiative 99):
1. Lose one card of CHOICE from discard; return rest to hand (mandatory)
2. Perform "Heal 2, self" (optional)
3. Recover all spent items (optional)

### Experience

- Gained from abilities with XP icon, NOT from killing monsters
- Tracked on blue XP dial during scenario
- Bonus XP added on scenario completion (see level table)
- XP thresholds: Lv1=0, Lv2=45, Lv3=95, Lv4=150, Lv5=210, Lv6=275, Lv7=345, Lv8=420, Lv9=500
- XP does NOT reset on level up

### Exhaustion

Caused by either:
- HP reaches 0
- Cannot play 2 cards from hand AND cannot rest (fewer than 2 in discard)

On exhaustion: all cards go to lost pile, figure removed from map. Character cannot
participate further but keeps all XP, gold, loot earned. If ALL characters exhausted,
scenario is lost.

### End-of-Turn Looting

Characters MUST loot any loot tokens or treasure tiles in their hex at the END of
their turn. Only characters loot this way (not monsters or summons).

---

## 4. Conditions

### Condition Duration Rules

- Cannot have multiple instances of the same condition
- Gaining a condition you already have: no effect (does NOT reset duration)
- Cannot be voluntarily removed
- Conditions removed "at end of next turn" are removed AFTER all other end-of-turn effects
- Condition from attack: applied even if attack dealt 0 damage, but NOT if attack killed target or target is immune

### Positive Conditions

| Condition | Effect | Removed When |
|-----------|--------|--------------|
| **Strengthen** | Advantage on all attacks | End of figure's next turn |
| **Invisible** | Cannot be focused/targeted by enemies | End of figure's next turn |
| **Regenerate** | "Heal 1, self" at START of each turn (even if stunned) | Figure suffers any damage |
| **Ward** | Next damage suffered is halved (round down) | After halving damage once |
| **Bless** | Shuffle 2x card into attack modifier deck | When card is drawn (returned to supply) |

### Negative Conditions

| Condition | Effect | Removed When |
|-----------|--------|--------------|
| **Wound** | Suffer 1 damage at START of each turn | Figure is healed |
| **Poison** | All attacks on this figure gain "+1 Attack" | Figure is healed (but heal gives no HP) |
| **Brittle** | Next damage suffered is doubled | After doubling damage once, or healed |
| **Bane** | Suffer 10 damage at END of next turn | End of next turn (auto), or healed |
| **Muddle** | Disadvantage on all attacks | End of figure's next turn |
| **Immobilize** | Cannot perform move abilities | End of figure's next turn |
| **Disarm** | Cannot perform attack abilities | End of figure's next turn |
| **Stun** | Cannot perform ANY abilities or use items | End of figure's next turn |
| **Impair** | Cannot use/trigger items (characters only) | End of character's next turn |
| **Curse** | Shuffle null card into attack modifier deck | When card is drawn (returned to supply) |

### Critical Condition Interactions

- **Regenerate + Wound:** Regenerate triggers first at start of turn, removing wound before wound deals damage
- **Ward + Brittle:** If figure has both, they negate each other and are BOTH removed (no damage modification)
- **Poison + Heal:** Heal removes poison but does NOT increase HP. A single heal removes any combination of wound, brittle, bane, and poison
- **Bane:** Deals exactly 10 damage, not modified by anything except ward/brittle

---

## 5. Attack Resolution

### Attack Modification Order (exact sequence)

1. Apply all attack bonuses/penalties (+X Attack effects, poison's +1)
2. Draw and apply attack modifier card
3. Apply target's shield bonus (reduces attack value, minimum 0)
4. Apply ward and brittle (if both present, they cancel and are both removed)
5. Target suffers resulting damage

### Attack Modifier Deck

**Standard deck (20 cards):**
- +0: x6
- +1: x5
- -1: x5
- +2: x1
- -2: x1
- Null (miss): x1
- 2x (crit): x1

Each character has their own deck. All monsters share one deck. Allies use a separate deck.

**Special cards:**
- **Bless:** 2x modifier, returned to supply when drawn (max 10 across all decks)
- **Curse:** Null modifier, returned to supply when drawn (10 with character icon, 10 with monster icon)
- **Rolling modifiers:** Draw additional cards until a non-rolling card is drawn; apply all

**Shuffle trigger:** If any drawn card has shuffle icon, shuffle discard back into deck at end of round. If deck is empty when a draw is needed, shuffle immediately.

### Advantage & Disadvantage

- **Advantage:** Draw 2 modifiers, use the better one (characters may choose either)
- **Disadvantage:** Draw 2, use the worse one
- **Both cancel:** If attack has both advantage and disadvantage, it has neither
- **Cannot stack:** Multiple sources of advantage/disadvantage don't multiply
- **Auto-disadvantage:** Any ranged attack targeting an adjacent enemy gains disadvantage
- **Rolling modifier handling:** Complex rules apply (see detailed section)

### Pierce

Reduces target's shield by X. Multiple pierce sources stack additively.

### Shield

Reduces incoming attack value. Applied after modifier card (step 3). Multiple shield
bonuses stack. Does NOT apply to non-attack damage. Self-only.

### Retaliate

Deals X damage to attacker after attack resolution, if attacker is within range.
NOT an attack (not reduced by shield). Does not trigger if retaliating figure was
killed by the attack. Multiple retaliate bonuses stack. Self-only.

---

## 6. Elements

Six elements: Fire, Ice, Air, Earth, Light, Dark. Three states: Inert, Waning, Strong.

### Element Cycle

- **Infuse:** Move element to Strong at END of figure's turn (mandatory if any part of the action was performed)
- **Consume:** Move element from Strong or Waning to Inert. Must already be Strong/Waning at start of turn
- **Wane:** At end of every round: Strong -> Waning, Waning -> Inert

### Key Rules

- Same element cannot be consumed multiple times in one turn
- Multi-element consumption: ALL depicted elements must be consumed together
- Cannot infuse and consume same element in same turn (infusion happens at end of turn)
- **Monsters:** Consumption at FIRST monster's turn (benefits all). Infusion at LAST monster's turn

---

## 7. Monster Turns

### Monster Focus

Focus = the enemy the monster can attack using the fewest movement points.

**Tie-breaking (in order):**
1. Path triggering fewest negative hexes (traps, hazardous terrain)
2. Fewest movement points required
3. Closest enemy by range
4. Enemy with earliest initiative

If no valid path exists to any attack hex (even with infinite movement), monster
does not move or attack but still performs other abilities.

If disarmed or no attack on ability card: focus as if single-target melee.

### Monster Movement

- Only moves if ability card lists a move ability
- Must end in a position with SHORTER path to attack hex than before
- Moves to hex from which it can attack focus (+ most additional targets if multi-target)
- Ranged monsters with adjacent focus: move AWAY first to avoid disadvantage
- Prefers paths through fewest negative hexes

### Monster Acting Order

Within a monster set's turn:
1. Elite monsters in ascending standee number
2. Normal monsters in ascending standee number
3. Each monster completes full turn before next acts

### Spawning & Revealing

- Revealed/spawned monsters ACT during the round they appear (unlike summons)
- If their initiative already passed, they act immediately after the current figure
- If standees run out, place as many as possible (elites first, by proximity to enemy)

### Monster Death

- Remove standee, clear tokens, place loot token in hex
- Loot token dropped even if monster was summoned/spawned (NOT if scenario ally)

---

## 8. Summons

- Placed in empty hexes adjacent to summoner (if no hex available, not summoned)
- Card goes to summoner's active area (persistent bonus)
- Act immediately BEFORE summoner, following automated monster rules (Move +0, Attack +0)
- Use summoner's attack modifier deck
- **Never act the round they are summoned**
- When summoner exhausted, all their summons removed
- Summoner may voluntarily remove summons at any time
- If summon has no focus, summoner may have it move toward them

---

## 9. Loot System (Frosthaven)

### Loot Deck Construction

Built per scenario's loot table from:
- **Money cards (20 total):** 1-3 coins each, converted to gold at scenario level rate
- **Material resources (8 per type):** Lumber, metal, hide
- **Herb resources (2 per type):** Arrowvine, axenut, corpsecap, flamefruit, rockroot, snowthistle
- **Random item (1 card):** Provides random item, gained immediately when looted

Specified number of each type randomly drawn, then all shuffled together.

### Looting

- When a character loots a token, draw one card from loot deck
- Money and resources NOT gained until end of scenario
- Random items gained immediately
- Monsters looting: token just removed (no card draw)
- Loot tokens/treasure remaining on map at scenario end CANNOT be looted

---

## 10. Scenario Setup Sequence

1. Select scenario (must be unlocked, requirements met)
2. Resolve road event (if applicable)
3. Place ALL map tiles for entire scenario
4. Retrieve monster materials (stat cards at scenario level, shuffle ability decks)
5. Retrieve all overlay tiles for entire scenario
6. Set up FIRST ROOM ONLY (monsters, overlay tiles, tokens)
7. Shuffle attack modifier decks
8. Read scenario goals, introduction, special rules
9. Deal 3 battle goals per character; each keeps 1
10. Build loot deck per scenario's loot table
11. Characters choose items and ability cards (hand size)
12. Set HP to max, XP to 0

### Monster Placement by Player Count

Each monster hex shows 3 bars:
- Top = 2 players
- Middle = 3 players
- Bottom = 4 players
- Black = no monster, White = normal, Yellow = elite

---

## 11. Ending a Scenario

### Lost

All characters exhausted, or loss condition from scenario rules met.

### Completed

Goal from scenario rules achieved. Play continues to end of current round.
If both lost AND completed in same round: scenario is **LOST**.

### Always (lost or completed)

- Recover all cards and items
- Reset HP, remove all conditions
- Remove bless/curse from modifier decks, shuffle
- Gain XP from dial. If completed: add bonus XP per scenario level
- Gain gold from loot cards (coins * gold conversion rate)
- Gain resources from loot cards (if completed, or if lost and returning to town)

### Battle Goals

- Completed only if scenario is **completed** AND goal criteria met
- Every 3 checkmarks = 1 perk mark (max 6 extra perk marks = 18 checkmarks)
- Lost scenario: no battle goal rewards regardless

---

## 12. Campaign & Leveling

### Level Up

- Required when XP >= next level threshold
- XP thresholds: 0, 45, 95, 150, 210, 275, 345, 420, 500
- On level up: +1 ability card, increased max HP, +1 perk mark
- May level up without XP if character level < ceil(prosperity / 2)

### Perks

Gained from: leveling up, checkmarks (3 per perk, max 18), retirement bonus, masteries.
Perks permanently modify attack modifier deck.

### Retirement

Mandatory when personal quest fulfilled. Party gains 2 prosperity, unlocks building.

### New Character

- Starting gold = 10 * prosperity + 20 (must spend immediately)
- Perk marks = number of previously retired characters by that player
- Starts level 1, may prosperity-level up

---

## 13. Overlay Tiles & Terrain

| Type | Effect |
|------|--------|
| **Trap** | Triggered on entry: suffer trap damage, then trap removed. Avoided by flying/jump |
| **Hazardous Terrain** | Suffer hazard damage on entry. NOT removed after triggering. Avoided by flying/jump |
| **Difficult Terrain** | Costs 2 movement points to enter. Ignored by flying/jump |
| **Icy Terrain** | Forced movement of 1 hex when entering (FH only) |
| **Obstacle** | Blocks movement and line of sight. Cannot end movement on |
| **Treasure** | Must be looted by character ending turn on it |
| **Door** | Closed doors block movement/LOS. Opening reveals new room |

---

## 14. Ability Reference

| Ability | Key Rules |
|---------|-----------|
| **Move X** | X movement points. 1 per hex. Cannot move through enemies/obstacles. Must end in unoccupied hex |
| **Jump** | Ignores enemies, obstacles, traps, hazardous terrain EXCEPT last hex. Ignores difficult/icy terrain completely |
| **Flying** | Ignores ALL obstacles, enemies, terrain INCLUDING last hex. Cannot end on occupied hex |
| **Teleport X** | NOT a move. Ignores everything including walls. Destination effects still trigger |
| **Attack X** | Base X damage. No range specified = melee (adjacent only). Draws modifier card |
| **Heal X** | Increase HP by X. Removes wound/brittle/bane/poison. If poisoned: removes poison but no HP gain |
| **Loot X** | Loot all tokens within range X. Characters draw from loot deck. Monsters just remove tokens |
| **Suffer Damage** | NOT an attack. Not modified by anything except ward/brittle |
| **Push X / Pull X** | Forced movement. Unaffected by difficult terrain. Works on immobilized/stunned figures |
| **Summon** | Place in empty adjacent hex. Acts before summoner. Uses summoner's modifier deck |

---

## 15. Quick Reference: Common Bug Sources

These are rules frequently implemented incorrectly:

1. **Regenerate removes wound BEFORE wound deals damage** (regenerate triggers first at start of turn)
2. **Poison prevents HP gain from heal but heal still removes poison** (and wound/brittle/bane)
3. **Ward + brittle cancel each other** (both removed, no damage modification)
4. **Bane deals exactly 10 damage at END of next turn**, modified only by ward/brittle
5. **Elements wane at end of round**, not end of turn
6. **Short rest loses a RANDOM card** (not player choice)
7. **Long rest initiative is always 99**
8. **Character vs monster initiative tie: character goes first**
9. **Monster death ALWAYS drops a loot token** (even summoned/spawned, NOT allies)
10. **Summons never act the round they are summoned**
11. **Conditions from attacks apply even if 0 damage dealt**, but NOT if target killed
12. **Attack modifier shuffle happens at END OF ROUND**, not immediately (unless deck empty)
13. **Ranged attack on adjacent target: automatic disadvantage**
14. **Scenario level trap damage = 2 + level** (not 1 + level)
15. **Hazardous terrain damage = ceil(1 + level/3)** (not same as traps)
16. **Gold conversion is per-coin on loot cards**, not flat gold per token
17. **Both lost AND completed in same round = LOST**
18. **Exhausted characters still gain XP/gold/loot** if scenario completed
19. **Monster focus uses infinite movement** to determine if a path exists
20. **Monsters prefer paths with fewest negative hexes** even if longer
