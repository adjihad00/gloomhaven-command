# Phase T0c — Campaign Sheet (Claude Code Prompt)

## Context

Working in the `gloomhaven-command` repo. **Baseline: T0b complete** (commit `23ee75e`). Run `git pull` and confirm `app/shared/sheets/PartySheet.tsx`, `app/shared/hooks/useCommitOnPause.ts`, and `packages/shared/src/data/reputationPrice.ts` all exist. If T0b isn't landed, stop.

T0a built Player Sheet. T0b built Party Sheet and the shared-sheet pattern under `app/shared/sheets/`, the ControllerNav floating `⋯`, and the display's idle-mode handoff to Party Sheet. **T0c ships Campaign Sheet — the world's own record.** Third and final sheet in the trio.

The scope doc calls Campaign Sheet's Outpost tab "the richest single surface in the whole project." The Outpost tab is the primary design investment of this batch. Rest of the Campaign Sheet is structured-but-simpler views.

**Read before writing code:**

1. `CLAUDE.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/APP_MODE_ARCHITECTURE.md` (note: updated by T0b with sheet architecture details)
4. `docs/PHASE_T0_SCOPE.md` (Campaign Sheet section authoritative for scope)
5. `docs/PHASE_T0_DESIGN_BRIEF.md` (Campaign Sheet section authoritative for look — esp. wax-sealed headers, Outpost tab layout)
6. `docs/GAME_RULES_REFERENCE.md` — §Prosperity (GH + FH thresholds), §Campaign, §16 (added by T0b — reputation/prosperity interactions)
7. `docs/DESIGN_DECISIONS.md` — all T0a + T0b entries
8. `docs/BUGFIX_LOG.md` — esp. the 4 T0b self-review fixes (recency-biased lessons)
9. `app/CONVENTIONS.md`
10. `docs/ASSET_REQUESTS.md` — existing open asks

**Design skills** — read every `.md` file under each:

- `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
- `C:\Users\Kyle Diaz\.agents\skills\`

Priority: `app/CONVENTIONS.md` > `PHASE_T0_DESIGN_BRIEF.md` > UI/UX Pro Max > agent skills.

**Existing code to study first (these are the patterns you follow — do NOT reinvent):**

- `app/shared/sheets/PartySheet.tsx` (210 lines) — root modal, Context, focus trap, intro gating, autoCycle handling, layout prop. **Model CampaignSheet on this structure exactly.** Campaign Sheet is the third variant of the same pattern.
- `app/shared/sheets/PartySheetContext.ts` — Context shape. CampaignSheet gets its own context in the same shape.
- `app/shared/sheets/PartySheetTabs.tsx` — tab strip with ARIA arrow-key nav, landscape vs portrait layout, hidden-tab filtering. CampaignSheetTabs mirrors this.
- `app/shared/sheets/PartySheetIntro.tsx` (140 lines) — 3-second animation sequence with phases, skip handling, reduced-motion fallback. CampaignSheetIntro follows the same structure with different content.
- `app/shared/sheets/tabs/*` — one file per tab. ResourcesTab and RosterTab are the most intricate references.
- `app/shared/styles/sheets.css` (2369 lines total, Party Sheet section at L972+) — all styles live here. Append Campaign Sheet section at the end.
- `app/shared/hooks/useCommitOnPause.ts` (103 lines) — hybrid-commit hook. Reuse for every editable text field in Campaign Sheet.
- `app/controller/ControllerNav.tsx` + `app/controller/overlays/MenuOverlay.tsx` — where the "Campaign Sheet" entry goes.
- `app/controller/App.tsx` — where the overlay state + open/close lives. `onOpenPartySheet` is prop-drilled through ScenarioView. `onOpenCampaignSheet` drills the same way.
- `app/display/App.tsx` — currently mounts `DisplayPartySheetView` in idle lobby + town. Campaign Sheet needs to join the rotation (see Step 6 below).
- `packages/shared/src/engine/applyCommand.ts` — `handleUpdateCampaign` (line ~1810) is the generic scalar setter. Works for prosperity, donations, weeks, morale, etc. Array fields need structured commands (pattern from T0b `addPartyAchievement` / `removePartyAchievement`).

---

## Scope — T0c Only

**In scope:**

- New shared `CampaignSheet` component family under `app/shared/sheets/` (CampaignSheet, CampaignSheetContext, CampaignSheetHeader, CampaignSheetTabs, CampaignSheetIntro, plus tab files).
- 7 tabs: **Prosperity**, **Scenarios**, **Unlocks**, **Donations**, **Achievements**, **Outpost** (FH only), **Settings**.
  - Prosperity / Donations / Achievements / Settings: full implementation.
  - Scenarios: full list view. Flowchart/graph visualization is *simplified* (see Step 5c); full d3-powered graph deferred to T0c-follow-up or T5.
  - Unlocks: items / characters lists sourced from `state.party.unlockedItems` + `state.party.unlockedCharacters`.
  - Outpost (FH): static layout with building cards, calendar strip, resource pills. **No map-coordinate building placement this batch** — that requires either asset manifest lookups or custom position data that doesn't yet exist. The Outpost tab ships as a rich "dashboard" of outpost state that communicates the world at a glance. Full top-down outpost map lives later (likely T4 in display-specific form, or a T0c-polish follow-up).
- Controller entry: new menu item "Campaign Sheet" in `MenuOverlay`, wired to new `CampaignSheetOverlay`.
- Display decorative: Campaign Sheet joins the idle-state rotation. Display alternates between Party Sheet and Campaign Sheet during idle lobby + town, each sheet cycling its own tabs for 30s per tab before handing off to the other sheet after a full rotation.
- `Campaign` intro animation ("a map unfurling") with persisted `state.party.campaignSheetIntroSeen?: boolean`.
- New structured commands where needed for array fields:
  - `addGlobalAchievement` / `removeGlobalAchievement` (parallel to T0b's party achievement pattern).
- Scalar mutations continue to use `updateCampaign`: `prosperity`, `donations`, `weeks`, `inspiration`, `defense`, `soldiers`, `morale`, `trials`, `campaignSheetIntroSeen`.
- `getProsperityLevel(prosperity, edition)` helper — maps a raw prosperity score (checkbox count) to the current level. Ship now alongside reputation helper; centralized game math.
- CSS: append a **Campaign Sheet** section to `sheets.css` after the Party Sheet section. BEM prefix `campaign-sheet__*` and tab-prefixed variants.
- Wax-sealed tab headers — the Campaign Sheet's signature element, per design brief.

**Out of scope (explicit — do NOT try to sneak these in):**

- Full outpost map with building coordinates and rendered illustrations (partial Outpost tab covers the "state readout" need; full map is deferred).
- Scenario flowchart d3 graph (list view instead for this batch).
- GHS save import/export interactive wizard (Settings tab shows current edition + campaign mode; import/export gets a "Contact GM" stub for now, or ship as a future batch).
- Notes tab on Player Sheet (T0d).
- History tab on Player Sheet (T0d).
- Progression / Items / Personal Quest (T2a–d).
- Event system wiring (T6).
- Outpost phase flow (T3).
- World map scenario selector (T5).
- Building construct/upgrade commands (T3).
- Town Phase display orchestration (T8).

---

## Tab Layout

Final order (most consulted first):

1. **Prosperity** — current level + threshold progress + unlock reveals.
2. **Scenarios** — completed list with outcomes + metadata.
3. **Unlocks** — items, characters, treasures revealed.
4. **Donations** — running total + milestone markers.
5. **Achievements** — global achievements list.
6. **Outpost** (FH only) — calendar, buildings dashboard, resource pills, campaign stickers, trials.
7. **Settings** — edition (read-only), campaign mode (read-only), import/export placeholder.

FH detection: `state.edition === 'fh'` OR `state.party.edition === 'fh'`. Outpost tab hides on non-FH.

---

## Step 1 — Scope-level decisions locked in

Before any code, three decisions are locked:

1. **Campaign Sheet is SHARED** (same pattern as T0b) — lives in `app/shared/sheets/`, consumed by controller primary and display decorative.
2. **Display idle rotation** alternates Party Sheet ↔ Campaign Sheet. Implementation via a small wrapper component that manages which sheet renders. See Step 6.
3. **Wax-sealed tab headers** are this sheet's visual signature — the decorative element that distinguishes Campaign Sheet from Player/Party. Every tab content area opens with a wax-seal header at the top. Tab-specific icon in the seal's center (gears for Prosperity, scroll for Scenarios, treasure chest for Unlocks, coin stack for Donations, shield for Achievements, building for Outpost, settings gear for Settings).

---

## Step 2 — File layout

```
app/shared/sheets/
├── CampaignSheet.tsx
├── CampaignSheetContext.ts
├── CampaignSheetHeader.tsx
├── CampaignSheetTabs.tsx
├── CampaignSheetIntro.tsx
├── WaxSealHeader.tsx            (shared — reused by every CampaignSheet tab)
└── tabs/
    ├── ProsperityTab.tsx
    ├── ScenariosTab.tsx
    ├── UnlocksTab.tsx
    ├── DonationsTab.tsx
    ├── AchievementsTab.tsx
    ├── OutpostTab.tsx
    └── SettingsTab.tsx

app/controller/overlays/
└── CampaignSheetOverlay.tsx     (thin wrapper; mirrors PartySheetOverlay)

app/display/views/
└── DisplayIdleSheetsView.tsx    (NEW — replaces the raw DisplayPartySheetView
                                  mount; manages Party ↔ Campaign alternation)
```

`WaxSealHeader` goes under `app/shared/sheets/` (not tabs/) because it's a reusable component. Shared between all 7 Campaign tabs; single source for the seal motif.

---

## Step 3 — Engine & shared additions

### 3a. `state.party.campaignSheetIntroSeen` flag

In `packages/shared/src/types/gameState.ts`, `Party` interface:

```ts
/** Campaign Sheet intro animation shown flag (per campaign). */
campaignSheetIntroSeen?: boolean;
```

Optional, undefined = never shown, set once via `updateCampaign('campaignSheetIntroSeen', true)`.

Note: `Party.sheetIntroSeen` already exists from T0b for the Party Sheet intro. Don't conflate them — these are independent per-sheet flags.

### 3b. Structured commands for global achievements

Parallel to T0b's `addPartyAchievement` / `removePartyAchievement`:

In `packages/shared/src/types/commands.ts`:
```ts
| 'addGlobalAchievement'
| 'removeGlobalAchievement'

