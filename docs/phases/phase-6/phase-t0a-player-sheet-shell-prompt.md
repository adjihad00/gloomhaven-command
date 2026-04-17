# Phase T0a — Player Sheet Shell + Overview Tab (Claude Code Prompt)

## Context

You are working in the `gloomhaven-command` repo. Baseline: **T1 complete, T1.1 complete**. Run `git pull` and confirm. If T1.1 hasn't landed, stop and say so.

This batch is the **proof-of-concept for the Phase T0 sheet design system**. Its quality sets the bar for T0b (Party Sheet) and T0c (Campaign Sheet). No phoning it in on this one. Kyle's explicit direction: "spare no expense RE design and effort — these really are the meat and potatoes of the campaign."

**Read before writing any code, in order:**

1. `CLAUDE.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/APP_MODE_ARCHITECTURE.md`
4. `docs/PHASE_T0_SCOPE.md` — the architectural decisions
5. `docs/PHASE_T0_DESIGN_BRIEF.md` — the aesthetic direction (authoritative on look & feel)
6. `docs/DESIGN_DECISIONS.md`
7. `docs/GAME_RULES_REFERENCE.md` — §12 (leveling / XP thresholds) is relevant for Overview stats
8. `app/CONVENTIONS.md`

**Design skills (read every `.md` file under each):**

- `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
- `C:\Users\Kyle Diaz\.agents\skills\`

Priority: `app/CONVENTIONS.md` > `PHASE_T0_DESIGN_BRIEF.md` > UI/UX Pro Max > agent skills.

**Existing code to read before writing (these are your patterns):**

- `app/phone/overlays/PhoneCharacterDetail.tsx` (329 lines) — the current in-scenario character detail. **You are absorbing this** into Player Sheet Overview tab's "Active Scenario section." Do not delete the file until new component fully replaces it and all call sites are updated.
- `app/phone/characterThemes.ts` — class color schema (bg / accent / flair). **Move this to `app/shared/characterThemes.ts`** as part of this batch; the display client already cross-imports it from `app/phone/`, which is a code smell and the sheets will need it across all three clients.
- `app/phone/overlays/PhoneRewardsOverlay.tsx` — T1's polished overlay; model for sheet overlay structure.
- `app/shared/styles/theme.css` — baseline design tokens. You extend it.
- `app/phone/ScenarioView.tsx` — currently opens `PhoneCharacterDetail` from the character portrait button; that button now opens Player Sheet.
- `app/phone/TownView.tsx` — 38-line placeholder. **Also opens Player Sheet.**
- `app/phone/LobbyView.tsx` — if there's a character portrait button, wire it too.
- `app/controller/overlays/CharacterSheetOverlay.tsx` (239 lines) — existing read-only character sheet on controller. **You're replacing this** with a new `PlayerSheetQuickView.tsx` that renders the same Player Sheet in read-only mode for the GM.

---

## Scope — T0a Only

**In scope:**

- Design tokens extension in `theme.css` (parchment, leather, gilt, class-color CSS variables, motion easings).
- `app/shared/characterThemes.ts` migration with no behavior change.
- New Player Sheet container component with tab navigation.
- **Overview tab fully implemented** to final-ish quality, serving as reference for future tabs.
- Placeholder tabs (Items, Progression, Personal Quest, Notes, History) visible but bodies just read: *"Available in [batch name]."* Tab order final per design brief; body content intentional placeholder. This is the one allowed exception to the "no placeholders" rule, for structural reasons.
- One-time intro animation ("Your story begins…") with persisted `char.progress.sheetIntroSeen` flag.
- Controller-side `PlayerSheetQuickView` replacing `CharacterSheetOverlay`, read-only.
- Persistent entry point update: phone character portrait button in all three mode views (Lobby, Scenario, Town) opens Player Sheet instead of current overlays.
- `PhoneCharacterDetail` absorbed into Overview tab's "Active Scenario" section (scenario mode only).

**Out of scope (explicit — do NOT try to sneak these in):**

- Items tab content (T2a)
- Progression tab content (T2b + T2d)
- Personal Quest tab content (T2c)
- Notes tab content (T0d)
- History tab content (T0d)
- Party Sheet (T0b)
- Campaign Sheet (T0c)
- Any new engine commands beyond the one flag (`sheetIntroSeen`)
- Any new ref DB methods or API endpoints

---

## Tab Layout — Final per T0 Scope

Final Player Sheet tab list (grouped per Kyle's decision):

1. **Overview** — built in T0a (this batch)
2. **Items** — T2a
3. **Progression** (combines Perks + Level Up + Enhancements) — T2b + T2d
4. **Personal Quest** — T2c
5. **Notes** — T0d
6. **History** — T0d

6 tabs, fit phone width without horizontal scroll (but still scrollable if a future edition adds a tab). Cinzel small-caps labels, 44px min height.

**FH-only tab visibility:** none in this list are FH-only at the top level. Crafting and brewing go *inside* the Progression tab when T2d lands. Progression tab visibility is unconditional.

---

## Step 1 — Migrate `characterThemes.ts` to shared

### 1a. Move the file

Move `app/phone/characterThemes.ts` → `app/shared/characterThemes.ts`. No content changes. The existing file has:

- `interface CharacterTheme { bg, accent, flair }`
- `getCharacterTheme(name, fallbackColor?)` function
- Per-class theme map covering GH starters, GH unlockables, FH classes

### 1b. Update all imports

Grep current consumers:

- `app/phone/App.tsx` — import path update.
- `app/display/components/DisplayFigureCard.tsx` — import path update (removes the cross-client import smell).

Any other consumers surfacing during grep: update.

### 1c. Verify

- `npm run build` clean.
- `tsc --noEmit` clean.
- Visual smoke test: load phone, confirm character theming unchanged. Load display, confirm figure cards still get accent colors.

This migration must land cleanly as its own logical unit before any Player Sheet work. If grep finds unexpected consumers, stop and surface.

---

## Step 2 — Design tokens extension

### 2a. Extend `app/shared/styles/theme.css`

Append the full token set from `PHASE_T0_DESIGN_BRIEF.md` §"Design tokens — extensions to `theme.css`" block. Specifically:

- Parchment palette (`--parchment-base`, `--parchment-aged`, `--parchment-dark`, `--parchment-ink`, `--parchment-ink-dim`).
- Leather palette (`--leather-brown`, `--leather-brown-deep`, `--leather-seam`, `--gilt-gold`, `--gilt-gold-shadow`).
- Class accent tokens as `--class-accent`, `--class-accent-glow`, `--class-accent-dim`. These default to the existing `--accent-gold` values; per-class overrides come from Step 2b.
- Sheet-specific surface gradients (`--sheet-player-bg`, `--sheet-party-bg`, `--sheet-campaign-bg`).
- Motion tokens (`--ease-page-turn`, `--ease-ink-settle`, `--duration-page-turn`, `--duration-ink-settle`).
- Sheet-specific radii.

Preserve all existing tokens. Append; do not rewrite.

### 2b. Class-color CSS variable wiring

Do NOT write out `[data-class='brute'] { --class-accent: ... }` rules in CSS. Instead, set the three class-accent variables via inline `style` on the sheet root element, reading from `getCharacterTheme(name).accent` / `.flair` / derived dim.

Rationale: the theme map is already the source of truth in TypeScript; duplicating it in CSS means two places to edit when a new class lands.

Implementation pattern for any component using class accents:

```tsx
const theme = getCharacterTheme(character.name, classData?.color);
const sheetStyle = {
  '--class-accent': theme.accent,
  '--class-accent-glow': `${theme.accent}66`,  // 40% alpha
  '--class-accent-dim': `${theme.accent}26`,   // 15% alpha
  '--class-bg': theme.bg,
  '--class-flair': theme.flair,
} as h.JSX.CSSProperties;

