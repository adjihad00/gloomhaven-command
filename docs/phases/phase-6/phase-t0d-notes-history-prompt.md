# Phase T0d — Player Sheet Notes + History Tabs (Claude Code Prompt)

## Context

Working in the `gloomhaven-command` repo. **Baseline: T0c complete** (commit `4b75178`). Run `git pull` and confirm `app/shared/sheets/CampaignSheet.tsx` and `packages/shared/src/data/prosperityLevel.ts` exist. If T0c isn't landed, stop.

**This is the final batch of Phase T0.** T0a shipped Player Sheet shell + Overview. T0b shipped Party Sheet. T0c shipped Campaign Sheet. T0d fills the last two Player Sheet tabs — Notes and History — and closes the T0 arc.

After T0d, the T2 rewrites begin (Items / Progression / Personal Quest targeting Player Sheet tabs).

**Read before writing code:**

1. `CLAUDE.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/APP_MODE_ARCHITECTURE.md`
4. `docs/PHASE_T0_SCOPE.md` (Player Sheet Notes + History sections)
5. `docs/PHASE_T0_DESIGN_BRIEF.md`
6. `docs/DESIGN_DECISIONS.md` — all T0a/b/c entries
7. `docs/BUGFIX_LOG.md` — recent batch lessons
8. `docs/GAME_RULES_REFERENCE.md` — §11 (Ending a Scenario), §17 (Prosperity, added by T0c)
9. `app/CONVENTIONS.md`
10. `docs/TEST_BACKFILL.md` (T0c created this — T0d may add entries)

**Design skills** — every `.md` under each:

- `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
- `C:\Users\Kyle Diaz\.agents\skills\`

Priority: `app/CONVENTIONS.md` > `PHASE_T0_DESIGN_BRIEF.md` > UI/UX Pro Max > agent skills.

**Existing code to study first (these are the patterns you follow):**

- `app/phone/sheets/PlayerSheet.tsx` — sheet container, tab dispatch (notes and history cases already wired at lines 213–214 in placeholder form).
- `app/phone/sheets/tabs/NotesTabPlaceholder.tsx` / `HistoryTabPlaceholder.tsx` — the placeholder files you're **replacing**. Delete both once real tabs compile.
- `app/phone/sheets/tabs/OverviewTab.tsx` / `tabs/OverviewXPBar.tsx` — the polish/motion reference for the Player Sheet visual language (parchment-ink, class-accent, candlelight warmth).
- `app/shared/sheets/tabs/StandingTab.tsx` — **the canonical editable-text reference.** Uses `useCommitOnPause`. Model the Notes tab on this.
- `app/shared/hooks/useCommitOnPause.ts` (103 lines) — hybrid-commit hook established in T0b. Reuse directly.
- `packages/shared/src/engine/applyCommand.ts` around line 2258 — `handleCompleteScenario`'s scenario-record block. The live history hook plugs in here.
- `packages/shared/src/types/commands.ts` around line 400 — `SetCharacterProgressField` union. **`'notes'` is already whitelisted** (T0a left the door open). Notes tab wires to existing command — zero engine work for Notes.
- `packages/shared/src/types/gameState.ts` around line 235 — `CharacterProgress.notes: string` **already exists**. Existing pre-Phase-T data.

---

## Scope Decisions (locked in before writing)

Per your direct answers:

**Scope:** Ship both Notes + History. History seeds from `state.party.scenarios[]` on first open (backfill), captures new completions live via a hook in `completeScenario`. Future batches (T2b level-up, T2c retirement) append their own hooks when those commands land.

**Architecture:** Explicit per-event hooks at each trigger site. Typed event variants. Each hook site enriches the entry with context the History tab wants to show.

What this means concretely:
- `HistoryEntry` is a discriminated union of typed entry variants. New variants land with future batches; T0d introduces only `scenarioCompleted` and `scenarioFailed`.
- A tiny helper `logHistoryEvent(char, entry)` centralizes the push. Future batches call it from their own handlers.
- Backfill is a one-time migration that runs lazily when History tab first opens (or on engine load if we want cleaner separation). Prefer lazy — it keeps the engine oblivious to UI concerns.

---

## What's In Scope

- **Notes tab** — fully implemented. Editable textarea, hybrid-commit via `useCommitOnPause`, autosave indicator, character count, parchment-styled UI matching Player Sheet language. Wires to existing `setCharacterProgress` command with `field: 'notes'`.
- **History tab** — scenario-event timeline, fully implemented. Read-only for the player (no editing their own history). Displays entries in reverse chronological order. Empty state when a brand-new character has no entries.
- New `HistoryEntry` type on `CharacterProgress` — discriminated union, typed, extensible.
- New `logHistoryEvent(char, entry)` helper — the single mutator all history pushes go through. T0d uses it from `handleCompleteScenario`. Future batches call it from their handlers.
- **Hook in `handleCompleteScenario`**: on victory OR defeat, append a history entry to every participating character. Data sourced from `state.finishData` snapshot where available, live state otherwise.
- **Backfill**: one-time migration from `state.party.scenarios[]` to each character's history, applied lazily on first History tab view. Attributes existing scenarios to all currently-active characters (imperfect — best data allows). Once migration has run, entries accumulate live.
- New CSS section in `app/shared/styles/sheets.css` under a clearly labeled `/* T0d: Player Sheet Notes + History */` block.
- `app/phone/sheets/tabs/NotesTab.tsx` replaces `NotesTabPlaceholder.tsx`; `HistoryTab.tsx` replaces `HistoryTabPlaceholder.tsx`. Delete placeholders on green.
- Controller read-only path: `PlayerSheetQuickView` (existing) automatically gets the new tabs too, read-only — confirm by smoke test.

## Out of Scope (Explicit — Do Not Drift)

- Any T2 content (Items, Progression, Personal Quest). Those placeholders stay placeholders.
- Any T3 / T4 / T5 / T6 / T7 / T8 content.
- Event hooks for level-up, perks, masteries, personal quests, retirement, treasures, items, enhancements — these land with the batches that add those commands. **Do NOT preempt by wiring level-up hooks even "for later"** — the commands don't exist yet, so there's nothing to hook.
- GM-side history entry editing or deletion. Read-only for everyone.
- Export or share of history. Part of export-campaign is already covered by the existing `/api/export/{gameCode}` path.
- Notes markdown rendering. Plain text only. Markdown is a future polish decision, not T0d.
- History entry pagination. Campaigns max out at ~100 scenarios — render them all. Add virtualization only if a future run shows it's needed.
- Cross-character history view ("party history"). Per-character only. Party-level scenario log already lives on the Campaign Sheet Scenarios tab (T0c).

---

## Step 1 — Engine: `HistoryEntry` type

### 1a. Define the discriminated union

In `packages/shared/src/types/gameState.ts`, add above `CharacterProgress`:

```ts
// ── Character history entries ────────────────────────────────────────────────

