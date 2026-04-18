# Gloomhaven Command — Command Protocol Specification

## Transport
WebSocket over same-origin HTTP. Server listens on a single port.
All messages are JSON strings.

## Message Envelope
Every message has a `type` field. Direction noted as C→S or S→C.

## Connection Flow

### C→S: connect
```json
{ "type": "connect", "gameCode": "myGame", "sessionToken": null }
```
First connect: sessionToken is null. Reconnect: send previous token.

### S→C: connected
```json
{
  "type": "connected",
  "sessionToken": "uuid-v4",
  "revision": 42,
  "state": { /* full GameState */ }
}
```

### S→C: reconnected
```json
{
  "type": "reconnected",
  "sessionToken": "uuid-v4",
  "revision": 47,
  "diffs": [ /* array of missed diffs since client's last revision */ ]
}
```
If client is too far behind (>100 revisions), server sends full state instead.

## Commands (C→S)
```json
{
  "type": "command",
  "action": "changeHealth",
  "payload": { "target": { "type": "character", "name": "brute" }, "delta": -2 }
}
```

### Command Actions (49 total)
| Action                  | Payload                                                          |
|-------------------------|------------------------------------------------------------------|
| changeHealth            | { target: CommandTarget, delta: number }                         |
| changeMaxHealth         | { target: CommandTarget, delta: number }                         |
| toggleCondition         | { target: CommandTarget, condition: ConditionName, value? }      |
| setInitiative           | { characterName, edition, value }                                |
| advancePhase            | { }                                                              |
| toggleTurn              | { figure: FigureIdentifier }                                     |
| addEntity               | { monsterName, edition, entityNumber, type: MonsterType }        |
| removeEntity            | { monsterName, edition, entityNumber, type: MonsterType }        |
| moveElement             | { element: ElementType, newState: ElementState }                 |
| drawLootCard            | { }                                                              |
| assignLoot              | { cardIndex, characterName, edition }                            |
| drawMonsterAbility      | { monsterName, edition }                                         |
| shuffleMonsterAbilities | { monsterName, edition }                                         |
| shuffleModifierDeck     | { deck: 'monster' \| 'ally' \| { character, edition } }         |
| drawModifierCard        | { deck: 'monster' \| 'ally' \| { character, edition } }         |
| addModifierCard         | { deck: …, cardType: 'bless' \| 'curse' }                        |
| removeModifierCard      | { deck: …, cardType: 'bless' \| 'curse' }                        |
| revealRoom              | { roomId }                                                       |
| undoAction              | { }                                                              |
| setScenario             | { scenarioIndex, edition, group? }                               |
| addCharacter            | { name, edition, level, player? }                                |
| removeCharacter         | { name, edition }                                                |
| setLevel                | { level }                                                        |
| setExperience           | { characterName, edition, value }                                |
| setLoot                 | { characterName, edition, value }                                |
| addSummon               | { characterName, edition, summonName, cardId, number, color }    |
| removeSummon            | { characterName, edition, summonUuid }                           |
| addMonsterGroup         | { name, edition }                                                |
| removeMonsterGroup      | { name, edition }                                                |
| setMonsterLevel         | { name, edition, level }                                         |
| toggleExhausted         | { characterName, edition }                                       |
| toggleAbsent            | { characterName, edition }                                       |
| toggleLongRest          | { characterName, edition }                                       |
| renameCharacter         | { characterName, edition, title }                                |
| setLevelAdjustment      | { adjustment }                                                   |
| setRound                | { round }                                                        |
| importGhsState          | { ghsJson: string }                                              |
| updateCampaign          | { field, value }                                                 |
| prepareScenarioEnd      | { outcome: 'victory' \| 'defeat' } — builds state.finishData     |
| cancelScenarioEnd       | { } — clears finish + finishData                                 |
| completeScenario        | { outcome: 'victory' \| 'defeat' } — applies finishData atomically |
| startScenario           | { scenarioIndex, edition, group? } — also clears finishData      |
| prepareScenarioSetup    | { scenarioIndex, edition, group?, chores }                       |
| confirmChore            | { characterName, edition }                                       |
| proceedToRules          | { }                                                              |
| proceedToBattleGoals    | { }                                                              |
| cancelScenarioSetup     | { }                                                              |
| completeTownPhase       | { } — clears finishData, mode → 'lobby'                          |
| dealBattleGoals         | { edition, count }                                               |
| returnBattleGoals       | { cardIds: string[] }                                            |
| setBattleGoalComplete   | { characterName, edition, checks: 0..3 } *(T1, phone-allowed)*   |
| claimTreasure           | { characterName, edition, treasureId } *(T1, phone-allowed)*     |
| dismissRewards          | { characterName, edition } *(T1, phone-allowed)*                 |
| setCharacterProgress    | { characterName, edition, field, value } *(T0a, phone-allowed)*  |
| addPartyAchievement     | { achievement: string } *(T0b, GM-only)*                         |
| removePartyAchievement  | { achievement: string } *(T0b, GM-only)*                         |
| addGlobalAchievement    | { achievement: string } *(T0c, GM-only)*                         |
| removeGlobalAchievement | { achievement: string } *(T0c, GM-only)*                         |
| abortScenario           | { } *(T0b, GM-only; mode must be 'scenario')*                    |