return <div class="player-sheet" style={sheetStyle} data-class={character.name}>...</div>;
```

Alpha appending via hex string works for `#rrggbb` values (8-char `#rrggbbaa`). All theme values are `#rrggbb` so this is safe. Add a tiny helper `withAlpha(hex, alpha)` in `app/shared/characterThemes.ts` to centralize this.

---

## Step 3 — Engine state addition

### 3a. Add `sheetIntroSeen` flag

One-line engine change:

In `packages/shared/src/types/gameState.ts`, `CharacterProgress` interface, add:

```ts
/** Per-sheet intro animation shown flag. Set once per character on first Player Sheet open. */
sheetIntroSeen?: boolean;
```

Optional + undefined-default so existing saves and GHS imports are unaffected.

### 3b. Command handler

No new command needed — the existing `updateCampaign` catch-all handles this. Client code fires:

```ts
commands.updateCampaign('sheetIntroSeen', true);
```

…wait, `updateCampaign` today mutates `state.party.*`, not `CharacterProgress.*`. Check.

```ts
// Verify in packages/shared/src/engine/applyCommand.ts handleUpdateCampaign
```

If `updateCampaign` is party-scoped only, add a new character-scoped command for per-character flags instead of bending `updateCampaign`. Prefer structured commands.

New command `setCharacterProgress`:

- `packages/shared/src/types/commands.ts`:

  ```ts
  | 'setCharacterProgress'

  export interface SetCharacterProgressCommand {
    action: 'setCharacterProgress';
    payload: {
      characterName: string;
      edition: string;
      /** Field on CharacterProgress to update. Keep restricted to safe fields. */
      field: 'sheetIntroSeen' | 'notes';
      value: boolean | string;
    };
  }
  ```

  Add to `Command` union.