/** Shared fields on every HistoryEntry variant. */
interface HistoryEntryBase {
  /**
   * Monotonically increasing id within a character's history.
   * Stable identifier — used for React keys and cross-device dedup.
   * Not a timestamp; History has no real times (the game state has no
   * wall-clock concept of "when during real life" something happened).
   */
  id: number;
  /**
   * Logical sequence marker — which scenario (by party.scenarios index)
   * the entry occurred during, or the count of entries that preceded it.
   * Used for ordering when `kind` alone is insufficient.
   */
  sequence: number;
  /**
   * If true, this entry was created by the backfill migration from
   * `state.party.scenarios[]` on first History-tab open. Rendered
   * with a subtle "reconstructed" styling and no per-character detail
   * (since backfill can't know who was in the party when). Live
   * entries have `backfilled: false`.
   */
  backfilled: boolean;
}

export interface HistoryEntryScenarioCompleted extends HistoryEntryBase {
  kind: 'scenarioCompleted';
  scenarioIndex: string;
  edition: string;
  group?: string;
  /** Scenario level at time of completion (for context). */
  scenarioLevel: number;
  /** XP gained in this scenario (scenario dial + bonus). */
  xpGained?: number;
  /** Gold gained from loot conversion. */
  goldGained?: number;
  /** FH resources gained. */
  resourcesGained?: Partial<Record<string, number>>;
  /** Battle-goal checks applied to the character's total. */
  battleGoalChecks?: number;
}

export interface HistoryEntryScenarioFailed extends HistoryEntryBase {
  kind: 'scenarioFailed';
  scenarioIndex: string;
  edition: string;
  group?: string;
  scenarioLevel: number;
  /** XP gained from the dial (no bonus, per rules §11). */
  xpGained?: number;
  /** Gold gained if returning-to-town; zero if replay. */
  goldGained?: number;
  resourcesGained?: Partial<Record<string, number>>;
}

/**
 * Discriminated union of history entry variants.
 * Future batches extend this union:
 *   T2b: 'levelUp', 'perkApplied', 'masteryUnlocked'
 *   T2c: 'personalQuestFulfilled', 'characterRetired', 'characterCreated'
 *   T2d: 'enhancementApplied'
 *   T6 (maybe): 'eventResolved'
 * Each variant MUST extend `HistoryEntryBase` and include a `kind`
 * discriminator so the UI can render type-specific content.
 */
export type HistoryEntry =
  | HistoryEntryScenarioCompleted
  | HistoryEntryScenarioFailed;
```

Add the field to `CharacterProgress`:

```ts
export interface CharacterProgress {
  // ... existing fields ...
  sheetIntroSeen?: boolean;
  /** Per-character history log. Backfilled lazily from party.scenarios on
   *  first History-tab open; live entries appended by explicit hooks at
   *  trigger sites (e.g. handleCompleteScenario, T2b applyLevelUp). */
  history?: HistoryEntry[];
  /** Whether the one-time backfill migration has run for this character.
   *  Set by the client when History tab opens the first time; engine
   *  consumes it only as a gate. Optional so pre-T0d saves flow through. */
  historyBackfilled?: boolean;
}
```

Both fields optional — pre-T0d saves and GHS imports tolerate the absence cleanly.

Export `HistoryEntry`, `HistoryEntryScenarioCompleted`, `HistoryEntryScenarioFailed`, and the union type from `packages/shared/src/index.ts` barrel.

### 1b. `logHistoryEvent` helper

File: `packages/shared/src/engine/historyLog.ts` (new).

```ts
import type { Character, HistoryEntry } from '../types/gameState.js';

/**
 * Append a history entry to a character's progress log.
 *
 * Single source of history mutation. Called from command handlers at
 * meaningful trigger sites (scenario complete, level up, retirement, etc.).
 *
 * - Ensures the `history` array exists.
 * - Assigns a monotonic `id` based on current length + 1 (stable within
 *   this character's history; not cross-character comparable).
 * - Assigns `sequence` as current length. Simple and monotonic; the
 *   sequence doesn't need to be globally unique or correspond to any
 *   wall-clock value.
 * - Caller provides everything else including `kind`, backfilled flag,
 *   and typed payload fields.
 */
