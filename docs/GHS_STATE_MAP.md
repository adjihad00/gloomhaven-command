# GHS State Map — Field Reference

Compiled from GHS SQLite dump, TypeScript source, and data JSONs.

## GameState Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| revision | number | Server sync revision counter |
| revisionOffset | number | Offset for revision numbering |
| edition | string? | Active edition (e.g. "fh", "gh", "jotl") |
| conditions | ConditionName[] | Edition-level active conditions |
| battleGoalEditions | string[] | Editions with battle goals enabled |
| filteredBattleGoals | Identifier[] | Excluded battle goals |
| figures | string[] | Ordered figure refs ("edition-name") |
| entitiesCounter | EntityCounter[] | Kill/summon counters |
| characters | Character[] | Active character states |
| monsters | Monster[] | Active monster groups |
| objectiveContainers | ObjectiveContainer[] | Scenario objectives |
| state | "draw" \| "next" | Game phase (draw=card selection, next=playing) |
| scenario | ScenarioModel? | Current scenario info |
| sections | ScenarioModel[] | Revealed scenario sections |
| scenarioRules | ScenarioRuleId[] | Active scenario rules |
| appliedScenarioRules | ScenarioRuleId[] | Already-applied rules |
| discardedScenarioRules | ScenarioRuleId[] | Dismissed rules |
| level | number | Scenario level |
| levelCalculation | boolean | Auto-calculate level |
| levelAdjustment | number | Manual level offset |
| bonusAdjustment | number | Difficulty bonus offset |
| ge5Player | boolean | 5+ player variant |
| playerCount | number | Override player count (-1=auto) |
| round | number | Current round number |
| roundResets / roundResetsHidden | number[] | Rounds where resets occurred |
| playSeconds / totalSeconds | number | Session and total timers |
| monsterAttackModifierDeck | AttackModifierDeck | Monster AMD |
| allyAttackModifierDeck | AttackModifierDeck | Ally AMD |
| elementBoard | ElementModel[] | 6 elements with state |
| solo | boolean | Solo mode flag |
| party | Party | Active party/campaign state |
| parties | Party[] | All parties in save |
| lootDeck | LootDeck | Current loot deck |
| lootDeckEnhancements | Loot[] | Loot card enhancements |
| lootDeckFixed / lootDeckSections | LootType[] / string[] | Fixed loot config |
| unlockedCharacters | string[] | "edition:name" format |
| server | boolean | Server-synced flag |
| finish | ScenarioFinish? | Scenario completion state |
| gameClock | GameClockTimestamp[] | Clock in/out timestamps |
| challengeDeck | ChallengeDeck | FH challenge deck |
| favors / favorPoints | Identifier[] / number[] | Favor tracking |
| keepFavors | boolean | Retain favors between scenarios |

## Enums

| Enum | Values |
|------|--------|
| GameState | draw, next |
| ConditionName | stun, immobilize, disarm, wound, muddle, poison, strengthen, invisible, curse, bless, regenerate, ward, bane, brittle, impair, chill, infect, rupture, dodge, empower, enfeeble, poison_x, wound_x, heal, shield, retaliate, safeguard, plague, invalid |
| Element | fire, ice, air, earth, light, dark, wild |
| ElementState | strong, waning, inert, new, consumed, partlyConsumed, always |
| SummonState | new, true, false |
| SummonColor | blue, green, yellow, orange, white, purple, pink, red, custom, fh |
| MonsterType | normal, elite, boss, bb |
| AttackModifierType | plus, plus0-4, plusX, minus, minus1, minus2, null, double, bless, curse, minus1extra, empower, enfeeble, invalid, townguard, wreck, success, imbue, advancedImbue |
| LootType | money, lumber, metal, hide, arrowvine, axenut, corpsecap, flamefruit, rockroot, snowthistle, random_item, special1, special2 |

## Character (nested)

| Field | Type | Notes |
|-------|------|-------|
| name, edition | string | Identity |
| marker, title | bool, string | Display customization |
| initiative | number | 0 = not set |
| experience, loot | number | In-scenario counters |
| lootCards | number[] | Drawn loot card indices |
| treasures | string[] | Collected treasures |
| exhausted, absent, longRest | boolean | Status flags |
| level, health, maxHealth | number | Stats |
| entityConditions | EntityCondition[] | Active conditions |
| immunities | ConditionName[] | Condition immunities |
| summons | Summon[] | Active summons |
| identity, number, token, tokenValues | number | Character slot/tokens |
| progress | CharacterProgress | Campaign progress (XP, gold, items, perks, etc.) |
| scenarioStats | ScenarioStats | Per-scenario performance tracking |
| attackModifierDeck | AttackModifierDeckModel | Character's AMD |
| battleGoals | Identifier[] | Assigned battle goals |
| shield, retaliate, retaliatePersistent | string/string[] | Serialized Action JSON |

## Monster (nested)

| Field | Type | Notes |
|-------|------|-------|
| name, edition | string | Identity |
| level | number | Monster level |
| off, active, drawExtra | boolean | State flags |
| ability | number | Current ability card index |
| abilities | number[] | Available ability indices |
| entities | MonsterEntity[] | Individual monster standees |
| isAlly, isAllied | boolean | Ally status |
| tags | string[] | Custom tags |

## MonsterEntity

number, marker, type(normal/elite/boss), dead, summon(SummonState), active, off, revealed, dormant, health, maxHealth, entityConditions, immunities, markers, tags, shield, retaliate

## EntityCondition

name(ConditionName), value(number), state(new/normal/expire/roundExpire/removed/turn), lastState, permanent, expired, highlight

## AttackModifierDeck (serialized model)

current(number), cards(string[] of IDs), discarded(number[]), active(bool), lastVisible(number), state(advantage/disadvantage/undefined), bb(bool), lastDrawn(string? — tracks drawn card ID for UI display; needed because bless/curse are spliced from cards array on draw)

## Party (Frosthaven fields)

weeks, weekSections, loot(resource counts), inspiration, defense, soldiers, morale, townGuardPerks, campaignStickers, townGuardDeck, buildings, pets, trials, garden, factionReputation, imbuement

## Fields NOT in COMMAND_PROTOCOL.md

- objectiveContainers, scenarioRules, entitiesCounter, challengeDeck, favors, favorPoints
- Monster: drawExtra, lastDraw, isAlly, isAllied, abilities array
- Character: absent, longRest, token, tokenValues, battleGoals, identity, scenarioStats
- Full Party/campaign state (buildings, weeks, events, town guard deck, pets, trials)
- GameClock timestamps, finish state, eventDraw