- `packages/shared/src/engine/applyCommand.ts`:

  ```ts
  case 'setCharacterProgress':
    handleSetCharacterProgress(after, command.payload);
    break;

  function handleSetCharacterProgress(state: GameState, payload: ...): void {
    const char = state.characters.find(c => c.name === payload.characterName && c.edition === payload.edition);
    if (!char) return;
    (char.progress as any)[payload.field] = payload.value;
  }
  ```

- `packages/shared/src/engine/validateCommand.ts`: accept `setCharacterProgress` if character exists and field is in the allowed list. Reject unknown fields.

- `server/src/wsHub.ts`: add `setCharacterProgress` to `PHONE_ALLOWED_ACTIONS`. Character-scoped (not global). Ensure `getCommandCharacterName` routes on `payload.characterName`.

This command also serves T0d's Notes field (`field: 'notes'`). Do not add it to `PHONE_GLOBAL_ACTIONS`.

### 3c. useCommands wrapper

`app/hooks/useCommands.ts`:

```ts
setCharacterProgress: (characterName: string, edition: string, field: 'sheetIntroSeen' | 'notes', value: boolean | string) =>
  send({ action: 'setCharacterProgress', payload: { characterName, edition, field, value } }),
```

---

## Step 4 — Player Sheet structure

### 4a. File layout

```
app/phone/sheets/
├── PlayerSheet.tsx               — container + tab nav + intro animation
├── PlayerSheetHeader.tsx         — class sigil, illuminated capital, title
├── PlayerSheetTabs.tsx           — tab strip
├── PlayerSheetIntro.tsx          — one-time intro animation
└── tabs/
    ├── OverviewTab.tsx           — the content for this batch
    ├── ItemsTabPlaceholder.tsx
    ├── ProgressionTabPlaceholder.tsx
    ├── PersonalQuestTabPlaceholder.tsx
    ├── NotesTabPlaceholder.tsx
    └── HistoryTabPlaceholder.tsx
```

Placeholder files are single-component each with one paragraph body:
*"Available in [batch, e.g. T2a]."* Slight emphasis on the batch marker with `--class-accent-dim`.

CSS: `app/phone/styles/sheets.css` (new file, imported from phone main entry). Use BEM with prefix `player-sheet__*`.

### 4b. PlayerSheet container

```tsx
interface PlayerSheetProps {
  character: Character;
  edition: string;
  onClose: () => void;
  // Ambient scenario state that Overview's "Active Scenario section" needs
  elements?: ElementModel[];
  lootDeck?: LootDeck | null;
  isActive?: boolean;
  // Full passthrough of PhoneCharacterDetail's existing callbacks (see Step 5)
  onChangeHealth: (delta: number) => void;
  onSetXP: (value: number) => void;
  onToggleCondition: (name: ConditionName) => void;
  onToggleLongRest: () => void;
  onToggleAbsent: () => void;
  onToggleExhausted: () => void;
  onMoveElement?: (element: ElementType, newState: ElementState) => void;
  onSwitchCharacter?: () => void;
}
```

State:

- `activeTab: 'overview' | 'items' | 'progression' | 'quest' | 'notes' | 'history'`. Initial `'overview'`; persisted across closes within a session via `useState` (no localStorage — server state is enough).
- `showIntro: boolean` — computed from `!character.progress.sheetIntroSeen` on first render.

Structure:

```tsx
<div
  class="player-sheet"
  data-class={character.name}
  style={themeVars}
  role="dialog"
  aria-modal="true"
  aria-labelledby="player-sheet-title"
>
  <button class="player-sheet__close" onClick={onClose} aria-label="Close sheet">←</button>

  <PlayerSheetHeader character={character} />
  <PlayerSheetTabs activeTab={activeTab} onChange={setActiveTab} />

  <div class="player-sheet__content">
    {activeTab === 'overview' && <OverviewTab ...allProps />}
    {activeTab === 'items' && <ItemsTabPlaceholder />}
    {/* ...rest */}
  </div>

  {showIntro && <PlayerSheetIntro character={character} onComplete={handleIntroComplete} />}
</div>
```

`handleIntroComplete`:

```ts
const handleIntroComplete = () => {
  setShowIntro(false);
  commands.setCharacterProgress(character.name, character.edition, 'sheetIntroSeen', true);
};
```

### 4c. PlayerSheetHeader

Layout per `PHASE_T0_DESIGN_BRIEF.md` §"Player Sheet — layout spec":

```tsx
<header class="player-sheet__header">
  <button class="player-sheet__close" ...>←</button>
  <img class="player-sheet__class-sigil" src={classSigilUrl(edition, character.name)} alt="" />
  <button class="player-sheet__menu" ...>⋯</button>

  <div class="player-sheet__title-block">
    <IlluminatedCapital letter={(character.title || formatName(character.name))[0]} />
    <div class="player-sheet__title-text">
      <h2 id="player-sheet-title" class="player-sheet__title">
        {character.title || formatName(character.name)}
      </h2>
      <p class="player-sheet__subtitle">
        Level {character.level} · {scenariosCompleted} scenarios
      </p>
    </div>
  </div>
</header>
```