export interface AddGlobalAchievementCommand {
  action: 'addGlobalAchievement';
  payload: { achievement: string };
}

export interface RemoveGlobalAchievementCommand {
  action: 'removeGlobalAchievement';
  payload: { achievement: string };
}
```

Handlers in `applyCommand.ts` (mirroring T0b's party achievement handlers but targeting `state.party.globalAchievementsList`):

```ts
case 'addGlobalAchievement': {
  const ach = command.payload.achievement.trim();
  if (!ach) break;
  if (!after.party.globalAchievementsList) after.party.globalAchievementsList = [];
  if (!after.party.globalAchievementsList.includes(ach)) {
    after.party.globalAchievementsList.push(ach);
  }
  break;
}
case 'removeGlobalAchievement': {
  if (!after.party.globalAchievementsList) break;
  after.party.globalAchievementsList = after.party.globalAchievementsList.filter(
    a => a !== command.payload.achievement,
  );
  break;
}
```

Validation: reject empty; reject remove if absent. GM-only (not added to `PHONE_ALLOWED_ACTIONS`).

`useCommands` wrappers:
```ts
addGlobalAchievement: (achievement: string) =>
  send({ action: 'addGlobalAchievement', payload: { achievement } }),
removeGlobalAchievement: (achievement: string) =>
  send({ action: 'removeGlobalAchievement', payload: { achievement } }),
```

### 3c. `getProsperityLevel(prosperity, edition)` helper

Prosperity in GH/FH is a running count of "checkmarks" accrued during play. At certain thresholds the prosperity level increments, unlocking rewards (items, abilities, etc.).

**GH thresholds** (per rules): cumulative checkmarks needed to reach each level:
- Level 1: 0 (starting level)
- Level 2: 3
- Level 3: 8
- Level 4: 14
- Level 5: 21
- Level 6: 29
- Level 7: 38
- Level 8: 48
- Level 9: 59

**FH thresholds**: reach each level at total checkmarks:
- Level 1: 0
- Level 2: 5
- Level 3: 12
- Level 4: 21
- Level 5: 32
- Level 6: 45
- Level 7: 60
- Level 8: 77
- Level 9: 96

(Verify these numbers against `docs/GAME_RULES_REFERENCE.md` or the rulebook before committing. If §Prosperity isn't in the rules reference yet, add it. If Kyle's source data has a different table, the data wins — flag and align.)

File: `packages/shared/src/data/prosperityLevel.ts`

```ts
/**
 * Prosperity level thresholds — cumulative checkmark counts required
 * to reach each level. Index 0 = level 1 (starting level, 0 checks).
 * Source: docs/GAME_RULES_REFERENCE.md §Prosperity.
 */
export const PROSPERITY_THRESHOLDS_GH: readonly number[] = [0, 3, 8, 14, 21, 29, 38, 48, 59];
export const PROSPERITY_THRESHOLDS_FH: readonly number[] = [0, 5, 12, 21, 32, 45, 60, 77, 96];

