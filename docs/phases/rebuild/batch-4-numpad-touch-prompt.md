# Batch 4 — Initiative Numpad + Touch Fixes + Skill Integration

> Paste into Claude Code. Adds initiative numpad overlay, fixes touch UX issues,
> and integrates frontend-design skill for all future UI work. Updates CLAUDE.md
> to reference skills. Fixes I1, I2, I4, I5, B10 from playtest.

---

## PRE-STEP — Read design skills and establish conventions

Before ANY code changes, read ALL of these skill sources:

**1. Built-in frontend-design skill:**
```
Read the file at /mnt/skills/public/frontend-design/SKILL.md
```

**2. UI/UX Pro Max skill plugin:**
```powershell
# Read the skill directory and its SKILL.md or README
Get-ChildItem "C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill" -Recurse | Select-Object FullName
# Then read the main skill file (likely SKILL.md, README.md, or index.md)
Get-Content "C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\SKILL.md"
# If no SKILL.md, read whatever the primary instruction file is
```

**3. Frontend agent skills:**
```powershell
# Read all skill files in the agents skills directory
Get-ChildItem "C:\Users\Kyle Diaz\.agents\skills" -Recurse -Filter "*.md" | Select-Object FullName
# Read each .md file found — these contain frontend development practices
Get-ChildItem "C:\Users\Kyle Diaz\.agents\skills" -Recurse -Filter "*.md" | ForEach-Object { Write-Host "=== $($_.FullName) ==="; Get-Content $_.FullName }
```

Read ALL skill files found. Internalize their principles and best practices.
Where skills conflict, prioritize: (1) project-specific conventions in
`app/CONVENTIONS.md`, (2) UI/UX Pro Max skill, (3) frontend agent skills,
(4) built-in frontend-design skill.

For Gloomhaven Command specifically:

**Aesthetic direction:** Dark fantasy tabletop — NOT generic dashboard UI. Think
aged parchment, copper/gold metallics, deep browns and blacks, candlelight glow.
The app should feel like a magical artifact at the gaming table, not a SaaS product.

**Typography:** We already use Cinzel (display) + Crimson Pro (body) — self-hosted.
These are the right fonts for the medieval fantasy tone. Maintain them.

**Color system:** Our CSS variables in `theme.css` define the palette. Accent gold
for active/important, copper for borders, deep browns for backgrounds. Health
colors (green/yellow/red). Elite gold. Negative red. Shield blue. These are
established and consistent.

**Motion:** Use CSS transitions for state changes (0.15-0.3s). Subtle glow
animations for active elements. No jarring movements. The numpad overlay should
slide/fade in, not pop.

**Key principle from the skill:** "Bold maximalism and refined minimalism both
work — the key is intentionality." Our app is FUNCTIONAL maximalism — dense
information display with refined interaction design. Every pixel serves gameplay.

## PRE-STEP — Update CLAUDE.md

Append this section to `CLAUDE.md`:

```markdown
## Design Skills & Conventions

For ALL UI/UX work, read these skill files before implementing:
- `/mnt/skills/public/frontend-design/SKILL.md` — production-grade UI principles
- `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\` — UI/UX Pro Max skill (read all .md files)
- `C:\Users\Kyle Diaz\.agents\skills\` — frontend agent skills (read all .md files)

Priority when skills conflict: (1) app/CONVENTIONS.md, (2) UI/UX Pro Max,
(3) agent skills, (4) built-in frontend-design.

Aesthetic direction: Dark fantasy tabletop. Aged parchment, copper/gold metallics,
deep browns, candlelight glow effects. NOT generic dashboard/SaaS aesthetics.

Font stack: Cinzel (display/headings) + Crimson Pro (body). Self-hosted woff2.
Color system: CSS variables in app/shared/styles/theme.css — accent-gold, accent-copper,
health-green, negative-red, shield-blue, elite-gold.

CSS conventions: BEM naming, spacing tokens, focus-visible accessibility.
See app/CONVENTIONS.md for full CSS architecture docs.

Component conventions: Preact functional components, useCommands() for interactions,
GHS assets exclusively (no fallbacks), touch-action: manipulation on all interactive
elements, aria-labels on all buttons.
```

Now read the rest of the context:
- CLAUDE.md (after updating)
- docs/GHS_AUDIT.md Section 6 (Round Flow — initiative input)
- `app/CONVENTIONS.md` — BEM naming, spacing tokens
- `app/components/InitiativeDisplay.tsx` — current initiative input
- `app/components/CharacterBar.tsx` — where initiative is rendered
- `app/controller/ScenarioView.tsx` — overlay management
- `app/controller/overlays/OverlayBackdrop.tsx` — current overlay backdrop
- `app/controller/overlays/CharacterDetailOverlay.tsx` — overlay with Mark Absent
- `app/shared/styles/components.css` — current component CSS
- `app/controller/styles/controller.css` — current controller CSS
- `app/shared/styles/theme.css` — spacing tokens, CSS variables

