# Phone View Design & Implementation — Claude Code Prompt

## Skills to Read FIRST

Before doing anything, read these skill files in order:

1. **UI/UX Pro Max skill** — Read ALL `.md` files in:
   `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
2. **Frontend Agent skills** — Read ALL `.md` files in:
   `C:\Users\Kyle Diaz\.agents\skills\`
3. **Project conventions** — Read `app/CONVENTIONS.md`
4. **Phone handoff spec** — Read `docs/phone-view-handoff.md`

These skills define the design system, component patterns, and quality bar.
Priority when skills conflict: (1) `app/CONVENTIONS.md`, (2) UI/UX Pro Max, (3) agent skills.

---

## What You're Building

The **Phone Client** for Gloomhaven Command — a portrait-oriented, character-scoped companion view for a single player's phone during tabletop Gloomhaven/Frosthaven sessions. This is Phase 3 of the project roadmap.

### Context

- **Controller** (iPad, landscape) is COMPLETE — 13 fix batches shipped. It handles all GM functions.
- **Phone** has a scaffold in `app/phone/` with working connection, character picker, and placeholder views.
- **Display** (TV/monitor) is not started.

The phone shows ONLY what one player needs: their character's HP, initiative, conditions, XP, loot, summons, and turn status. It does NOT show other characters, monsters, modifier decks, element board, or door controls.

---

## Design Direction

**Aesthetic:** Dark fantasy tabletop companion — NOT a generic mobile app. Think aged parchment under candlelight, copper and gold metallics, deep browns with warm highlights. This is a game piece that sits on a medieval fantasy table.

**Fonts:** Cinzel (display/headings) + Crimson Pro (body). Already self-hosted as woff2. CSS vars in `app/shared/styles/theme.css`.

**Colors:** Use existing CSS variables — `--accent-gold`, `--accent-copper`, `--health-green`, `--negative-red`, `--shield-blue`, `--elite-gold`. Base is `#1a1410`.

**Icons/Assets:** GHS SVG/PNG assets EXCLUSIVELY. Located at `assets/ghs/images/`. No emoji, no generic icons, no fallbacks. A broken image means a path error — fix it, don't hide it.

**Key constraint:** This runs on phones at a gaming table. Large tap targets (44px minimum per Apple HIG), `touch-action: manipulation` on ALL interactive elements, portrait orientation locked, max width ~430px viewport.

---

## Phase 1: Design Exploration (DO THIS FIRST)

Before writing any production code, create **interactive Preact prototypes** as standalone `.jsx` artifacts to explore the phone layout. These are design comps, not production files — use them to nail the visual language and interaction flow.

### Prototype 1: Phone ScenarioView — Full Layout

Build a single-screen portrait layout showing all sections for a character mid-scenario. Use realistic mock data (e.g., Level 5 Brute, 8/14 HP, initiative 42, wound + strengthen active, 3 XP, 1 loot, 1 summon).

**Sections top to bottom:**

1. **Character Header** — class name, level badge, thin color accent bar matching class color (`character.color` from edition data, e.g., Brute = `#35acd5`). Compact — this isn't the hero. HP and initiative are the heroes.

2. **HP Section** — THE dominant visual element. Large health bar spanning full width. Blood drop icon (from `Icons.tsx`). Current/max as large numerals. +/- buttons flanking the bar. The bar should feel physical — like a life gauge carved into stone or leather.

3. **Initiative Section** — Large initiative number (or zzz icon for long rest). Phase-aware states:
   - Draw phase: tappable, opens numpad overlay
   - Play phase, not yet turn: shows value, "Waiting..." subtext
   - Play phase, active turn: gold glow, "Your Turn" badge
   - Play phase, turn complete: dimmed, "Done" state

4. **Turn Status Banner** — Clear, unmissable. Three states:
   - **Your Turn**: warm gold glow, pulsing subtle animation
   - **Waiting**: muted, shows position in initiative order (e.g., "3rd")
   - **Turn Complete**: dimmed with checkmark

5. **Condition Strip** — Horizontal scrollable row of active condition icons. Each condition shows its GHS icon. Tap to remove. "+" button at end opens condition picker overlay. Icons should be 36-40px — visible at a glance across the table.