function thresholdsFor(edition: string): readonly number[] {
  return edition === 'fh' ? PROSPERITY_THRESHOLDS_FH : PROSPERITY_THRESHOLDS_GH;
}

/**
 * Given a raw prosperity checkmark count, return the current prosperity level (1–9).
 */
export function getProsperityLevel(prosperity: number, edition: string): number {
  const thresholds = thresholdsFor(edition);
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (prosperity >= thresholds[i]) level = i + 1;
    else break;
  }
  return level;
}

/**
 * Progress toward the next prosperity level.
 * Returns { currentFloor, nextThreshold, level } — nextThreshold is null at max level.
 */
export function getProsperityProgress(prosperity: number, edition: string): {
  level: number;
  currentFloor: number;
  nextThreshold: number | null;
} {
  const thresholds = thresholdsFor(edition);
  const level = getProsperityLevel(prosperity, edition);
  const currentFloor = thresholds[level - 1];
  const nextThreshold = level < thresholds.length ? thresholds[level] : null;
  return { level, currentFloor, nextThreshold };
}
```

Export from `packages/shared/src/index.ts` barrel.

No test framework in the repo (confirmed by T0b backfill note). Ship verification via runtime spot checks in a dev script; log to `ASSET_REQUESTS.md`-style "Test Backfill Needed" list. Actually — add a new `docs/TEST_BACKFILL.md` if it doesn't exist; T0b's reputationPrice is already waiting there. T0c adds `getProsperityLevel` and `getProsperityProgress` to the same doc.

---

## Step 4 — `CampaignSheet` container

### 4a. CampaignSheetContext

`app/shared/sheets/CampaignSheetContext.ts`:

```ts
import { createContext } from 'preact';

/**
 * T0c: shared context for Campaign Sheet family.
 * Same shape as PartySheetContext. Duplicated rather than shared because
 * each sheet's context is logically distinct — keeps Context usage clear
 * at call sites.
 */
export interface CampaignSheetContextValue {
  readOnly: boolean;
  edition: string;
  onClose: () => void;
  /** Display mode cycles tabs automatically — disables manual tab interaction. */
  autoCycle: boolean;
}

