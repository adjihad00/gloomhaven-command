# Phase T0 — Design Brief

**Companion to:** `PHASE_T0_SCOPE.md`.
**Audience:** Claude Code when implementing T0a–d, and Kyle for design
sign-off before any code is written.
**Goal:** Make the three sheets feel like artifacts worth keeping — the
digital equivalent of a well-loved campaign binder. Every design
decision below should be traceable to that goal.

---

## Design philosophy

### Anti-patterns to avoid

- Generic SaaS dashboards. If the sheet looks like a project management
  tool, we failed.
- "Material Design" cards with flat shadows and uniform corner radii
  across all content. Every piece of information doesn't get the same
  visual weight.
- Uniform tabs that feel like browser tabs. Sheets are ledgers, not
  browsers.
- Modern productivity-app empty states ("Add your first item!"). Empty
  states here mean narrative — "No personal quest chosen yet. Visit the
  Sanctuary to choose your path."
- Skeuomorphism as gimmick. No faux leather tooling, no drop-shadowed
  paper that says *I am pretending to be paper*. The aesthetic is
  **earned weight**, not costume.

### Target feeling

- **Player Sheet:** a hero's personal grimoire. Parchment, class-colored
  illuminated capitals, the sense that this page has been written on by
  hand over many sessions. Intimate.
- **Party Sheet:** the GM's campaign ledger. Leather-bound, gilt edges,
  organized tabs with brass reinforcements. Authoritative, practical.
- **Campaign Sheet:** an in-world atlas/codex. Scrolls and maps for the
  scenarios/outpost tabs; tactile checklists for prosperity and
  donations. The world's own record.

### Shared language

All three sheets share:
- Type system (Cinzel headings, Crimson Pro body — already in
  `theme.css`).
- Color tokens (extend the existing `--accent-gold`, `--accent-copper`).
- Edition theming (`data-edition` attribute; GH warm gold, FH ice blue
  applied to accents and glows; tokens already defined).
- Motion language (gentle, physical, with weight — never snappy or
  elastic; page-turn easing, not UI-library easing).

Beyond the shared language, each sheet has a distinct **personality
marker** — one signature element that makes it instantly recognizable:

- Player Sheet: **illuminated capital** on the character name (first
  letter treated like a medieval manuscript drop-cap, in class color).
- Party Sheet: **gilt tab edges** on the vertical tab strip (each tab
  bound with a thin gold metallic rule).
- Campaign Sheet: **wax-sealed headers** at the top of each tab content
  area (an embossed seal motif in accent-copper, tab-specific icon).

---

## Design tokens — extensions to `theme.css`

Add to `app/shared/styles/theme.css`:

```css
:root {
  /* ── Parchment / paper textures ── */
  --parchment-base: #e8d9b8;
  --parchment-aged: #d4c094;
  --parchment-dark: #b8a47a;
  --parchment-ink: #3a2e1f;
  --parchment-ink-dim: #5c4a33;

  /* ── Leather / binding ── */
  --leather-brown: #4a3020;
  --leather-brown-deep: #2d1810;
  --leather-seam: #6b4428;
  --gilt-gold: #c9a961;
  --gilt-gold-shadow: #8a6d2e;

  /* ── Class-color accents (overridden per-character via data-class) ── */
  --class-accent: var(--accent-gold);
  --class-accent-glow: rgba(211, 166, 99, 0.4);
  --class-accent-dim: rgba(211, 166, 99, 0.15);

  /* ── Sheet-specific surfaces ── */
  --sheet-player-bg: radial-gradient(
    ellipse at top,
    var(--parchment-base) 0%,
    var(--parchment-aged) 70%,
    var(--parchment-dark) 100%
  );
  --sheet-party-bg: linear-gradient(
    180deg,
    var(--leather-brown) 0%,
    var(--leather-brown-deep) 100%
  );
  --sheet-campaign-bg: radial-gradient(
    circle at 30% 20%,
    var(--leather-brown) 0%,
    var(--leather-brown-deep) 60%,
    #1a0f08 100%
  );

  /* ── Motion ── */
  --ease-page-turn: cubic-bezier(0.4, 0.0, 0.2, 1);
  --ease-ink-settle: cubic-bezier(0.2, 0.8, 0.3, 1);
  --duration-page-turn: 400ms;
  --duration-ink-settle: 240ms;

  /* ── Sheet-specific radii ── */
  --radius-page-corner: 3px;    /* parchment corners are crisp, not rounded */
  --radius-bookmark: 0 8px 8px 0;
  --radius-wax-seal: 50%;
}

/* Class-color overrides — Claude Code should read edition data to wire these */
[data-class='brute'] { --class-accent: #c44a3c; --class-accent-glow: rgba(196, 74, 60, 0.4); }
[data-class='tinkerer'] { --class-accent: #6a8faa; --class-accent-glow: rgba(106, 143, 170, 0.4); }
[data-class='spellweaver'] { --class-accent: #a855c4; --class-accent-glow: rgba(168, 85, 196, 0.4); }
[data-class='scoundrel'] { --class-accent: #6b4a28; --class-accent-glow: rgba(107, 74, 40, 0.4); }
[data-class='cragheart'] { --class-accent: #7b6239; --class-accent-glow: rgba(123, 98, 57, 0.4); }
[data-class='mindthief'] { --class-accent: #3a5f7a; --class-accent-glow: rgba(58, 95, 122, 0.4); }
/* ... continue for all classes, GH + FH; colors sourced from edition data */
```

