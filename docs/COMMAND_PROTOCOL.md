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

### Command Actions
| Action              | Payload                                              |
|---------------------|------------------------------------------------------|
| changeHealth        | { target, delta }                                    |
| toggleCondition     | { target, condition }                                |
| setInitiative       | { characterName, value }                             |
| advancePhase        | { } (server determines next phase)                   |
| toggleTurn          | { figureName } (start/end turn)                      |
| addEntity           | { monsterName, entityData }                          |
| removeEntity        | { monsterName, entityNumber }                        |
| moveElement         | { element, newState }                                |
| drawLootCard        | { }                                                  |
| assignLoot          | { cardIndex, characterName }                         |
| drawMonsterAbility  | { monsterName }                                      |
| shuffleModifierDeck | { deck: "monster" | characterName }                  |
| revealRoom          | { roomId }                                           |
| undoAction          | { }                                                  |
| setScenario         | { scenarioNumber, edition }                          |
| addCharacter        | { name, edition, player? }                           |
| removeCharacter     | { name }                                             |

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
- Server marks client stale after 5s with no pong
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