## Playtest Issues Being Fixed

| # | Issue | Summary |
|---|-------|---------|
| I1 | Initiative needs numpad overlay | Type-to-input awkward on iPad. Phone-style numpad with Set + Long Rest |
| I2 | Rapid taps cause zoom | Double-tap zoom not fully prevented on overlay +/- |
| I4 | Mark Absent too close to close button | Move Mark Absent to bottom of overlay |
| I5 | Overlays need backdrop tap to close | Backdrop click should dismiss |
| B10 | Scroll cutoff — bottom card obscured | Fixed footer covers last card (may already be fixed by Batch 3 scroll padding — verify) |

## STEP 1 — Build the Initiative Numpad Overlay

Create `app/controller/overlays/InitiativeNumpad.tsx`:

This is a phone-style numpad that appears when tapping the initiative area
on a character card during the draw phase. Matches the GHS audit description:
"Phone-style numpad overlay with Long Rest option."

### Design

```
┌───────────────────────────┐
│    Set Initiative          │
│    ┌─────────────────┐    │
│    │       15        │    │  ← large display showing current input
│    └─────────────────┘    │
│                           │
│    ┌───┐ ┌───┐ ┌───┐    │
│    │ 1 │ │ 2 │ │ 3 │    │
│    └───┘ └───┘ └───┘    │
│    ┌───┐ ┌───┐ ┌───┐    │
│    │ 4 │ │ 5 │ │ 6 │    │
│    └───┘ └───┘ └───┘    │
│    ┌───┐ ┌───┐ ┌───┐    │
│    │ 7 │ │ 8 │ │ 9 │    │
│    └───┘ └───┘ └───┘    │
│    ┌───┐ ┌───┐ ┌───┐    │
│    │⏸️ │ │ 0 │ │ ⌫ │    │  ← Long Rest, 0, Backspace
│    └───┘ └───┘ └───┘    │
│                           │
│  ┌──────────┐ ┌────────┐ │
│  │  Cancel   │ │  SET   │ │
│  └──────────┘ └────────┘ │
└───────────────────────────┘
```

### Props

```tsx
interface InitiativeNumpadProps {
  characterName: string;
  currentInitiative: number;
  onSet: (value: number) => void;
  onLongRest: () => void;
  onClose: () => void;
}
```

### Implementation

```tsx
import { useState } from 'preact/hooks';

export function InitiativeNumpad({ characterName, currentInitiative,
  onSet, onLongRest, onClose }: InitiativeNumpadProps) {

  const [input, setInput] = useState(
    currentInitiative > 0 ? String(currentInitiative) : ''
  );

  const handleKey = (key: string) => {
    if (key === 'back') {
      setInput(prev => prev.slice(0, -1));
    } else if (key === 'rest') {
      onLongRest();
      onClose();
    } else {
      // Max 2 digits (1-99)
      if (input.length < 2) {
        setInput(prev => prev + key);
      }
    }
  };

  const handleSet = () => {
    const value = parseInt(input, 10);
    if (value > 0 && value <= 99) {
      onSet(value);
      onClose();
    }
  };

  const keys = ['1','2','3','4','5','6','7','8','9','rest','0','back'];

  return (
    <div class="numpad-backdrop" onClick={onClose}>
      <div class="numpad-panel" onClick={(e) => e.stopPropagation()}>
        <div class="numpad-title">
          {formatName(characterName)}
        </div>

        <div class="numpad-display">
          <span class="numpad-value">{input || '—'}</span>
        </div>

        <div class="numpad-grid">
          {keys.map(key => (
            <button
              key={key}
              class={`numpad-key ${key === 'rest' ? 'numpad-rest' : ''} ${key === 'back' ? 'numpad-back' : ''}`}
              onClick={() => handleKey(key)}
            >
              {key === 'rest' ? (
                <span class="rest-content">
                  <span class="rest-icon">⏸</span>
                  <span class="rest-label">Rest</span>
                </span>
              ) : key === 'back' ? '⌫' : key}
            </button>
          ))}
        </div>

        <div class="numpad-actions">
          <button class="numpad-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            class={`numpad-confirm ${input ? 'ready' : ''}`}
            onClick={handleSet}
            disabled={!input}
          >
            SET
          </button>
        </div>
      </div>
    </div>
  );
}
```

### CSS — Dark fantasy styled numpad