**Note on class colors:** reference edition data for each class has a
canonical color. Claude Code should read from the edition data files
rather than the hardcoded examples above, which are illustrative. The
convention is `data-class="brute"` on the sheet root, and every
interior accent uses `--class-accent`.

---

## Typography

**Display weight (sheet titles, tab names, character name):**
- Cinzel at 500–600 weight
- Letter-spacing: 0.04em for titles, 0.02em for tab labels
- All-caps for tab labels, mixed case for titles

**Body (stats, descriptions, tooltips):**
- Crimson Pro at 400–500 weight
- Line-height: 1.4–1.5 (generous; this is reading material, not UI)
- Numeric tabular figures for stats: `font-feature-settings: 'tnum' 1`

**The illuminated capital (Player Sheet):**
- Cinzel Decorative or similar display face, or Cinzel at 700 with a
  thick decorative border frame via SVG
- Color: `--class-accent`, filled with `--parchment-dark` pattern
- Size: 2.5× body, occupies two lines (first letter of character name
  or title)

**Numeric emphasis:**
- Level numbers, HP values: Cinzel 600 at 1.5×–2× body size, in
  `--parchment-ink` for Player Sheet, `--gilt-gold` for Party/Campaign.

---

## Player Sheet — layout spec

### Phone (portrait, primary)

Dimensions target: 390×844 baseline (iPhone 15 Pro). Must scale up to
tablet portrait gracefully. **No landscape lock** — this view is
consumable in landscape too.

```
┌─────────────────────────────────────┐
│ ← close    [class sigil]     … menu │  ← 56px header
├─────────────────────────────────────┤
│                                     │
│   ╔═══╗                             │
│   ║ B ║  Brute                      │  ← illuminated capital + title
│   ╚═══╝  Level 4   Scenarios: 12    │
│                                     │
├─────────────────────────────────────┤
│ [Overview] Items  Hand  Perks  ...  │  ← horizontal tab strip, sticky
├─────────────────────────────────────┤
│                                     │
│  ┌─── XP ──────────────────────┐   │
│  │ ▓▓▓▓▓▓▓▓░░░░░░░░░  95/150  │   │  ← progress bar, parchment texture
│  └─────────────────────────────┘   │
│                                     │
│  Gold    HP      Scenarios   Perks │  ← stat row: 4 metrics as "coins"
│   127    10      12/60       3/18  │     (each is a circular medallion)
│                                     │
│  ─── Active Scenario ───────────   │  ← only in scenario mode
│    [HP bar with heart]             │
│    [initiative + conditions]       │
│    [actions: long rest / exhaust]  │
│                                     │
│  ─── Current Activity ──────────   │  ← only in town (T8 downtime)
│    At the Craftsman · tap to open  │
│                                     │
│  ─── Hand Preview ─────────────    │
│    [3 card backs, tap to expand]   │
│                                     │
└─────────────────────────────────────┘
```

Key visual elements:

**Parchment texture:** background uses `--sheet-player-bg`. Overlaid
with a subtle noise SVG (≤3% opacity) for grain. A faint hand-drawn
border rule in `--class-accent-dim` frames the content, inset 12px
from the edges, broken at the tab strip.

**Illuminated capital:** SVG component, fixed aspect (roughly 80×80),
sits to the left of the character title. First letter of
`character.title` (or name if title empty). Filled with
`--class-accent` on a parchment-dark ornamental frame. Frame design can
be a simple interlaced border — keep it stylized, not literal medieval
(which would clash with the tabletop aesthetic).

