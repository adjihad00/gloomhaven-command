# Phase T1 — Scenario End Rewards + Post-Scenario Flow (Claude Code Prompt)

## Context

You are working in the `gloomhaven-command` repo. Baseline commit is `ce0936e`.
Before doing anything, read these docs in order:

1. `CLAUDE.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/APP_MODE_ARCHITECTURE.md` (has the Phase T design notes)
4. `docs/DESIGN_DECISIONS.md`
5. `docs/COMMAND_PROTOCOL.md`
6. `docs/GAME_RULES_REFERENCE.md` — sections 11 ("Ending a Scenario") and 12
   ("Campaign & Leveling"). **Reward logic must match these rules.**
7. `docs/ROADMAP.md`
8. `docs/GHS_AUDIT.md`
9. `app/CONVENTIONS.md`

Also read these design skills (read every `.md` file under each):

- `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
- `C:\Users\Kyle Diaz\.agents\skills\`

Priority when skills conflict: `app/CONVENTIONS.md` > UI/UX Pro Max > agent skills.

Run `git pull` before starting.

---

## What Already Exists (Do Not Recreate)

This is important because the original handoff doc glossed over these:

- **`app/phone/overlays/PhoneRewardsOverlay.tsx`** (210 lines) already exists and
  already handles pending/claimed states and live-derived rewards for a single
  character. It is mounted from `app/phone/ScenarioView.tsx` line 189.
- **`app/controller/overlays/ScenarioSummaryOverlay.tsx`** (121 lines) already
  exists. The controller triggers it from its `MenuOverlay` "Scenario End" button
  (see `app/controller/ScenarioView.tsx` lines 188–215). It fires
  `prepareScenarioEnd` on open and `completeScenario` on confirm.
- **`state.finish`** already transitions `undefined → 'pending:victory'/'pending:failure' → 'success'/'failure'`.
- **Engine: `handleCompleteScenario`** at `packages/shared/src/engine/applyCommand.ts:1831`
  already transfers XP, converts loot→gold, records scenario completion, resets
  combat state, and sets `state.mode = 'town'`. This remains the single source of truth.
- **`deriveLevelValues(level)`** in `packages/shared/src/data/levelCalculation.ts`
  returns `{ goldConversion, bonusXP, ... }`. **Reuse** this everywhere — do not
  re-derive coin/XP formulas in the UI.
- **`char.progress.battleGoals: number`** (cumulative checkmarks, per rules §12)
  and **`char.treasures: string[]`** (array of claimed treasure ids) already exist
  on the state.
- **Display transition overlay** at `app/display/ScenarioView.tsx` line 78 already
  renders a `victory`/`defeat` flourish when `finish` goes pending — leave that
  flourish in place; the new rewards overlay sits on top of / after it.

T1's job is to **unify rewards data in a persisted snapshot, finish the battle
goals / treasures / XP-threshold story, and give the display a real rewards
surface** — not to replace the existing overlays.

---

## Goal

Make scenario end a proper rewards experience for the whole table. Victory or
defeat, every player sees their personal rewards on their phone, the controller
sees a per-character summary with confirmation action, and the display shows a
full-bleed read-only rewards tableau. All three stay in sync via a single
persisted snapshot, `state.finishData`.

**Deliverable.** Playtest-ready rewards experience. Win or lose a scenario,
complete rewards flow plays out on all three clients with accurate numbers,
battle goals, and treasures, and then drops into the existing town checklist
(which is unchanged by this batch). Two consecutive scenarios work without
stale data from the first leaking into the second.

---

## Plan Overview

1. **Engine**: add `ScenarioFinishData` snapshot. Populate on `prepareScenarioEnd`.
   Mutate during the pending window (`setBattleGoalComplete`, `claimTreasure`).
   Apply on `completeScenario`. Clear on `completeTownPhase` and `startScenario`
   (defensive — a new scenario should never see last scenario's rewards).
2. **Reference DB**: add `getCampaignData`, `getTreasure` methods + two API routes.
3. **Commands**: three new commands (`setBattleGoalComplete`, `claimTreasure`,
   `dismissRewards`). Phone whitelist updates for the two character-scoped ones.
4. **Clients**:
   - Phone: refactor `PhoneRewardsOverlay` to read from `finishData` (not live
     state), add battle goal toggle for the player's own row, treasure claim
     prompt when their character looted treasure, XP threshold progress bar,
     dismissal on Continue.
   - Controller: refactor `ScenarioSummaryOverlay` to read from `finishData`,
     show battle goal checkbox grid (per character), list of unclaimed treasures
     with resolve-to button, Confirm Completion button (fires `completeScenario`).
   - Display: new `DisplayRewardsOverlay` — full-bleed per-character rewards
     tableau with edition theming and particles. Read-only.

---

## Step 1 — Engine: `ScenarioFinishData` type + snapshot lifecycle

### 1a. Add new type to `packages/shared/src/types/gameState.ts`

Append before the `GameState` interface:

```ts
export interface ScenarioFinishCharacterReward {
  /** Character identity — matches `Character.name` / `Character.edition`. */
  name: string;
  edition: string;
  /** Display label at time of snapshot. */
  title: string;
  /** XP scored on the initiative dial during the scenario. */
  scenarioXP: number;
  /** Scenario-level bonus XP (4 + 2 * level), zero on defeat. */
  bonusXP: number;
  /** Sum of scenarioXP + bonusXP — what gets added to career XP. */
  totalXPGained: number;
  /** Career XP before this scenario. */
  careerXPBefore: number;
  /** Career XP after applying totalXPGained. */
  careerXPAfter: number;
  /** Scenario level for display of gold conversion. */
  scenarioLevel: number;
  /** Gold conversion rate at scenario level (e.g. 2/2/3/3/4/4/5/6). */
  goldConversion: number;
  /** Total coin value looted (FH from cards, GH from char.loot counter). */
  totalCoins: number;
  /** Gold gained = totalCoins * goldConversion. */
  goldGained: number;
  /** Career gold before/after. */
  careerGoldBefore: number;
  careerGoldAfter: number;
  /** FH resource counts drawn from loot cards (lumber, metal, hide, herbs). */
  resources: Partial<Record<LootType, number>>;
  /** Loot cards the character drew (index into lootDeck.cards at snapshot). */
  lootCardIndexes: number[];
  /** Treasure tiles revealed by this character. Resolved via claimTreasure. */
  treasuresPending: string[];
  /** Treasure ids the character has already claimed this pending window. */
  treasuresClaimed: string[];
  /** XP thresholds for progression display: [prev, next]. */
  xpThresholds: {
    currentLevel: number;
    /** XP required for current level. */
    currentFloor: number;
    /** XP required for next level, or null if already at max. */
    nextThreshold: number | null;
  };
  /** Battle-goal slots — one entry per dealt goal card. `cardId` identifies
   *  the card in the battle goal deck; `checks` is number of marks earned on
   *  completion (from the reference data). Completed requires victory. */
  battleGoals: Array<{
    cardId: string;
    name: string;
    checks: number;
    completed: boolean;
  }>;
  /** Whether this player has dismissed their phone rewards overlay. */
  dismissed: boolean;
}