export function logHistoryEvent(
  char: Character,
  entryWithoutMeta: Omit<HistoryEntry, 'id' | 'sequence'>,
): void {
  if (!char.progress) return;
  if (!char.progress.history) char.progress.history = [];
  const nextId = char.progress.history.length > 0
    ? Math.max(...char.progress.history.map((e) => e.id)) + 1
    : 1;
  const entry = {
    ...entryWithoutMeta,
    id: nextId,
    sequence: char.progress.history.length,
  } as HistoryEntry;
  char.progress.history.push(entry);
}
```

Keep the file tiny. Future additions are new variants in the type union, not changes here.

**Do not export from the main barrel** — only engine handlers call it. Exposing to clients would invite client-side history mutation, which we don't want. Engine-only.

### 1c. Hook `handleCompleteScenario`

In `packages/shared/src/engine/applyCommand.ts`, inside `handleCompleteScenario` (line 2180-ish), inside the `for (const char of state.characters)` loop (line 2191-ish).

**Location** — immediately after the XP / gold / resources / battle-goal / treasure application (around line 2243, after the `if (snapshot) { ... } else { ... }` block completes for this character, but **before** the combat-state reset that runs in a separate loop). Context: we need access to the live `row` from the snapshot to pull xpGained/goldGained/resources.

Simplest clean implementation: restructure the scope so row stays in scope, or compute a fresh history-entry payload inside that block and append.

Add to `applyCommand.ts`:

```ts
// (top of file, import)
import { logHistoryEvent } from './historyLog.js';
```

Inside the `for (const char of state.characters)` loop, after applying rewards:

```ts
// T0d: log a history entry for this scenario outcome.
// Only log characters who actually participated (not absent throughout).
// If the scenario index/edition is missing (edge case), skip.
const scenarioIndex = state.scenario?.index;
const scenarioEdition = state.scenario?.edition;
if (scenarioIndex && scenarioEdition && !char.absent) {
  const group = state.scenario?.group;
  const historyPayload = snapshot
    ? (() => {
        const row = snapshot.characters.find(
          (r) => r.name === char.name && r.edition === char.edition,
        );
        return {
          xpGained: row?.totalXPGained,
          goldGained: row?.goldGained,
          resourcesGained: row?.resources,
          battleGoalChecks: isVictory ? row?.battleGoalChecks : undefined,
        };
      })()
    : { xpGained: undefined, goldGained: undefined, resourcesGained: undefined };

  if (isVictory) {
    logHistoryEvent(char, {
      kind: 'scenarioCompleted',
      backfilled: false,
      scenarioIndex,
      edition: scenarioEdition,
      group,
      scenarioLevel: level,
      ...historyPayload,
    });
  } else {
    // Defeat: battleGoalChecks must not be present (rules §11 — no battle-goal rewards on defeat)
    const { battleGoalChecks: _drop, ...defeatPayload } = historyPayload;
    logHistoryEvent(char, {
      kind: 'scenarioFailed',
      backfilled: false,
      scenarioIndex,
      edition: scenarioEdition,
      group,
      scenarioLevel: level,
      ...defeatPayload,
    });
  }
}
```

Notes:
- `char.absent` check avoids logging history for characters who were absent from the scenario (they didn't play).
- We log **both victory and defeat**. Rules §11: XP is gained on either outcome; defeat still "happened" in the story and belongs in history.
- Battle goal checks logged only on victory.
- If `snapshot` is absent (fallback path for pre-T1 saves), log the entry without the optional reward fields. The UI handles missing optional fields gracefully.

### 1d. Backfill migration — client-driven, not engine-driven

History backfill runs **client-side**, triggered on first History tab render. Rationale:
- Engine handlers stay pure (no "run this once on load" logic bleeding into applyCommand).
- Backfill is a UI-initiated concern. If a character's History tab is never opened, backfill never runs. No cost.
- Using a command (`setCharacterProgress` with a new `'history'` field) would require adding `'history'` to the whitelist — but we deliberately **don't** want to allow clients arbitrary history mutation. That's the whole point of engine-only `logHistoryEvent`.

**Solution**: a dedicated command `backfillCharacterHistory`, which runs only when `char.progress.historyBackfilled !== true`. The engine guards against double-invocation. The command payload is minimal — client signals intent, engine does the work from known state.

In `packages/shared/src/types/commands.ts`:

```ts
| 'backfillCharacterHistory'

export interface BackfillCharacterHistoryCommand {
  action: 'backfillCharacterHistory';
  payload: { characterName: string; edition: string };
}
```

Add to `Command` union.

In `packages/shared/src/engine/validateCommand.ts`, accept as always-valid when target character exists (the handler self-gates on `historyBackfilled`).

In `applyCommand.ts`:

```ts
case 'backfillCharacterHistory':
  handleBackfillCharacterHistory(after, command.payload);
  break;

function handleBackfillCharacterHistory(
  state: GameState,
  payload: { characterName: string; edition: string },
): void {
  const char = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (!char) return;
  if (char.progress.historyBackfilled) return; // idempotent

  const scenarios = state.party?.scenarios ?? [];
  if (!char.progress.history) char.progress.history = [];

  for (const s of scenarios) {
    // Only backfill entries we don't already have (guards against partial prior backfill).
    const exists = char.progress.history.some(
      (e) => e.backfilled
        && ((e.kind === 'scenarioCompleted' || e.kind === 'scenarioFailed')
            && e.scenarioIndex === s.index
            && e.edition === s.edition),
    );
    if (exists) continue;
    logHistoryEvent(char, {
      kind: 'scenarioCompleted', // party.scenarios only tracks victories per engine convention
      backfilled: true,
      scenarioIndex: s.index,
      edition: s.edition,
      group: s.group,
      scenarioLevel: 0, // unknown at time of original completion
    });
  }

  char.progress.historyBackfilled = true;
}
```

**Phone permissions** in `server/src/wsHub.ts`: add `'backfillCharacterHistory'` to `PHONE_ALLOWED_ACTIONS`. Character-scoped. Add routing in `getCommandCharacterName` for the new action.

**`useCommands` wrapper** in `app/hooks/useCommands.ts`:

```ts
backfillCharacterHistory: (characterName: string, edition: string) =>
  send({ action: 'backfillCharacterHistory', payload: { characterName, edition } }),