export const CampaignSheetContext = createContext<CampaignSheetContextValue>({
  readOnly: false,
  edition: 'gh',
  onClose: () => {},
  autoCycle: false,
});
```

### 4b. CampaignSheet root

Structure parallels `PartySheet.tsx` line-by-line. Key props:

```ts
interface CampaignSheetProps {
  party: Party;
  edition: string;
  onClose: () => void;
  readOnly?: boolean;
  /** When true, tabs auto-cycle every 30 seconds (display decorative). */
  autoCycle?: boolean;
  /** Skip intro animation (display). */
  skipIntro?: boolean;
  /** Layout — landscape for controller, portrait for display. */
  layout?: 'landscape' | 'portrait';
}
```

Reuse patterns from `PartySheet.tsx`:
- Focus trap useEffect.
- Escape-to-close (only when `!autoCycle`).
- `data-class` not applicable here (Campaign Sheet has no single character). Root gets `data-edition` only.
- Surface uses `--sheet-campaign-bg` token (from T0a's theme.css).
- 30-second auto-cycle with page-turn animation using the keyframe `party-sheet-page-turn` defined in T0b (or promote it to `sheet-page-turn` in the CSS while here — prefer promotion for reuse clarity).
- Intro gating via `!party.campaignSheetIntroSeen && !skipIntro && !autoCycle && !readOnly`.

### 4c. CampaignSheetTabs

Parallels `PartySheetTabs.tsx`. Same ARIA contract (arrow-key nav, aria-orientation, tab IDs). The only difference from Party Sheet is the tab list. Consider **extracting a shared `SheetTabs` primitive** if the duplication from Party Sheet tabs exceeds ~70%. If that feels invasive, stay duplicated — duplication across only two sheet types is not yet abstraction-worthy; with three sheets (Player Sheet uses its own phone-optimized tabs), the pattern crystallizes later.

**Recommendation:** stay duplicated for T0c. Flag in `docs/DESIGN_DECISIONS.md` that after T0c lands with three tab implementations (Player horizontal, Party vertical/horizontal, Campaign vertical/horizontal), we revisit whether a shared `SheetTabs` primitive makes sense.

### 4d. CampaignSheetHeader

Top of the sheet. Structure:
- Close button `←` (hidden when `autoCycle`).
- Title: Campaign name / edition name. E.g., "Frosthaven: Year One" or "Gloomhaven: The Jaws Open Again". Use `state.party.name` as subtitle if set, else omit. Main title in Cinzel 600 at 28px, `--gilt-gold`. Editable in T0c: NO — campaign title is derived. Party name editing lives in Party Sheet.
- Subtitle: current prosperity level pill + week count pill (FH) + scenarios completed count.

Subtitle pills use `--gilt-gold` on `--leather-brown` chips with thin gilt border.

### 4e. CampaignSheetIntro — "map unfurling"

3-second sequence, same structure as T0a/b intros:

- **0–300ms:** Backdrop fades to opaque black.
- **300–900ms:** Rolled parchment scroll icon fades in center. Stylized SVG — a rolled scroll with wax seal on the end, in `--parchment-aged` with `--gilt-gold` accents.
- **900–1800ms:** Scroll unfurls horizontally. SVG animation: scroll ends slide outward, parchment body expands from a narrow strip to full width. Subtle "paper settling" easing at the end. (Implementation: two SVG elements with clip-path or transform scaling; the parchment "reveals" as the ends slide apart.)
- **1800–2300ms:** Campaign title fades in above the scroll, Cinzel 28px `--gilt-gold`.
- **2300–2800ms:** "The world turns." subtitle in Crimson Pro italic `--parchment-base`.
- **2800–3000ms:** Everything fades as Campaign Sheet fades in behind.

Skip hint at bottom: "Tap to skip" in small-caps Cinzel 10px at 50% opacity.

Persistence: `updateCampaign('campaignSheetIntroSeen', true)` via `requestedMarkSeen` ref pattern from T0b.

Reduced-motion: skip animation, still set flag.

---

## Step 5 — Tabs

### 5a. WaxSealHeader (shared primitive)

`app/shared/sheets/WaxSealHeader.tsx`:

The signature element, reused by every Campaign Sheet tab. Consistent visual language across all 7 tabs.

```ts
interface WaxSealHeaderProps {
  /** Tab title, e.g. "Prosperity" or "Outpost". */
  title: string;
  /** Icon rendered inside the wax seal. Pass an existing Icon component from `app/components/Icons.tsx` where available; else a custom SVG path. */
  icon: preact.VNode | string;
}
```

Layout:
- Fixed row at the top of each tab's content area.
- Left: wax-seal motif. SVG. Circular `--gilt-gold-shadow` (the wax impression color) with a raised-relief inner shape. Icon centered at ~22px inside the seal. Subtle embossed effect via inner shadow.
- Right of the seal: the tab title in Cinzel 600 at 22px, `--gilt-gold` color.
- Thin gilt rule spans the full width beneath the header, separating it from tab content.

Dimensions:
- Seal: 44px diameter
- Row: 64px tall with `--space-4` padding
- Margin-bottom: `--space-5` before tab content begins

CSS class `.campaign-sheet__wax-seal` + `.campaign-sheet__tab-title`.

Accessibility: the header element has `role="heading" aria-level="2"`. The seal is decorative (`aria-hidden="true"`).

**Wax seal SVG design:**
- 44×44 viewBox.
- Outer circle: `--gilt-gold-shadow` (wax impression color).
- Inner subtle circular shape (raised center): `--gilt-gold` at 85% opacity with slight inset shadow via filter.
- Icon: centered, ~22px, in `--parchment-base` (acts as the "negative space" of the stamp).

Keep the SVG reusable — icon is the only variable between tabs.

### 5b. ProsperityTab

**Layout:**

```
┌─────────────────────────────────────────────┐
│ [seal]  Prosperity                          │
├─────────────────────────────────────────────┤
│                                             │
│         Level 3                             │
│                                             │
│   ▓▓▓▓▓▓▓▓░░░░░░░░░░  (8 of 14)             │
│                                             │
│   ┌─────────────────────────────────┐       │
│   │ Unlocks progression             │       │
│   │                                 │       │
│   │  1 ✓  Beginner items            │       │
│   │  2 ✓  New items unlocked        │       │
│   │  3 ●  Currently here            │       │
│   │  4    6 checks to unlock        │       │
│   │  5    Unknown rewards           │       │
│   │  6–9  Locked                    │       │
│   └─────────────────────────────────┘       │
│                                             │
│   [+1 checkmark]  (GM action)               │
│                                             │
└─────────────────────────────────────────────┘
```

**Data:**
- `state.party.prosperity` — raw checkmark count.
- `getProsperityProgress(state.party.prosperity, state.edition)` — current level + thresholds.

**Structure:**
1. Current level: Cinzel 600 at 48px, `--gilt-gold`, centered.
2. Progress bar: parchment strip with gilt ink fill, same visual language as T0a XP bar but sheet-agnostic (use `--gilt-gold` instead of `--class-accent`). Shows `{currentProsperity - currentFloor} / {nextThreshold - currentFloor}` toward next level.
3. **Level list:** each prosperity level rendered as a row. States:
   - **Completed** (level < current): gilt checkmark, "Rewards revealed in-game" label — keeps spoilers minimal without revealing unbought content.
   - **Current** (level === current): gilt dot, highlighted with `--class-flair`-style accent (but since no class, use `--gilt-gold`), "You are here" label.
   - **Next** (level === current + 1): `{checksRemaining} checks to unlock`.
   - **Locked** (level > current + 1): dim row, "Locked".
4. **GM action** (controller only, `!readOnly`): "+1 checkmark" button that fires `updateCampaign('prosperity', state.party.prosperity + 1)`. Single button. Undo via existing `undoAction` — no special undo flow needed. Large button (44px min), `--gilt-gold` border, hover/focus states.
5. Crossing a level threshold triggers a level-up celebration animation: gilt flash on the current-level row, 400ms, with a subtle gold-particle burst using CSS (limit to 4-6 particles; nothing heavy).

Display (autoCycle): same layout, no GM button. Number change flash still fires on external state updates.

### 5c. ScenariosTab

List view. No graph / flowchart in T0c.

**Data:** `state.party.scenarios` (`ScenarioModel[]`) — completed scenarios with edition + index.

**Structure:**
- Total count chip at top-right of tab header: "12 Scenarios Completed"
- Scrollable list, most recent first (reverse-chronological). Each row:
  - Scenario number badge (large, gilt-on-leather circular pip)
  - Scenario name (from reference DB label lookup — `/api/ref/label/:edition/scenario.name.:id`)
  - Edition chip
  - Outcome icon (gilt wreath for victory — all `scenarios[]` entries are victories per engine logic)
  - Date indicator if available — `ScenarioModel` probably doesn't carry completion date (check type). If no date, skip.
- Filter chip row at top: All / Casual / Conclusions. Filters the list view — `state.party.casualScenarios`, `state.party.conclusions` are separate arrays; the filter toggles which source is shown.

Empty state: centered "No scenarios completed yet. Your first victory will be recorded here." with a simple scroll-and-quill SVG decoration.

No "add scenario" action — scenarios are added automatically by `completeScenario` on victory. GM has `updateCampaign` if they need to hack the list manually (not exposed in UI).

### 5d. UnlocksTab

Three sub-sections, collapsible:

1. **Items** (`state.party.unlockedItems: CountIdentifier[]`):
   - Rows with item name, edition chip, count pill ("×2" if multiple).
   - Total count chip in section header.
   - Search/filter input at top (client-side filter).

2. **Characters** (`state.party.unlockedCharacters: string[]`):
   - Rows with class icon (thumbnail from asset manifest) + class name.
   - Total count chip.

3. **Treasures** (`state.party.treasures: Identifier[]`):
   - Rows with treasure ID + edition.
   - Total count chip.

All three read-only in T0c. Interactive unlock via gameplay events — no in-sheet unlock button.

Empty states per section if list is empty: simple small italic text "No {items/characters/treasures} unlocked yet."

### 5e. DonationsTab

**Data:** `state.party.donations: number` — running total of gold donated.

**Structure:**

```
┌─────────────────────────────────────────────┐
│ [seal]  Donations                           │
├─────────────────────────────────────────────┤
│                                             │
│              127 gold                       │
│         donated to the sanctuary            │
│                                             │
│   ◉──◉──◉──◯──◯──◯──◯──◯──◯──◯             │
│   10  20  30  40  50  60  70  80  90 100    │
│                                             │
│   Next milestone: 40 gold (13 to go)       │
│                                             │
│   Most recent donation:                     │
│   • 20 gold at Sanctuary (week 4)           │
│                                             │
│   [+10g Donate]  (GM action)                │
│                                             │
└─────────────────────────────────────────────┘
```

**Milestone ticks:** every 10 gold is a filled/unfilled pip. Total pips displayed up to 100g initially; extend if donations exceed.

**Crossing a milestone:** pip fills with gilt flash animation + subtle gold shimmer.

**Donation history:** `state.party.donations` is just a running total — no history structure. Omit "Most recent donation" display unless the state carries more info.

**GM action:** "+10g Donate" button fires `updateCampaign('donations', donations + 10)`. Per rules, 10g donations convert to 2 bless cards at the Sanctuary in the scenario — but card conversion is scenario-time logic, not here. Donations tab is just the ledger.

### 5f. AchievementsTab

Global achievements (`state.party.globalAchievementsList`). Mirrors T0b's Standing tab achievements pattern — add input + list with remove.

- Add input at top: text field + "Add" button. Commits on submit via `addGlobalAchievement`.
- List of achievements below, most recent last. Each row: achievement text + `×` remove button (GM only).
- Empty state: "No global achievements yet. These track party-wide story milestones." centered.
- Use `useCommitOnPause` only if we want typing-pause auto-save on the input — **skip it here**: the input is transient (cleared on submit), hybrid-commit doesn't add value. Simple submit-on-Enter is enough.

Per-achievement delete: controller only (`!readOnly`).

### 5g. OutpostTab (FH only — centerpiece of T0c)

Hidden when `edition !== 'fh'`.

**This tab carries the most design weight of the batch.** Not a map — T0c ships the "dashboard" version. Full map comes later.

**Layout, top to bottom:**

```
┌──────────────────────────────────────────────┐
│ [seal]  Outpost                              │
├──────────────────────────────────────────────┤
│                                              │
│ [Calendar strip]                             │
│  ☀ Summer · Week 4 of 10                     │
│  ▓▓▓▓▓░░░░░  (advances to winter at week 10) │
│                                              │
│ ┌──────── Resource Pills ────────┐           │
│ │ Morale 5 │ Defense 3 │ Soldiers 2 │         │
│ │ Inspiration 1 │ Trials 0 │                 │
│ └─────────────────────────────────┘          │
│                                              │
│ Buildings                         [6 active] │
│ ┌─── Sanctuary · Level 2 · Active ─────┐    │
│ │ [icon]  Donations convert to bless.  │    │
│ └──────────────────────────────────────┘    │
│ ┌─── Craftsman · Level 1 · Damaged ────┐    │
│ │ [icon]  Crafts items.                │    │
│ └──────────────────────────────────────┘    │
│ ...                                          │
│                                              │
│ Campaign Stickers                [3 applied] │
│   • Hog-Stuck  • The Frozen Watch  • …       │
│                                              │
└──────────────────────────────────────────────┘
```

**Subsections:**

1. **Calendar strip** — top.
   - Season icon: ☀ for summer, ❄ for winter. Determined by `weeks` via: weeks 1–10 = summer, 11–20 = winter, repeating. (Confirm against rules — the "10 box → season change" rule from `docs/GAME_RULES_REFERENCE.md`.)
   - Week N of 10 (within the current season).
   - Progress bar — ink-fill parchment strip showing week progress within season.
   - Week-section cue: if `state.party.weekSections` has entries for the current or past weeks in the current season, show an in-line pip marking weeks with sections. Tap (controller only) to reveal the section numbers recorded for that week.

2. **Resource pills** — horizontal row (wrap on narrow widths).
   - Each pill: leather chip with gilt-gold numeral + small-caps label below.
   - Morale, Defense, Soldiers, Inspiration, Trials.
   - **Read-only here** — Resources tab on Party Sheet already handles mutations. (Explicitly avoid duplicating the mutation affordance — keeps each sheet's role clear.)

3. **Buildings** — vertical card list.
   - `state.party.buildings: BuildingModel[]` — `{ name, level, state }`.
   - Each card:
     - Top row: building name in Cinzel 500 · level chip · state chip (Active / Damaged / Wrecked / Building).
     - Icon: asset manifest lookup for `category='building'` (if available) or generic building silhouette SVG fallback. If no asset, log to ASSET_REQUESTS. Per conventions: don't fake it with a placeholder image, but a generic SVG silhouette (created inline) is OK because it's explicitly "we don't have art for this building yet" not "broken asset."
     - Brief description — from reference DB label lookup (`/api/ref/label/fh/building.{name}.description` or similar; grep labels table for available building label keys).
   - State colors:
     - Active: `--gilt-gold` border, normal
     - Damaged: `--accent-copper` border with "Damaged" chip in copper
     - Wrecked: dim with dust/fracture overlay, "Wrecked" chip in muted red
     - Building (under construction): animated shimmer border, "Building" chip
   - **Read-only in T0c.** Building operations / construction / damage application = T3.

4. **Campaign stickers** — `state.party.campaignStickers: string[]`.
   - Horizontal tag list, each sticker a pill.
   - Simple text-only rendering (no sticker images unless asset manifest has them).

5. **Trials** — single pill with count. (Already covered in resource pills above; don't duplicate.)

**Empty state:** if `buildings` is empty, show "No buildings constructed yet. Complete scenarios to unlock outpost buildings."

### 5h. SettingsTab

Read-mostly tab.

**Sections:**
1. **Campaign Identity:**
   - Edition: read-only chip with edition full name (Gloomhaven / Frosthaven / Jaws of the Lion / etc.)
   - Campaign Mode: read-only chip — Campaign / One-off / Casual, pulled from `state.party.campaignMode` (boolean) + other indicators. Display as "Campaign" vs "Casual" vs "One-off scenario".
   - Game Code: read-only. The gameCode from context.

2. **Save & Restore:**
   - "Export Campaign" button → opens `/api/export/{gameCode}` in new tab (matches `MenuOverlay`'s existing pattern). Provides a downloadable JSON of full game state.
   - "Import from GHS Save" — placeholder, stub, disabled with tooltip "Coming in a future update." No interactive import wizard in T0c.

3. **Campaign Info:**
   - Total scenarios played
   - Total weeks elapsed (FH only)
   - Total donations
   - Campaign age (based on first scenario completion date if recorded; otherwise omit)

Minimal. Not a features list — just reference info and the export pathway.

---

## Step 6 — Display decorative: alternate Party + Campaign Sheets

### 6a. The current state

`app/display/App.tsx` currently mounts `DisplayPartySheetView` whenever mode is `lobby` (no setupPhase) or `town`. The view takes full control.

### 6b. The target

A new `DisplayIdleSheetsView` component manages alternation:

- On mount, start with Party Sheet (chosen deterministically; don't randomize).
- Each sheet cycles through its own tabs at 30s per tab.
- After a full cycle (5 tabs on Party Sheet in FH, 4 on non-FH; 7 tabs on Campaign Sheet in FH, 6 on non-FH) — i.e., when the tab index wraps — switch to the other sheet.
- On sheet-switch: apply a brief fade transition (300ms) to hide the swap.

**Why full-cycle switch vs per-tab alternation:** per-tab would be visually choppy (tabs within a sheet have similar visual language; rapid switching between two sheets with different backgrounds/binding styles feels jumpy). Full-cycle gives each sheet a chance to breathe.

### 6c. Implementation sketch

`app/display/views/DisplayIdleSheetsView.tsx`:

```tsx
import { h } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { useGameState } from '../../hooks/useGameState';
import { PartySheet } from '../../shared/sheets/PartySheet';
import { CampaignSheet } from '../../shared/sheets/CampaignSheet';

