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