6. **XP + Loot Row** — Side by side. XP star icon + count (tap to +1). Loot/gold bag icon + count (tap to +1). These are secondary — important but not dominant.

7. **Summons Section** (conditional) — Only renders when summons exist. Compact cards with summon name, HP bar, condition icons. Tap to expand for HP +/- and condition management.

8. **Action Buttons** — Bottom-anchored toolbar:
   - Long Rest toggle (when in draw phase)
   - End Turn (when active, during play phase)
   - Exhaust (danger zone — needs confirmation)

### Prototype 2: Initiative Numpad Overlay

The controller already has `app/controller/overlays/InitiativeNumpad.tsx`. Review its design and create a phone-optimized version:
- Full-viewport overlay with dark backdrop
- 3×3+1 numpad grid (1-9, 0) with large keys (60px+ height)
- Long Rest button (clock/zzz icon) as an alternative to entering a number
- "Clear" and "Confirm" buttons
- Current value displayed large at top
- Dark fantasy styling — keys should look like stone tiles or carved buttons, not flat Material Design

### Prototype 3: Character Detail Panel

Tap the character header to slide open a detail panel (overlay from bottom). Shows:
- Full condition grid (all edition-appropriate conditions, toggleable)
- Larger HP controls
- XP controls with +/- and career total display
- Loot/gold controls with +/- 
- Level + XP progress bar toward next level
- Long Rest toggle
- Absent / Exhausted toggles (with confirmation for Exhausted)

### Prototype 4: Condition Picker Overlay

Triggered by "+" on the condition strip. Shows:
- Grid of all edition-appropriate condition icons (use `getConditionsForEdition()` logic)
- Split into Positive (top) and Negative (bottom) sections
- Each icon is a large tappable tile (48px+) with condition name below
- Tap to apply, overlay dismisses
- Already-active conditions shown as selected/highlighted
- Dark backdrop, centered panel

---

## Phase 2: Component Architecture Plan

After the prototypes are approved, plan the production component tree. Here's the target structure — adjust based on what the prototypes reveal:

```
app/phone/
├── App.tsx                    — (EXISTS) Connection → Picker → ScenarioView
├── CharacterPicker.tsx        — (EXISTS) Grid selection
├── ConnectionScreen.tsx       — (EXISTS) Game code input
├── ScenarioView.tsx           — (REBUILD) Main phone scenario screen
├── TownView.tsx               — (PLACEHOLDER) Future
├── components/
│   ├── PhoneCharacterHeader.tsx   — Name, level, class color
│   ├── PhoneHealthBar.tsx         — Large HP bar with +/- controls
│   ├── PhoneInitiativeSection.tsx — Initiative display + numpad trigger
│   ├── PhoneTurnBanner.tsx        — Turn status indicator
│   ├── PhoneConditionStrip.tsx    — Horizontal condition scroll
│   ├── PhoneCounterRow.tsx        — XP + Loot side-by-side
│   ├── PhoneSummonSection.tsx     — Conditional summon cards
│   └── PhoneActionBar.tsx         — Bottom toolbar
├── overlays/
│   ├── PhoneInitiativeNumpad.tsx  — Numpad overlay (may reuse/adapt controller's)
│   ├── PhoneConditionPicker.tsx   — Condition grid overlay
│   └── PhoneCharacterDetail.tsx   — Expanded character panel
├── styles/
│   └── phone.css                  — All phone-specific styles (BEM)
├── main.tsx                   — (EXISTS) Preact render
└── index.html                 — (EXISTS) HTML shell
```

### Shared Component Reuse Strategy

These shared components from `app/components/` should be evaluated for reuse vs. phone-specific variants:

| Shared Component | Reuse? | Notes |
|-----------------|--------|-------|
| `HealthControl.tsx` | **Adapt** — may need larger variant for phone |
| `ConditionGrid.tsx` | **Reuse** for the detail panel overlay |
| `ConditionIcons.tsx` | **Reuse** for the strip display |
| `InitiativeDisplay.tsx` | **Reuse** for value rendering |
| `SummonCard.tsx` | **Reuse** directly |
| `Icons.tsx` | **Reuse** — all icons needed |
| `CharacterBar.tsx` | **Don't reuse** — too controller-specific |
| `MonsterGroup.tsx` | **Skip** — phone doesn't show monsters |
| `ScenarioHeader.tsx` | **Skip** — phone has own header |
| `ScenarioFooter.tsx` | **Skip** — phone has own action bar |