interface Props {
  onOpenMenu: () => void;
}

type WhichSheet = 'party' | 'campaign';

export function DisplayIdleSheetsView({ onOpenMenu }: Props) {
  const { state } = useGameState();
  const [whichSheet, setWhichSheet] = useState<WhichSheet>('party');
  const [fading, setFading] = useState(false);

  // Each sheet signals when it completes a full tab cycle via onCycleComplete prop.
  // Display swaps at that point.
  const handleCycleComplete = () => {
    setFading(true);
    setTimeout(() => {
      setWhichSheet((curr) => (curr === 'party' ? 'campaign' : 'party'));
      setFading(false);
    }, 300);
  };

  if (!state) return null;

  return (
    <div
      class={`display-idle-sheets ${fading ? 'display-idle-sheets--fading' : ''}`}
      data-which={whichSheet}
    >
      {whichSheet === 'party' ? (
        <PartySheet
          party={state.party}
          characters={state.characters}
          edition={state.edition ?? 'gh'}
          onClose={() => {}}
          readOnly
          autoCycle
          skipIntro
          layout="portrait"
          onCycleComplete={handleCycleComplete}
        />
      ) : (
        <CampaignSheet
          party={state.party}
          edition={state.edition ?? 'gh'}
          onClose={() => {}}
          readOnly
          autoCycle
          skipIntro
          layout="portrait"
          onCycleComplete={handleCycleComplete}
        />
      )}

      {/* Corner tap-zone to open display menu — inherited from T0b */}
      <button
        class="display-idle-sheets__menu-zone"
        aria-label="Display menu"
        onClick={onOpenMenu}
      />
    </div>
  );
}
```

**Change required in PartySheet:** add optional `onCycleComplete?: () => void` prop. In the autoCycle useEffect, when the next-tab index wraps to 0 (meaning we just completed a full cycle of visible tabs), call `onCycleComplete?.()`. If no handler provided, just keep cycling internally (backward-compatible with T0b's existing usage).

**Mirror the same prop addition on CampaignSheet.**

### 6d. Update `app/display/App.tsx`

Replace `<DisplayPartySheetView onOpenMenu={handleOpenMenu} />` with `<DisplayIdleSheetsView onOpenMenu={handleOpenMenu} />` in both lobby (idle) and town branches.

`DisplayPartySheetView` stays importable for now — T0c doesn't delete it, just stops mounting it directly. Mark as deprecated in a JSDoc comment: "replaced by DisplayIdleSheetsView in T0c; retained for potential debug paths."

### 6e. Display menu corner

T0b's invisible 96×96 tap-zone in top-left already opens `DisplayConfigMenu`. Preserve that behavior in `DisplayIdleSheetsView` — wrap or inherit the same tap zone. See the existing implementation in `DisplayPartySheetView`; copy the pattern.

---

## Step 7 — Controller mount

### 7a. `CampaignSheetOverlay`

`app/controller/overlays/CampaignSheetOverlay.tsx`:

```tsx
import { h } from 'preact';
import { useGameState } from '../../hooks/useGameState';
import { CampaignSheet } from '../../shared/sheets/CampaignSheet';

