# Batch 3 — Element + Header Redesign

> Paste into Claude Code. Moves elements from footer to top-right header area,
> makes them larger with a half-filled waning visual, reformats the scenario
> header, and moves level-derived values to the footer. Fixes V1, V2, V3, I3.

---

Read CLAUDE.md, then docs/GHS_AUDIT.md Section 1 (Application Overview — screen
layout, header bar, footer bar) and Section 7 (Element Board behavior).

Then read these files:
- `app/components/ElementBoard.tsx` — current element rendering + CSS classes
- `app/components/ScenarioHeader.tsx` — current header
- `app/components/ScenarioFooter.tsx` — current footer
- `app/controller/ScenarioView.tsx` — how header/footer are composed
- `app/shared/styles/components.css` — element, header, footer CSS
- `app/controller/styles/controller.css` — controller layout CSS
- `app/shared/assets.ts` — elementIcon() helper

## Playtest Issues Being Fixed

| # | Issue | What to do |
|---|-------|------------|
| V1 | Elements too small in footer, move to top-right, larger, waning = half-filled not dim | Relocate ElementBoard to header area, increase size, new waning visual |
| V2 | Trap/gold/XP should swap with elements | Level-derived values move from header to footer, elements move from footer to header |
| V3 | Scenario header format | "#1 - BLACK BARROW, LEVEL 2" instead of "#1 - Level 2" |
| I3 | Element icons too small to tap in footer | Fixed by making them larger in the header |

## New Layout

### Before (current):
```
HEADER: [☰] [Round 3 — Playing] [#1 — Level 2] [Trap:4 Gold:3 XP:8]  [●]
FOOTER: [▶ Next Round] [#1 Black Barrow 🚪🚪] [🔥❄💨⛰☀🌑] [AMD 18]
```

### After (redesigned):
```
HEADER: [☰] [Round 3 — Playing] [#1 - BLACK BARROW, LEVEL 2]  [🔥❄💨⛰☀🌑]
FOOTER: [▶ Next Round] [🚪🚪] [Trap:4 | Gold:3 | XP:8 | Haz:1] [AMD 18]
```

Changes:
1. **Elements move to header right** — 6 icons, larger (40-44px), tappable
2. **Level-derived values move to footer center** — compact pills between doors and AMD
3. **Scenario header format**: "#1 - BLACK BARROW, LEVEL 2" (number, name uppercase, level)
4. **Connection status dot** removed from header (unnecessary clutter, status shown on connect screen)

## STEP 1 — Redesign ElementBoard for header placement

Update `app/components/ElementBoard.tsx`:

The component already supports a `layout` prop and `size` prop. Add a new
size option `'header'` that's larger and designed for the header bar.

### New waning visual: half-filled

The playtest feedback was clear: dimming for waning is too easily confused
with inert. Instead, waning should show the icon at full color but only the
bottom half filled, with the top half greyed/empty.

**Implementation approach — CSS clip-path:**

```css
/* Waning: full icon visible but only bottom half colored */
.element-btn.element-waning .element-img-container {
  position: relative;
}

.element-btn.element-waning .element-img {
  /* Grey/desaturated version as base */
  filter: grayscale(0.8);
  opacity: 0.4;
}

.element-btn.element-waning .element-img-overlay {
  /* Full color version clipped to bottom half */
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  clip-path: inset(50% 0 0 0);
  filter: none;
  opacity: 1;
}
```

This requires rendering the element icon TWICE for waning state — once as the
greyed background and once as the clipped colored overlay. Update the ElementBoard
component to handle this:

```tsx
function ElementButton({ element, onCycle, readonly, size }: {
  element: ElementModel;
  onCycle?: () => void;
  readonly?: boolean;
  size: 'normal' | 'compact' | 'header';
}) {
  const stateClass = `element-${element.state}`;
  const isWaning = element.state === 'waning';
  const isActive = element.state === 'strong' || element.state === 'new';
  const sizeClass = `element-${size}`;

  return (
    <button
      class={`element-btn ${stateClass} ${sizeClass}`}
      onClick={onCycle}
      disabled={readonly}
      title={`${element.type}: ${element.state}`}
    >
      <div class="element-img-container">
        <img src={elementIcon(element.type)} class="element-img" />
        {isWaning && (
          <img src={elementIcon(element.type)} class="element-img-overlay" />
        )}
      </div>
    </button>
  );
}
```