```css
/* Numpad overlay */
.numpad-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  animation: fadeIn 0.15s ease;
}

.numpad-panel {
  background: var(--bg-card);
  border: 2px solid var(--accent-gold);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  width: 280px;
  box-shadow: 0 0 40px rgba(212, 175, 55, 0.15), var(--shadow-heavy);
  animation: scaleIn 0.2s ease;
}

@keyframes scaleIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.numpad-title {
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent-gold);
  text-align: center;
  margin-bottom: var(--space-3);
}

.numpad-display {
  background: var(--bg-primary);
  border: 2px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  text-align: center;
  margin-bottom: var(--space-4);
}

.numpad-value {
  font-family: 'Cinzel', serif;
  font-size: 2rem;
  font-weight: 900;
  color: var(--text-primary);
  min-height: 2.5rem;
  display: block;
}

.numpad-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.numpad-key {
  height: 56px;
  border: 1px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: 'Cinzel', serif;
  font-size: 1.3rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.numpad-key:active {
  background: var(--accent-copper);
  color: var(--bg-primary);
  transform: scale(0.95);
}

/* Long Rest key — blue accent */
.numpad-rest {
  background: rgba(106, 135, 163, 0.15);
  border-color: var(--shield-blue);
  color: var(--shield-blue);
}

.numpad-rest:active {
  background: var(--shield-blue);
  color: var(--bg-primary);
}

.rest-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.rest-icon { font-size: 1rem; }
.rest-label { font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.5px; }

/* Backspace key — subtle red */
.numpad-back {
  color: var(--text-muted);
  font-size: 1.4rem;
}

/* Action buttons */
.numpad-actions {
  display: flex;
  gap: var(--space-3);
}

.numpad-cancel {
  flex: 1;
  padding: var(--space-3);
  border: 1px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-family: 'Crimson Pro', serif;
  font-size: 0.95rem;
  cursor: pointer;
  touch-action: manipulation;
}

.numpad-confirm {
  flex: 1;
  padding: var(--space-3);
  border: 2px solid var(--accent-copper);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-muted);
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  font-weight: 700;
  cursor: not-allowed;
  touch-action: manipulation;
  transition: all var(--transition-fast);
}

.numpad-confirm.ready {
  border-color: var(--accent-gold);
  color: var(--accent-gold);
  cursor: pointer;
  background: linear-gradient(135deg, var(--bg-primary), rgba(212, 175, 55, 0.1));
}

.numpad-confirm.ready:active {
  transform: scale(0.95);
}
```

## STEP 2 — Wire numpad into CharacterBar

Update `app/components/CharacterBar.tsx`:

When the initiative area is tapped during draw phase, instead of showing a text
input inline, open the InitiativeNumpad overlay.

This requires the CharacterBar to manage a local `showNumpad` state:

```tsx
const [showNumpad, setShowNumpad] = useState(false);

// In the render, replace the inline InitiativeDisplay edit mode:
<div class="char-init-area" onClick={() => isDrawPhase && !readonly && setShowNumpad(true)}>
  <InitiativeDisplay
    value={character.initiative}
    editable={false}  // never inline-edit anymore
    longRest={character.longRest}
    size="normal"
  />
</div>

// Add the numpad overlay (renders at document level via portal or just in the component):
{showNumpad && (
  <InitiativeNumpad
    characterName={character.name}
    currentInitiative={character.initiative}
    onSet={(value) => {
      onSetInitiative(value);
      setShowNumpad(false);
    }}
    onLongRest={() => {
      commands.toggleLongRest(character.name, edition);
      setShowNumpad(false);
    }}
    onClose={() => setShowNumpad(false)}
  />
)}
```

The `InitiativeDisplay` component stays but becomes display-only. Tapping it
opens the numpad. This is better for iPad because the numpad keys are large,
purpose-built touch targets instead of a tiny text input.

## STEP 3 — Fix: Prevent double-tap zoom globally

Batch 2 added `touch-action: manipulation` to interactive elements via CSS.
Verify this is comprehensive. Add a global rule:

```css
/* Global touch optimization — prevent double-tap zoom on all interactive elements */
button,
input,
select,
textarea,
[role="button"],
[onclick],
a,
.counter,
.char-portrait,
.monster-header,
.door-btn,
.element-btn,
.cond-btn,
.hp-btn,
.numpad-key,
.phase-btn,
.menu-btn,
.standee-num,
.standee-row,
.overlay-close {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
```

Also add `-webkit-tap-highlight-color: transparent` to remove the blue flash
on iOS Safari taps.

## STEP 4 — Fix: Move Mark Absent away from close button

Read `app/controller/overlays/CharacterDetailOverlay.tsx`. The playtest found
that "Mark Absent" is too close to the overlay close (X) button, causing
accidental taps.

Move Mark Absent to the BOTTOM of the overlay, in its own section:

```tsx
// Current (wrong): Mark Absent in top-right near close button
// Fixed: Mark Absent at bottom of overlay with clear visual separation

<div class="overlay-panel right">
  <button class="overlay-close" onClick={onClose}>✕</button>

  {/* ... HP, XP, Gold, conditions, summons ... */}

  {/* Mark Absent — at bottom, clearly separated */}
  <div class="overlay-danger-zone">
    <button
      class={`absent-btn ${character.absent ? 'active' : ''}`}
      onClick={() => commands.toggleAbsent(character.name, edition)}
    >
      {character.absent ? 'Return to Game' : 'Mark Absent'}
    </button>
  </div>
</div>
```

Style the danger zone:

```css
.overlay-danger-zone {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--negative-red-dim, rgba(197, 48, 48, 0.2));
}

.absent-btn {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--text-muted);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-muted);
  font-family: 'Crimson Pro', serif;
  font-size: 0.9rem;
  cursor: pointer;
  touch-action: manipulation;
  transition: all var(--transition-fast);
}

.absent-btn:active {
  background: var(--negative-red);
  color: var(--text-primary);
}

.absent-btn.active {
  border-color: var(--health-green);
  color: var(--health-green);
}
```

## STEP 5 — Fix: Backdrop tap closes overlays

Read `app/controller/overlays/OverlayBackdrop.tsx`. Verify that clicking the
backdrop (dark area outside the panel) calls `onClose`.

The current implementation likely already does this if the backdrop div has
`onClick={onClose}` and the panel has `onClick={e => e.stopPropagation()}`.

Check ALL overlays:
- `OverlayBackdrop.tsx` — base component
- `CharacterDetailOverlay.tsx`
- `ScenarioSetupOverlay.tsx`
- `MenuOverlay.tsx`

If any overlay renders its backdrop without the close-on-click behavior, fix it.
Also verify that `e.stopPropagation()` on the panel prevents backdrop clicks
from propagating through the panel content.

## STEP 6 — Verify scroll padding

Batch 3 added `padding-bottom: 80px` to `.scenario-content`. Verify this is
present and working:

```css
.scenario-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 8px;
  padding-bottom: 80px;  /* space for fixed footer */
}
```

If the figure grid is inside `.scenario-content`, the last card should be
fully visible above the footer. Test by scrolling to the bottom with 5+ figures.

## STEP 7 — Verify

### Build

```powershell
node app/build.mjs
```

### Boot and test

Connect to a game with characters in draw phase.

**Numpad checks:**
1. Tap a character's initiative area → numpad overlay appears
2. Numpad has gold border, dark fantasy aesthetic (not generic)
3. Display shows current input as you tap numbers
4. Tapping "1" then "5" shows "15"
5. Backspace (⌫) removes last digit
6. "SET" button disabled when input is empty, gold when input has a value
7. Tapping SET sets the initiative and closes the numpad
8. Long Rest button (⏸ Rest) sets long rest and closes
9. Cancel closes without changing initiative
10. Backdrop tap (outside numpad panel) closes it
11. Numpad keys are large enough to tap accurately on iPad (56px height)

**Touch checks:**
12. Rapid tapping +/- on health does NOT trigger zoom
13. Rapid tapping condition icons does NOT trigger zoom
14. No blue flash on any button tap (iOS Safari)
15. All overlay +/- buttons respond cleanly to rapid taps

**Overlay checks:**
16. Tapping backdrop (dark area) closes CharacterDetailOverlay
17. Tapping backdrop closes ScenarioSetupOverlay
18. Tapping backdrop closes MenuOverlay
19. Mark Absent is at BOTTOM of character detail overlay (not near X button)

**Scroll check:**
20. With 5+ figures, last card fully visible above footer when scrolled to bottom

## STEP 8 — Commit

```powershell
git add -A
git commit -m "feat: initiative numpad overlay + touch UX fixes

- InitiativeNumpad: phone-style numpad with Set + Long Rest buttons,
  dark fantasy styling with gold accents and scale-in animation
- Initiative input changed from inline text to numpad overlay tap
- Global touch-action: manipulation on all interactive elements
- -webkit-tap-highlight-color: transparent removes iOS blue flash
- Mark Absent moved to bottom of character detail overlay (away from X)
- Backdrop tap closes all overlays (CharacterDetail, ScenarioSetup, Menu)
- Scroll padding verified for fixed footer
- CLAUDE.md updated with design skill references and conventions
- Fixes I1, I2, I4, I5 from playtest"
git push
```

Report: commit hash, bundle size, and which of the 20 checks pass. Specifically:
does the numpad feel good on iPad — are the keys large enough, does the
animation feel polished, and does the Long Rest button work?
