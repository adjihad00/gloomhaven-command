# Phase 4: Display Client — Design & Implementation

## Skills to Read FIRST

Before doing ANYTHING else, read these skill files in order:

1. **UI/UX Pro Max skill** — Read ALL `.md` files in:
   `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
2. **Frontend Agent skills** — Read ALL `.md` files in:
   `C:\Users\Kyle Diaz\.agents\skills\`
3. **Frontend design skill** — Read the SKILL.md
4. **Project conventions** — Read `app/CONVENTIONS.md`
5. **Shared styles** — Read `app/shared/styles/theme.css`

Priority when skills conflict: (1) `app/CONVENTIONS.md`, (2) UI/UX Pro Max, (3) frontend design skill, (4) agent skills.

---

## What You're Building

The **Display Client** — a portrait-oriented, read-only view rendered on a TV or monitor that sits at the center of the gaming table. Every player and the GM looks at this during play. It is the **visual centerpiece** of the entire Gloomhaven Command system.

This is NOT a utility screen. This is a living game board. It should feel like an enchanted war table, an illuminated chronicle of the battle unfolding, a dark fantasy artifact that draws the eye. When someone walks past the gaming table, this screen should make them stop and ask "what is THAT?"

### Physical Setup
- 24" monitor (1920×1080 native) mounted in portrait orientation (1080×1920 effective)
- Connected to a laptop running Chrome in fullscreen mode — full browser capabilities, no device limitations
- Viewed from 3-6 feet away by 2-4 players seated around a table
- Always on, always visible — no one touches it, no interaction needed

### Constraints
- **Read-only.** Zero user interaction. No buttons, no taps, no clicks. The display only receives state via WebSocket diffs and renders.
- **Portrait orientation.** CSS should lock to portrait or adapt naturally to tall viewports.
- **Large text and icons.** On a 24" 1080p portrait monitor viewed from 4-6 feet, minimum readable font size is roughly 18-20px for body text and 28px+ for headings. Icons should be 48px+ (about 1" physical). Test readability at distance — if you can't read it from across a dining table, it's too small.
- **Auto-reconnect.** If the browser loses connection, it should silently reconnect and restore state. No manual intervention possible (no one is touching this device).
- **Performance.** The display runs in Chrome fullscreen on a laptop connected to a portrait monitor. This is NOT a low-powered casting device — you have full browser capabilities. Use whatever animation technique produces the best visuals: CSS animations, JS-driven animations, Canvas 2D, requestAnimationFrame, even WebGL/Three.js for atmospheric effects if warranted. Don't hold back on visual fidelity.
- **No commands.** The display never sends commands to the server. It only consumes state. It does not even need `useCommands()`.

---

## Design Direction

### Aesthetic Vision

**Dark fantasy war table.** Not a dashboard. Not an app. A magical artifact that chronicles the battle.

Think:
- The Marauder's Map from Harry Potter — a living document that tracks movement
- A medieval commander's sand table with carved figures
- An illuminated manuscript with gold leaf borders that updates in real time
- The map table in a Game of Thrones war room
- A stained glass window that shifts as the battle progresses

**Typography:** Cinzel for all headings and labels (this is a display piece — lean into the display font). Crimson Pro for stat numbers and details.

**Color palette:** The existing dark fantasy theme (`#1a1410` base, `--accent-gold`, `--accent-copper`) but elevated. This screen has room for atmospheric effects that would be distracting on a phone or controller:
- Subtle animated fog/particle effects in the background
- Candlelight flicker on gold accents (CSS animation)
- Parchment texture gradients
- Deep vignette around edges
- Warm ambient glow that shifts subtly

**Key visual principle:** Information hierarchy through SIZE, not through layout density. The display has an entire TV screen — use it. Let elements breathe. A monster's ability card should be large enough to read the action text from across the table. The active figure's portrait should be prominent. The round counter should be unmissable.

**Animation & effects:** With Chrome on a laptop, you have full creative freedom. Consider:
- Canvas 2D or WebGL for ambient particle systems (floating embers, drifting fog, dust motes in torchlight)
- CSS `backdrop-filter: blur()` for depth-of-field effects on inactive sections
- SVG filters for glow, fire, and magical effects on elements
- `requestAnimationFrame`-driven animations for smooth, continuous atmospheric effects
- Shader-like effects via CSS `mix-blend-mode` and layered pseudo-elements
- Smooth scroll-driven animations when the initiative order advances