`IlluminatedCapital` is a new component at `app/phone/sheets/IlluminatedCapital.tsx`. Stylized-modern per Kyle's direction:

- SVG-based, 80×80 on phone.
- Letter in Cinzel 700, color `--class-accent`.
- Single decorative flourish: a flowing ribbon or vine motif on one corner, NOT a heavy ornate frame. Reference: modern book design, not medieval manuscript.
- Implement as an SVG with the letter centered and a minimal corner ornament. Use one `<path>` for the ornament; keep the whole thing under ~60 lines.
- Fades in on first render with 500ms opacity + scale (0.9 → 1.0), easing `var(--ease-ink-settle)`. Re-opens of the sheet skip animation (check via ref).

`classSigilUrl` — check asset manifest for class sigil / thumbnail assets. `characterThumbnail` helper in `app/shared/assets.ts` already exists for phone scenario views; use it. Fallback gracefully per `app/CONVENTIONS.md` (no fallbacks means broken image signals a bug — log and render empty alt, don't swap placeholder).

### 4d. PlayerSheetTabs

Horizontal scrollable strip, 6 tabs. Each tab a bookmark shape:

```css
.player-sheet__tab {
  position: relative;
  padding: var(--space-3) var(--space-5);
  min-height: 44px;
  font-family: 'Cinzel', serif;
  font-weight: 500;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--parchment-ink-dim);
  background: transparent;
  border: none;
  touch-action: manipulation;
  transition: color var(--transition-fast);
}

.player-sheet__tab--active {
  color: var(--parchment-ink);
  /* Underline uses class-accent */
}

.player-sheet__tab--active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 12%;
  right: 12%;
  height: 2px;
  background: var(--class-accent);
  border-radius: 1px;
}
```

ARIA: `role="tablist"` on strip, `role="tab"`, `aria-selected`, `aria-controls` per tab. Content panels `role="tabpanel"`.

Tab switch transition: outgoing panel fade out 120ms, incoming panel fade + 2px translateY-in 180ms, concurrent. Use CSS transitions on a `data-tab-state` attribute rather than JS animation.

### 4e. Overview tab — full implementation

This tab is the reference quality target.

```tsx
function OverviewTab(props) {
  const { character, edition, elements, lootDeck, isActive, ...handlers } = props;
  const { state } = useGameState();
  const mode = state?.mode;

  return (
    <div class="overview-tab">
      {/* XP bar */}
      <OverviewXPBar character={character} />

      {/* Stat medallions: Gold, HP, Scenarios, Perks */}
      <OverviewStatMedallions character={character} />

      {/* Active Scenario section — scenario mode only */}
      {mode === 'scenario' && (
        <OverviewActiveScenario
          character={character}
          edition={edition}
          elements={elements}
          lootDeck={lootDeck}
          isActive={isActive}
          {...handlers}
        />
      )}

      {/* Current Activity section — town mode only (T8 hookup later) */}
      {mode === 'town' && character.progress as any?.townLocation && (
        <OverviewCurrentActivity character={character} />
      )}

      {/* Hand Preview — placeholder for T0a, real in T2b */}
      <OverviewHandPreview character={character} />
    </div>
  );
}
```

**`OverviewXPBar`** — parchment-strip progress bar with ink fill.

- Full width of content area.
- Height 36px, rounded 6px corners.
- Background: `--parchment-aged` with slight inset shadow.
- Fill: gradient from `--class-accent-dim` to `--class-accent` representing ink. Width % based on `char.progress.experience` relative to `currentFloor` and `nextThreshold` (XP_THRESHOLDS from shared).
- Overlaid text centered: `{currentXP} / {nextThreshold}` in Crimson Pro tabular figures, color `--parchment-ink`.
- When `currentXP >= nextThreshold`: right edge shows a wax-seal indicator (circular SVG, `--gilt-gold` fill, "Level Up" text below) that animates in with 600ms ink-settle ease.
- When within 10% of threshold: strip pulses class-accent glow subtly (0.8s breathing cycle, opacity 0.0 → 0.3 on the `::after` glow element).

Max level (9): show "MAX" instead of threshold; fill bar solid.

**`OverviewStatMedallions`** — 4 circular metric badges.

- Layout: horizontal flex row, 4 columns, gap `--space-4`.
- Each medallion: 72px diameter on phone, 88px on tablet.
- Structure:
  ```tsx
  <div class="stat-medallion">
    <svg class="stat-medallion__ring" ...>
      <!-- Metallic gilt-gold ring, 4px stroke -->
    </svg>
    <div class="stat-medallion__inner">
      <div class="stat-medallion__value">{value}</div>
      <div class="stat-medallion__label">{label}</div>
    </div>
  </div>
  ```
- Ring: gradient `--gilt-gold` to `--gilt-gold-shadow` with a subtle inner shadow for depth.
- Inner: `--parchment-base` fill, `--parchment-ink` text.
- Value: Cinzel 600, 22px, tabular figures.
- Label: Crimson Pro small-caps, 10px, `--parchment-ink-dim`.
- Number change animation: a 240ms gold flash overlay + digit tick on any change. Use a small `<NumberTicker>` component or just `key={value}` with CSS animation on mount.
- Haptic feedback on significant changes (XP gain, level up, gold change > 5): `.selectionChanged()` via `navigator.vibrate?.(10)` wrapper. Feature-detect gracefully.

Values:
1. **Gold** — `char.progress.gold`
2. **HP** — `character.maxHealth` (town mode shows max; scenario mode shows current/max via Active Scenario section, so Overview still shows max for consistent reading)
3. **Scenarios** — `state.party.scenarios?.length || 0` (completed count)
4. **Perks** — `char.progress.perks?.filter(Boolean).length` / `totalPerks` — totalPerks from classData

**`OverviewActiveScenario`** — scenario mode only.

This is the absorbed `PhoneCharacterDetail` content. Port the controls from `PhoneCharacterDetail.tsx`:

- HP bar with +/− buttons (`onChangeHealth`)
- Current conditions list with toggle (`onToggleCondition`)
- Initiative display with picker button
- Long rest toggle (`onToggleLongRest`)
- Exhaust button (`onToggleExhausted` — confirm via `PhoneExhaustPopup` pattern)
- Absent toggle (`onToggleAbsent`)
- Element board if provided (`onMoveElement`)
- Loot card preview if provided

Reuse existing subcomponents where possible (`ElementBoard`, condition rendering). The visual frame around this section is the distinguishing feature:

- Title: `— Active Scenario —` with ornamental leaf glyphs on either side.
- Panel: inset parchment with `--parchment-dark` inner bg (slightly darker than main content), 1px `--class-accent-dim` border, radius `--radius-page-corner`.

**`OverviewCurrentActivity`** — town mode + T8 downtime only.

For T0a, this is a stub that renders only if `char.progress.townLocation` exists (field will be added in T8). Safe to have it always render as `null` for now, commented as T8 hookup.

**`OverviewHandPreview`** — placeholder.

3 card-back SVGs in a row, with subtle fan layout. Tap expands to "Full hand view in Progression tab (T2b)." No interactivity this batch; visual placeholder only with "Hand preview coming in T2b" small-caps label.

---

## Step 5 — Absorb PhoneCharacterDetail; update entry points

### 5a. Update phone character portrait button targets

Grep for the portrait button opening `PhoneCharacterDetail`:

```
app/phone/ScenarioView.tsx (current call site)
app/phone/TownView.tsx (opens disconnect menu currently; add player sheet entry)
app/phone/LobbyView.tsx (if applicable)
```

In each, replace the open-character-detail logic with open-player-sheet:

```tsx
const [showSheet, setShowSheet] = useState(false);

<button class="..." onClick={() => setShowSheet(true)} aria-label="Open character sheet">
  <img src={characterThumbnail(edition, selectedCharacter)} alt="" />
</button>

{showSheet && (
  <PlayerSheet
    character={character}
    edition={edition}
    onClose={() => setShowSheet(false)}
    elements={state.elementBoard}
    lootDeck={state.lootDeck}
    isActive={character.active}
    onChangeHealth={handleChangeHealth}
    /* ...all handlers */
  />
)}
```

### 5b. Delete `PhoneCharacterDetail`?

**Not yet.** Keep the file until all call sites are migrated and smoke-tested. After green smoke, delete it in the same commit with a clear note in the commit body.

Check all consumers:
```bash
grep -rn "PhoneCharacterDetail" app/
```

Should only surface the component itself plus its import sites once T0a migration is complete.

### 5c. Replace controller `CharacterSheetOverlay`

New file `app/controller/overlays/PlayerSheetQuickView.tsx`:

- Renders a read-only Player Sheet in a side-panel or centered modal (iPad landscape: centered 480px wide modal works; check controller's existing overlay sizing patterns).
- Takes a `Character` object passed from whatever GM-side roster triggers it.
- Shows the same tabs, but every interactive control is disabled. Use a `readOnly` prop threaded through `PlayerSheet` and Overview tab subcomponents.
- The Active Scenario section on controller is where GM commands still work (health ±, condition toggle, etc.), same as today. So `readOnly` isn't global; it gates progression tabs (Items, Progression, Personal Quest, Notes, History) — those are player-only during town.

Wire: open from existing controller nav / character roster (wherever `CharacterSheetOverlay` opens from today). Replace import and component name. Delete `CharacterSheetOverlay.tsx` once green.

---

## Step 6 — PlayerSheetIntro animation

### 6a. Component

`app/phone/sheets/PlayerSheetIntro.tsx`. Full-screen overlay above the sheet. 3-second sequence, skippable with single tap.

Sequence (uses CSS animations tied to a state machine):

1. **0–400ms:** Backdrop fades to opaque black. Class sigil fades in center, starts at scale 0.7, eases to 1.0 with class-accent glow building.
2. **400–1000ms:** Character name (and title if present) type on letter-by-letter (staggered fade-in via CSS animation-delay). Cinzel 600, 28px on phone. Color `--class-accent`.
3. **1000–1600ms:** Illuminated capital paints in from the left (scale 0 → 1, origin left-center) via SVG stroke animation on the ornament path + simultaneous fill fade on the letter.
4. **1600–2400ms:** Subtitle *"Your story begins…"* fades in 200ms after capital, holds for 600ms. Crimson Pro italic, 16px, `--parchment-base`.
5. **2400–3000ms:** Everything fades out while sheet fades in behind. `onComplete` fires at 3000ms.

Tap anywhere before 3000ms: skip to completion at 200ms fade-out.

Implementation notes:

- State machine via `useReducer` with 5 phases + skipped.
- Each phase advances via `setTimeout` chained in `useEffect`. Clean up on unmount.
- Skip handler clears all timeouts and jumps to fade-out.
- Respect `prefers-reduced-motion`: skip the animation entirely, just fire `onComplete` immediately after setting the `sheetIntroSeen` flag.

### 6b. Persistence

`onComplete` fires `commands.setCharacterProgress(name, edition, 'sheetIntroSeen', true)`. Subsequent opens skip the intro because `character.progress.sheetIntroSeen === true`.

Edge case: what if the user closes the sheet mid-intro without the flag setting? Use the skip handler to still fire the command on skip, not just on natural completion. Guarantees the intro only plays once per character.

---

## Step 7 — Accessibility

- Sheet overlay is a modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the title.
- Close button focusable and has `aria-label`.
- Tab strip: `role="tablist"`, each tab `role="tab"`, active tab `aria-selected="true"`, `aria-controls` pointing to panel id. Panels `role="tabpanel"` with `aria-labelledby` back to tab.
- Arrow-key navigation on tab strip (Left/Right move selection, Home/End jump to first/last). Space/Enter activates. Do NOT trap focus inside the tab strip; Tab key moves out of the strip into the panel.
- Focus trap on the modal: when sheet opens, focus the close button. When closed, return focus to the portrait button that opened it.
- Close on Escape key.
- All interactive controls have `aria-label` or visible label text.
- Minimum touch targets 44×44px. Tabs bookmark shape: label inside is small caps 13px, but the click area is the full 44px height.
- Color contrast: parchment backgrounds are light; ink text must meet WCAG AA 4.5:1 against `--parchment-aged`. `--parchment-ink` (#3a2e1f) on `--parchment-aged` (#d4c094) = ~8.2:1 ✓.

---

## Step 8 — CSS organization

New file `app/phone/styles/sheets.css`. Imported from phone entry point after `theme.css`.

Sections:

```
/* ── Player Sheet container ── */
/* ── Player Sheet header + illuminated capital ── */
/* ── Player Sheet tabs ── */
/* ── Overview tab ── */
/*   ── XP bar ── */
/*   ── Stat medallions ── */
/*   ── Active Scenario section ── */
/*   ── Current Activity section ── */
/*   ── Hand preview ── */
/* ── Intro animation ── */
/* ── Placeholder tabs ── */
```

BEM throughout: `.player-sheet__header`, `.player-sheet__tab`, `.overview-tab`, `.stat-medallion__value`, etc.

All measurements in design-brief-specified sizes. Use `clamp()` for scaling between phone and tablet where appropriate (e.g., medallion sizing: `clamp(72px, 10vw, 88px)`).

Reduced-motion media query wraps every animation:

```css
@media (prefers-reduced-motion: reduce) {
  .illuminated-capital { animation: none; }
  .stat-medallion__value--changed { animation: none; }
  /* etc. */
}
```

---

## Verification Checklist

### Build / static analysis

- [ ] `npm run build` succeeds on all three client bundles.
- [ ] `tsc --noEmit` clean across server, shared, clients.
- [ ] No remaining imports from `'../phone/characterThemes'` in `app/display/` — all use `'../shared/characterThemes'`.
- [ ] No remaining references to `PhoneCharacterDetail` or `CharacterSheetOverlay` (both deleted) anywhere except commit history.

### Theme migration

- [ ] Phone character theming visually unchanged — load phone, confirm class accent matches what it was before this batch.
- [ ] Display FigureCards get class accents as before.
- [ ] No regression on lobby/scenario screens.

### Player Sheet — phone

- [ ] Tap character portrait in Lobby view → sheet opens.
- [ ] Tap character portrait in Scenario view → sheet opens, Overview tab active, Active Scenario section visible with HP/conditions/initiative controls from old PhoneCharacterDetail.
- [ ] Tap character portrait in Town view → sheet opens, Active Scenario section hidden.
- [ ] Intro animation plays once per character. Verify `char.progress.sheetIntroSeen === true` after first close (via dev tools state inspector).
- [ ] Reopening sheet after intro seen: no animation, straight to sheet.
- [ ] Skipping intro with a tap still sets `sheetIntroSeen`.
- [ ] `prefers-reduced-motion` disables intro animation entirely, flag still sets.
- [ ] Overview XP bar renders with correct fill % for character at level 4 with 120 XP (assuming thresholds 0/45/95/150: 25/55 = 45% fill).
- [ ] At level 9 or XP ≥ max threshold, bar shows MAX, no wax seal.
- [ ] At XP ≥ nextThreshold but level < 9, wax-seal "Level Up" indicator animates in.
- [ ] Stat medallions show correct Gold / HP max / Scenarios completed / Perks applied.
- [ ] Number change flash animation fires on gold change (test by firing a test command changing gold).
- [ ] Active Scenario section during live scenario: HP controls work, conditions toggle, long rest fires command.
- [ ] All 5 placeholder tabs (Items, Progression, PQ, Notes, History) show their "Available in [batch]" message with class-accent-dim emphasis.
- [ ] Tab switching: active underline animates to new tab, incoming panel fades in.
- [ ] Keyboard nav: Tab key reaches close button, arrow keys move tab selection, Escape closes sheet.

### Player Sheet — controller quick-view

- [ ] Controller has a way to view any character's sheet (whatever the current entry point is — likely a roster button). Verify the new PlayerSheetQuickView opens.
- [ ] All progression tabs disabled on controller view.
- [ ] Overview tab readable; Active Scenario section still interactive for GM use (HP ±, conditions).
- [ ] GM can close and reopen cleanly; GM can switch between characters without losing tab state (or with clear UX if tab state resets per character — either is fine, document choice).

### Design quality checks (against design brief)

- [ ] Parchment background renders with gradient + noise overlay + border rule.
- [ ] Illuminated capital shows character's first letter in class-accent color with decorative flourish (single corner ornament, not heavy frame).
- [ ] Class sigil image loads from asset manifest; if missing, log but don't render placeholder.
- [ ] Tab bookmarks have beveled corner, active tab's class-accent underline fills 76% of tab width (12% inset both sides).
- [ ] Stat medallions have metallic gilt ring, parchment inner, tabular figures.
- [ ] XP bar ink fill uses class-accent gradient, not generic green/blue.
- [ ] Wax-seal level-up indicator uses gilt-gold with embossed appearance (subtle inner shadow).
- [ ] Sheet open/close animates with page-turn easing (300ms, scale 0.96 → 1.0 + opacity).
- [ ] Intro animation flows through all 5 phases visibly; class sigil + illuminated capital + subtitle all render correctly.

### Accessibility

- [ ] VoiceOver (iOS) reads sheet title, tab names, active tab state, medallion labels + values.
- [ ] Focus ring visible on close button and tabs when keyboard-navigated.
- [ ] Modal focus trap works — Tab cycles within sheet, doesn't escape to underlying page.
- [ ] Contrast passes WCAG AA throughout.
- [ ] Escape key closes sheet.

### Regressions

- [ ] T1 rewards overlay still triggers on scenario end; reading state.finishData.
- [ ] T1.1 display dismiss-after-phones-dismiss still works.
- [ ] Scenario play untouched.
- [ ] Lobby → scenario → town flow unchanged.

---

## Documentation (mandatory)

- **`docs/BUGFIX_LOG.md`** — any regressions or surprises found.
- **`docs/DESIGN_DECISIONS.md`** — entry:
  *"T0a: Player Sheet landed as canonical character home, absorbing `PhoneCharacterDetail` and replacing controller `CharacterSheetOverlay`. characterThemes.ts promoted to app/shared/. Player Sheet design system (parchment + leather + gilt tokens, illuminated capitals, stat medallions, wax-seal indicators) established as reference for T0b/c/d. Class-color CSS vars set inline from the theme map rather than duplicated in CSS. One-time intro animation persists via `CharacterProgress.sheetIntroSeen` + new `setCharacterProgress` command."*
- **`docs/ROADMAP.md`** — add Phase T0 subsection; mark T0a complete; list T0b/c/d upcoming; note T2a-d now target Player Sheet tabs.
- **`docs/PROJECT_CONTEXT.md`** — add `setCharacterProgress` to Commands Quick Reference; update repo layout to mention `app/phone/sheets/`; update "Phone" description in Components section.
- **`docs/APP_MODE_ARCHITECTURE.md`** — update the "Phone (portrait)" Character Sheet table to reflect actual tabs (Overview / Items / Progression / Personal Quest / Notes / History); note that it's now the canonical sheet, not a town-only surface.
- **`docs/COMMAND_PROTOCOL.md`** — document `setCharacterProgress`.
- **`docs/ASSET_REQUESTS.md`** — create if not exists; log any missing assets surfaced during build (class sigils that don't resolve, etc.).

---

## Commit Message

```
feat(phase-t0a): Player Sheet shell + Overview tab (design system reference)

Establishes the Player Sheet as the canonical character home, accessible
from every mode (lobby, scenario, town). Absorbs PhoneCharacterDetail
into Overview tab's Active Scenario section. Replaces the controller's
read-only CharacterSheetOverlay with a new PlayerSheetQuickView that
renders the same sheet in read-only mode for GM inspection.

Design system:
- Parchment, leather, gilt, class-accent tokens in theme.css
- Class-color CSS variables set inline from shared characterThemes map
  (migrated from app/phone/ to app/shared/)
- Stylized-modern illuminated capitals on the header
- Stat medallions with metallic gilt rings
- XP bar as parchment strip with ink fill; wax-seal level-up indicator
- Page-turn / ink-settle motion easings; reduced-motion fallbacks
- Cinzel display + Crimson Pro body established at sheet-scale

Tabs (structure only for non-Overview this batch):
- Overview ✓ full implementation
- Items (T2a), Progression (T2b+d), Personal Quest (T2c),
  Notes (T0d), History (T0d) — placeholders

One-time intro animation ("Your story begins…") with persisted
char.progress.sheetIntroSeen via new setCharacterProgress command
(character-scoped, phone-whitelisted).

Removes: PhoneCharacterDetail, CharacterSheetOverlay (absorbed).

Docs: PHASE_T0_SCOPE, PHASE_T0_DESIGN_BRIEF referenced from ROADMAP.
DESIGN_DECISIONS, PROJECT_CONTEXT, APP_MODE_ARCHITECTURE,
COMMAND_PROTOCOL updated. ASSET_REQUESTS created.

Baseline: T1 + T1.1 complete. Part of Phase T0 (Sheets).
```

---

## Notes to Claude Code

1. **Produce a Plan first and wait for confirmation before editing files.** The Plan should list every file you'll touch, in what order, with a one-line rationale each. Particularly flag the migration of `characterThemes.ts` — that needs to be its own logical unit that green-builds before sheet work starts.
2. **Do the `characterThemes.ts` migration first and smoke-test it in isolation** before touching Player Sheet scaffolding. If the migration breaks display figure cards or phone theming, we find out cleanly.
3. **Design brief is authoritative on look & feel.** If you find ambiguity, surface it — don't invent.
4. **Illuminated capital: stylized-modern**, per Kyle. One corner ornament, NOT heavy ornate frames. Reference: modern book design (Penguin Classics covers), not medieval manuscripts.
5. **Editable fields commit mode for future tabs:** hybrid — blur/Enter commits immediately + typing-pause auto-save at 1000ms. T0a doesn't have editable fields (Notes is T0d), but bake this pattern into `app/phone/sheets/shared/` utility hooks if you build them preemptively. Otherwise wait for T0d.
6. **Display decorative mode** (campaign/party sheets on display during idle): 30-second tab rotation. T0a doesn't implement this; T0b does. Just noting.
7. **Do not preempt T2a items work.** Items tab is a labeled placeholder only. Interactive items UI is T2a's job and its prompt will be rewritten post-T0a to target the Items tab home.
8. **Do not preempt T8 town coordination.** Overview tab's "Current Activity" section is a commented stub — don't try to wire it to `townLocation` today because that field doesn't exist yet.
9. **Grep before assuming barrel exports.** If you add exports from `app/shared/` ensure index files (if any) re-export appropriately.
10. **Haptic feedback:** feature-detect `navigator.vibrate`. If absent, no-op. Do not try to use `Haptics` APIs that require Capacitor or native bridges — we're a pure web app.
11. **If asset manifest doesn't have class sigils for all classes**, log them to `docs/ASSET_REQUESTS.md` and render with no image (empty alt) rather than a fallback. Per `app/CONVENTIONS.md`, broken asset = real bug.
12. **Smoke test order after all changes:** load phone lobby → open sheet from portrait → verify intro fires → close → reopen → verify no intro → enter scenario mode → reopen sheet → verify Active Scenario section renders → adjust HP, verify it works → go to town mode → reopen sheet → verify Active Scenario gone → load controller → open PlayerSheetQuickView on same character → verify read-only.
