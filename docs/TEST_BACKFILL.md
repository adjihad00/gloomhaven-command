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

## How to backfill once a framework lands

1. Pick framework (vitest preferred; aligns with esbuild + Node-native ESM).
2. Wire `npm test` script at repo root + per-workspace.
3. Create `packages/shared/src/data/__tests__/` (or `*.test.ts` siblings).
4. Port assertions verbatim. Each should be a single-line `expect`.
5. Delete this file once entries are covered.