The goal is for this screen to feel ALIVE — not a static readout but a living chronicle of the battle. Ambient motion everywhere, even when nothing is happening gameplay-wise.

---

## Phase 1: Design Exploration (DO THIS FIRST)

Create **interactive Preact prototypes** as standalone artifacts to explore the display design. Use realistic mock data. These are design comps for visual approval before production code.

### Prototype 1: ScenarioView — The Main Battle Display

This is the screen that's up 95% of play time. Vertical tower layout, portrait orientation.

**Use mock data:** 4 characters (Drifter lv5, Boneshaper lv4, Blinkblade lv3, Banner Spear lv4), 3 monster groups (Algox Guard ×4, Ice Wraith ×3, Snow Imp ×2), Round 3, scenario "Frozen Crypt" #12, scenario level 2, elements: Fire strong, Ice waning, rest inert.

**Layout (top → bottom, single column):**

#### Section 1: Scenario Header
- Scenario name + number (large, Cinzel, gold)
- Round counter (prominent — "Round 3")
- Scenario level + derived values: trap damage, gold conversion, hazard damage, bonus XP (these are reference values players glance at)
- Subtle animated border or ornamental divider

#### Section 2: Element Board
- 6 element icons in a horizontal row, large (64px+)
- Three visual states: Inert (stone grey, desaturated), Strong (full color, glowing), Waning (half-filled from bottom, dimmer)
- Elements should feel like gemstones or runes set into the display — not flat icons
- Animated state transitions: when an element goes Strong, it should ignite/illuminate; when it wanes, it should dim with a fading ember effect

#### Section 3: Initiative Timeline (Vertical)
This is the HEART of the display. A vertical initiative order showing all figures, top to bottom, in turn order. This replaces the horizontal timeline on the phone — the display has vertical space to make each entry substantial.