export interface ScenarioFinishData {
  outcome: 'victory' | 'defeat';
  scenarioIndex: string;
  scenarioEdition: string;
  scenarioLevel: number;
  /** Per-character snapshot at `prepareScenarioEnd` time. */
  characters: ScenarioFinishCharacterReward[];
  /** FH inspiration reward (4 - playerCount) on victory only; omitted in GH. */
  inspirationGained?: number;
  /** Captured at pending; persisted through completeScenario. */
  createdAtRevision: number;
}
```

Then add the field to `GameState`:

```ts
finishData?: ScenarioFinishData;
```

### 1b. Build the snapshot in `applyCommand.ts` `case 'prepareScenarioEnd'`

Replace the existing one-liner with a call to a new helper
`buildScenarioFinishData(state, outcome, dataContext)`. The helper must:

- Read `state.level`, characters, loot deck, battle goals dealt
  (`char.battleGoals: Identifier[]`).
- Use `deriveLevelValues(level)` for `goldConversion` and `bonusXP`. Do NOT
  re-derive.
- Mirror the gold/resource derivation already in `handleCompleteScenario`
  (FH uses loot card indexes into `state.lootDeck.cards` with player-count
  column `value2P/value3P/value4P`; GH uses `char.loot` coin counter).
- Skip absent/exhausted characters? **No** — include every character in
  `state.characters` (per rules §11, even exhausted characters gain XP). Set
  `scenarioXP` and `totalCoins` to 0 for exhausted-on-defeat only if their
  in-scenario counters are already zero; otherwise use whatever they have.
- For `xpThresholds`, call `dataContext.getCampaignData?.(edition, 'xpThresholds')`
  if provided; fall back to the hard-coded `[0, 45, 95, 150, 210, 275, 345, 420, 500]`
  from `GAME_RULES_REFERENCE.md` §12 so the engine still works without
  DataContext (important for tests). Use `char.level` to find current floor
  and next threshold.
- For battle goals, look up checks per card via
  `dataContext.getBattleGoals?.(edition)` (already exists in DataContext);
  fall back to `{ checks: 1 }` if unresolved. Emit one entry per card the
  character holds; `completed: false` on creation.
- `inspirationGained` — FH only. Detect FH by `state.edition === 'fh'` or
  `state.party?.edition === 'fh'`. Set to `Math.max(0, 4 - playerCount)` on
  victory; `undefined` on defeat or non-FH.
- `treasuresPending` — copy `char.treasures` (array of treasure ids already
  revealed during play). `treasuresClaimed` starts empty.
- `dismissed: false` on creation.
- `createdAtRevision: state.revision`.

After building the snapshot, also set:

```ts
after.finish = `pending:${outcome}` as ScenarioFinish;
after.finishData = snapshot;
```

### 1c. Update `handleCompleteScenario` to apply from the snapshot

`handleCompleteScenario` is the source of truth for career-data mutations.
Keep that. But when `state.finishData` is present, **read totalXPGained,
goldGained, resources, and completed battle-goal checks from the snapshot**
rather than re-deriving from live state (live state may have been mutated
during the pending window — e.g. battle-goal toggles or treasure claims).
Fallback path (no `finishData`, which can happen with pre-T1 saves during
deploy): keep the existing derivation logic intact — **do not remove it**.

Additional rules-accurate mutations to perform during
`handleCompleteScenario` only when outcome is victory AND snapshot is present:

- Per character, add completed-battle-goal check count to
  `char.progress.battleGoals`.
- Resolve treasures: for each id in `finishData.characters[i].treasuresClaimed`,
  apply the treasure's reward to the character via `applyTreasureReward` (new
  helper — see step 1e below). This must be idempotent — since the snapshot is
  built at prepare and mutated during the pending window, treasures that are
  still `pending` at completion should **not** be applied.
- FH only: if `finishData.inspirationGained` is a positive number, add it to
  `state.party.inspiration ?? 0`.

Preserve the existing reset logic (combat state, monsters, round, element
board, `state.mode = 'town'`, `state.finish = 'success'|'failure'`). Do NOT
clear `state.finishData` here — keep it around so the rewards overlay can
remain visible after the transition to `'town'`. Clearing happens on the
next lobby transition.

### 1d. Clear `finishData` defensively

Add `after.finishData = undefined` to:

- `case 'cancelScenarioEnd'` — player canceled the end flow.
- `case 'completeTownPhase'` — town done, dropping back to lobby.
- `case 'startScenario'` — brand-new scenario starts, no stale snapshot.

### 1e. `setBattleGoalComplete`, `claimTreasure`, `dismissRewards` handlers

All three mutate `state.finishData` in place:

- **`setBattleGoalComplete`**: finds the character row, toggles or sets the
  `completed` flag on the matching `cardId`. Must reject if the outcome is not
  `victory` (battle goals are only awarded on victory — rules §11). Also
  reject if `state.finish` is not pending or `finishData` missing.
- **`claimTreasure`**: moves an id from `treasuresPending` to `treasuresClaimed`.
  Look up the reward via `dataContext.getTreasure?.(edition, id)` and **do
  not** mutate character progress directly here — the actual application
  happens at `completeScenario` (one atomic place). However, **do** add any
  resolved-narrative text into the snapshot so the UI can display what was
  granted. Store resolved text on the pending char entry:
  `char.treasuresResolved?: Record<string, string>` (add this optional field
  to the type). If the treasure payload includes a definite item id or flat
  gold reward, include that in the resolved metadata.
- **`dismissRewards`**: character-scoped. Sets `char.dismissed = true` for the
  matching character row.

### 1f. Helper `applyTreasureReward(state, char, treasure)`

Interpret the reward text/payload from the reference DB (treasures table has a
freeform `reward` column). MVP support (anything else stays on-screen as text
for players to resolve manually):

- `+NNg` or `N gold` — add to `char.progress.gold`.
- `+NN XP` or `N experience` — add to `char.progress.experience`.
- `<Item NNN>` / pattern matches for items — push to `char.progress.items`
  with the parsed item id.
- Anything else — no-op (the rewards UI still shows the narrative text).

This is a conservative first pass; treasures are diverse and parsing the full
grammar is its own project. Keep `applyTreasureReward` small and well-tested.

### 1g. Validation in `validateCommand.ts`

For `setBattleGoalComplete` / `claimTreasure` / `dismissRewards`:

- Reject if `state.finish` is not `pending:victory` or `pending:failure`.
- `setBattleGoalComplete`: reject if outcome is `defeat`.
- `claimTreasure`: reject if the id isn't in that character's
  `treasuresPending`.
- `dismissRewards`: always valid once pending is active.

### 1h. Command types (`packages/shared/src/types/commands.ts`)

Append to the action union:

```ts
| 'setBattleGoalComplete'
| 'claimTreasure'
| 'dismissRewards'
```

Command interfaces:

```ts
export interface SetBattleGoalCompleteCommand {
  action: 'setBattleGoalComplete';
  payload: {
    characterName: string;
    edition: string;
    cardId: string;
    completed: boolean;
  };
}

