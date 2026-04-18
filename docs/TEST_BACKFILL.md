# Test Backfill

Pure helpers shipped without unit tests because the repo has no test
framework today. When a framework lands (vitest is the likely choice
given the esbuild + tsc tooling already in place), backfill tests for
every entry below.

Each entry: file · exported names · behaviour to assert.

---

## `packages/shared/src/data/reputationPrice.ts`

**Exports:** `getReputationPriceModifier(reputation: number): number`

**Assertions:**
- `getReputationPriceModifier(0) === 0`
- `getReputationPriceModifier(20) === -5` (max discount)
- `getReputationPriceModifier(-20) === 5` (max surcharge)
- Bracket boundaries (per rules §16):
  - `getReputationPriceModifier(3) === -1` (lower edge of -1 bracket)
  - `getReputationPriceModifier(2) === 0` (top of 0 bracket)
  - `getReputationPriceModifier(-2) === 0` (bottom of 0 bracket)
  - `getReputationPriceModifier(-3) === 1`
- Returns integer in [-5, +5] for any input.

Origin: Phase T0b (Party Sheet — Standing tab live chip).

---

## `packages/shared/src/data/prosperityLevel.ts`

**Exports:** `getProsperityLevel`, `getProsperityProgress`,
`PROSPERITY_THRESHOLDS_GH`, `PROSPERITY_THRESHOLDS_FH`.

**Assertions for `getProsperityLevel`:**
- `getProsperityLevel(0, 'gh') === 1` (starting level)
- `getProsperityLevel(2, 'gh') === 1` (just below first threshold)
- `getProsperityLevel(3, 'gh') === 2` (exactly on threshold)
- `getProsperityLevel(59, 'gh') === 9` (max threshold)
- `getProsperityLevel(100, 'gh') === 9` (clamps at max)
- `getProsperityLevel(5, 'fh') === 2` (FH threshold differs)
- `getProsperityLevel(96, 'fh') === 9`
- `getProsperityLevel(0, 'unknown_edition') === 1` (defaults to GH thresholds)

**Assertions for `getProsperityProgress`:**
- At `(0, 'gh')`: `{ level: 1, currentFloor: 0, nextThreshold: 3 }`
- At `(8, 'gh')`: `{ level: 3, currentFloor: 8, nextThreshold: 14 }`
- At `(59, 'gh')`: `{ level: 9, currentFloor: 59, nextThreshold: null }`
  (max level → no next threshold)
- At `(96, 'fh')`: `{ level: 9, currentFloor: 96, nextThreshold: null }`

Origin: Phase T0c (Campaign Sheet — Prosperity tab).

---

## `packages/shared/src/engine/historyLog.ts`

**Exports:** `logHistoryEvent(char, entryWithoutMeta)` (engine-only; NOT barrel-exported).

**Assertions:**
- First call on a character with no `progress.history` creates the array
  and appends an entry with `id === 1` and `sequence === 0`.
- Second call increments `id` to `2` and `sequence` to `1` (monotonic
  within the character's history).
- After an arbitrary sequence of pushes, `id` values remain strictly
  increasing (based on `max(existing.id) + 1`, not `length + 1` — so a
  removed-then-re-added entry doesn't collide).
- `backfilled`, `kind`, and variant-specific payload fields are preserved
  verbatim on the appended entry.
- `sequence` equals `history.length` at time of push, so entries pushed
  in the same operation have distinct monotonic sequence markers.
- Does nothing (no throw) if `char.progress` is missing.

**Engine integration assertions** (via `applyCommand`):
- `completeScenario` victory appends exactly one `scenarioCompleted`
  entry per non-absent character with snapshot fields populated
  (`xpGained`, `goldGained`, `resourcesGained`, `battleGoalChecks`).
- `completeScenario` defeat appends `scenarioFailed` entries; the
  result object has **no** `battleGoalChecks` field (rules §11).
- Absent characters (`char.absent === true`) receive no entry.
- `backfillCharacterHistory` is idempotent: calling twice produces
  the same `history` array (no duplicate backfilled entries).
- Undo across a `completeScenario` removes the appended entries; redo
  re-appends them (both via the normal state snapshot + replay).

Origin: Phase T0d (Player Sheet — Notes + History tabs).

---

## How to backfill once a framework lands

1. Pick framework (vitest preferred; aligns with esbuild + Node-native ESM).
2. Wire `npm test` script at repo root + per-workspace.
3. Create `packages/shared/src/data/__tests__/` (or `*.test.ts` siblings).
4. Port assertions verbatim. Each should be a single-line `expect`.
5. Delete this file once entries are covered.