### Size and active state visual changes

From playtest: "Would like strong/waning to be larger than inert as well."

```css
/* Inert: small, greyed out */
.element-btn.element-inert.element-header {
  width: 36px;
  height: 36px;
}

.element-btn.element-inert .element-img {
  filter: grayscale(1);
  opacity: 0.25;
}

/* Strong/New: larger, full color, glow */
.element-btn.element-strong.element-header,
.element-btn.element-new.element-header {
  width: 44px;
  height: 44px;
}

.element-btn.element-strong .element-img,
.element-btn.element-new .element-img {
  filter: none;
  opacity: 1;
}

.element-btn.element-strong,
.element-btn.element-new {
  box-shadow: 0 0 12px var(--element-glow-color);
  transform: scale(1.1);
}

/* Waning: larger than inert, half-filled */
.element-btn.element-waning.element-header {
  width: 44px;
  height: 44px;
}

/* Transition */
.element-btn {
  transition: all 0.3s ease;
}
```

Each element type could have its own glow color. Use a CSS custom property:

```css
.element-btn[data-type="fire"] { --element-glow-color: #d4553a; }
.element-btn[data-type="ice"] { --element-glow-color: #4a9bd9; }
.element-btn[data-type="air"] { --element-glow-color: #a0a0a0; }
.element-btn[data-type="earth"] { --element-glow-color: #6b8f3c; }
.element-btn[data-type="light"] { --element-glow-color: #d4c462; }
.element-btn[data-type="dark"] { --element-glow-color: #6b5bb5; }
```

Set `data-type` attribute on the button element.

## STEP 2 — Redesign ScenarioHeader

Update `app/components/ScenarioHeader.tsx`:

### New format

```tsx
interface ScenarioHeaderProps {
  round: number;
  phase: string;
  scenarioName?: string;
  scenarioIndex?: string;
  level: number;
  elementBoard: ElementModel[];
  onCycleElement?: (elementType: string, currentState: string) => void;
  onMenuOpen?: () => void;
  readonly?: boolean;
}
```

Note: `elementBoard` and `onCycleElement` move FROM ScenarioFooter TO
ScenarioHeader. `levelValues` and `connectionStatus` are removed from header.

### Render