export interface ClaimTreasureCommand {
  action: 'claimTreasure';
  payload: {
    characterName: string;
    edition: string;
    treasureId: string;
  };
}

export interface DismissRewardsCommand {
  action: 'dismissRewards';
  payload: { characterName: string; edition: string };
}
```

Add all three to the `Command` union at the end of the file.

### 1i. Server phone permissions (`server/src/wsHub.ts`)

Add the three new actions to `PHONE_ALLOWED_ACTIONS`. Do NOT add them to
`PHONE_GLOBAL_ACTIONS` — they are all character-scoped. `getCommandCharacterName`
already routes on `payload.characterName` for similar shapes; extend the switch
if necessary so the three new actions return the correct character name.

---

## Step 2 — Reference DB + API

### 2a. `server/src/referenceDb.ts`

Add these methods near `getItems` (keep alphabetical-ish order):

```ts
getCampaignData(edition: string, key: string): unknown | null {
  const row = this.stmtCache('getCampaignData',
    `SELECT value_json FROM campaign_data WHERE edition = ? AND key = ?`,
  ).get(edition, key) as { value_json: string } | undefined;
  if (!row) return null;
  try { return JSON.parse(row.value_json); }
  catch { return null; }
}

getTreasure(edition: string, treasureIndex: string | number): { treasure_index: number; reward: string } | null {
  const idx = typeof treasureIndex === 'string' ? Number.parseInt(treasureIndex, 10) : treasureIndex;
  if (!Number.isFinite(idx)) return null;
  const row = this.stmtCache('getTreasure',
    `SELECT treasure_index, reward FROM treasures WHERE edition = ? AND treasure_index = ?`,
  ).get(edition, idx) as { treasure_index: number; reward: string } | undefined;
  return row ?? null;
}
```

### 2b. DataManager wiring

In `server/src/commandHandler.ts` (the constructor that builds `this.dataContext`
from `dataManager`), add mappings:

```ts
getCampaignData: (ed, key) => dataManager.getCampaignData(ed, key),
getTreasure: (ed, idx) => dataManager.getTreasure(ed, idx),
```

Then add the corresponding methods on `DataManager` (find the file by grepping
for `class DataManager`). They should delegate to `refDb`. Also extend the
`DataContext` interface in `packages/shared/src/engine/applyCommand.ts`:

```ts
getCampaignData?(edition: string, key: string): unknown | null;
getTreasure?(edition: string, treasureIndex: string): { treasure_index: number; reward: string } | null;
```

### 2c. API endpoints (`server/src/index.ts`)

Add below the existing `/api/ref/items/:edition` route:

```ts
app.get('/api/ref/campaign/:edition/:key', (req, res) => {
  if (!refDb) { res.status(503).json({ error: 'Reference DB not available' }); return; }
  const data = refDb.getCampaignData(req.params.edition, req.params.key);
  data !== null ? res.json(data) : res.status(404).json({ error: 'Campaign data not found' });
});