### Hook Usage

All hooks from `app/hooks/` are used as-is:
- `useConnection` — WebSocket lifecycle (already wired in App.tsx)
- `useGameState` — extract character data from GameState
- `useCommands` — send commands (setInitiative, changeHealth, etc.)
- `useDataApi` — fetch edition data for condition lists, XP thresholds

---

## Phase 3: Implementation Order

After design approval:

1. **P1**: `PhoneHealthBar` + `PhoneCharacterHeader` — the visual anchor
2. **P2**: `PhoneInitiativeSection` + `PhoneInitiativeNumpad` — critical for gameplay
3. **P3**: `PhoneTurnBanner` + `PhoneActionBar` — turn management
4. **P4**: `PhoneConditionStrip` + `PhoneConditionPicker` — condition management
5. **P5**: `PhoneCounterRow` (XP + Loot)
6. **P6**: `PhoneSummonSection`
7. **P7**: `PhoneCharacterDetail` overlay
8. **P8**: `phone.css` polish pass — animations, transitions, edge cases
9. **P9**: Server permission enforcement in `wsHub.ts`
10. **P10**: Integration test on actual phone device

---

## Technical Constraints

- **Framework:** Preact (3KB). Import from `preact` and `preact/hooks`. NOT React.
- **Styling:** Vanilla CSS with BEM naming. CSS variables from `app/shared/styles/theme.css`. No Tailwind, no CSS-in-JS.
- **Build:** esbuild bundles `app/phone/main.tsx` as entry point. Served at `/phone`.
- **Assets:** Reference via `/assets/ghs/images/...` paths. Use `app/shared/assets.ts` helpers if they exist.
- **Commands:** Use `useCommands()` hook. All commands target the phone's registered character only.
- **State:** Use `useGameState()` hook to extract character data. The phone receives full game state via WebSocket diffs but only renders its own character.

---

## Key Files to Audit Before Coding

Read these files to understand what exists and what patterns to follow:

```
app/phone/App.tsx                          — Current scaffold, routing logic
app/phone/CharacterPicker.tsx              — How character selection works
app/controller/ScenarioView.tsx            — Pattern reference for the controller's approach
app/controller/overlays/InitiativeNumpad.tsx — Numpad to potentially reuse
app/components/CharacterBar.tsx            — How HP/conditions/initiative render on controller
app/components/ConditionGrid.tsx           — Condition toggle grid
app/components/ConditionIcons.tsx          — Condition icon strip
app/components/HealthControl.tsx           — HP +/- pattern
app/components/SummonCard.tsx              — Summon display
app/hooks/useGameState.ts                  — How to extract character from state
app/hooks/useCommands.ts                   — How to send commands
app/shared/styles/theme.css                — All CSS variables
app/CONVENTIONS.md                         — BEM naming, spacing tokens
packages/shared/src/utils/conditions.ts    — getConditionsForEdition()
packages/shared/src/data/levelCalculation.ts — XP thresholds, level calc
```

---

## Deliverables

### Phase 1 (Design — this prompt)
- [ ] 4 interactive Preact prototypes (artifacts) showing the phone view design
- [ ] Design rationale document explaining key choices
- [ ] Component tree finalized
- [ ] Shared component reuse decisions confirmed

### Phase 2 (Implementation — separate prompt)
- [ ] Production phone components
- [ ] Phone CSS
- [ ] Server permission enforcement
- [ ] Integration verified on device

---

## DO NOT

- Use Tailwind or any CSS framework
- Use React (use Preact)
- Add emoji or generic icons
- Build monster management, element board, modifier decks, or door controls
- Skip reading the skill files listed at the top
- Use fallback images or placeholder icons
- Make it look like a generic mobile app — this is a dark fantasy game companion
