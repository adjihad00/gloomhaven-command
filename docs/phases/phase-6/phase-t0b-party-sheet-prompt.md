# Phase T0b — Party Sheet (Claude Code Prompt)

## Context

You are working in the `gloomhaven-command` repo. **Baseline: T0a complete** (commits `9d3db1c` and `6d5570d`). Run `git pull` and confirm `app/phone/sheets/PlayerSheet.tsx` and `app/shared/styles/sheets.css` exist before starting. If T0a isn't landed, stop.

T0a established the sheet design system — parchment/leather/gilt tokens, class-accent inline CSS vars, PlayerSheetContext pattern for readOnly, compound components, BEM in `app/shared/styles/sheets.css`. **T0b mirrors that pattern for the Party Sheet.** Don't invent new patterns where T0a has one.

**Read before writing code:**

1. `CLAUDE.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/APP_MODE_ARCHITECTURE.md`
4. `docs/PHASE_T0_SCOPE.md` (Party Sheet section is authoritative for scope)
5. `docs/PHASE_T0_DESIGN_BRIEF.md` (Party Sheet section is authoritative for look)
6. `docs/GAME_RULES_REFERENCE.md` — §Reputation, §Campaign (for reputation price modifier brackets and party-level stats)
7. `docs/DESIGN_DECISIONS.md` (including T0a's entry)
8. `app/CONVENTIONS.md`

**Design skills** — read every `.md` file under each:

- `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
- `C:\Users\Kyle Diaz\.agents\skills\`

Priority: `app/CONVENTIONS.md` > `PHASE_T0_DESIGN_BRIEF.md` > UI/UX Pro Max > agent skills.

**Existing code to study first (these are the patterns you follow):**

- `app/phone/sheets/PlayerSheet.tsx` — compound-components pattern, Context for readOnly/edition/onClose, inline class-accent vars via `themeStyle` useMemo, modal focus trap, Escape/Tab handlers. **Model PartySheet on this structure exactly.**
- `app/phone/sheets/PlayerSheetContext.ts` — tiny shared context; T0b adds a `PartySheetContext` in the same shape.
- `app/phone/sheets/tabs/*` — compound subcomponents pattern. Each Party Sheet tab = one file.
- `app/shared/styles/sheets.css` (969 lines) — the CSS lives here, not in phone-specific styles. T0b extends this file; don't create a new one.
- `app/shared/styles/theme.css` — all tokens (parchment/leather/gilt) already defined by T0a.
- `app/shared/characterThemes.ts` — already shared, used for character portrait accents.
- `app/controller/overlays/PlayerSheetQuickView.tsx` — the pattern for "controller imports the phone/shared sheet directly, wires controller-side commands." **The Party Sheet on controller follows this.**
- `app/controller/overlays/MenuOverlay.tsx` — the 57-line menu currently only reachable from `ScenarioView`. T0b promotes it (see Step 1).
- `app/controller/ScenarioView.tsx` around line 188 — current MenuOverlay mount pattern.

---

## Scope — T0b Only

**In scope:**

- New `PartySheet` component at `app/shared/sheets/PartySheet.tsx` — shared between controller primary + display decorative.
- Controller mount: reachable from a persistent entry in every controller mode (Lobby / Scenario / Town). Requires promoting `MenuOverlay` so it exists outside `ScenarioView`.
- Display mount: decorative read-only cycling view when no other phase owns the display.
- 5 tabs: **Roster**, **Standing**, **Location**, **Resources** (FH only), **Events**.
  - Roster / Standing / Events: full implementation.
  - Location: functional text editing + current location display; world map (T5) drops in later as an enhancement.
  - Resources: FH gauges (morale, defense, soldiers, inspiration, trials, shared loot pool) — fully implemented as read/write.
- `getReputationPriceModifier(reputation)` helper at `packages/shared/src/data/reputationPrice.ts` — ship now because Party Sheet's Standing tab displays the modifier. T2a will consume the same helper. Include tests.
- New structured commands for array-field mutations that `updateCampaign` can't handle cleanly: `addPartyAchievement`, `removePartyAchievement`. Scalar fields (name, location, notes, reputation, donations) continue to use `updateCampaign`.
- Controller-side edit-mode for Party Sheet tabs. Editable text fields use the **hybrid commit pattern** from T0a decisions: commit on blur or Enter, plus auto-save at 1000ms typing pause.
- Party Sheet first-open intro animation ("a leather book opening") — parallel to PlayerSheetIntro's "your story begins". Persist via new party-scoped flag `state.party.sheetIntroSeen?: boolean`.
- Display tab-cycling: 30 seconds per tab (per Kyle's design decision), with page-turn transition between tabs. Skip Resources tab cycling in GH-like editions (tab hidden there).
- Extend `sheets.css` with Party Sheet BEM classes — use the `.party-sheet__*` prefix.
- Add new design tokens if needed (gilt rule for tab-binding effect, page-turn keyframe animations) to `theme.css`.

**Out of scope (explicit — do NOT try to sneak these in):**

- Campaign Sheet (T0c)
- Notes/History on Player Sheet (T0d)
- Items / Progression / Personal Quest content (T2a/b/c/d)
- World map scenario picker inside Location tab (T5 — just text editing + current-location display for now)
- Event draw / resolve flows inside Events tab (T6 — T0b shows *historical and active event cards as read-only list*, not the draw mechanism)
- Phone Party Sheet (there is none — phones get a mini party-pill on their Player Sheet Overview eventually; not this batch)
- Building/outpost details (those are Campaign Sheet's Outpost tab, T0c)

---

## Tab Layout — Final per T0 Scope

Order matters (most-consulted first):

1. **Roster** — grid of character portraits, active + retired archive.
2. **Standing** — editable name, reputation, price-modifier chip, party notes, party achievements.
3. **Location** — current location text (edit), travel history.
4. **Resources** (FH only) — morale/defense/soldiers/inspiration/trials gauges, shared loot pool.
5. **Events** — active cards, historical resolved cards.

FH detection: `state.edition === 'fh'`. Resources tab hides on GH/jotl/cs/fc/toa.

---

## Step 0 — Decision: file location

`PartySheet.tsx` goes in `app/shared/sheets/` (new directory). **Not** `app/phone/sheets/`. Rationale: Party Sheet is consumed by controller primary and display decorative. Co-locating it with the player sheet under `app/phone/` would mislead — and T0a's `PlayerSheetQuickView` already sets the precedent for cross-client sheet consumption via direct import.

Create `app/shared/sheets/` and place:
```
app/shared/sheets/
├── PartySheet.tsx
├── PartySheetContext.ts
├── PartySheetHeader.tsx
├── PartySheetTabs.tsx
├── PartySheetIntro.tsx
└── tabs/
    ├── RosterTab.tsx
    ├── StandingTab.tsx
    ├── LocationTab.tsx
    ├── ResourcesTab.tsx
    └── EventsTab.tsx
```

When T0c arrives, `CampaignSheet.tsx` and siblings land here too.

Update `app/CONVENTIONS.md` noting that `app/shared/sheets/` is the canonical home for multi-client sheet components.

---

## Step 1 — Promote `MenuOverlay` so it's reachable everywhere

Today `MenuOverlay` is instantiated only inside `ScenarioView`. Party/Campaign Sheet need to be reachable from Lobby and Town too. Two options considered:

**Option A (preferred):** Promote `MenuOverlay` into a controller-level persistent nav component (a small floating `⋯` button in the top-right corner of every controller view, opening the same menu).

**Option B:** Add "Party" and "Campaign" buttons directly to each view's header (Lobby / Scenario / Town).

Go with **A**. Rationale: keeps the menu's existing structure intact, only changes where it mounts from, and gives a future Campaign Sheet / Settings / etc. one canonical home.

### 1a. Create `app/controller/ControllerNav.tsx`

Small component rendered by the controller's app root (`app/controller/App.tsx` or wherever the mode router lives — grep to find). Renders a fixed-position `⋯` button in the top-right (z-index below modals). On click, opens `MenuOverlay`. Mode-aware: passes `hasScenario` etc. based on current `state.mode`.

```tsx
interface ControllerNavProps {
  gameCode: string;
  onDisconnect: () => void;
  onOpenScenarioSetup: () => void;
  onScenarioEnd?: (outcome: 'victory' | 'defeat') => void;
  onOpenPartySheet: () => void;
  // Placeholder hook for T0c — in T0b, pass undefined
  onOpenCampaignSheet?: () => void;
}
```

### 1b. Extend `MenuOverlay`

Add two items to the menu:
- **Party Sheet** — calls `onOpenPartySheet` (always visible, regardless of scenario).
- **Campaign Sheet** (T0c) — add as a disabled item with label "Campaign Sheet · Coming T0c" so the nav structure is final. Alternatively omit and add in T0c. Prefer: **omit in T0b**, add in T0c when it's functional.

`Scenario Setup` and `Scenario End` items stay scenario-only (gate via `hasScenario`).

### 1c. Rewire ScenarioView / LobbyView / TownView

- `ScenarioView.tsx`: remove its local `MenuOverlay` mount; the root-level `ControllerNav` replaces it. But: ScenarioView currently opens MenuOverlay from its own `activeOverlay` state. Removing that state machine needs care. Safer approach: keep the local menu button in ScenarioView's header (for reachability from gameplay), but also add `ControllerNav` globally. Two entry points, same MenuOverlay component. This avoids breaking ScenarioView's internal flows (ScenarioEnd, ScenarioSetup open from the same menu).

- `LobbyView.tsx` and `TownView.tsx`: get access to the menu via `ControllerNav` only. They don't need local menu buttons.

If during implementation this turns out more invasive than it sounds, stop and flag — menu promotion is infrastructure for T0b but shouldn't balloon the scope. Smaller alternative: add just the Party Sheet entry points directly via a small floating button in each view, defer the full menu promotion to a later batch. Either path is acceptable; prefer the clean one (A) unless it becomes noisy.

---

## Step 2 — Engine & shared additions

### 2a. `state.party.sheetIntroSeen` flag

In `packages/shared/src/types/gameState.ts`, `Party` interface, add:
```ts
/** Party Sheet intro animation shown flag (per campaign). */
sheetIntroSeen?: boolean;
```

No migration needed — optional, defaults to `undefined`, treated as "not seen" by client.

### 2b. Structured commands for array fields

`updateCampaign` scalar fields covered today:
- `name`, `location`, `notes`, `reputation`, `prosperity`, `donations`, `morale`, `defense`, `soldiers`, `inspiration`, `trials`, `sheetIntroSeen` (new)

`updateCampaign` cannot cleanly handle arrays because it's a blanket setter (it would replace the whole array, losing ordering / duplicates in undo). For achievements and related arrays, add structured commands.

In `packages/shared/src/types/commands.ts`:
```ts
| 'addPartyAchievement'
| 'removePartyAchievement'

export interface AddPartyAchievementCommand {
  action: 'addPartyAchievement';
  payload: { achievement: string };
}

export interface RemovePartyAchievementCommand {
  action: 'removePartyAchievement';
  payload: { achievement: string };
}
```

Both go into the `Command` union.

**Handler** in `applyCommand.ts`:
```ts
case 'addPartyAchievement': {
  const ach = command.payload.achievement.trim();
  if (!ach) break;
  if (!after.party.achievementsList) after.party.achievementsList = [];
  if (!after.party.achievementsList.includes(ach)) {
    after.party.achievementsList.push(ach);
  }
  break;
}
case 'removePartyAchievement': {
  if (!after.party.achievementsList) break;
  after.party.achievementsList = after.party.achievementsList.filter(
    a => a !== command.payload.achievement,
  );
  break;
}
```

**Validation:** reject empty achievement strings; reject removal when the achievement isn't in the list.

**Phone permissions:** do NOT add these to `PHONE_ALLOWED_ACTIONS`. Party management is GM-only.

**useCommands wrappers** in `app/hooks/useCommands.ts`:
```ts
addPartyAchievement: (achievement: string) =>
  send({ action: 'addPartyAchievement', payload: { achievement } }),
removePartyAchievement: (achievement: string) =>
  send({ action: 'removePartyAchievement', payload: { achievement } }),
```

### 2c. `getReputationPriceModifier(reputation)` helper

Per `docs/GAME_RULES_REFERENCE.md` brackets:

- Reputation ≥ +19: −5g per item
- ≥ +15: −4g
- ≥ +11: −3g
- ≥ +7: −2g
- ≥ +3: −1g
- Between −2 and +2: 0g
- ≤ −3 through −6: +1g
- ≤ −7 through −10: +2g
- ≤ −11 through −14: +3g
- ≤ −15 through −18: +4g
- ≤ −19: +5g

Modifier is applied to the **item price**, not capped here — the floor-at-0 rule belongs to the purchase logic (T2a). This helper returns an integer in the range `[-5, +5]`.

File: `packages/shared/src/data/reputationPrice.ts`:

```ts
/**
 * Per-item gold price modifier from party reputation.
 * Positive reputation → price discount (negative modifier on cost).
 * Negative reputation → price increase.
 * Returns integer in [-5, +5]. Price floor is caller's responsibility.
 * Source: GAME_RULES_REFERENCE.md §Reputation.
 */
export function getReputationPriceModifier(reputation: number): number {
  if (reputation >= 19) return -5;
  if (reputation >= 15) return -4;
  if (reputation >= 11) return -3;
  if (reputation >= 7) return -2;
  if (reputation >= 3) return -1;
  if (reputation >= -2) return 0;
  if (reputation >= -6) return 1;
  if (reputation >= -10) return 2;
  if (reputation >= -14) return 3;
  if (reputation >= -18) return 4;
  return 5;
}
```

Tests at `packages/shared/src/data/__tests__/reputationPrice.test.ts`:
```ts
// Bracket edges
expect(getReputationPriceModifier(19)).toBe(-5);
expect(getReputationPriceModifier(18)).toBe(-4);
expect(getReputationPriceModifier(0)).toBe(0);
expect(getReputationPriceModifier(-2)).toBe(0);
expect(getReputationPriceModifier(-3)).toBe(1);
expect(getReputationPriceModifier(-19)).toBe(5);
// Out-of-range clamping
expect(getReputationPriceModifier(100)).toBe(-5);
expect(getReputationPriceModifier(-100)).toBe(5);
```

Verify the test runner setup by grepping existing `*.test.ts` files in packages/shared; use whatever framework they already use.

Export from `packages/shared/src/index.ts` barrel.

---

## Step 3 — `PartySheet` container (shared component)

### 3a. PartySheetContext

`app/shared/sheets/PartySheetContext.ts`:

```ts
import { createContext } from 'preact';

/**
 * T0b: shared context for Party Sheet family.
 *
 * Consumed by header/tabs/rows to gate editability and route close.
 * Controller sets `readOnly: false` for full editing; display sets
 * `readOnly: true` for decorative mode.
 */
export interface PartySheetContextValue {
  readOnly: boolean;
  edition: string;
  onClose: () => void;
  /** Display mode cycles tabs automatically — disables manual tab interaction. */
  autoCycle: boolean;
}

export const PartySheetContext = createContext<PartySheetContextValue>({
  readOnly: false,
  edition: 'gh',
  onClose: () => {},
  autoCycle: false,
});
```

### 3b. PartySheet root component

`app/shared/sheets/PartySheet.tsx`:

```ts
interface PartySheetProps {
  party: Party;
  characters: Character[];
  edition: string;
  onClose: () => void;
  readOnly?: boolean;
  /** When true (display mode), tabs auto-cycle every 30 seconds. */
  autoCycle?: boolean;
  /** Display skips the intro animation (decorative render is ambient). */
  skipIntro?: boolean;
}
```

Structure parallels `PlayerSheet.tsx`:

- Class accent NOT used here (Party Sheet has no single character color). Instead, use `--gilt-gold` + `--accent-gold` for accents. Keep `data-edition` attribute on root so `data-edition="fh"` can style differently if needed.
- Root class `party-sheet`, `data-edition={edition}`, `data-mode` (current `state.mode`), `style` with `--sheet-surface: var(--sheet-party-bg)`.
- Focus trap identical to PlayerSheet's (copy the useEffect hooks).
- Escape-to-close.
- Intro animation runs on first open per campaign (when `!party.sheetIntroSeen && !autoCycle && !skipIntro`), fires `updateCampaign('sheetIntroSeen', true)` on complete/skip.
- Auto-cycle (display mode): useEffect with setInterval advances `activeTab` every 30 seconds, skipping hidden tabs (Resources on non-FH). Pause cycle while a transition is in flight to avoid stutter.

Tab layout: **vertical tab strip on the left** for controller (iPad landscape), per design brief. On display portrait (1080×1920), tab strip moves to top (horizontal) — use CSS container queries or a simple media query on the root's aspect ratio. Practical detection: add a `layout` prop (`'landscape'` | `'portrait'`) defaulting to landscape; display passes `'portrait'`.

### 3c. Gilt-bound tab signature

Per design brief, the Party Sheet's signature element is the gilt metallic rule running along the right edge of the tab strip, continuous full-height. Active tab breaks the rule at its row (creating the "brass-reinforced binding" impression).

Implementation: vertical tab strip has a `::after` pseudo-element that's a 1px gilt-gold vertical rule spanning full height. Active tab uses `::before` pseudo-element that covers the rule at its row with the content panel's background color, creating a break. Looks like the tab "bites into" the binding.

```css
.party-sheet__tab-strip {
  position: relative;
  /* other styling */
}
.party-sheet__tab-strip::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  right: 0;
  width: 1px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--gilt-gold) 12%,
    var(--gilt-gold) 88%,
    transparent 100%
  );
  pointer-events: none;
}
.party-sheet__tab--active {
  position: relative;
}
.party-sheet__tab--active::before {
  content: '';
  position: absolute;
  top: 8px; bottom: 8px;
  right: -1px;
  width: 3px;
  background: var(--sheet-content-bg, var(--leather-brown));
  z-index: 1;
}
```

Subtle effect, adds physicality. Reference in code comments points to this block.

### 3d. PartySheetTabs component

`app/shared/sheets/PartySheetTabs.tsx`:

- Props: `activeTab`, `onChange`, `layout` ('landscape' | 'portrait'), `hideTabs?: string[]` (for Resources on non-FH).
- Renders each tab as a button with label (Cinzel small-caps, Crimson Pro if label needs body weight).
- Active state per tab uses the gilt-binding break described in 3c.
- ARIA: `role="tablist"`, arrow key navigation (Up/Down for vertical, Left/Right for horizontal), Home/End jumps. `aria-orientation="vertical"` or `"horizontal"` per layout.
- `aria-controls={'party-sheet-panel-' + id}`, tabs identified via `id={'party-sheet-tab-' + id}`.

### 3e. PartySheetHeader

Top of the sheet, above tabs. Structure:
- Close button `←` (hidden when `autoCycle` — display doesn't need to close).
- Title: party name in Cinzel 600 at 28px. If no party name set, show "Unnamed Party" in `--parchment-ink-dim`.
- Subtitle: party's edition + scenarios completed count + current level chip.
- Optional: subtle embossed party achievement count pill on the right side.

Header pinned; tab content scrolls below.

### 3f. PartySheetIntro — "leather book opening"

Parallel to PlayerSheetIntro's "your story begins". 3-second sequence:

- 0–300ms: Backdrop fades to opaque black.
- 300–900ms: A closed leather-bound book icon fades in center (stylized SVG — a leather-spine-and-cover silhouette in `--leather-brown-deep` with gilt-gold flourishes on the spine and a `--gilt-gold` title plate).
- 900–1600ms: Book "opens" — animated 3D transform simulating a cover lift. Either: (a) SVG morph where the cover path animates from closed to open position via `path d=` interpolation; or (b) two-layered SVG where the cover is a separate element that rotates on Y-axis with `transform-origin: left center` and a parallel inside-page fades in. **Prefer (b)** — simpler and more robust.
- 1600–2200ms: Party name fades in above the open book, Cinzel 28px, `--gilt-gold`.
- 2200–2800ms: "Your campaign begins…" subtitle in Crimson Pro italic, `--parchment-base`.
- 2800–3000ms: Everything fades as the Party Sheet fades in behind.

Skip hint text at bottom: "Tap to skip" in small-caps Cinzel 10px at 50% opacity.

Persists via `updateCampaign('sheetIntroSeen', true)` — simple, fits the existing command. `requestedMarkSeen` ref prevents duplicate commands on double-tap.

Respects `prefers-reduced-motion` (skip immediately, still set the flag).

---

## Step 4 — Tabs

### 4a. RosterTab

Full-height scrollable content. Two sections:

**Active Characters** (top section):
- Grid of portrait cards (portrait thumbnail + class-accent border using each char's own theme color).
- Each card: character portrait (use `characterThumbnail` from `app/shared/assets.ts`), title, class name, level badge, HP max pill, retirement count pill.
- Tap card on controller → opens `PlayerSheetQuickView` for that character (reusing T0a's component).
- No tap action on display (autoCycle + readOnly).
- "Add Character" card at the end of grid (GM action). Opens the existing character-add flow — grep `addCharacter` command callsites to find the existing UI wizard, then reuse. If no existing wizard exists outside lobby setup, a simple inline prompt works: class picker + initial level pick, fires `addCharacter` command. **Keep this minimal — the character creation UI itself is a separate concern.**

**Retired Archive** (bottom section, collapsible, default collapsed):
- `state.party.retirements` is the list.
- Compact rows (smaller than active cards) showing name/title/edition.
- Read-only — retired characters aren't editable from here.

Empty state (no active characters): centered illustration + text "No heroes. Add a character to begin." with a prominent Add button. Keep illustration minimal — just a silhouette SVG of a cloaked figure.

### 4b. StandingTab

Key editable fields, hybrid-commit (blur/Enter commits + 1000ms typing-pause auto-save).

**Structure:**

1. **Party Name** — editable single-line text. Label "Party Name" in small-caps Cinzel; input in Crimson Pro 20px. Edit via `updateCampaign('name', value)`. On blur/Enter/1000ms: commit. Visual: parchment-inset panel with ink text when not focused; on focus gets `--gilt-gold` border and slight lightening.

2. **Reputation** — custom slider. Parchment strip with tick marks at −20, −10, 0, +10, +20. Draggable `--gilt-gold` gem shows current value. Commits on drag end via `updateCampaign('reputation', value)`. Range: −20 to +20.

   **Below the slider:** the live price modifier display. Structure:
   ```
   Shop Price Modifier: [−2g per item]   (calculated from getReputationPriceModifier)
   ```
   Modifier shown as a chip in `--gilt-gold` on `--parchment-aged` background. Updates live as the slider drags; commits only on drag end.

3. **Party Notes** — multiline textarea. 6 rows, grows to fit content. Same hybrid-commit. `updateCampaign('notes', value)`.

4. **Party Achievements** — list view with add/remove. `state.party.achievementsList`.
   - Each entry: row with achievement text in Crimson Pro, small `×` delete button on right.
   - At the bottom: "Add achievement…" input + add button. Submits via `addPartyAchievement(text)`.
   - Delete fires `removePartyAchievement(text)`.

### 4c. LocationTab

Simple in T0b (full world map is T5).

- **Current Location** — large editable text field (`state.party.location`). Commits via `updateCampaign('location', value)`.
- **"(World map scenario picker coming in T5)"** placeholder band below. No emphasis; just a small-caps note.

Travel history: `state.party.scenarios[]` already lists completed scenarios with edition + index. Render as a timeline list (most recent first). Each entry: scenario number, edition, completion indicator. Read-only. Not interactive. Uses the existing scenario list shape — this is essentially a view of existing data, no new commands.

### 4d. ResourcesTab (FH only)

Hidden entirely for non-FH. Root of tab renders `null` if `edition !== 'fh'`.

Six gauges stacked vertically (or in a 2×3 grid on wider displays):
- **Morale** — `state.party.morale` (integer, typical range 0–20 per rules).
- **Defense** — `state.party.defense`.
- **Soldiers** — `state.party.soldiers`.
- **Inspiration** — `state.party.inspiration`.
- **Trials** — `state.party.trials`.

Each gauge:
- Large number in Cinzel 600 at 32px, `--gilt-gold`.
- Label in small-caps Cinzel below, `--parchment-ink-dim` (controller) or `--parchment-base` with 70% opacity (display variant on leather bg).
- +/− buttons on controller (readOnly hides them). Each tap fires `updateCampaign(fieldName, newValue)`. Buttons: `--gilt-gold` on hover border, minimum 44×44 tap area.
- On any value change: `.party-resource__value` gets a 240ms gold flash via CSS class toggle (pattern copied from T0a's StatMedallion change flash).

Below the gauges: **Shared Loot Pool** — `state.party.loot` object (resource type → count). Render as tag cloud of resource chips (lumber ×4, metal ×2, etc.). Read-only in T0b (the commands to mutate this pool will be part of T3 outpost).

### 4e. EventsTab

Event decks live at `state.party.eventCards` (`EventCardIdentifier[]`).

Two sections:

**Active Events** (top):
- Cards currently in play (e.g., an ongoing event's persistent effect). `state.party.eventCards` where some flag indicates "active" — for T0b, since T6 hasn't landed and event lifecycle isn't wired, treat the entire `eventCards` list as active. Revisit in T6.
- Each card: card image if available from asset manifest, card name, brief narrative preview (first line), "Resolved: Option A/B" badge.
- Tap card (controller only) → expands inline to show full narrative + resolution detail. Read-only display — event *resolution* is T6's job.

**Resolved History** (bottom, collapsible):
- Past events with outcomes. Same row structure as active, but compact.

**Empty state:** "No events drawn yet. Events appear here as your campaign unfolds." — same centered-text-plus-minimal-illustration pattern as Roster's empty state.

If the asset manifest doesn't have card images for events, log to `docs/ASSET_REQUESTS.md` and render text-only cards with a decorative gilt border. Do not use placeholder images — `app/CONVENTIONS.md` rule: broken image is a real bug.

---

## Step 5 — Controller mount

### 5a. Create `app/controller/overlays/PartySheetOverlay.tsx`

Thin wrapper that pulls state from `useGameState()` and renders the shared `PartySheet` with `readOnly={false}`. Mirrors `PlayerSheetQuickView`'s pattern.

```tsx
export function PartySheetOverlay({ onClose }: { onClose: () => void }) {
  const { state } = useGameState();
  if (!state) return null;
  return (
    <PartySheet
      party={state.party}
      characters={state.characters}
      edition={state.edition ?? state.party.edition ?? 'gh'}
      onClose={onClose}
      readOnly={false}
      autoCycle={false}
      layout="landscape"
    />
  );
}
```

### 5b. Mount from `ControllerNav` → `MenuOverlay`

The new menu item "Party Sheet" opens `PartySheetOverlay`. State goes on the controller root (`App.tsx` or nearest parent). Close dismisses overlay.

---

## Step 6 — Display mount (decorative)

### 6a. Conditions to render

Display renders `PartySheet` in decorative mode when:
- `state.mode === 'lobby'` AND no `setupPhase` set (idle lobby), OR
- `state.mode === 'town'` AND `state.party.townPhase?.step` is undefined or in a quiet moment (T8 coordinator will formally define this; for T0b, treat `townPhase` undefined/null as "no phase owns display").

Do NOT render when `mode === 'scenario'` — scenario mode owns the display fully.

The display cycles between the Party Sheet and (eventually, T0c) the Campaign Sheet. For T0b alone, only Party Sheet available — so the display either shows Party Sheet (if triggered) or the existing lobby/town decorative content already there.

**Practical hookup:** grep `app/display/` for whatever owns the idle-mode view. If it's a component tree like `LobbyView` and `TownView` under `app/display/`, add a "if party sheet should render" branch that mounts `PartySheet` with `autoCycle` and `readOnly`.

### 6b. Display PartySheetView wrapper

`app/display/views/DisplayPartySheetView.tsx`:

```tsx
export function DisplayPartySheetView() {
  const { state } = useGameState();
  if (!state) return null;
  return (
    <PartySheet
      party={state.party}
      characters={state.characters}
      edition={state.edition ?? 'gh'}
      onClose={() => {}} // no-op on display
      readOnly
      autoCycle
      skipIntro
      layout="portrait"
    />
  );
}
```

### 6c. Auto-cycle implementation details

In `PartySheet.tsx`:

```tsx
useEffect(() => {
  if (!autoCycle) return;
  const visibleTabs = TAB_IDS.filter(id => !(id === 'resources' && edition !== 'fh'));
  const interval = setInterval(() => {
    setActiveTab(curr => {
      const idx = visibleTabs.indexOf(curr);
      return visibleTabs[(idx + 1) % visibleTabs.length];
    });
  }, 30000);
  return () => clearInterval(interval);
}, [autoCycle, edition]);
```

Page-turn transition: when `autoCycle` fires the tab change, apply a `data-cycling="true"` attribute on the content panel for the duration of the transition. CSS:

```css
.party-sheet__content[data-cycling="true"] {
  animation: party-sheet-page-turn 600ms var(--ease-page-turn);
}