app.get('/api/ref/treasure/:edition/:index', (req, res) => {
  if (!refDb) { res.status(503).json({ error: 'Reference DB not available' }); return; }
  const data = refDb.getTreasure(req.params.edition, req.params.index);
  data ? res.json(data) : res.status(404).json({ error: 'Treasure not found' });
});
```

---

## Step 3 — Hooks

Add a new `app/hooks/useFinishData.ts`:

```ts
import { useGameState } from './useGameState';

export function useFinishData() {
  const { state } = useGameState();
  const finishData = state?.finishData;
  const finish = state?.finish;
  const isPending = typeof finish === 'string' && finish.startsWith('pending:');
  const isFinal = finish === 'success' || finish === 'failure';
  const isVictory = finish === 'pending:victory' || finish === 'success';
  return { finishData, isPending, isFinal, isVictory };
}
```

Also extend `app/hooks/useCommands.ts` with thin wrappers for the three new
commands, matching the style of existing helpers:

```ts
setBattleGoalComplete: (characterName: string, edition: string, cardId: string, completed: boolean) =>
  send({ action: 'setBattleGoalComplete', payload: { characterName, edition, cardId, completed } }),
claimTreasure: (characterName: string, edition: string, treasureId: string) =>
  send({ action: 'claimTreasure', payload: { characterName, edition, treasureId } }),