```tsx
export function ScenarioHeader({ round, phase, scenarioName, scenarioIndex,
  level, elementBoard, onCycleElement, onMenuOpen, readonly }: ScenarioHeaderProps) {

  const phaseLabel = phase === 'draw' ? 'Card Selection' : 'Playing';
  const scenarioDisplay = scenarioIndex && scenarioName
    ? `#${scenarioIndex} - ${scenarioName.toUpperCase()}, LEVEL ${level}`
    : scenarioIndex
    ? `#${scenarioIndex}, LEVEL ${level}`
    : `LEVEL ${level}`;

  return (
    <div class="scenario-header">
      {/* Left: menu + round */}
      <div class="header-left">
        {onMenuOpen && (
          <button class="menu-btn" onClick={onMenuOpen}>☰</button>
        )}
        <div class="round-phase">
          <span class="round-label">Round {round}</span>
          <span class="phase-label">{phaseLabel}</span>
        </div>
      </div>

      {/* Center: scenario info */}
      <div class="header-center">
        <span class="scenario-label">{scenarioDisplay}</span>
      </div>

      {/* Right: element board */}
      <div class="header-right">
        <ElementBoard
          elements={elementBoard}
          onCycleElement={onCycleElement}
          layout="horizontal"
          readonly={readonly}
          size="header"
        />
      </div>
    </div>
  );
}
```

## STEP 3 — Redesign ScenarioFooter

Update `app/components/ScenarioFooter.tsx`:

### New props

Remove `elementBoard` and `onCycleElement` (moved to header).
Add `levelValues` (moved from header).

```tsx
interface ScenarioFooterProps {
  phase: string;
  canAdvance: boolean;
  advanceLabel: string;
  onAdvance: () => void;
  doors?: { roomNumber: number; ref: string; revealed: boolean; marker?: string }[];
  onRevealRoom?: (roomNumber: number) => void;
  levelValues: LevelDerivedValues;
  modifierDeck?: AttackModifierDeckModel;
  onDrawModifier?: () => void;
  readonly?: boolean;
}
```

### Render

```tsx
export function ScenarioFooter({ phase, canAdvance, advanceLabel, onAdvance,
  doors, onRevealRoom, levelValues, modifierDeck, onDrawModifier, readonly }: ScenarioFooterProps) {

  return (
    <div class="scenario-footer">
      {/* Left: phase button */}
      <button
        class={`phase-btn ${canAdvance ? 'ready' : 'waiting'}`}
        onClick={onAdvance}
        disabled={!canAdvance}
      >
        {advanceLabel}
      </button>

      {/* Center-left: door controls */}
      {doors && doors.length > 0 && (
        <DoorControls doors={doors} onRevealRoom={onRevealRoom} />
      )}

      {/* Center: level-derived values */}
      <div class="footer-derived">
        <span class="derived-pill" title="Trap Damage">
          <span class="derived-icon">⚠</span>{levelValues.trapDamage}
        </span>
        <span class="derived-pill" title="Gold per Coin">
          <span class="derived-icon">💰</span>{levelValues.goldConversion}
        </span>
        <span class="derived-pill" title="Bonus XP">
          <span class="derived-icon">★</span>{levelValues.bonusXP}
        </span>
        <span class="derived-pill" title="Hazardous Terrain">
          <span class="derived-icon">☣</span>{levelValues.hazardousTerrain}
        </span>
      </div>

      {/* Right: modifier deck */}
      {modifierDeck && (
        <ModifierDeck
          deck={modifierDeck}
          deckName="monster"
          onDraw={onDrawModifier || (() => {})}
          onShuffle={() => {}}
          onAddBless={() => {}}
          onRemoveBless={() => {}}
          onAddCurse={() => {}}
          onRemoveCurse={() => {}}
          readonly={readonly}
          compact={true}
        />
      )}
    </div>
  );
}
```

## STEP 4 — Update ScenarioView to wire new props

Update `app/controller/ScenarioView.tsx`:

Move element-related props from ScenarioFooter to ScenarioHeader:

```tsx
// BEFORE:
<ScenarioHeader
  round={round} phase={phase} scenarioName={...} level={level}
  levelValues={levelValues} connectionStatus="connected" onMenuOpen={...}
/>
<ScenarioFooter
  ... elementBoard={elementBoard} onCycleElement={...} ...
/>

// AFTER:
<ScenarioHeader
  round={round} phase={phase} scenarioName={...} scenarioIndex={...}
  level={level} elementBoard={elementBoard} onCycleElement={...} onMenuOpen={...}
/>
<ScenarioFooter
  ... levelValues={levelValues} ...
/>
```

Also pass `scenarioIndex` to the header for the new format.
Read the current ScenarioView to see how scenario data is accessed — the
scenario index may be at `state.scenario?.index` or similar.

## STEP 5 — CSS for all redesigned components

Replace the header, footer, and element CSS. Write the complete styles.

### Header

```css
.scenario-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--accent-copper);
  min-height: 52px;
  position: sticky;
  top: 0;
  z-index: 20;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.menu-btn {
  width: 40px;
  height: 40px;
  border: 1px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--accent-gold);
  font-size: 1.3rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
}

.round-phase {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.round-label {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent-gold);
}

.phase-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.header-center {
  flex: 1;
  text-align: center;
  min-width: 0;
}

.scenario-label {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
```

### Element board (header size)

```css
/* Element board in header */
.element-board.horizontal {
  display: flex;
  align-items: center;
  gap: 4px;
}

.element-btn {
  border: none;
  background: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 50%;
  transition: all 0.3s ease;
  touch-action: manipulation;
  position: relative;
}

/* Header size defaults */
.element-btn.element-header {
  width: 36px;
  height: 36px;
}

.element-img-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.element-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: filter 0.3s ease, opacity 0.3s ease;
}

/* Inert: small, greyed out */
.element-btn.element-inert .element-img {
  filter: grayscale(1);
  opacity: 0.25;
}

.element-btn.element-inert.element-header {
  width: 32px;
  height: 32px;
}

/* Strong/New: larger, full color, glow */
.element-btn.element-strong .element-img,
.element-btn.element-new .element-img {
  filter: none;
  opacity: 1;
}

.element-btn.element-strong.element-header,
.element-btn.element-new.element-header {
  width: 44px;
  height: 44px;
}