interface CampaignSheetOverlayProps {
  onClose: () => void;
}

/**
 * T0c: controller-side Campaign Sheet overlay.
 * Thin wrapper around the shared CampaignSheet with readOnly=false and
 * controller-appropriate layout. Mirrors PartySheetOverlay's pattern.
 */
export function CampaignSheetOverlay({ onClose }: CampaignSheetOverlayProps) {
  const { state } = useGameState();
  if (!state) return null;
  return (
    <CampaignSheet
      party={state.party}
      edition={state.edition ?? state.party.edition ?? 'gh'}
      onClose={onClose}
      readOnly={false}
      autoCycle={false}
      layout="landscape"
    />
  );
}
```

### 7b. Wire into MenuOverlay + ControllerNav + App

- Add `onOpenCampaignSheet?: () => void` to `MenuOverlayProps`. Add a new menu item "Campaign Sheet" below Party Sheet (when the prop is present).
- `ControllerNav`: add `onOpenCampaignSheet` prop; drill to `MenuOverlay`.
- `App.tsx`: add `campaignSheetOpen` state + `openCampaignSheet`. Drill to `<ControllerNav>` and `<ScenarioView>` (for in-scenario menu). Mount `<CampaignSheetOverlay>` conditionally.
- `ScenarioView`: accept `onOpenCampaignSheet` prop. Pass to its inline `MenuOverlay` mount.

Structure mirrors T0b's PartySheet wiring — minimal new code.

---

## Step 8 — CSS

Append to `app/shared/styles/sheets.css` in a clearly labeled section:

```
/* ───────────────────────────────────────────────────────────────────
   T0c: Campaign Sheet
   The world's own record. Wax-sealed tab headers as signature
   (each tab content area opens with a circular wax-seal motif + title).
   Shares the leather-bound root aesthetic with Party Sheet, but uses
   darker --sheet-campaign-bg and amplified gilt emphasis.
   ─────────────────────────────────────────────────────────────────── */