**Stat medallions:** each stat is a circular badge with metallic rim
(`--gilt-gold` gradient ring, `--parchment-base` inner). Number in
Cinzel 600, label in small-caps below. 64px diameter on phone, scales
up to 80px on tablet.

**XP bar:** not a generic progress bar. A horizontal parchment strip
with ink filling in from left. Shows current XP numerator + next-level
denominator at right. When nearing threshold (within 10%), the strip
pulses with class-color glow. At threshold, a subtle "seal" appears at
the right edge indicating "Level Up available."

**Tab strip:** horizontally scrollable. Each tab is a small bookmark
tab shape — rectangle with a beveled bottom-right corner. Active tab
has `--class-accent` underline and a slight rise (like a selected
bookmark). Inactive tabs are flat. 44px tall minimum for touch.

**Active Scenario section (scenario mode only):** visually distinct,
framed as a "current page" panel. Carries all the controls from today's
`PhoneCharacterDetail` — HP bar, conditions, initiative, long-rest,
exhaust. This is the tabbed-overlay replacing that existing component,
NOT a new surface.

**Current Activity section (town mode only during T8 downtime):**
minimal band showing current building + tap-to-jump-to-that-tab
affordance.

### Motion patterns (Player Sheet)

- Tab switch: 240ms ink-settle, slight vertical nudge (-2px) on the
  incoming tab content for a settling feel.
- Stat medallion number change: digit tick with a subtle gold flash.
- XP threshold crossing: the right-edge seal fades in with a 400ms
  wax-impression animation.
- Sheet open: fade + scale from 0.96 → 1.0 over 300ms, page-turn
  easing.
- Sheet close: inverse.

---

## Party Sheet — layout spec

### Controller (iPad landscape, primary)

Dimensions target: 1194×834 (iPad Pro 11 landscape). Must scale down
to 1024×768 (older iPads).

```
┌────────────────────────────────────────────────────────────────┐
│  ← close           The Hand of Ages                       … │  ← 64px header
├──┬─────────────────────────────────────────────────────────────┤
│▓▓│                                                            │
│R │    ═══  Party Standing  ═══                                │
│ō │                                                            │
│st│    Party Name:  The Hand of Ages          [edit]           │
│er│    Reputation:  +7                                         │
│  │    ╔════════════════════════════════════╗                  │
│▓▓│    ║  [-20 ◄───────●─────────► +20]    ║  price: −2g      │
│St│    ╚════════════════════════════════════╝                  │
│an│                                                            │
│di│    Party Achievements                                      │
│ng│     • The Merchant's Friend                                │
│  │     • Low Reputation (expired)                             │
│▓▓│                                                            │
│Lo│    Party Notes                                             │
│ca│     ┌────────────────────────────────────┐                 │
│ti│     │ Got into a bar fight in Frosthaven │                 │
│on│     │ last week. Still owe 5g to Ivor.   │                 │
│  │     └────────────────────────────────────┘                 │
│▓▓│                                                            │
│Re│                                                            │
│so│                                                            │
└──┴─────────────────────────────────────────────────────────────┘
```

Key visual elements:

**Background:** `--sheet-party-bg` leather gradient. Overlay a very
subtle grain at 2% opacity. Inset bevel at the edges (2px dark inner
shadow) reinforces the binding.

**Left tab strip (200px wide, full height):**
- Dark leather background, separate from content panel.
- Each tab: stacked vertically, 72px tall. Label in Cinzel small caps.
- Active tab: bleeds into the content area (tab continues into content
  panel with `--gilt-gold` rule connecting them); inactive tabs have
  a thin gilt underline only.
- Signature element: a 1px gilt metallic rule runs along the right
  edge of the tab strip, continuous full height. Active tab breaks it
  at its row, giving the impression of a physical brass-reinforced
  binding.

**Content panel:** lighter leather (`--leather-brown` vs deep).
Section headers use the wax-seal header pattern (see Campaign Sheet
below; reused here at smaller size).

**Reputation slider:** custom control, not a native HTML range input.
Horizontal parchment strip with embossed tick marks at −20, −10, 0,
+10, +20. Draggable gilt gem for current value. Below: live-calculated
price modifier in `--gilt-gold`.

**Editable text fields:** inline. Click to edit, blur/enter to commit
via `updateCampaign` command. Displays as parchment-inset panel with
ink text when not focused; becomes editable with a subtle lighten + 1px
gilt border on focus.

### Display (decorative, secondary)

When nothing else claims the display during lobby/town idle, the
display shows a **non-interactive Party Sheet layout** scaled to
1080×1920 portrait. Same left-tab + content structure, but:

- Auto-cycles through tabs every 12 seconds with a page-turn
  transition.
- No editable affordances — remove focus rings, cursors.
- Subtle candlelight flicker effect on the gilt accents (already
  available as a CSS animation from scenario-mode work).

---

## Campaign Sheet — layout spec

### Controller (iPad landscape, primary)

Same frame as Party Sheet (left tab strip + content panel) but with
`--sheet-campaign-bg` (deeper, more dramatic leather gradient with
cartographic feel).

```
┌────────────────────────────────────────────────────────────────┐
│  ← close           Frosthaven: Year One              … │
├──┬─────────────────────────────────────────────────────────────┤
│Pr│                                                            │
│os│    ⚙ Prosperity ⚙                                          │
│pe│                                                            │
│ri│    Level 3                                                 │
│ty│                                                            │
│  │    ▓▓▓▓▓▓▓▓░░░░░░  4/7 to Prosperity 4                    │
│Sc│                                                            │
│en│    ┌──────────────────────────────────────────────┐        │
│ar│    │ Unlocked at each level (click to preview):   │        │
│io│    │                                              │        │
│s │    │  1 ✓  Beginner items                         │        │
│  │    │  2 ✓  +2 HP for all new characters           │        │
│Un│    │  3 ✓  New items unlocked                     │        │
│lo│    │  4 ●  Rare consumables (4 more needed)       │        │
│ck│    │  5    ?                                      │        │
│s │    └──────────────────────────────────────────────┘        │
└──┴─────────────────────────────────────────────────────────────┘
```

### Signature: wax-sealed tab headers

Top of each tab content area (right panel) begins with a **wax seal
header**: circular seal motif in `--gilt-gold-shadow` with tab-specific
icon centered (gears for Prosperity, scroll for Scenarios, treasure
chest for Unlocks, coin stack for Donations, shield for Achievements,
building for Outpost, settings gear for Settings). The tab title sits
to the right of the seal.

### Scenarios tab — flowchart visualization

Use D3.js (already imported for other visualizations) or custom SVG
rendering to draw a scenario unlock graph. Nodes = scenarios,
positioned by their `scenarios.coordinates_json` if available,
auto-layout otherwise. Edges = unlock chains (directional).

Node states:
- **Completed:** gilt coin medallion with check
- **Available:** parchment medallion, slight glow
- **Locked (requirements unmet):** dark medallion, icon muted
- **Blocked (explicitly blocked by other scenario completion):** red
  X overlay
- **Casual:** faded edge

Pan + zoom with touch-drag and pinch. Tap a node for a detail popover
showing completion metadata.

### Outpost tab — the centerpiece (FH)

This is the richest single surface in the whole project. It's also
what the display renders in idle town state. Worth the most design
effort.

**Background:** Top-down illustration of the outpost (Frosthaven base
camp). Use Worldhaven asset if available via `asset_manifest`; if not,
commission or create a stylized layout.

**Buildings layered on map:**
- Each building has an on-map position (read from edition data or
  defined in a new `building_positions.json` if data doesn't include
  it).
- Building state determines visual: constructed buildings render their
  proper illustration, unbuilt show a ghosted footprint, damaged show
  a smoke plume overlay, wrecked show ruined sprite.
- Tap a building → detail panel slides in from right with building
  info, operations, upgrade options.

**Calendar strip:** below the map. Shows current week, season icon,
triggered week sections as pips. Advancing a week (T3 command)
animates the week marker.

**Ambient effects:** snow particles (FH preset already exists in
display ambient system). Fog layer at bottom of map. Candlelight
flickers on lit buildings (those with active operations).

**Resource pills:** floating at top of the tab — morale, defense,
soldiers, inspiration, trials. Each a leather pill with metallic
numeral. Subtle pulse when changed via command.

### Display rendering

Campaign Sheet on display uses the same logic as Party Sheet: cycles
through tabs, but spends more time on the Outpost tab (weight the
rotation 3× for Outpost in FH) since that's the most compelling
ambient view.

---

## Motion & interaction specifications

### Tab transitions
All three sheets use the same tab-transition pattern:
- Outgoing tab content: fade out 120ms.
- Incoming tab content: fade + vertical nudge in 180ms with
  ink-settle easing.
- Concurrent, not sequential — total transition is 180ms.

### Sheet open/close
- Open: backdrop dims over 200ms, sheet fades + scales (0.96 → 1.0) in
  300ms with page-turn easing.
- Close: reverse; backdrop dims 150ms after sheet begins closing.