dismissRewards: (characterName: string, edition: string) =>
  send({ action: 'dismissRewards', payload: { characterName, edition } }),
```

---

## Step 4 — Phone: refactor `PhoneRewardsOverlay`

Rewrite `app/phone/overlays/PhoneRewardsOverlay.tsx` to:

- Read from `state.finishData` via `useFinishData()`. No more live-state
  derivation — snapshot is authoritative the moment it exists.
- Mount while `finishData` exists (regardless of mode — stays visible through
  the `scenario → town` transition until user taps Continue OR `finishData`
  becomes `undefined`, whichever first).
- Find the row for `selectedCharacter`. If no row, render nothing.
- Sections, in order:
  1. **Title banner** — Victory / Defeat, character title (big).
  2. **XP block** — scenarioXP, bonusXP (if > 0), totalXPGained highlight,
     career XP before → after, and an XP threshold progress bar:
     `careerXPAfter` relative to `currentFloor` and `nextThreshold`; if already
     past the threshold, show a "Level Up available in town!" callout.
  3. **Gold block** — totalCoins × goldConversion = goldGained, career delta.
  4. **Resources** (FH only, if present).
  5. **Battle goals** — one row per dealt card. Show card name + checkbox.
     Checkbox only interactive during pending AND victory; otherwise read-only.
     Toggling fires `setBattleGoalComplete`. Show check-count ("+1 check" /
     "+2 checks") next to the checkbox.
  6. **Treasures** — list pending + claimed. Pending: narrative preview
     (fetched from `/api/ref/treasure/:edition/:index` lazily — use a tiny
     `useEffect` per overlay mount; cache by id). Tap "Claim" fires
     `claimTreasure`. Claimed: show resolved narrative + "Claimed" pill.
  7. **Inspiration** (FH victory) — banner "Party gains +N inspiration" when
     snapshot has `inspirationGained`.
  8. **Waiting / Continue button**
     - If pending: "Waiting for GM to confirm…" (no button unless dismissed
       state applies — see below).
     - If final (`success`/`failure`): show "Continue" button. Tapping fires
       `dismissRewards` and locally hides the overlay. If all phones have
       dismissed, the overlay vanishes naturally once `finishData` is cleared
       at `completeTownPhase` (handled by the snapshot lifecycle).

Accessibility + conventions:

- `role="dialog" aria-modal="true" aria-labelledby` pointing at a hidden h2.
- `touch-action: manipulation` on interactive elements (already in CSS).
- Use `aria-label`s on checkbox buttons ("Battle goal: Slay 3 bosses, 2 checks,
  toggle completed").

---

## Step 5 — Controller: refactor `ScenarioSummaryOverlay`

Rewrite `app/controller/overlays/ScenarioSummaryOverlay.tsx` to:

- Read from `state.finishData` (via `useGameState()` directly — hooks are fine
  here). Live-derivation fallback is NOT needed since the overlay is opened by
  firing `prepareScenarioEnd` which populates the snapshot in the same tick.
- Preserve the existing open/close lifecycle — `onConfirm` still fires
  `completeScenario`, `onCancel` still fires `cancelScenarioEnd`.
- Replace the current single-per-row text block with:
  - Per-character card (grid of 2 or 3 columns wide on iPad landscape).
  - Character title, scenario XP breakdown, gold, resources (same data).
  - **Battle goal grid** — one compact checkbox row per card, GM can toggle
    on behalf of any player. Fires `setBattleGoalComplete`. Disabled when
    outcome is `defeat`.
  - **Treasure section** — list unclaimed treasures for this character with
    a Claim button per treasure. Fires `claimTreasure`. Claimed treasures
    show as resolved.
  - Career XP → XP threshold meter (so GM can see who is about to level up
    in town).
- Keep the existing action bar: Cancel / Claim Rewards (victory) or Accept
  Defeat.
- All interactive elements get `aria-label`, focus ring visible, pointer-
  friendly sizing (iPad landscape).

Consult the UI/UX Pro Max skill for:

- Layout rhythm / spacing tokens.
- How to present tabular reward data at tablet scale without feeling like a
  dashboard.

Aesthetic: aged parchment / candlelight. This is a ceremonial moment at the
end of play. Cards glow, confirm button has copper/gold emphasis, victory
uses a subtle gold haze, defeat uses a muted rust-red.

---

## Step 6 — Display: new `DisplayRewardsOverlay`

This is greenfield. Create `app/display/overlays/DisplayRewardsOverlay.tsx`
(create the `overlays/` directory if it doesn't yet exist — check first).

Mount from `app/display/ScenarioView.tsx` wherever the existing transition
overlay state machine is. Render when `state.finishData` exists. It should
layer above (or replace) the existing victory/defeat flourish after the
flourish completes.

Structure (portrait 1080×1920 tower):

- Full-bleed backdrop with edition-themed particles (reuse the embers/snow
  component already used elsewhere on the display client — grep for
  `ParticleCanvas` or the canvas particle hook).
- Crown title: "Victory" or "Scenario Failed", scenario `#idx — Level N`.
- Vertical list of per-character rewards cards (tall portrait layout allows
  2 or 3 visible at once — let them scroll if party > 3):
  - Character portrait (from existing asset resolver) on the left.
  - XP line, gold line, resources line, battle goals mini-grid, treasures
    mini-list, all from `finishData`.
  - Completed battle goals animate a checkmark when they flip.