@keyframes party-sheet-page-turn {
  0%   { opacity: 1; transform: translateY(0); }
  20%  { opacity: 0; transform: translateY(-4px); }
  60%  { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

Controller manual tab switches use the subtler ink-settle from T0a, not the page-turn.

### 6d. Display ambient effects

Per design brief "subtle candlelight flicker effect on the gilt accents" — applies to `--gilt-gold` elements when `autoCycle` is true. Add:

```css
.party-sheet[data-autocycle="true"] .party-sheet__tab--active::before {
  animation: party-sheet-gilt-flicker 2.4s ease-in-out infinite;
}
.party-sheet[data-autocycle="true"] .party-resource__value {
  animation: party-sheet-gilt-flicker 3.1s ease-in-out infinite;
}

@keyframes party-sheet-gilt-flicker {
  0%, 100% { opacity: 1; filter: brightness(1); }
  50%      { opacity: 0.94; filter: brightness(1.08); }
}
```

Uses slightly offset durations so the flicker isn't synchronized across elements (feels more natural).

---

## Step 7 — Hybrid-commit input hook (shared utility)

Pattern first introduced in T0b (Notes, Name, Location, Party Notes, achievement add, textarea fields). Encapsulate in a shared hook so T0d's Notes tab and future tabs use the same.

`app/shared/hooks/useCommitOnPause.ts`:

```ts
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

/**
 * Hybrid commit behaviour for text inputs.
 * - Commits on blur, Enter key, or after 1000ms of typing inactivity.
 * - Returns current local value + handlers for input/blur/keydown.
 *
 * If external value changes while not focused, local value follows.
 * If external value changes while focused (rare — collaborative edit), local
 * value is NOT overwritten (user's in-progress edit wins until blur).
 */
export function useCommitOnPause(options: {
  value: string;
  onCommit: (next: string) => void;
  pauseMs?: number;
  commitOnEnter?: boolean;
}): {
  localValue: string;
  onInput: (e: Event) => void;
  onBlur: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
} {
  const { value, onCommit, pauseMs = 1000, commitOnEnter = true } = options;
  const [localValue, setLocalValue] = useState(value);
  const focusedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const lastCommittedRef = useRef(value);

  // External value sync — only when not focused
  useEffect(() => {
    if (!focusedRef.current && value !== localValue) {
      setLocalValue(value);
      lastCommittedRef.current = value;
    }
  }, [value]); // eslint-disable-line

  const scheduleCommit = useCallback((next: string) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (next !== lastCommittedRef.current) {
        onCommit(next);
        lastCommittedRef.current = next;
      }
    }, pauseMs);
  }, [onCommit, pauseMs]);

  const onInput = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const next = target.value;
    setLocalValue(next);
    scheduleCommit(next);
  };

  const onBlur = () => {
    focusedRef.current = false;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (localValue !== lastCommittedRef.current) {
      onCommit(localValue);
      lastCommittedRef.current = localValue;
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!commitOnEnter) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      // For single-line inputs, commit and blur. Textareas can Shift+Enter for newline.
      (e.target as HTMLElement).blur?.();
    }
  };

  // Also mark focused on focus; use ref to avoid stale closures
  const onFocusInternal = () => { focusedRef.current = true; };
  // Consumers can spread these on input + bind onFocus={onFocusInternal} if needed
  // (we wire via a wrapper below)

  useEffect(() => {
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, []);

  return { localValue, onInput, onBlur, onKeyDown };
}
```

All Standing tab / Location tab / Notes (T0d) inputs use this hook.

---

## Step 8 — CSS

Extend `app/shared/styles/sheets.css`. Add clearly-labelled section:

```
/* ───────────────────────────────────────────────────────────────────
   T0b: Party Sheet
   Leather-bound campaign ledger. Gilt-bound tab strip on left
   (vertical on landscape, top on portrait). Extends the sheet design
   system established by T0a (Player Sheet).
   ─────────────────────────────────────────────────────────────────── */
```

Under this section, BEM classes prefixed `party-sheet__*`, `party-sheet-tab__*`, `roster-tab__*`, `standing-tab__*`, `location-tab__*`, `resources-tab__*`, `events-tab__*`.

**Key style guidelines to hit:**

1. **Surface:** `.party-sheet` uses `background: var(--sheet-party-bg)` (leather gradient).
2. **Content panel:** lighter leather (`--leather-brown`) inset from the leather-brown-deep outer. Use box-shadow inset for subtle separation.
3. **Gilt tab binding** per Step 3c above.
4. **Text on leather:** `--parchment-base` color (not ink — ink is for parchment backgrounds). Headings in Cinzel `--gilt-gold`.
5. **Editable inputs:** parchment-inset panel (`--parchment-aged` bg with inset shadow) for the field. Text in `--parchment-ink`. Focus state lightens bg + gilt border.
6. **Resource gauges:** medallion style similar to T0a's stat medallions, but on leather: gilt rim, leather-brown-deep inner, gilt-gold value text.
7. **Tab strip on landscape:** 220px wide, full height. On portrait: top-anchored, 64px tall.
8. **Page-turn animation** keyframes defined globally so Campaign Sheet (T0c) can reuse.
9. **Reduced-motion** covers all new animations.

---

## Step 9 — Accessibility

- Modal dialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to a heading with party name.
- Focus trap (identical pattern to T0a).
- Escape closes (controller only; display autoCycle ignores escape).
- Tab strip ARIA per 3d.
- Every editable input has a visible label + `aria-label` for screen readers.
- Reputation slider: `role="slider"`, `aria-valuemin="-20"`, `aria-valuemax="20"`, `aria-valuenow={value}`, `aria-valuetext` with both the reputation and price modifier ("+7, discount 2 gold per item").
- +/− buttons on Resources tab: clear `aria-label` ("Increase morale by 1").
- Color contrast: text on leather backgrounds must hit AA. `--parchment-base` (#f4ede4) on `--leather-brown-deep` (#2d1810) ≈ 14:1 ✓. `--gilt-gold` (#c9a961) on leather ≈ 6:1 ✓.
- Min 44×44 tap targets everywhere.

---

## Step 10 — Documentation

- **`docs/BUGFIX_LOG.md`** — any regressions surfaced + fixed.
- **`docs/DESIGN_DECISIONS.md`** — entry:
  *"T0b: Party Sheet landed as shared multi-client sheet (`app/shared/sheets/`), consumed by controller primary and display decorative via direct import (pattern set by T0a's PlayerSheetQuickView). Gilt-bound tab signature established as Party Sheet's visual fingerprint. Hybrid-commit hook `useCommitOnPause` centralized for editable text fields. reputationPrice helper ships here for Party Sheet Standing tab and will be consumed by T2a shopping. MenuOverlay promoted via ControllerNav so Party Sheet reachable from every controller mode (Lobby/Scenario/Town). Structured commands `addPartyAchievement` / `removePartyAchievement` added because `updateCampaign` can't cleanly mutate arrays; undo-friendly."*
- **`docs/ROADMAP.md`** — mark T0b complete. List new commands.
- **`docs/PROJECT_CONTEXT.md`** — update repo layout (add `app/shared/sheets/`). Add commands to Quick Reference.
- **`docs/APP_MODE_ARCHITECTURE.md`** — update the Controller and Display sections to describe Party Sheet reachability and display decorative cycling.
- **`docs/COMMAND_PROTOCOL.md`** — document `addPartyAchievement`, `removePartyAchievement`.
- **`app/CONVENTIONS.md`** — note that `app/shared/sheets/` is the canonical home for multi-client sheet components; explain the `app/shared/sheets/*Context.ts` pattern.
- **`docs/ASSET_REQUESTS.md`** — log any missing event card images or class sigils surfaced during implementation.

---

## Verification Checklist

### Build / static analysis

- [ ] `npm run build` succeeds on all three client bundles.
- [ ] `tsc --noEmit` clean across server, shared, clients.
- [ ] No imports reaching across client boundaries (no controller importing from phone, etc., except via `app/shared/`).

### Engine

- [ ] `getReputationPriceModifier` tests pass (bracket edges + extremes).
- [ ] `addPartyAchievement` deduplicates (adding same twice = one entry).
- [ ] `removePartyAchievement` removes cleanly; no-op if absent (validation rejects).
- [ ] `updateCampaign('sheetIntroSeen', true)` persists through save/reload (via GameStore).
- [ ] Phone cannot fire `addPartyAchievement` / `removePartyAchievement` (rejected server-side).

### Controller Party Sheet

- [ ] Open from ControllerNav `⋯` menu from **Lobby** — sheet opens.
- [ ] Open from menu from **Scenario** — sheet opens, underlying scenario state unchanged.
- [ ] Open from menu from **Town** — sheet opens.
- [ ] First ever open: intro animation plays; skip works; `sheetIntroSeen` persists.
- [ ] Reopen after intro seen: straight to sheet.
- [ ] **Roster tab:** active characters grid renders with portraits + levels; retirees section collapsed by default; expand works; Add Character card opens character-add flow.
- [ ] Tap an active character card → opens PlayerSheetQuickView; close returns to Roster.
- [ ] **Standing tab:** party name edits commit on blur/Enter/1000ms pause. Reputation slider moves; price modifier chip updates live to `−2g` at rep +7, `0g` at rep 0, `+3g` at rep −11. Party notes persist. Adding achievement via text input → appears in list. Delete achievement → removed.
- [ ] **Location tab:** location text edits commit via hybrid pattern. Travel history lists recent completed scenarios.
- [ ] **Resources tab (FH only):** all 6 gauges render; +/− buttons adjust via `updateCampaign`; gold-flash animation on value change. Shared loot pool shows current resources.
- [ ] **Resources tab hidden** on GH, jotl, cs, fc, toa.
- [ ] **Events tab:** active event cards list (or empty state if none); tap card expands narrative read-only.
- [ ] Close button returns to previous mode intact.

### Display Party Sheet (decorative)

- [ ] In idle lobby, display renders Party Sheet; tabs cycle every 30 seconds with page-turn animation.
- [ ] In idle town, display renders Party Sheet.
- [ ] In scenario mode, display does NOT render Party Sheet (scenario takes over).
- [ ] Gilt candlelight flicker subtly animates the active tab's gilt rule break.
- [ ] Display ignores Escape/close (no interactions).
- [ ] Skips Resources tab on non-FH during cycle.
- [ ] Skips intro animation (decorative should never play intro).

### Accessibility

- [ ] VoiceOver reads sheet title, tab names, active tab, editable input labels.
- [ ] Reputation slider announces value + price modifier.
- [ ] Arrow keys navigate tab strip (Up/Down on landscape, Left/Right on portrait).
- [ ] Focus trap keeps Tab inside modal.
- [ ] Escape closes on controller.
- [ ] Reduced-motion disables intro, page-turn, gold flash, gilt flicker.

### Design quality (against brief)

- [ ] Leather background visible throughout; no flat-gray dashboard vibe.
- [ ] Gilt-bound tab strip has continuous rule broken only at active tab.
- [ ] Wax-seal motif NOT used here (that's Campaign Sheet).
- [ ] Character portraits in Roster have per-class accent borders from `getCharacterTheme`.
- [ ] Reputation slider looks tactile — gem moves smoothly, tick marks embossed.
- [ ] Resource gauges use metallic gilt rims, legible on leather.
- [ ] Empty states have illustrations + evocative text, not "No data."

### Regressions

- [ ] T0a Player Sheet still opens normally from phone character portrait.
- [ ] T1 rewards overlay still fires on scenario end.
- [ ] T1.1 display dismissal still works.
- [ ] Scenario play fully intact.
- [ ] Town phase placeholder still shows in town mode.

---

## Commit Message

```
feat(phase-t0b): Party Sheet — shared controller + decorative display

Ships the Party Sheet as the campaign's canonical shared-state surface.
5 tabs: Roster, Standing, Location, Resources (FH), Events. Controller
edits, display renders decoratively with 30s tab cycling and page-turn
transitions during idle lobby/town moments.

Design system continuity:
- New shared home `app/shared/sheets/` for multi-client sheet components
- Gilt-bound tab strip as Party Sheet's signature (continuous metallic
  rule broken only at active tab)
- Leather surface palette with gilt-gold accents; parchment-inset
  editable fields
- Hybrid-commit input hook (`useCommitOnPause`) — blur/Enter + 1000ms
  auto-save. Centralized for reuse in T0d Notes.
- "Leather book opening" intro animation, persisted via
  updateCampaign('sheetIntroSeen', ...)

Engine / protocol:
- `getReputationPriceModifier(reputation)` in shared/data; tested against
  rules bracket table. Consumed by Standing tab live preview; T2a
  shopping will consume the same helper.
- `addPartyAchievement` / `removePartyAchievement` structured commands
  (updateCampaign can't cleanly mutate arrays with undo). GM-only;
  not on phone permission list.
- `Party.sheetIntroSeen` flag on party.

Controller:
- `ControllerNav` floating menu button reachable in Lobby / Scenario /
  Town. Existing `MenuOverlay` promoted to reachable-everywhere.
- `PartySheetOverlay` wrapper mounts shared PartySheet with readOnly=false.
- Roster tab opens PlayerSheetQuickView for any character (pattern
  reused from T0a).

Display:
- `DisplayPartySheetView` mounts in idle lobby/town only. Auto-cycles
  tabs with page-turn animation and gilt candlelight flicker.
- No interactions; skips intro; hidden during scenario mode.

Docs: PHASE_T0_SCOPE + DESIGN_BRIEF referenced. DESIGN_DECISIONS,
ROADMAP, PROJECT_CONTEXT, APP_MODE_ARCHITECTURE, COMMAND_PROTOCOL,
CONVENTIONS updated. ASSET_REQUESTS logs any missing event card /
class sigil assets.

Baseline: T0a complete. Part of Phase T0 (Sheets).
```

---

## Notes to Claude Code

1. **Produce a Plan first and wait for confirmation before editing files.** The Plan should list every file you'll touch, in order, with one-line rationale. Flag the `MenuOverlay` promotion — that's infrastructure and should land green before any Party Sheet work begins.
2. **Read T0a's `PlayerSheet.tsx` thoroughly before writing PartySheet.** Copy the patterns: Context shape, focus trap useEffects, inline theme style, modal structure, tab strip ARIA. Do not reinvent these.
3. **Do not create new CSS files.** All Party Sheet styles go in `app/shared/styles/sheets.css`, appended after T0a's Player Sheet section, clearly labeled.
4. **Gilt-bound tab binding is the signature**, as important to Party Sheet identity as the illuminated capital is to Player Sheet. Don't skip or phone it in.
5. **MenuOverlay promotion is the riskiest part.** If it gets complex, fall back to a simple floating `⋯` button per view that opens `MenuOverlay` directly — that's acceptable. What must be true: Party Sheet reachable from Lobby, Scenario, AND Town.
6. **Shared loot pool in Resources tab is read-only.** Don't try to build mutation UI for it — that's T3 outpost territory.
7. **Events tab treats all `party.eventCards` as "active" for T0b.** T6 will refine the active/resolved split. Don't invent lifecycle state.
8. **Don't touch `char.progress.*`** — that's Player Sheet territory (T0a / T0d).
9. **Reputation slider range is −20 to +20.** Per rules. Reject values outside this range if firing via `updateCampaign`.
10. **Asset manifest** for class sigils / event cards: log any misses to `docs/ASSET_REQUESTS.md`, render with no image per `app/CONVENTIONS.md` (broken image = real bug, not cosmetic).
11. **Smoke test after merge:** open sheet in every mode × every tab × FH and GH editions. That's the minimum pass.
12. **Do not preempt T0c.** If the menu naturally wants a "Campaign Sheet" entry, leave it out entirely (don't add a disabled stub). T0c adds it.