```

Under this section, BEM classes prefixed:
- `campaign-sheet__*` (root, header, tab-strip)
- `campaign-sheet-tab__*` (individual tab containers)
- `campaign-sheet__wax-seal` (the reusable header primitive)
- Tab-specific: `prosperity-tab__*`, `scenarios-tab__*`, `unlocks-tab__*`, `donations-tab__*`, `achievements-tab__*`, `outpost-tab__*`, `settings-tab__*`

Also promote the page-turn keyframe from `party-sheet-page-turn` to `sheet-page-turn` so both Party and Campaign Sheets reuse it. Update Party Sheet CSS rules that reference the old name. This is a small rename but gets a one-line note in `DESIGN_DECISIONS.md`.

**Key styles:**

1. **Root:** `background: var(--sheet-campaign-bg)` — deeper leather gradient with cartographic feel.
2. **Wax-seal header:** 64px tall row, 44px seal + 22px Cinzel gilt title, thin gilt rule below.
3. **Prosperity level list:** parchment-inset card, each level row 44px tall, status pip + label + reward text. Current-level row has subtle gilt glow.
4. **Donations milestone pips:** row of 10 circular pips, filled pips have gilt fill with subtle inner-shadow embossing.
5. **Outpost calendar strip:** same ink-fill parchment pattern as Player Sheet XP bar, but with season icon inline.
6. **Building cards:** leather-inset cards with state-dependent borders (gilt / copper / muted red). Animated shimmer for "Building" state.

Stay consistent with T0b's Party Sheet patterns — the two sheets should feel like siblings, not strangers.

**Reduced-motion** wraps all new keyframe-based effects.

---

## Step 9 — Accessibility

Follow the patterns established by T0a/T0b:
- Modal: `role="dialog" aria-modal="true" aria-labelledby="campaign-sheet-title"`.
- Focus trap + Escape close (controller).
- Tab strip: `role="tablist"`, arrow-key navigation, `aria-orientation`, `aria-controls`.
- Wax-seal headers: `role="heading" aria-level="2"`; seal SVG is `aria-hidden="true"`.
- Prosperity "+1 checkmark" button: descriptive `aria-label="Add prosperity checkmark (current: 8 of 14 toward level 4)"`.
- Donations "+10g" button: descriptive `aria-label="Donate 10 gold (current total: 127)"`.
- Every editable text input has a visible label + `aria-label` if needed.
- Color contrast: gilt-gold on leather-brown-deep ≈ 6:1 ✓. Parchment ink on parchment-aged ≈ 8:1 ✓.
- Min 44×44 tap targets.

---

## Step 10 — Documentation

- **`docs/BUGFIX_LOG.md`** — any regressions surfaced during implementation.
- **`docs/DESIGN_DECISIONS.md`** — entries (as many as warranted):
  - "T0c: Campaign Sheet landed — third and final sheet in the T0 trio. Wax-sealed tab headers as visual signature. Outpost tab ships as dashboard (calendar / pills / building cards / stickers) rather than map — coordinate-based map deferred to T4 / T0c-follow-up once building-position data surfaces."
  - "T0c: Sheet tab CSS keyframe renamed `party-sheet-page-turn` → `sheet-page-turn` to share across all sheets; no functional change."
  - "T0c: Decision to stay with duplicated tab-strip components (Party vs Campaign) rather than extracting a shared primitive. After three sheet implementations (Player / Party / Campaign), revisit whether a `SheetTabs` primitive crystallizes."
  - "T0c: `getProsperityLevel` / `getProsperityProgress` added to `packages/shared/src/data/prosperityLevel.ts`. Parallels `reputationPrice` — both are game-rules math with fixed tables; no runtime variance."
  - "T0c: Display decorative mode now alternates Party Sheet ↔ Campaign Sheet during idle lobby/town. Full-cycle switch (at tab-index wrap) rather than per-tab interleave — chosen because per-tab interleave would feel choppy."
- **`docs/ROADMAP.md`** — mark T0c complete. Note outpost-map follow-up consideration.
- **`docs/PROJECT_CONTEXT.md`** — add commands, helpers, shared-sheet entries. Update Controller and Display descriptions.
- **`docs/APP_MODE_ARCHITECTURE.md`** — update the Controller and Display sections with Campaign Sheet reachability. Note the idle-sheet rotation pattern.
- **`docs/COMMAND_PROTOCOL.md`** — document `addGlobalAchievement`, `removeGlobalAchievement`.
- **`docs/GAME_RULES_REFERENCE.md`** — ensure §Prosperity has the threshold tables documented (add if not); reference `prosperityLevel.ts` as implementation.
- **`docs/ASSET_REQUESTS.md`** — log missing building icons, scenario map, edition logos, anything else that surfaced.
- **`docs/TEST_BACKFILL.md`** — create if not exists; list `reputationPrice`, `prosperityLevel`, `prosperityProgress` as needing tests when a test framework lands.

---

## Verification Checklist

### Build / static analysis

- [ ] `npm run build` clean across all three client bundles.
- [ ] `tsc --noEmit` clean everywhere.
- [ ] Bundle-size bump within reason (expect controller ~+15-20kB, display ~+10-15kB).
- [ ] No new cross-client imports that skip `app/shared/`.

### Engine

- [ ] `getProsperityLevel(0, 'gh')` === 1; `getProsperityLevel(59, 'gh')` === 9; `getProsperityLevel(100, 'gh')` === 9 (clamps at max).
- [ ] `getProsperityLevel(5, 'fh')` === 2; `getProsperityLevel(96, 'fh')` === 9.
- [ ] `addGlobalAchievement` deduplicates.
- [ ] `removeGlobalAchievement` rejects when absent.
- [ ] `updateCampaign('campaignSheetIntroSeen', true)` persists through GameStore save/reload.
- [ ] Phone cannot fire `addGlobalAchievement` / `removeGlobalAchievement` (rejected server-side).

### Controller Campaign Sheet

- [ ] Open from ControllerNav menu in Lobby. Intro plays first time, skips on reopen.
- [ ] Open from ControllerNav menu in Town.
- [ ] Open from ScenarioView menu in Scenario mode. Scenario state intact on close.
- [ ] Wax-seal header visible on every tab. Icon changes per tab.
- [ ] **Prosperity tab:** current level correct for the state's prosperity + edition. Level list shows completed / current / next / locked states. "+1 checkmark" button increments correctly. Crossing a threshold animates.
- [ ] **Scenarios tab:** completed scenarios listed, most recent first. Count chip matches.
- [ ] **Unlocks tab:** items / characters / treasures sections collapsed by default OR expandable; search filter works.
- [ ] **Donations tab:** total gold correct. Milestone pips reflect current progress. "+10g" button commits via updateCampaign. Crossing a milestone animates.
- [ ] **Achievements tab:** add/remove works. Hybrid-commit-style input OR simple submit-on-Enter works.
- [ ] **Outpost tab (FH):** calendar strip shows current week / season. Resource pills show correct values. Buildings cards render with state chips. Wrecked/damaged/active visual states distinguishable.
- [ ] **Outpost tab hidden on non-FH.**
- [ ] **Settings tab:** edition, campaign mode, game code all display correctly. Export button opens export URL. Import placeholder disabled.
- [ ] Close returns to previous mode cleanly.

### Display Campaign Sheet (idle rotation)

- [ ] In idle lobby, display starts on Party Sheet, cycles tabs every 30s, after full cycle fades to Campaign Sheet, cycles its tabs, fades back.
- [ ] In idle town, same rotation.
- [ ] In scenario mode, no idle sheet renders.
- [ ] Fade transition between sheet swaps is smooth (300ms).
- [ ] Corner tap-zone opens display menu regardless of which sheet is currently showing.
- [ ] Gilt candlelight flicker active on both sheets.
- [ ] Campaign Sheet intro animation does NOT play on display (skipIntro).

### Design quality

- [ ] Wax-seal headers distinguishable — different icon per tab, seal motif consistent.
- [ ] Darker leather surface visibly different from Party Sheet (`--sheet-campaign-bg` vs `--sheet-party-bg`).
- [ ] Prosperity level display feels weighty and celebratory at level transitions.
- [ ] Outpost tab building cards communicate state at a glance (color alone doesn't carry meaning — chip text is present for accessibility).
- [ ] Donations milestone pips feel tactile (embossed-filled vs empty).

### Accessibility

- [ ] VoiceOver reads sheet title, tab names, wax-seal header, interactive button labels.
- [ ] Arrow keys navigate tab strip.
- [ ] Focus trap works.
- [ ] Escape closes on controller.
- [ ] Reduced-motion disables intro + page-turn + gold flash + gilt flicker.

### Regressions

- [ ] T0a Player Sheet unchanged.
- [ ] T0b Party Sheet unchanged — opens from menu, all tabs work.
- [ ] T1 rewards overlay fires correctly.
- [ ] T1.1 display dismissal works.
- [ ] Scenario play fully intact.
- [ ] Party Sheet on display still cycles (now part of rotation, not exclusive).

---

## Commit Message

```
feat(phase-t0c): Campaign Sheet — the world's record