```

---

## Step 2 — NotesTab

### 2a. Component

New file: `app/phone/sheets/tabs/NotesTab.tsx`.

Structure:

```tsx
import { h } from 'preact';
import { useContext, useMemo, useState } from 'preact/hooks';
import type { Character } from '@gloomhaven-command/shared';
import { PlayerSheetContext } from '../PlayerSheetContext';
import { useCommands } from '../../../hooks/useCommands';
import { useCommitOnPause } from '../../../shared/hooks/useCommitOnPause';

interface NotesTabProps {
  character: Character;
}

const NOTES_MAX_CHARS = 4000;

export function NotesTab({ character }: NotesTabProps) {
  const { readOnly } = useContext(PlayerSheetContext);
  const commands = useCommands();

  // current value (persisted + live local during edit)
  const persisted = character.progress?.notes ?? '';
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const { localValue, onInput, onBlur, onKeyDown } = useCommitOnPause({
    value: persisted,
    onCommit: (next) => {
      commands.setCharacterProgress(
        character.name,
        character.edition,
        'notes',
        next,
      );
      setSavedAt(Date.now());
    },
    pauseMs: 1000,
    commitOnEnter: false, // textarea — Enter is a newline
  });

  const charCount = localValue.length;
  const atLimit = charCount >= NOTES_MAX_CHARS;

  // "Saved" chip fades out 1.6s after save
  const showSavedChip = useMemo(() => {
    if (!savedAt) return false;
    return Date.now() - savedAt < 1600;
  }, [savedAt]);

  return (
    <section class="notes-tab" role="region" aria-labelledby="notes-tab-heading">
      <header class="notes-tab__header">
        <h3 id="notes-tab-heading" class="notes-tab__heading">Notes</h3>
        <p class="notes-tab__subheading">
          Your hero's journal. Track NPCs, hooks, plans, and anything worth remembering.
        </p>
      </header>

      <div class="notes-tab__field-wrapper">
        <textarea
          class="notes-tab__textarea"
          value={localValue}
          onInput={(e) => {
            const target = e.currentTarget;
            if (target.value.length > NOTES_MAX_CHARS) {
              target.value = target.value.slice(0, NOTES_MAX_CHARS);
            }
            onInput(e);
          }}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          readOnly={readOnly}
          maxLength={NOTES_MAX_CHARS}
          placeholder={readOnly ? 'No notes.' : 'Begin your journal...'}
          aria-label={`Notes for ${character.title || character.name}`}
          rows={14}
        />

        <div class="notes-tab__meta">
          <span
            class={`notes-tab__char-count ${atLimit ? 'notes-tab__char-count--limit' : ''}`}
            aria-live="polite"
          >
            {charCount} / {NOTES_MAX_CHARS}
          </span>
          <span
            class={`notes-tab__saved ${showSavedChip ? 'notes-tab__saved--visible' : ''}`}
            aria-live="polite"
          >
            Saved
          </span>
        </div>
      </div>
    </section>
  );
}
```

**Details worth calling out:**
- `commitOnEnter: false` — Enter in textarea should insert a newline, not commit.
- `maxLength` attribute + the explicit clamp in `onInput` form a belt-and-suspenders cap at 4000 chars. Most character sheets don't hit 1000 in practice. Adjust if playtest disagrees.
- "Saved" chip flashes briefly on each commit. Subtle, non-intrusive. Accessible via `aria-live`.
- Character count turns copper (`--accent-copper`) when at the limit.
- ReadOnly mode (controller quick-view) renders the textarea as read-only with a softer placeholder.

### 2b. Styles

Append to `app/shared/styles/sheets.css` under a new section:

```
/* ───────────────────────────────────────────────────────────────────
   T0d: Player Sheet Notes + History
   Per-character journal (editable textarea with autosave) and a
   reverse-chronological scenario-event timeline. Continues the
   parchment language of the Overview tab; no new tokens needed.
   ─────────────────────────────────────────────────────────────────── */

/* ── Notes tab ────────────────────────────────────────────────────── */

.notes-tab {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.notes-tab__header { display: flex; flex-direction: column; gap: var(--space-2); }

.notes-tab__heading {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 20px;
  letter-spacing: 0.04em;
  color: var(--parchment-ink);
  margin: 0;
}

.notes-tab__subheading {
  font-family: 'Crimson Pro', serif;
  font-size: 14px;
  font-style: italic;
  color: var(--parchment-ink-dim);
  margin: 0;
  line-height: 1.4;
}

.notes-tab__field-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.notes-tab__textarea {
  font-family: 'Crimson Pro', serif;
  font-size: 16px;
  line-height: 1.55;
  color: var(--parchment-ink);
  background: var(--parchment-aged);
  border: 1px solid var(--class-accent-dim);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  resize: vertical;
  min-height: 240px;
  width: 100%;
  transition: border-color var(--transition-fast), background var(--transition-fast);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.08);
}

.notes-tab__textarea:focus-visible {
  outline: none;
  border-color: var(--class-accent);
  background: var(--parchment-base);
}

.notes-tab__textarea[readonly] {
  background: transparent;
  border-color: var(--class-accent-dim);
  opacity: 0.85;
}

.notes-tab__textarea::placeholder {
  color: var(--parchment-ink-dim);
  font-style: italic;
  opacity: 0.7;
}

.notes-tab__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 24px;
  font-family: 'Cinzel', serif;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--parchment-ink-dim);
}

.notes-tab__char-count {
  transition: color var(--transition-fast);
}

.notes-tab__char-count--limit { color: var(--accent-copper); }