.element-btn.element-strong,
.element-btn.element-new {
  filter: drop-shadow(0 0 8px var(--element-glow-color, var(--accent-gold)));
  transform: scale(1.1);
}

/* Waning: larger than inert, half-filled bottom half */
.element-btn.element-waning.element-header {
  width: 40px;
  height: 40px;
}

.element-btn.element-waning .element-img {
  filter: grayscale(0.8);
  opacity: 0.35;
}

.element-img-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  clip-path: inset(50% 0 0 0);
  filter: none !important;
  opacity: 1 !important;
}

/* Per-element glow colors */
.element-btn[data-element="fire"] { --element-glow-color: #d4553a; }
.element-btn[data-element="ice"] { --element-glow-color: #4a9bd9; }
.element-btn[data-element="air"] { --element-glow-color: #b0b0b0; }
.element-btn[data-element="earth"] { --element-glow-color: #6b8f3c; }
.element-btn[data-element="light"] { --element-glow-color: #d4c462; }
.element-btn[data-element="dark"] { --element-glow-color: #6b5bb5; }
```

### Footer

```css
.scenario-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--accent-copper);
  z-index: 20;
  min-height: 48px;
}

/* Phase button */
.phase-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--accent-copper);
  background: var(--bg-primary);
  color: var(--text-muted);
  cursor: not-allowed;
  white-space: nowrap;
  flex-shrink: 0;
  touch-action: manipulation;
  transition: all var(--transition-fast);
}

.phase-btn.ready {
  border-color: var(--accent-gold);
  color: var(--accent-gold);
  cursor: pointer;
  background: linear-gradient(135deg, var(--bg-primary), rgba(212, 175, 55, 0.1));
}

.phase-btn.ready:active {
  transform: scale(0.95);
}

/* Level-derived values */
.footer-derived {
  display: flex;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.derived-pill {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 3px 8px;
  border-radius: 12px;
  border: 1px solid var(--accent-copper-dim, rgba(160, 120, 80, 0.3));
}

.derived-icon {
  font-size: 0.7rem;
}
```

## STEP 6 — Verify

### Build

```powershell
node app/build.mjs
```

### Boot and test

Connect to a game with an active scenario.

**Header checks:**
1. Elements visible in top-right of header
2. All 6 element icons load (no broken images)
3. Elements are larger than before (~36-44px)
4. Tapping an element cycles its state
5. Inert = greyed, small
6. Strong/New = full color, larger, glow (with element-colored glow)
7. Waning = half-filled (bottom half colored, top half grey) — NOT just dimmed
8. Strong/waning physically larger than inert (size difference visible)
9. Element glow colors match element type (fire=red, ice=blue, etc.)

**Header format:**
10. Scenario shows "#1 - BLACK BARROW, LEVEL 2" (or equivalent format)
11. Round and phase info still visible on left
12. Menu button (☰) still works

**Footer checks:**
13. Elements NO LONGER in footer
14. Level-derived values (Trap, Gold, XP, Hazard) now in footer center as pills
15. Phase button still on left
16. Door controls still functional
17. Modifier deck still on right
18. Footer not too crowded with the new layout

**Scroll padding:**
19. Last figure card not obscured by footer (there should be padding at the
    bottom of the scroll area to account for fixed footer)

Check the `.scenario-content` CSS — if it doesn't have `padding-bottom` for
the footer height, add it:

```css
.scenario-content {
  padding-bottom: 80px;  /* space for fixed footer */
}
```

## STEP 7 — Commit

```powershell
git add -A
git commit -m "feat: element + header redesign — elements to top-right, half-filled waning

- Elements moved from footer to header (larger, 36-44px, element-colored glow)
- Waning visual: half-filled via clip-path overlay (bottom half colored, top grey)
- Strong/new elements physically larger than inert (scale + size)
- Per-element glow colors (fire=red, ice=blue, earth=green, etc.)
- Scenario header format: '#1 - BLACK BARROW, LEVEL 2'
- Level-derived values (trap/gold/XP/hazard) moved from header to footer pills
- Connection status dot removed from header
- Scroll padding for fixed footer (prevents last card obscured)
- Fixes V1, V2, V3, I3 from playtest"
git push
```

Report: commit hash, bundle size, and which of the 19 checks pass. Specifically:
does the waning half-filled visual work (bottom half colored, top greyed)?