- Footer: FH inspiration banner if present; status string tied to dismissal
  state ("Waiting for players to continue…" / "Rewards claimed.").

Display is read-only. No interactive elements. Match the scenario-mode
aesthetic — this is the same room, same vibe, one beat later.

Use `app/CONVENTIONS.md` for CSS class naming (BEM, `display-rewards__*`).
Use existing CSS variables from `app/shared/styles/theme.css`. Do NOT
introduce new colors — reuse `--accent-gold`, `--accent-copper`, etc.
Respect `data-edition="fh"` and `data-edition="gh"` on the document root
for edition theming.

---

## Step 7 — Wire it up

- Phone: existing mount point at `app/phone/ScenarioView.tsx:189` stays, but
  the overlay is now alive any time `finishData` exists, not just during the
  pending window. (Internal logic switches by `isPending`/`isFinal`.) If the
  phone is in town mode and still has `finishData`, the overlay is still
  appropriate.
- Controller: lives inside the existing `scenarioSummary` overlay type; no
  routing changes needed.
- Display: ensure the transition overlay (the big "VICTORY"/"DEFEAT"
  flourish) plays first, then hands off to `DisplayRewardsOverlay` once the
  flourish animation settles — keep it feeling like two beats, not two
  overlays fighting.

---

## Verification Checklist (run on a live server, FH campaign game code)

