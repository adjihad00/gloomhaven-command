# Gloomhaven Command — Bug Fix Log

Append-only. Each entry: date, symptom, root cause, fix. Never delete entries.

---

## 2026-03-26 — Batch 1: Condition Engine & Combat Fixes

### B1: Conditions never expire
**Symptom:** Strengthen, Stun, etc. persist indefinitely once applied.
**Root cause:** `processConditionEndOfTurn()` only transitioned `turn` → `normal` and counted wound damage. It never transitioned `normal` → `expire` for expire-type conditions. Also, `EXPIRE_CONDITIONS` array was incomplete (missing bane, brittle, infect, regenerate, ward, dodge, empower, enfeeble, safeguard).
**Fix:** Expanded `EXPIRE_CONDITIONS` to include all end-of-next-turn conditions. Rewrote `processConditionEndOfTurn()` to filter expired conditions and transition `normal` → `expire` for conditions in the expire list. Lifecycle: new → (end of round) → normal → (end of next turn) → expire → removed.

### B2: Regenerate + Wound interaction broken
**Symptom:** Both regenerate and wound fire independently — wound deals 1 damage, regenerate heals 1, net zero. But wound is never cleared.
**Root cause:** `applyTurnStartConditions()` processed wound first, then regenerate. Per rules, any heal (including regenerate) should clear wound and poison INSTEAD of healing HP.
**Fix:** Reordered: regenerate processes first. If wound or poison is present, the heal is consumed (removes wound/poison, no HP gained). Wound damage only fires if wound is still present after regenerate.

### B3: Bane (FH) doesn't fire
**Symptom:** Bane condition has no mechanical effect — no damage dealt.
**Root cause:** No bane damage processing existed anywhere in the codebase.
**Fix:** `processConditionEndOfTurn()` now returns `baneDamage` (10 when bane transitions `normal` → `expire`). The `toggleTurn` handler applies bane damage to the entity, with auto-kill for monsters at 0 HP.

### B4: Poison has no mechanical effect
**Symptom:** Poison is just a visual icon — no +1 damage modifier.
**Root cause:** `handleChangeHealth()` applied deltas directly without checking for poison. Wound damage at turn start also ignored poison.
**Fix:** `handleChangeHealth()` now adds -1 to negative deltas when entity has active poison. `applyTurnStartConditions()` adds +1 to wound damage when poison is present. `handleChangeHealth()` also clears wound/poison on positive deltas (heal clears conditions instead of healing).

### B5: Dead standees at 0 HP remain visible
**Symptom:** Monster standees reduced to 0 HP still appear on screen.
**Root cause:** Primarily a UI issue (deferred to Batch 2). Engine already marks entities dead at 0 HP in `handleChangeHealth` and `activateFigure`.
**Fix:** Engine-side: dead monster groups are now filtered from `getInitiativeOrder()`, preventing them from appearing in turn order or being auto-advanced to.

### B6: Dead monster groups still appear in turn order
**Symptom:** When all standees in a group are dead, the group still draws ability cards and is sorted into initiative order.
**Root cause:** `getInitiativeOrder()` included all figures from `state.figures[]` without checking if monster groups had living entities.
**Fix:** Added all-dead filter to `getInitiativeOrder()`. `drawMonsterAbilities()` already had this filter (line 411). Also fixed `applyTurnStartToActiveFigure()` to apply turn-start conditions when `startRound()` activates the first figure (previously only set `active=true` without processing conditions).

### Additional fix: Turn-start conditions on round start
**Symptom:** Wound/regenerate didn't fire on the first figure activated at the start of a round.
**Root cause:** `startRound()` in turnOrder.ts only set `figure.active = true` — it didn't call `applyTurnStartConditions()` which lives in applyCommand.ts.
**Fix:** `handleAdvancePhase()` now calls `applyTurnStartToActiveFigure()` after `startRound()` returns, ensuring the first activated figure gets wound/regenerate processing.

---

## 2026-04-13 — Batch 12: Game Logic & Combat Fixes

### B12.1: Long rest doesn't heal 2 HP
**Symptom:** Characters declaring long rest (initiative 99) activate but never receive the "Heal 2, self" that the rules mandate.
**Root cause:** `activateFigure()` in applyCommand.ts calls `applyTurnStartConditions()` for characters but never checks the `longRest` flag. The long rest heal was simply never implemented.
**Fix:** Added long rest processing inside the `if (type === 'character')` block, before `applyTurnStartConditions()`. When `c.longRest` is true: checks for heal-blocking conditions (wound, poison, bane, brittle); if present, removes them (heal consumed); otherwise heals 2 HP. Clears `c.longRest = false` after processing so it doesn't repeat next round. Per rules §3, long rest heal fires before wound/regenerate turn-start processing.

### B12.2: Bless/curse cards not removed after drawing
**Symptom:** Drawing a bless or curse from the attack modifier deck leaves it in the deck. It reappears after shuffle and persists indefinitely.
**Root cause:** `handleDrawModifierCard()` always advanced `deck.current` and pushed to `deck.discarded` — same logic for all cards. Bless/curse cards were never spliced out.
**Fix:** After drawing, check if the card is `'bless'` or `'curse'`. If so, `splice()` it from `deck.cards` (returned to supply per rules §5) and leave `deck.current` unchanged (next card shifts into position). Normal cards advance `deck.current` as before. Added `lastDrawn?: string` field to `AttackModifierDeckModel` to track the drawn card ID for UI display — necessary because after splicing a bless/curse, `deck.cards[deck.current - 1]` would point to the wrong card. Updated `ModifierDeck.tsx` to read `deck.lastDrawn` instead of indexing into the cards array.

### B12.3: Monsters remain on board after scenario complete
**Symptom:** Clicking "Scenario Complete (Victory)" transfers XP and gold but all monster groups remain visible. Character state (HP, conditions, initiative) is not reset.
**Root cause:** `handleCompleteScenario()` only handled XP/gold transfer and party scenario tracking. No cleanup of scenario-specific state.
**Fix:** Added cleanup before `state.finish` assignment: clear `state.monsters` and `state.objectiveContainers`, filter `state.figures` to characters only, reset all character combat state (HP to max, initiative to 0, clear conditions/summons, deactivate), reset round to 0 and phase to `'draw'`, set all elements to `'inert'`.

### B12.4: Gold not tracked for GH scenarios
**Symptom:** GH scenarios always show 0 gold earned on scenario completion, even when characters looted coins during play.
**Root cause:** `handleCompleteScenario()` derived gold exclusively from `char.lootCards` + `state.lootDeck.cards` (the FH loot card system). GH scenarios have no loot deck — `state.lootDeck.cards` is empty, so `char.lootCards` is always empty. The simple `char.loot` coin counter (incremented by the gold icon tap) was never consulted.
**Fix:** Added conditional: if `char.lootCards` has entries AND `state.lootDeck` has cards, use FH loot card system. Otherwise fall back to `char.loot` as a simple coin count. Both paths feed into the same `totalCoins * goldConversion` calculation.
