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

### Command Actions (39 total)
| Action                 | Payload                                                          |
|------------------------|------------------------------------------------------------------|
| changeHealth           | { target: CommandTarget, delta: number }                         |
| changeMaxHealth        | { target: CommandTarget, delta: number }                         |
| toggleCondition        | { target: CommandTarget, condition: ConditionName, value? }      |
| setInitiative          | { characterName, edition, value }                                |
| advancePhase           | { }                                                              |
| toggleTurn             | { figure: FigureIdentifier }                                     |
| addEntity              | { monsterName, edition, entityNumber, type: MonsterType }        |
| removeEntity           | { monsterName, edition, entityNumber, type: MonsterType }        |
| moveElement            | { element: ElementType, newState: ElementState }                 |
| drawLootCard           | { }                                                              |
| assignLoot             | { cardIndex, characterName, edition }                            |
| drawMonsterAbility     | { monsterName, edition }                                         |
| shuffleMonsterAbilities| { monsterName, edition }                                         |
| shuffleModifierDeck    | { deck: 'monster' \| 'ally' \| { character, edition } }         |
| drawModifierCard       | { deck: 'monster' \| 'ally' \| { character, edition } }         |
| addModifierCard        | { deck: 'monster' \| 'ally' \| { character, edition }, cardType: 'bless' \| 'curse' } |
| removeModifierCard     | { deck: 'monster' \| 'ally' \| { character, edition }, cardType: 'bless' \| 'curse' } |
| revealRoom             | { roomId }                                                       |
| undoAction             | { }                                                              |
| setScenario            | { scenarioIndex, edition, group? }                               |
| addCharacter           | { name, edition, level, player? }                                |
| removeCharacter        | { name, edition }                                                |
| setLevel               | { level }                                                        |
| setExperience          | { characterName, edition, value }                                |
| setLoot                | { characterName, edition, value }                                |
| addSummon              | { characterName, edition, summonName, cardId, number, color }    |
| removeSummon           | { characterName, edition, summonUuid }                           |
| addMonsterGroup        | { name, edition }                                                |
| removeMonsterGroup     | { name, edition }                                                |
| setMonsterLevel        | { name, edition, level }                                         |
| toggleExhausted        | { characterName, edition }                                       |
| toggleAbsent           | { characterName, edition }                                       |
| toggleLongRest         | { characterName, edition }                                       |
| renameCharacter        | { characterName, edition, title }                                |
| setLevelAdjustment     | { adjustment }                                                   |
| setRound               | { round }                                                        |
| importGhsState         | { ghsJson: string }                                              |
| updateCampaign         | { field, value }                                                 |
| completeScenario       | { outcome: 'victory' \| 'defeat' }                               |

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
Server enforces: phone clients can only send commands targeting their character.
Controller and display clients have no role restriction.

## Error Response (S→C)
```json
{ "type": "error", "message": "Invalid command: health cannot go below 0" }
```