For every row below, record in a table: ✅ pass / ❌ fail (+ note).

### Engine + state

- [ ] Fresh FH scenario, end with victory → `state.finishData` populated with
      one entry per character; scenario/bonus XP, gold, resources match
      controller summary numbers.
- [ ] `state.finishData.xpThresholds.nextThreshold` matches §12 of
      `GAME_RULES_REFERENCE.md` for each character level.
- [ ] `prepareScenarioEnd` then `cancelScenarioEnd` → `finishData` cleared.
- [ ] `completeScenario` with victory and one battle-goal checkbox on →
      `char.progress.battleGoals` incremented by the card's check count.
- [ ] `completeScenario` with two treasures claimed (one +gold, one item) →
      `char.progress.gold` and `char.progress.items` updated correctly.
- [ ] `completeTownPhase` → `finishData` cleared; `state.mode = 'lobby'`.
- [ ] `startScenario` on a new scenario → `finishData` remains cleared
      (no leak from previous run).

### Phone

- [ ] Two phones connected, both see the rewards overlay with their
      character's data at `prepareScenarioEnd`.
- [ ] Battle goal checkbox is interactive on phone A (their character), not
      on phone B (other character's row not shown).
- [ ] Battle goal toggle on phone A reflects on controller summary immediately.
- [ ] Treasure claim on phone A: pending list shrinks, claimed list grows,
      narrative text appears.
- [ ] On defeat, battle goal checkboxes are disabled/read-only.
- [ ] Career XP delta and threshold progress bar render correctly at level 1
      (next at 45) and level 2 (next at 95).
- [ ] Continue button fires `dismissRewards`; overlay closes locally; other
      phone is unaffected.

### Controller

- [ ] Summary overlay shows all characters, not just non-absent non-exhausted
      (bugfix — rules §11 says exhausted chars gain XP). Confirm every
      non-absent char is listed.
- [ ] GM toggles battle goal on phone's behalf — phone updates.
- [ ] GM claims a treasure for a character — phone sees resolved text.
- [ ] Claim Rewards button fires `completeScenario`; all three clients
      transition together.
- [ ] Cancel button fires `cancelScenarioEnd`; snapshot cleared everywhere.

### Display

- [ ] Display shows victory/defeat flourish, then transitions to rewards
      tableau.
- [ ] Per-character rewards match controller numbers exactly.
- [ ] Battle goal checkmarks animate/flip when toggled on phone or controller.
- [ ] Treasure claim updates the display without a reload.
- [ ] FH inspiration banner appears on victory with correct value
      (4 - playerCount).
- [ ] GH scenario (no loot cards, no resources, no inspiration): display
      gracefully hides resource/inspiration sections; still shows XP + gold.

### FH-specific

- [ ] Loot card resource counts on snapshot equal live state before
      `completeScenario` ran.
- [ ] Money cards use correct player-count column (value2P/3P/4P).

### GH-specific

- [ ] `char.loot` (coin counter) × `goldConversion` = `goldGained` on snapshot.
- [ ] No `resources` section appears on phone/controller/display.

### Regressions

- [ ] Scenario-only play (no campaign, one-off mode) still reaches town with
      `mode = 'town'`; rewards overlay still renders.
- [ ] `npm run build` succeeds in all three client bundles.
- [ ] TypeScript compile clean (`tsc --noEmit`) across server, shared, and
      clients.

---

## Documentation (mandatory — per CLAUDE.md §"Documentation Currency")

Before committing, update:

- **`docs/BUGFIX_LOG.md`** — entries for any regressions found + fixed during
  verification.
- **`docs/DESIGN_DECISIONS.md`** — new entry:
  *"T1: `state.finishData` snapshot separates the presentational rewards
  model from the live engine state so rewards can be read uniformly pending
  and post-claim, and so per-character battle-goal / treasure choices
  accumulate in one place before atomic application."*
- **`docs/ROADMAP.md`** — mark Phase T → T1 complete; list commands added.
- **`docs/PROJECT_CONTEXT.md`** — add new commands to the "Commands Quick
  Reference" block; add new API endpoints to the Reference API Endpoints
  block; note `ScenarioFinishData` in the types summary.
- **`docs/APP_MODE_ARCHITECTURE.md`** — expand the "Scenario End → Town"
  transition sequence to cover the snapshot lifecycle and per-device rewards
  surfaces.
- **`docs/COMMAND_PROTOCOL.md`** — document the three new commands.
- **`docs/GAME_RULES_REFERENCE.md`** — no change expected (rules already
  covered), but sanity-check §11 and §12 match what was implemented.

---

## Commit Message

```
feat(phase-t1): scenario end rewards — per-character snapshot + cross-device overlays

Add state.finishData snapshot populated at prepareScenarioEnd. Phone, controller,
and display rewards overlays now read from the snapshot rather than deriving
live, so post-completion displays stay accurate. Battle goals and treasures
resolved during the pending window via setBattleGoalComplete and claimTreasure
commands (phone-scoped, character-matched). dismissRewards lets phones close
locally without affecting other devices.

Engine:
- ScenarioFinishData type + snapshot lifecycle (build on prepare, mutate on
  battle-goal/treasure/dismiss, apply atomically on complete, clear on
  cancel/town-complete/start-scenario)
- applyTreasureReward helper (gold/XP/item parsing)
- Three new commands with validation + engine handlers

Server:
- ReferenceDb.getCampaignData / getTreasure
- DataContext extensions
- /api/ref/campaign/:edition/:key, /api/ref/treasure/:edition/:index
- Phone permission whitelist updated for the three new commands

Clients:
- PhoneRewardsOverlay refactored to consume snapshot
- ScenarioSummaryOverlay refactored to consume snapshot; battle-goal grid +
  treasure claim actions
- New DisplayRewardsOverlay — full-bleed read-only tableau with edition
  theming and particles

Docs: BUGFIX_LOG, DESIGN_DECISIONS, ROADMAP, PROJECT_CONTEXT,
APP_MODE_ARCHITECTURE, COMMAND_PROTOCOL updated.

Baseline: ce0936e. Part of Phase T (Town Mode & Campaign Layer).
```

---

## Notes to Claude Code

- Read every document listed in Context before writing any code.
- After reading docs, produce a short Plan section (what files you'll change,
  in what order) and wait for Kyle to confirm before editing any files.
- Use targeted `view`s with `view_range` on large files (`applyCommand.ts` is
  ~2000 lines — don't dump the whole thing).
- Grep before assuming barrel exports. `packages/shared/src/index.ts` is the
  public surface — ensure `ScenarioFinishData` is exported.
- Run `npm run build` before claiming done.
- Do NOT touch `data/reference.db` or `scripts/import-data.ts`. All data for
  this batch is already there.
- Do NOT parse PDFs. Not this batch.
- If anything in this prompt conflicts with what you find in the codebase, stop
  and surface the conflict before proceeding.