For each figure in initiative order:
- **Character entries:** Large portrait (80-100px), character name (Cinzel), class, level, current HP bar, initiative number, active conditions as icons
- **Monster group entries:** Monster portrait (80-100px), monster name, initiative from drawn ability card, standee count (e.g., "×4"), ability card summary (the drawn card's actions: Move +1, Attack +2, etc.)
- **Active figure:** The currently active figure should be DRAMATICALLY highlighted — enlarged, gold border, glow effect, perhaps the surrounding figures dim slightly. This is the single most important piece of information: whose turn is it?
- **Completed figures:** Dimmed, slightly smaller or desaturated. Checkmark overlay.
- **Waiting figures:** Normal presentation, full color.

The initiative timeline should feel like a vertical scroll or tapestry unrolling. Consider subtle scroll animation when the active figure advances.

#### Section 4: Monster Ability Cards (Active Turn Detail)
When a monster group is the active figure, expand their ability card to show the full resolved actions. This is the information the GM reads aloud:
- Initiative number
- Each action: Move X, Attack X, Range X, special abilities
- Show resolved values (base stat + card modifier) for both normal and elite
- If the card has a shuffle icon, show it

When it's NOT a monster's turn, collapse this section or show a compact summary of all drawn ability cards.

#### Section 5: Character Status Summary (Bottom)
Compact status bars for each character, always visible:
- Class portrait (small), name, HP bar (current/max), XP, active conditions
- Exhausted characters shown dimmed with strikethrough
- Absent characters not shown

This section is secondary — the initiative timeline above shows the same characters in more detail during their turns. This is the "at a glance" reference.

### Prototype 2: Lobby/Setup Waiting View

When the game is in lobby mode or setup phases. This should be visually stunning — it's the first thing players see when they sit down:
- Large Gloomhaven/Frosthaven logo or edition art
- "Setting up scenario..." or "Waiting for GM..." text in Cinzel
- Rich atmospheric animation: particle ember system (Canvas 2D), volumetric fog layers, subtle torch flicker lighting effects
- If in chores/rules/goals phase, could show the scenario name and current setup phase
- Consider a slow camera-drift or parallax effect on layered background elements

This should look like the title screen of a AAA dark fantasy game — moody, atmospheric, cinematic.

### Prototype 3: Scenario Transition Moments

Design dramatic transition animations for key moments. With full browser capabilities, these can be truly cinematic:
- **Scenario start:** The display "activates" — a dramatic reveal animation. Consider a Canvas/WebGL-driven effect: embers igniting, parchment unrolling, elements illuminating one by one, then the scenario title burning into view
- **New round:** Round counter increments with a visual flourish — a ripple wave across the screen, the number materializing with particle effects
- **Room reveal:** When a door is opened and new monsters spawn, new entries in the initiative order could materialize with a portal/summoning effect, with the new monster portraits fading in dramatically
- **Scenario end (victory):** Gold light erupts, triumphant radiance, the scenario name displayed in full glory with achievement-style presentation
- **Scenario end (defeat):** Screen darkens progressively, embers die out, a somber fade with the word "DEFEATED" emerging from shadow

These transitions are what make the display feel alive. They should feel like cutscene moments in a game — brief (2-4 seconds) but impactful.

### Prototype 4: Town Mode (Placeholder)

Simple atmospheric screen for when the game is in town phase:
- "Town Phase" header
- Edition-appropriate flavor (GH: Gloomhaven cityscape mood, FH: Frosthaven outpost mood)
- Step checklist mirror of what controller shows (optional — could just be atmospheric)

---

## Phase 2: Component Architecture

After prototypes are approved, plan the production component tree:

```
app/display/
├── App.tsx                     — Connection → mode routing (lobby/scenario/town)
├── ScenarioView.tsx            — The main battle display (vertical tower)
├── LobbyWaitingView.tsx        — (EXISTS) Atmospheric waiting screen
├── TownView.tsx                — Town phase atmospheric placeholder
├── components/
│   ├── DisplayScenarioHeader.tsx   — Scenario name, round, level, derived values
│   ├── DisplayElementBoard.tsx     — Large element runes with animated states
│   ├── DisplayInitiativeColumn.tsx — Vertical initiative order (the centerpiece)
│   ├── DisplayFigureCard.tsx       — Individual figure in the initiative order
│   ├── DisplayMonsterAbility.tsx   — Expanded monster ability card
│   ├── DisplayCharacterSummary.tsx — Compact character status bar
│   └── DisplayTransitions.tsx      — Animated transitions (round change, room reveal, etc.)
├── styles/
│   └── display.css                 — All display-specific styles
├── main.tsx                    — (EXISTS) Preact render entry
└── index.html                  — (EXISTS) HTML shell
```

### Shared Component Reuse

Evaluate these shared components — most will need display-specific variants because the display is read-only and optimized for distance viewing:

| Shared Component | Approach | Notes |
|-----------------|----------|-------|
| `ElementBoard.tsx` | **Adapt** | Needs larger icons, no click interaction, animated state transitions |
| `ConditionIcons.tsx` | **Reuse** | For condition icons in figure cards + summary bars |
| `Icons.tsx` | **Reuse** | BloodDrop, XP, Gold icons for summary bars |
| `InitiativeDisplay.tsx` | **Adapt** | Needs much larger rendering for display |
| `CharacterBar.tsx` | **Don't reuse** | Too interactive, too compact. Build display-specific |
| `MonsterGroup.tsx` | **Don't reuse** | Too interactive. Build read-only display version |
| `MonsterStatCard.tsx` | **Maybe reuse** | For stat reference in monster entries |
| `HealthControl.tsx` | **Don't reuse** | Display needs a read-only bar, not +/- controls |
| `ModifierDeck.tsx` | **Skip** | GM manages modifiers on controller |
| `ScenarioHeader.tsx` | **Don't reuse** | Build display-specific with larger typography |
| `ScenarioFooter.tsx` | **Skip** | Doors/phase buttons are controller-only |

### Hooks

- `useConnection` — same as other clients, auto-reconnect
- `useGameState` — extract all figures, monsters, characters, elements, round, scenario
- `useDataApi` — fetch monster portraits, character portraits, ability card data
- `useCommands` — **NOT USED.** Display never sends commands.

---

## Phase 3: Implementation Priority

1. **D1**: `App.tsx` + connection + mode routing (lobby/scenario/town)
2. **D2**: `DisplayScenarioHeader` — scenario name, round, level, derived values
3. **D3**: `DisplayElementBoard` — large animated element runes
4. **D4**: `DisplayInitiativeColumn` + `DisplayFigureCard` — the vertical initiative order
5. **D5**: `DisplayMonsterAbility` — expanded ability card for active monster group
6. **D6**: `DisplayCharacterSummary` — compact character status bars
7. **D7**: `DisplayTransitions` — round change, scenario start/end, room reveal animations
8. **D8**: `LobbyWaitingView` upgrade — atmospheric waiting screen with edition art
9. **D9**: `TownView` — atmospheric placeholder
10. **D10**: `display.css` polish pass — performance optimization, animation tuning
11. **D11**: PWA manifest + service worker + auto-reconnect hardening

---

## Technical Constraints

- **Framework:** Preact. Import from `preact` and `preact/hooks`.
- **Styling:** Vanilla CSS with BEM naming. CSS variables from `app/shared/styles/theme.css`. No Tailwind.
- **Build:** esbuild bundles `app/display/main.tsx`. Served at `/display`.
- **Assets:** GHS portraits and icons via `/assets/ghs/images/...` paths.
- **No interaction.** No `onClick`, no `onTouchStart`, no form inputs. Pure render.
- **Auto-scaling:** Target 1080×1920 (1080p portrait) as the exact resolution. Use CSS `vw`/`vh` units so everything scales proportionally. At 24" diagonal in portrait, 1080px wide gives roughly 45px per inch — so a 48px icon is about 1 inch on screen, readable from 4-6 feet. Design to this constraint.
- **Animation:** Full browser capabilities available. Use CSS, Canvas 2D, SVG, WebGL, or any combination that produces the best visual result. `requestAnimationFrame` for continuous ambient effects. No need to optimize for low-powered devices.

---

## Key Data Sources

The display needs to render from these GameState fields:

```typescript
// Scenario info
state.scenario          // { index, name, edition }
state.round             // number
state.level             // number
state.state             // 'draw' | 'next' (phase)

// Figures in turn order
state.figures           // string[] — ordered figure refs
state.characters        // Character[] — HP, conditions, initiative, active, exhausted
state.monsters          // Monster[] — ability, entities, active

// Elements
state.elementBoard      // ElementModel[] — 6 elements with state

// Mode
state.mode              // 'lobby' | 'scenario' | 'town'
state.setupPhase        // 'chores' | 'rules' | 'goals' | null
state.finish            // scenario completion state
```

For monster ability card resolution, use `useDataApi` to fetch:
- Monster stats at current level: `/api/data/{edition}/monster/{name}`
- Monster ability deck: `/api/data/{edition}/monster/deck/{deckName}`
- Character portraits: `/api/data/{edition}/character/{name}`

---

## What the Display Does NOT Show

- Modifier deck state (GM manages on controller)
- Loot deck (GM manages on controller)
- Door controls (GM manages on controller)
- Individual character XP/gold details (players see on their phones)
- Setup chore assignments (phones handle)
- Battle goal reminders (phones handle)
- Any interactive controls whatsoever

---

## Files to Audit Before Coding

```
app/display/App.tsx                    — Current scaffold (if it exists beyond LobbyWaitingView)
app/display/LobbyWaitingView.tsx       — Existing lobby waiting screen
app/display/main.tsx                   — Entry point
app/display/index.html                 — HTML shell
app/components/ElementBoard.tsx        — Element display to adapt
app/components/ConditionIcons.tsx       — Condition icons to reuse
app/components/Icons.tsx               — Icon library
app/components/CharacterBar.tsx        — Layout reference (don't reuse, but study)
app/components/MonsterGroup.tsx        — Layout reference (don't reuse, but study)
app/controller/ScenarioView.tsx        — How the controller renders the same data
app/phone/components/PhoneInitiativeTimeline.tsx — Phone's horizontal timeline (the display does this vertically)
app/hooks/useGameState.ts              — State extraction patterns
app/hooks/useDataApi.ts                — Data fetching patterns
app/shared/styles/theme.css            — CSS variables
packages/shared/src/engine/turnOrder.ts — getInitiativeOrder() for sorting figures
```

---

## Deliverables

### Phase 1 (Design — this prompt)
- [ ] 4 interactive Preact prototypes exploring the display design
- [ ] Design rationale document: why each visual choice was made
- [ ] Component tree finalized
- [ ] Animation strategy documented (which moments get transitions, which techniques — CSS, Canvas, SVG, WebGL)

### Phase 2 (Implementation — separate prompt)
- [ ] Production display components
- [ ] Display CSS with atmospheric effects
- [ ] PWA manifest + service worker
- [ ] Auto-reconnect verified
- [ ] Tested on actual TV/monitor at table distance

---

## DO NOT

- Add any interactive elements (buttons, inputs, click handlers)
- Use Tailwind or CSS frameworks
- Use React (use Preact)
- Add emoji or generic icons
- Show modifier decks, loot decks, or door controls
- Make it look like a dashboard or admin panel
- Sacrifice readability for aesthetics — this is viewed from 6 feet away
- Use heavy blocking synchronous JS that freezes the UI — keep animations on rAF or CSS
- Skip reading the skill files listed at the top