### Side Effects

- **revealRoom**: During play phase (`state.state === 'next'`), automatically draws
  ability cards for newly spawned monster groups and re-sorts figures by initiative.
  Shared ability decks already drawn this round are copied, not re-drawn.
- **toggleTurn (monster)**: On activation, processes consume + summon actions from
  the drawn ability card. On deactivation, processes infuse actions.
- **addEntity / removeEntity**: Now exposed in the controller UI. `addEntity` resolves
  `maxHealth` from data context if not provided. `removeEntity` filters by entity number
  and type.
- **advancePhase (next→draw)**: Removes dead monster entities and prunes empty groups
  before calling `endRound()`.
- **setCharacterProgress** *(T0a)*: Character-scoped, phone-allowed. Writes a
  whitelisted field on `character.progress`. Current whitelist: `sheetIntroSeen`
  (boolean, one-time Player Sheet intro flag) and `notes` (string, per-character
  journal — T0d surface). `validateCommand` rejects unknown fields and enforces
  the expected value type. Does NOT use `updateCampaign` because that handler is
  `state.party.*`-scoped only.
- **addPartyAchievement / removePartyAchievement** *(T0b)*: GM-only (NOT on
  the phone whitelist). Structured array mutations for
  `state.party.achievementsList`. `updateCampaign` is a scalar setter and
  can't cleanly mutate arrays (it would replace the whole array, losing
  ordering/dedup on undo). `addPartyAchievement` deduplicates and trims
  whitespace; `removePartyAchievement` is rejected server-side if the
  achievement isn't currently in the list.
- **addGlobalAchievement / removeGlobalAchievement** *(T0c)*: GM-only (NOT on
  the phone whitelist). Parallel to the party-achievement pattern; targets
  `state.party.globalAchievementsList`. Same dedupe / trim / reject-if-absent
  semantics. Consumed by the Campaign Sheet's Achievements tab.
- **abortScenario** *(T0b)*: GM-only. Aborts the current scenario without
  applying rewards. Clears `state.monsters`, `state.objectiveContainers`,
  non-character `state.figures`, per-character combat state (HP restored
  to max; conditions, summons, in-scenario experience / loot / lootCards
  / treasures discarded), `state.elementBoard` → inert, `state.round = 0`,
  `state.state = 'draw'`, and `state.finish` / `state.finishData` (in
  case a pending scenario-end was in flight). Does **NOT** transfer XP /
  gold / resources to `char.progress` and does **NOT** append to
  `state.party.scenarios`. Transitions `state.mode = 'lobby'` directly
  (skips town phase). Validator rejects when `state.mode !== 'scenario'`.
  Reachable from the controller's scenario-controls overlay (click the
  scenario name in the scenario header) with a two-step inline confirm.

## Diffs (S→C broadcast)
```json
{
  "type": "diff",
  "revision": 43,
  "changes": [
    { "path": "characters.0.health", "value": 8 },
    { "path": "characters.0.entityConditions", "value": [...] }
  ],
  "action": "changeHealth"
}
```
Clients apply changes to their local state copy via JSON path.

## Heartbeat
- Server sends WebSocket ping frame every 15 seconds
- Client responds with pong (handled automatically by browser WebSocket)
- Server marks client stale after 20s with no pong
- Stale clients are disconnected, triggering client-side reconnect

## Client Registration (Phone)
```json
{
  "type": "register",
  "role": "phone",
  "characterName": "brute"
}
```
Server stores `role` and `characterName` on the session for permission enforcement.

### Phone Permission Enforcement
Phone clients (`role: "phone"`) are restricted to these commands:
- `setInitiative`, `toggleLongRest`, `changeHealth`, `toggleCondition`
- `setExperience`, `setLoot`, `toggleExhausted`, `toggleAbsent`
- `addSummon`, `removeSummon`, `toggleTurn`, `renameCharacter`
- `confirmChore`
- `setBattleGoalComplete`, `claimTreasure`, `dismissRewards` *(Phase T1)*
- `setCharacterProgress` *(Phase T0a)*
- Global (no character target): `moveElement`, `drawLootCard`, `dealBattleGoals`, `returnBattleGoals`

Each character-scoped command's target must match the registered `characterName`.
For `changeHealth`/`toggleCondition`: summon targets are allowed if the summon
owner (`target.characterName`) matches. Monster/objective targets are blocked.
For `toggleTurn`: only `figure.type === 'character'` with matching name.
`PHONE_GLOBAL_ACTIONS` commands skip the character-name check entirely.
All other commands (advancePhase, revealRoom, completeScenario, etc.) are blocked.
Rejected commands receive an error response; the client is NOT disconnected.

Controller and display clients have no command restrictions.

## Error Response (S→C)
```json
{ "type": "error", "message": "Invalid command: health cannot go below 0" }
```