.notes-tab__saved {
  color: var(--class-accent);
  opacity: 0;
  transform: translateY(2px);
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.notes-tab__saved--visible {
  opacity: 1;
  transform: translateY(0);
}
```

### 2c. Wire into PlayerSheet

In `app/phone/sheets/PlayerSheet.tsx` around line 213, swap the placeholder for the real component:

```tsx
{activeTab === 'notes' && <NotesTab character={character} />}
```

Update imports accordingly. Delete `NotesTabPlaceholder.tsx`.

---

## Step 3 — HistoryTab

### 3a. Component shape

New file: `app/phone/sheets/tabs/HistoryTab.tsx`.

Responsibilities:
1. On first render where `character.progress.historyBackfilled !== true`, fire `backfillCharacterHistory` command once.
2. Render `character.progress.history ?? []` in **reverse** order (newest first).
3. Switch on `kind` to render type-specific row content.
4. Empty state when no entries.
5. "Reconstructed" styling for `backfilled: true` entries.

```tsx
import { h } from 'preact';
import { useContext, useEffect, useRef } from 'preact/hooks';
import type { Character, HistoryEntry } from '@gloomhaven-command/shared';
import { PlayerSheetContext } from '../PlayerSheetContext';
import { useCommands } from '../../../hooks/useCommands';
import { XPIcon, GoldIcon } from '../../../components/Icons';

interface HistoryTabProps {
  character: Character;
}

export function HistoryTab({ character }: HistoryTabProps) {
  useContext(PlayerSheetContext); // reserved for future readOnly use
  const commands = useCommands();
  const backfillFired = useRef(false);

  useEffect(() => {
    if (backfillFired.current) return;
    if (character.progress?.historyBackfilled) return;
    backfillFired.current = true;
    commands.backfillCharacterHistory(character.name, character.edition);
  }, [character.name, character.edition, character.progress?.historyBackfilled]);

  const entries: HistoryEntry[] = character.progress?.history ?? [];
  const reversed = [...entries].reverse();

  return (
    <section class="history-tab" role="region" aria-labelledby="history-tab-heading">
      <header class="history-tab__header">
        <h3 id="history-tab-heading" class="history-tab__heading">History</h3>
        <p class="history-tab__subheading">
          {reversed.length > 0
            ? `${reversed.length} entr${reversed.length === 1 ? 'y' : 'ies'} in this hero's story.`
            : "Your hero's story begins. Entries will appear here as you play."}
        </p>
      </header>

      {reversed.length === 0 ? (
        <EmptyState />
      ) : (
        <ol class="history-tab__timeline" role="list">
          {reversed.map((entry) => (
            <li
              key={entry.id}
              class={`history-tab__entry history-tab__entry--${entry.kind} ${entry.backfilled ? 'history-tab__entry--backfilled' : ''}`}
            >
              <HistoryEntryRow entry={entry} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function HistoryEntryRow({ entry }: { entry: HistoryEntry }) {
  switch (entry.kind) {
    case 'scenarioCompleted':
      return <ScenarioCompletedRow entry={entry} />;
    case 'scenarioFailed':
      return <ScenarioFailedRow entry={entry} />;
    default: {
      // Exhaustiveness guard — new history variants land with future batches.
      const _exhaustive: never = entry;
      return <UnknownEntryRow entry={entry as HistoryEntry} />;
    }
  }
}
```

### 3b. Entry row components

Keep these inline in the same file — they're small, not reused, and live together.

```tsx
function ScenarioCompletedRow({ entry }: { entry: HistoryEntryScenarioCompleted }) {
  return (
    <article class="history-entry history-entry--completed">
      <div class="history-entry__marker" aria-hidden="true">
        <div class="history-entry__marker-dot history-entry__marker-dot--victory" />
      </div>
      <div class="history-entry__body">
        <header class="history-entry__title">
          Scenario <span class="history-entry__scenario-num">#{entry.scenarioIndex}</span>
          <span class="history-entry__outcome history-entry__outcome--victory">Completed</span>
          {entry.backfilled && (
            <span class="history-entry__backfilled-chip" title="Reconstructed from older save data">
              Reconstructed
            </span>
          )}
        </header>
        {!entry.backfilled && (
          <dl class="history-entry__rewards">
            {entry.xpGained !== undefined && (
              <div class="history-entry__reward">
                <XPIcon size={14} />
                <dt class="sr-only">XP gained</dt>
                <dd>+{entry.xpGained}</dd>
              </div>
            )}
            {entry.goldGained !== undefined && (
              <div class="history-entry__reward">
                <GoldIcon size={14} />
                <dt class="sr-only">Gold gained</dt>
                <dd>+{entry.goldGained}</dd>
              </div>
            )}
            {entry.battleGoalChecks !== undefined && entry.battleGoalChecks > 0 && (
              <div class="history-entry__reward">
                <span class="history-entry__reward-icon" aria-hidden="true">◆</span>
                <dt class="sr-only">Battle goal checks</dt>
                <dd>+{entry.battleGoalChecks}</dd>
              </div>
            )}
          </dl>
        )}
        <footer class="history-entry__meta">
          <span class="history-entry__edition">{entry.edition.toUpperCase()}</span>
          {entry.scenarioLevel > 0 && (
            <span class="history-entry__level">Level {entry.scenarioLevel}</span>
          )}
          {entry.group && <span class="history-entry__group">{entry.group}</span>}
        </footer>
      </div>
    </article>
  );
}

function ScenarioFailedRow({ entry }: { entry: HistoryEntryScenarioFailed }) {
  // Same structure as Completed, different outcome chip + muted marker
  // — omitted here for brevity; mirror the structure above with:
  //   - history-entry--failed class
  //   - history-entry__outcome--defeat label ("Failed")
  //   - no battle-goal row
  //   - muted marker dot color
}

function UnknownEntryRow({ entry }: { entry: HistoryEntry }) {
  // Graceful fallback for future entry kinds the current build doesn't know about.
  return (
    <article class="history-entry history-entry--unknown">
      <div class="history-entry__body">
        <header class="history-entry__title">
          <span class="history-entry__scenario-num">Entry #{entry.id}</span>
        </header>
        <p class="history-entry__unknown-text">
          (This entry requires a newer app version to display properly.)
        </p>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div class="history-tab__empty">
      <div class="history-tab__empty-icon" aria-hidden="true">
        {/* Small stylized SVG — e.g. a blank scroll. Keep under 20 lines. */}
        <svg viewBox="0 0 64 64" class="history-tab__empty-svg">
          <path d="..." />
        </svg>
      </div>
      <p class="history-tab__empty-text">
        No entries yet. Your first scenario will be recorded here.
      </p>
    </div>
  );
}
```

**Accessibility:**
- `role="region"` on the tab, labeled by the heading.
- `role="list"` on the timeline, `role="listitem"` on entries (automatic via `<ol><li>`).
- Icons `aria-hidden`, semantic content via `<dl>` with screen-reader-only `<dt>`.
- `.sr-only` utility: if it doesn't exist in `app/shared/styles/`, add a minimal `.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }` in a new small utility block.

### 3c. Timeline styles

Append to `app/shared/styles/sheets.css`:

```
/* ── History tab ─────────────────────────────────────────────────── */

.history-tab {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.history-tab__header { display: flex; flex-direction: column; gap: var(--space-2); }

.history-tab__heading {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 20px;
  letter-spacing: 0.04em;
  color: var(--parchment-ink);
  margin: 0;
}

.history-tab__subheading {
  font-family: 'Crimson Pro', serif;
  font-size: 14px;
  font-style: italic;
  color: var(--parchment-ink-dim);
  margin: 0;
  line-height: 1.4;
}

.history-tab__timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Spine — thin parchment-ink line down the left side */
.history-tab__timeline::before {
  content: '';
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 11px; /* aligns with marker-dot centers */
  width: 1px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--class-accent-dim) 8%,
    var(--class-accent-dim) 92%,
    transparent 100%
  );
}

.history-tab__entry { position: relative; }

.history-entry {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--parchment-aged);
  border: 1px solid var(--class-accent-dim);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-fast);
}

.history-entry:hover,
.history-entry:focus-within { border-color: var(--class-accent); }

.history-entry--backfilled {
  background: transparent;
  border-style: dashed;
  opacity: 0.85;
}

.history-entry__marker {
  position: relative;
  flex: 0 0 24px;
  min-height: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.history-entry__marker-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 6px;
  background: var(--class-accent);
  box-shadow: 0 0 0 2px var(--parchment-aged), 0 0 0 3px var(--class-accent-dim);
}

.history-entry__marker-dot--victory { background: var(--class-accent); }
.history-entry__marker-dot--defeat {
  background: var(--accent-copper);
  box-shadow: 0 0 0 2px var(--parchment-aged), 0 0 0 3px var(--accent-copper);
  opacity: 0.7;
}

.history-entry__body { flex: 1; display: flex; flex-direction: column; gap: var(--space-2); }

.history-entry__title {
  font-family: 'Cinzel', serif;
  font-weight: 500;
  font-size: 15px;
  color: var(--parchment-ink);
  display: flex;
  gap: var(--space-2);
  align-items: center;
  flex-wrap: wrap;
  margin: 0;
}

.history-entry__scenario-num { color: var(--class-accent); font-weight: 600; }

.history-entry__outcome {
  font-family: 'Cinzel', serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 2px;
}

.history-entry__outcome--victory {
  background: var(--class-accent-dim);
  color: var(--class-accent);
}

.history-entry__outcome--defeat {
  background: rgba(197, 48, 48, 0.18);
  color: var(--negative-red);
}

.history-entry__backfilled-chip {
  font-family: 'Cinzel', serif;
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--parchment-ink-dim);
  padding: 2px 6px;
  border: 1px dashed var(--parchment-ink-dim);
  border-radius: 2px;
}

.history-entry__rewards {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin: 0;
}

.history-entry__reward {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  font-family: 'Crimson Pro', serif;
  font-size: 13px;
  color: var(--parchment-ink);
  font-feature-settings: 'tnum' 1;
}

.history-entry__reward dd { margin: 0; }

.history-entry__reward-icon { color: var(--class-accent); font-size: 12px; }

.history-entry__meta {
  display: flex;
  gap: var(--space-3);
  font-family: 'Cinzel', serif;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--parchment-ink-dim);
}

.history-entry__edition { color: var(--class-accent); }

.history-tab__empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: center;
  text-align: center;
  padding: var(--space-8) var(--space-4);
}

.history-tab__empty-svg { width: 64px; height: 64px; opacity: 0.5; stroke: var(--class-accent-dim); stroke-width: 1.5; fill: none; }

.history-tab__empty-text {
  font-family: 'Crimson Pro', serif;
  font-style: italic;
  font-size: 14px;
  color: var(--parchment-ink-dim);
  max-width: 32ch;
  line-height: 1.5;
}

/* Screen-reader-only utility (check if exists; add if not) */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### 3d. Wire into PlayerSheet

`PlayerSheet.tsx` line 214:

```tsx
{activeTab === 'history' && <HistoryTab character={character} />}
```

Update imports. Delete `HistoryTabPlaceholder.tsx`.

---

## Step 4 — Smoke + edge cases

Verifications that deserve explicit testing:

### 4a. Backfill is one-shot per character

- Open History tab on character A → backfill fires once → `historyBackfilled: true`.
- Close + reopen sheet → no backfill command fires (ref-guarded + engine-guarded).
- Switch to character B → backfill fires for B independently.

### 4b. Live hook is immune to double-trigger

- `completeScenario` fires once per scenario by design. Still: ensure an undo-then-redo doesn't accidentally duplicate entries. Because the full state (including `history`) is restored via undo snapshot, the entry will be correctly removed on undo and re-added on redo (which is the command re-firing). No duplication.

### 4c. Defeat outcome logs correctly

- Trigger a defeat on a scenario → entry kind is `scenarioFailed`, no battleGoalChecks field. Verify UI shows copper-toned marker and "Failed" outcome chip.

### 4d. Absent character behavior

- A character with `absent: true` for the scenario: **no history entry logged**. Character has their own story; this scenario didn't happen to them.

### 4e. Snapshot-less fallback

- Pre-T1 save loaded, scenario completed without `state.finishData`: entry still created with `xpGained` / `goldGained` undefined. UI renders the entry without the reward row (gracefully).

### 4f. Read-only mode on controller

- Open controller's PlayerSheetQuickView: Notes tab is read-only; History tab renders identically. Controller's visible but not interactive.

### 4g. Notes persistence

- Type notes, wait 1s → `setCharacterProgress` fires with `field: 'notes'`. Reload game state → notes persist. Hits existing `GameStore` via `updateRow`/`saveGame` in server — whichever it is.

---

## Step 5 — Documentation

- **`docs/BUGFIX_LOG.md`** — any regressions surfaced.
- **`docs/DESIGN_DECISIONS.md`** — entries:
  - "T0d: `HistoryEntry` discriminated union on `CharacterProgress.history?`. Future batches extend the union rather than adding new fields — `scenarioCompleted` / `scenarioFailed` ship now; T2b adds `levelUp` / `perkApplied`; T2c adds retirement / creation; T2d adds enhancements. Each variant has its own typed payload."
  - "T0d: Explicit per-event hooks at trigger sites rather than a generic command-wrapping auto-logger. The single mutator `logHistoryEvent(char, entry)` is engine-only (no barrel export) — clients cannot fabricate history entries. Each hook site enriches the entry with contextual data meaningful at that site."
  - "T0d: History backfill runs client-driven via `backfillCharacterHistory` command on first History-tab render. One-shot, idempotent, engine-gated by `historyBackfilled` flag. Chose client-triggered over engine-on-load to keep `applyCommand` pure of UI concerns."
  - "T0d: Notes tab uses existing `setCharacterProgress` with `field: 'notes'` (T0a whitelisted the field preemptively). No new command needed."
- **`docs/ROADMAP.md`** — mark T0d complete. **T0 arc closed.** Note T2a-d now unblocked for rewrite against Player Sheet tabs.
- **`docs/PROJECT_CONTEXT.md`** — add `backfillCharacterHistory` to Commands Quick Reference. Add `HistoryEntry` to the types line mentioning CharacterProgress additions.
- **`docs/APP_MODE_ARCHITECTURE.md`** — update Phone Player Sheet tab table to reflect Notes + History as real (not placeholder).
- **`docs/COMMAND_PROTOCOL.md`** — document `backfillCharacterHistory`.
- **`docs/GAME_RULES_REFERENCE.md`** — no change expected. §11 already covers scenario outcome XP/gold — the hook reads that behavior faithfully.
- **`docs/TEST_BACKFILL.md`** — add `logHistoryEvent` id/sequence monotonicity to the pending test list.

---

## Verification Checklist

### Build / static analysis

- [ ] `npm run build` clean on all three clients.
- [ ] `tsc --noEmit` clean.
- [ ] Placeholder files deleted and no dangling imports to `NotesTabPlaceholder` / `HistoryTabPlaceholder`.
- [ ] Phone bundle size bump ≤ 5kB for the two tabs + hook calls.

### Engine

- [ ] `HistoryEntry` type exported from barrel.
- [ ] `logHistoryEvent` NOT exported from barrel (engine-only).
- [ ] `backfillCharacterHistory` command validates and applies correctly.
- [ ] `backfillCharacterHistory` is idempotent (firing twice doesn't duplicate).
- [ ] `completeScenario` victory appends `scenarioCompleted` entry per non-absent character with correct payload from snapshot.
- [ ] `completeScenario` defeat appends `scenarioFailed` entry per non-absent character, no battleGoalChecks field.
- [ ] Absent characters get no entry.
- [ ] Snapshot-less fallback path logs entry with undefined reward fields.
- [ ] Undo a `completeScenario` — history entries removed; redo re-creates them.

### Notes tab (phone)

- [ ] Textarea shows existing notes.
- [ ] Typing triggers debounced save after 1s of inactivity.
- [ ] Blurring the textarea commits immediately.
- [ ] Enter key inserts a newline (does NOT commit).
- [ ] Character count turns copper at limit; maxLength enforced.
- [ ] "Saved" chip flashes on commit and fades.
- [ ] Notes persist through full browser reload + reconnect.
- [ ] Switching to another tab and back preserves the current text.
- [ ] Two phones connected as same character: typing on one reflects on the other within one debounce cycle.

### Notes tab (controller)

- [ ] PlayerSheetQuickView shows Notes tab as read-only.
- [ ] Placeholder "No notes." shows when empty.
- [ ] No savedAt chip activity (read-only — no commits).

### History tab (phone)

- [ ] First open: backfill fires; entries from `party.scenarios` appear.
- [ ] Subsequent opens: no backfill command fires (check dev tools network or command log).
- [ ] Backfilled entries show dashed border + "Reconstructed" chip + no reward details.
- [ ] Complete a new scenario (victory) → new entry appears at the top (reverse-chronological), with XP / gold / battle goal rewards shown.
- [ ] Complete a scenario (defeat) → `scenarioFailed` entry at top, defeat chip, no battle goal row.
- [ ] Empty state renders cleanly when a character has no history (e.g. new character mid-campaign).
- [ ] Screen reader (VoiceOver quick check): heading announces, entries announce as list items with titles and rewards.

### Design quality (against brief)

- [ ] Notes textarea reads as parchment (aged tint, inset shadow, ink text).
- [ ] Focused textarea brightens to base parchment with class-accent border.
- [ ] History timeline has a subtle spine line running down the left.
- [ ] Entry markers (dots) feel tactile — ringed, slightly inset.
- [ ] Victory marker uses class-accent; defeat uses copper at reduced opacity.
- [ ] Reconstructed entries are distinguishable at a glance (dashed border, reduced opacity).
- [ ] Typography hierarchy clean: Cinzel for titles + metadata, Crimson Pro for body.

### Accessibility

- [ ] Notes textarea has visible label + `aria-label`.
- [ ] History entries use semantic `<ol>/<li>` with `<dl>` for rewards.
- [ ] Screen reader announces character count as it changes.
- [ ] Focus ring visible on textarea.
- [ ] Reduced-motion: no hover/focus transitions with motion; opacity/color only.
- [ ] Color contrast: parchment-ink on parchment-aged ≥ 7:1; class-accent on parchment-aged ≥ 4.5:1 (check per class).

### Regressions

- [ ] T0a Player Sheet Overview tab unchanged. XP bar, medallions, intro animation all fine.
- [ ] T0b Party Sheet unaffected.
- [ ] T0c Campaign Sheet unaffected.
- [ ] T1 rewards overlay fires correctly. Rewards show, pending → final → dismiss flow.
- [ ] T1.1 display dismissal works.
- [ ] Scenario play intact.
- [ ] Undo across scenario transitions correctly removes / restores history entries.
- [ ] GHS save import doesn't crash on missing `history` / `historyBackfilled` fields.

---

## Commit Message

```
feat(phase-t0d): Player Sheet Notes + History tabs — T0 arc complete

Closes Phase T0. Notes tab: editable per-character journal with
hybrid-commit autosave (1s debounce + immediate blur) using the
existing setCharacterProgress command (no new engine surface — T0a
whitelisted 'notes' preemptively). History tab: reverse-chronological
timeline of scenario events, seeded from state.party.scenarios on
first open via new backfillCharacterHistory command, live entries
appended by an explicit hook in handleCompleteScenario.

Engine:
- HistoryEntry discriminated union on CharacterProgress.history?.
  Variants: scenarioCompleted, scenarioFailed. Future batches extend
  (T2b levelUp / perkApplied, T2c characterRetired / characterCreated,
  T2d enhancementApplied).
- logHistoryEvent(char, entry) — engine-only mutator (no barrel
  export). All history mutation flows through this single site.
- handleCompleteScenario hook: logs per-character entry sourced from
  state.finishData snapshot (or live fallback). Skips absent
  characters.
- backfillCharacterHistory command — one-shot per character,
  engine-gated via historyBackfilled flag. Phone permission added.

Phone:
- NotesTab replaces NotesTabPlaceholder. 4000-char limit, "Saved"
  flash chip, readOnly support for controller quick-view.
- HistoryTab replaces HistoryTabPlaceholder. Timeline spine, marker
  dots, typed entry rows (scenarioCompleted / scenarioFailed /
  unknown fallback). Reconstructed-from-backfill entries styled
  distinctly (dashed border, "Reconstructed" chip).

Controller:
- PlayerSheetQuickView inherits both tabs read-only automatically.

Docs: DESIGN_DECISIONS (4 entries), ROADMAP (T0 closed), PROJECT_CONTEXT,
APP_MODE_ARCHITECTURE, COMMAND_PROTOCOL, TEST_BACKFILL updated.

Baseline: T0c complete. T0 trio + progression tabs closed. Next:
T2a rewrite against Player Sheet Items tab.
```

---

## Notes to Claude Code

1. **Produce a Plan first and wait for confirmation.** Flag the `HistoryEntry` type definition as the highest-risk decision — getting the union shape right now saves refactors in T2b/c/d.

2. **Study T0a/b/c patterns before writing:**
   - `app/shared/sheets/tabs/StandingTab.tsx` — the canonical editable-textarea reference. Your NotesTab mirrors this pattern.
   - `app/phone/sheets/tabs/OverviewTab.tsx` — how Player Sheet tabs are structured.
   - `packages/shared/src/engine/applyCommand.ts` around `handleCompleteScenario` — where the live hook goes.

3. **`CharacterProgress.notes` already exists.** Don't add it. Just read/write it via existing `setCharacterProgress` command. Likewise `'notes'` is already whitelisted in `SetCharacterProgressField`.

4. **`logHistoryEvent` is engine-only.** Do NOT export from `packages/shared/src/index.ts` barrel. If barrel exports spread across files, grep carefully to ensure nothing accidentally surfaces it.

5. **Backfill is lazy, client-driven, one-shot.** Do not put backfill logic inside `applyCommand` top-level paths or engine load hooks. Strictly: client fires `backfillCharacterHistory` on first History tab render; engine applies once; engine ignores subsequent calls. Keeps the engine agnostic of UI concerns.

6. **Defeat entries do NOT get battleGoalChecks.** Rules §11: no battle-goal rewards on defeat. TypeScript and the code should both enforce this. `HistoryEntryScenarioFailed` deliberately omits the field.

7. **Do not preempt future history variants.** If you're tempted to stub `levelUp` or `retired` types "for later" — stop. Those ship with T2b / T2c. The `HistoryEntry` union is open for extension but T0d only adds the two variants it needs. Add more when they have real code paths.

8. **Icons:** use existing `XPIcon` / `GoldIcon` from `app/components/Icons.tsx`. If a suitable battle-goal icon doesn't exist, log to `docs/ASSET_REQUESTS.md` and render the Unicode `◆` as a fallback (already in my sketch).

9. **Smoke test:** full round-trip after merge:
   - Open phone character sheet → History tab → confirm backfill fires once → entries appear.
   - Play a scenario to completion (victory) → return to town → open History → new entry at top with correct rewards.
   - Replay scenario (defeat) → new Failed entry.
   - Undo the defeat via controller Menu → Undo → History entry disappears.
   - Redo (let GM trigger completeScenario again) → entry reappears.
   - Reload full game → Notes persist, History persists, backfilled flag persists.

10. **When T0d lands, update `docs/ROADMAP.md`** to explicitly mark Phase T0 closed and note that T2a (Items) is next up for rewrite against the Player Sheet Items tab. Don't edit the original T2a prompt file — just note the retarget in the roadmap.