Ships the third and final sheet in the T0 trio. 7 tabs: Prosperity,
Scenarios, Unlocks, Donations, Achievements, Outpost (FH only), Settings.
Controller edits, display renders decoratively. Display idle mode now
alternates Party Sheet ↔ Campaign Sheet, each cycling its own tabs
at 30s before handoff.

Design signature:
- Wax-sealed tab headers — circular gilt seal with tab-specific icon at
  the top of every tab content area. Consistent motif across all 7 tabs.
- Darker `--sheet-campaign-bg` leather surface distinguishes from Party
  Sheet. Amplified gilt emphasis.
- Outpost tab centerpiece: calendar strip (season + week), resource
  pills, building cards with state chips (active/damaged/wrecked/building),
  campaign stickers.

Engine / protocol:
- getProsperityLevel / getProsperityProgress in shared/data; GH + FH
  threshold tables from rules reference. Consumed by Prosperity tab;
  T3 outpost will consume the same helpers.
- addGlobalAchievement / removeGlobalAchievement structured commands
  (parallels T0b's party achievement commands).
- Party.campaignSheetIntroSeen flag for one-time "map unfurling" intro.
- Page-turn keyframe renamed sheet-page-turn for cross-sheet reuse.

Controller:
- CampaignSheetOverlay wrapper (mirrors PartySheetOverlay).
- MenuOverlay gets "Campaign Sheet" entry below Party Sheet.
- ControllerNav + App.tsx drill onOpenCampaignSheet alongside
  onOpenPartySheet.

Display:
- DisplayIdleSheetsView manages Party/Campaign alternation with
  onCycleComplete hook on both sheets.
- Replaces direct DisplayPartySheetView mount in idle lobby + town.
- Menu corner zone preserved.

Deferred (documented):
- Outpost map with building-coordinate placement — Outpost tab ships
  dashboard form; map form likely T4 or T0c-polish.
- Scenario flowchart/graph — list view ships; graph form T5 or T0c-polish.
- GHS save import interactive wizard — export works; import placeholder.

Docs: DESIGN_DECISIONS (5 entries), ROADMAP, PROJECT_CONTEXT,
APP_MODE_ARCHITECTURE, COMMAND_PROTOCOL, GAME_RULES_REFERENCE,
ASSET_REQUESTS, TEST_BACKFILL updated.

Baseline: T0b complete. Part of Phase T0 (Sheets). T0 trio complete.
```

---

## Notes to Claude Code

1. **Produce a Plan first and wait for confirmation before editing files.** Plan should list every file you'll touch, in order, with one-line rationale. Flag the display rotation change as the riskiest piece; fallback option if complex: mount Campaign Sheet exclusively on display (skip alternation), still ship controller side cleanly, add alternation in a follow-up.

2. **Study T0b's sibling patterns before writing anything:**
   - `app/shared/sheets/PartySheet.tsx` (model for CampaignSheet.tsx)
   - `app/shared/sheets/PartySheetIntro.tsx` (model for CampaignSheetIntro)
   - `app/shared/sheets/tabs/StandingTab.tsx` (model for tabs with editable fields)
   - `app/shared/sheets/tabs/ResourcesTab.tsx` (model for tabs with pills/gauges — informs Outpost tab layout)
   - `app/controller/overlays/PartySheetOverlay.tsx` (model for CampaignSheetOverlay)
   - `app/display/views/DisplayPartySheetView.tsx` (model for transitioning to DisplayIdleSheetsView)

3. **Do NOT create new CSS files.** Append to `app/shared/styles/sheets.css` with a clearly labeled section.

4. **Wax-sealed headers are the signature.** Don't phone this in — the visual distinction between the three sheets is important to the whole T0 arc. Player = illuminated capital, Party = gilt-bound tab strip, Campaign = wax-sealed tab headers.

5. **Outpost tab is a dashboard, not a map.** If the implementation starts drifting toward full map rendering (building coordinates, spatial layout), stop and defer — we scoped map to a follow-up batch. Ship dashboard + defer map rather than half-map.

6. **Prosperity thresholds MUST match rules reference.** If the rules doc doesn't have the prosperity threshold table yet, add it to `docs/GAME_RULES_REFERENCE.md §Prosperity` while implementing. Cross-reference GHS source data if available (`state.edition` data files may carry the table).

7. **Display idle rotation** — the trickiest infrastructure piece. `onCycleComplete` callback pattern on both PartySheet and CampaignSheet must be backward-compatible (optional prop). Existing T0b usage without the prop should continue to cycle internally without invoking any callback.

8. **Do not preempt T0d / T2 / T3 / T4 / T5 / T6 / T8.** Any tab action that would belong to those batches is out of scope:
   - No Notes interaction (T0d).
   - No Items / Progression / Personal Quest (T2).
   - No scenario selection / launch (T5).
   - No event draw or resolve (T6).
   - No outpost phase flow (T3).
   - No building operations (T3).
   - No town phase orchestration (T8).

9. **Test backfill doc:** create `docs/TEST_BACKFILL.md` if T0b didn't create it yet (it was deferred). Add reputationPrice + both prosperity helpers to the list.

10. **Smoke test after merge:** open each tab in Campaign Sheet on controller in every mode (lobby, scenario, town), FH and GH editions. Verify display alternation cycles through a full rotation. Confirm Party Sheet unchanged.