### Wax seals & illuminated capitals
- Wax seal headers fade in 400ms after tab content settles — they're
  presentation elements, not interactive elements, so they arrive with
  a slight delay for emphasis.
- Illuminated capital on Player Sheet Overview fades in with its drop
  shadow over 500ms on first open; subsequent opens skip the animation
  (cached via a ref).

### State-change animations
- Stat changes (gold +N, HP change): number ticks up/down with a gold
  flash over 240ms.
- XP threshold crossing: wax seal animates in at the right edge of the
  XP bar over 600ms.
- Building construction (Campaign Sheet Outpost): ghost footprint
  solidifies over 900ms; a subtle dust cloud puffs at animation end.
- Prosperity increase: the new level's unlock reveal slides up from
  below the checkbox with a 400ms page-turn.

### Haptics (phone only)
- Tab switch: soft selection haptic (iOS `.selectionChanged()`).
- Level-up available: notification haptic (`.notificationSuccess`).
- Equip/unequip (T2a, inside Items tab): light impact haptic.

### Reduced motion
Respect `prefers-reduced-motion`. Disable all scale/translate
animations; keep only opacity changes. No haptics (already opt-in).

---

## Asset inventory needed

Before T0a coding begins, check the asset manifest for what exists and
flag gaps:

- **Class sigils** (medium-large SVG or PNG, per class). Used on
  Player Sheet header. Likely exists — check `asset_manifest` for
  `category='class-sigil'` or similar.
- **Illuminated capital frames** — decorative SVG borders for drop
  caps. **Probably missing.** Options: commission; create with a
  reusable SVG frame ornament design; use a free art asset with
  appropriate licensing (e.g. Folger Shakespeare Library public-domain
  initials, which would need visual style adjustment).
- **Wax seal icons** — per-tab seal motif. **Probably missing.**
  Create a single reusable SVG seal shape + swap center icons from
  existing icon library (`Icons.tsx`).
- **Building illustrations** (FH) — per-building top-down sprite.
  Check `asset_manifest category='building-illustration'`.
- **Outpost map background** — the Frosthaven base camp illustration.
  Check Worldhaven assets. Likely exists.
- **Parchment / leather textures** — seamless tiles, low opacity. Can
  source free noise textures or generate with CSS / SVG filters.

Gaps identified during T0a should be captured in a new
`docs/ASSET_REQUESTS.md` so they can be commissioned / created as a
parallel track without blocking code.

---

## Per-sheet opening animation — one-time special effect

First time a player opens their Player Sheet after joining a new
campaign, run an **introduction animation**:
- Black backdrop.
- Character class sigil fades in.
- Character name and title type on, letter by letter.
- Illuminated capital paints in.
- "Your story begins..." subtitle fades in, then out.
- Sheet reveals.
- Duration: ~3 seconds. Skippable with a tap.

Persisted flag `char.progress.sheetIntroSeen` (boolean, new field in
T0a). Set on completion.

Same concept for Party Sheet on first campaign open (GM sees it once).
And Campaign Sheet on first campaign open. Each has its own motif:
- Player: illuminated name paint-in.
- Party: leather book opening animation.
- Campaign: map unfurling.

These are **one-time moments.** They set tone, then the sheets become
everyday tools.

---

## Open questions for Kyle before T0a coding

1. **Illuminated capital style:** Medieval manuscript-style (heavily
   ornamented), art nouveau (flowing), or stylized-modern (clean with
   a single decorative flourish)? Lean toward stylized-modern to match
   the existing visual system unless Kyle prefers deeper.
2. **Class color sourcing:** confirm there's class color data in
   edition files. If not, T0 needs to define the palette in code —
   that's fine but worth flagging.
3. **Editable fields commit mode:** blur vs Enter vs auto-save after
   typing pause? Preferred: blur or Enter commits; typing pause
   auto-saves after 1200ms to avoid losing in-progress edits.
4. **Display decorative mode schedule:** is 12-second tab rotation
   right, or should we wait longer (say 30s) per tab so the display
   doesn't feel restless?
5. **Phone tab count pragmatism:** 9 tabs on the Player Sheet is a lot.
   Willing to accept horizontal scrolling? Or should we group
   (Overview / Items / Progression [= Perks+Level+Enhance] / Quest /
   Notes / History — 6 tabs)?

---

## Where to save this

Repo: `docs/PHASE_T0_DESIGN_BRIEF.md`. Reference from `PHASE_T0_SCOPE.md`
and `docs/ROADMAP.md`.
