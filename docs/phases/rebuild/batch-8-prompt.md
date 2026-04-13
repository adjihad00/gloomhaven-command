# Batch 8 — Interaction Fixes

> Paste this entire file into Claude Code. Read `RESPONSE_CONTRACT.md` and
> `app/CONVENTIONS.md` before implementing. Execute all 4 fixes, then run
> the verification checklist.

---

## Fix 8.1 — Condition picker popup clips beyond card boundary

### Problem
`StandeeConditionAdder` in `app/components/MonsterGroup.tsx` (line 163-179) renders
`.cond-adder-popup` with `position: absolute; bottom: 100%; right: 0;` (CSS at
`app/shared/styles/components.css` line 917-931). This positions the popup upward
from the standee row.

The problem: `.scenario-content` (`app/controller/styles/controller.css` line 137-143)
has `overflow-y: auto; overflow-x: hidden;` creating a scroll container. The absolute
popup extends above the monster card and gets clipped by the scroll container's
overflow boundary.

`.monster-card` already has `overflow: visible` (line 747) but that doesn't help
because the clipping ancestor is `.scenario-content`, not `.monster-card`.

### Fix
Convert the popup to a **fixed-position overlay** that calculates its position from
the button's viewport coordinates, escaping all overflow containers.

1. **Update** `StandeeConditionAdder` in `app/components/MonsterGroup.tsx`:

   ```tsx
   function StandeeConditionAdder({ target, existingConditions }: {
     target: { type: 'monster'; name: string; edition: string; entityNumber: number };
     existingConditions: EntityCondition[];
   }) {
     const [open, setOpen] = useState(false);
     const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
     const btnRef = useRef<HTMLButtonElement>(null);
     const commands = useCommands();

     const conditionsToShow = NEGATIVE_CONDITIONS.filter(
       name => !existingConditions.some(c => c.name === name)
     );

     if (conditionsToShow.length === 0) return null;

     const handleOpen = () => {
       if (btnRef.current) {
         const rect = btnRef.current.getBoundingClientRect();
         // Position above the button, right-aligned
         setPopupPos({
           top: rect.top - 8,  // 8px gap above button
           left: Math.max(8, rect.right - 200), // right-aligned, max-width 200
         });
       }
       setOpen(!open);
     };

     return (
       <div class="cond-adder">
         <button ref={btnRef} class="cond-add-btn" onClick={handleOpen}
           aria-label="Add condition">+</button>
         {open && popupPos && (
           <div class="cond-adder-portal"
             style={{
               position: 'fixed',
               top: 0, left: 0, right: 0, bottom: 0,
               zIndex: 60,
             }}
             onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
           >
             <div class="cond-adder-popup"
               style={{
                 position: 'fixed',
                 bottom: `${window.innerHeight - popupPos.top}px`,
                 left: `${popupPos.left}px`,
               }}
             >
               {conditionsToShow.map(name => (
                 <button key={name} class="cond-btn mini"
                   onClick={() => { commands.toggleCondition(target, name); setOpen(false); }}
                   title={name}
                 >
                   <img src={conditionIcon(name)} alt={name} class="cond-icon mini" />
                 </button>
               ))}
             </div>
           </div>
         )}
       </div>
     );
   }
   ```

   Add `useRef` to the preact/hooks import at the top of the file:
   ```typescript
   import { useState, useRef } from 'preact/hooks';
   ```

2. **Update CSS** in `app/shared/styles/components.css`:

   Remove the existing `.cond-adder-popup` positioning rules (lines 917-931) and
   replace with:
   ```css
   .cond-adder-popup {
       display: flex;
       flex-wrap: wrap;
       gap: 3px;
       padding: 6px;
       background: var(--bg-card);
       border: 1px solid var(--accent-copper);
       border-radius: var(--radius-sm);
       box-shadow: var(--shadow-heavy);
       z-index: 61;
       max-width: 200px;
   }

   .cond-adder-portal {
       /* Transparent backdrop — catches outside clicks */
   }
   ```

   Remove `position: absolute; bottom: 100%; right: 0;` from `.cond-adder-popup`
   since positioning is now handled inline via the `style` prop.

### Files
- `app/components/MonsterGroup.tsx`
- `app/shared/styles/components.css`

---

## Fix 8.2 — Room reveal needs confirmation prompt

### Problem
In `app/components/ScenarioFooter.tsx` (line 58), tapping a door button immediately
calls `onRevealRoom?.(door.roomNumber)`. Accidental taps spawn monsters and advance
the game state irreversibly.

### Fix
Add a confirmation overlay between the tap and the reveal command.

1. **Add state** to `ScenarioFooter` for a pending door confirmation:

   ```tsx
   const [pendingDoor, setPendingDoor] = useState<DoorInfo | null>(null);
   ```

2. **Change** the door button `onClick` (line 58) to set pending instead of
   immediately revealing:
   ```tsx
   onClick={() => !door.revealed && setPendingDoor(door)}
   ```

3. **Add** a confirmation overlay after the footer content (inside the
   `<div class="scenario-footer">` return, before the closing `</div>`):

   ```tsx
   {pendingDoor && (
     <div class="door-confirm-backdrop"
       onClick={(e) => { if (e.target === e.currentTarget) setPendingDoor(null); }}
     >
       <div class="door-confirm-panel">
         <p class="door-confirm-text">
           Open door to Room {pendingDoor.roomNumber} ({pendingDoor.ref})?
         </p>
         <div class="door-confirm-actions">
           <button class="btn door-confirm-cancel"
             onClick={() => setPendingDoor(null)}>Cancel</button>
           <button class="btn door-confirm-ok"
             onClick={() => {
               onRevealRoom?.(pendingDoor.roomNumber);
               setPendingDoor(null);
             }}>Open Door</button>
         </div>
       </div>
     </div>
   )}
   ```

4. **Add** the `useState` import:
   ```typescript
   import { useState } from 'preact/hooks';
   ```

5. **Add CSS** to `app/controller/styles/controller.css`:

   ```css
   /* Door confirm overlay */
   .door-confirm-backdrop {
     position: fixed;
     inset: 0;
     background: rgba(0, 0, 0, 0.7);
     z-index: 55;
     display: flex;
     align-items: center;
     justify-content: center;
   }

   .door-confirm-panel {
     background: var(--bg-card);
     border: 2px solid var(--accent-gold);
     border-radius: var(--radius-md);
     padding: 24px;
     max-width: 340px;
     text-align: center;
   }

   .door-confirm-text {
     font-family: 'Cinzel', serif;
     font-size: 1rem;
     color: var(--text-primary);
     margin-bottom: 16px;
   }

   .door-confirm-actions {
     display: flex;
     gap: 12px;
     justify-content: center;
   }

   .door-confirm-cancel {
     border-color: var(--text-muted);
     color: var(--text-muted);
   }

   .door-confirm-ok {
     border-color: var(--accent-gold);
     color: var(--accent-gold);
     background: linear-gradient(135deg, var(--bg-primary), rgba(212, 175, 55, 0.15));
   }
   ```

### Files
- `app/components/ScenarioFooter.tsx`
- `app/controller/styles/controller.css`

---

## Fix 8.3 — Mark Absent doesn't hide character card

### Problem
`FigureList` in `app/components/FigureList.tsx` renders every figure from
`getInitiativeOrder()`, including absent characters. Absent characters appear as full
cards in the initiative-sorted grid. They should be hidden from the main list and shown
as small portraits in a "bench" strip near the footer.

### Fix

1. **Filter absent figures** in `FigureList.tsx` (line 22). Change:
   ```tsx
   {figures.map(fig => {
   ```
   to:
   ```tsx
   {figures.filter(f => !f.absent).map(fig => {
   ```

2. **Add a Bench component** to `FigureList.tsx` below the figure grid. This shows
   absent character portraits as small tappable icons. Add this after the
   `.figure-grid` div:

   ```tsx
   {(() => {
     const absentFigs = figures.filter(f => f.absent && f.type === 'character');
     if (absentFigs.length === 0) return null;
     return (
       <div class="bench-strip">
         <span class="bench-label">Bench</span>
         {absentFigs.map(fig => {
           const character = state.characters.find(
             c => c.name === fig.name && c.edition === fig.edition
           );
           if (!character) return null;
           return (
             <button
               key={`bench-${fig.edition}-${fig.name}`}
               class="bench-portrait"
               onClick={() => onCharacterDetail?.(character.name)}
               title={`${character.title || fig.name} (absent)`}
             >
               <img
                 src={characterThumbnail(fig.edition, fig.name)}
                 alt={fig.name}
                 class="bench-portrait-img"
               />
             </button>
           );
         })}
       </div>
     );
   })()}
   ```

3. **Add import** for `characterThumbnail` in `FigureList.tsx`:
   ```typescript
   import { characterThumbnail } from '../shared/assets';
   ```

4. **Add CSS** to `app/shared/styles/components.css`:

   ```css
   /* Absent character bench */
   .bench-strip {
       display: flex;
       align-items: center;
       gap: 8px;
       padding: 8px 12px;
       margin-top: 8px;
       background: var(--bg-secondary);
       border: 1px dashed var(--text-muted);
       border-radius: var(--radius-sm);
       opacity: 0.65;
   }

   .bench-label {
       font-family: 'Cinzel', serif;
       font-size: 0.7rem;
       font-weight: 600;
       color: var(--text-muted);
       text-transform: uppercase;
       letter-spacing: 0.05em;
   }

   .bench-portrait {
       width: 36px;
       height: 36px;
       border-radius: 50%;
       border: 2px solid var(--text-muted);
       background: var(--bg-card);
       padding: 0;
       cursor: pointer;
       touch-action: manipulation;
       overflow: hidden;
       flex-shrink: 0;
   }

   .bench-portrait-img {
       width: 100%;
       height: 100%;
       object-fit: cover;
       filter: grayscale(0.6);
   }
   ```

### Files
- `app/components/FigureList.tsx`
- `app/shared/styles/components.css`

---

## Fix 8.4 — Modifier deck expanded mode shifts footer width

### Problem
`ModifierDeck` in `app/components/ModifierDeck.tsx` toggles between a compact badge
(line 51-58) and an inline expanded panel (line 61-103). The expanded panel
(`.modifier-deck--expanded`) renders as a flex column inside `.scenario-footer`,
which is a fixed footer with `display: flex; align-items: center;`. The expanded deck
takes up inline space, pushing other footer elements and causing layout reflow.

### Fix
Convert the expanded mode to a **floating overlay** positioned above the compact badge.

1. **Restructure** `ModifierDeck` component return in `app/components/ModifierDeck.tsx`.
   Always render the compact badge. When expanded, render the panel as a fixed overlay
   above the badge using a ref for positioning:

   ```tsx
   export function ModifierDeck({
     deck, deckName, onDraw, onShuffle,
     onAddBless, onRemoveBless, onAddCurse, onRemoveCurse,
     readonly, compact,
   }: ModifierDeckProps) {
     const [expanded, setExpanded] = useState(false);
     const badgeRef = useRef<HTMLButtonElement>(null);
     const remaining = deck.cards.length - deck.current;
     const total = deck.cards.length;

     const lastDrawnIndex = deck.current - 1;
     const lastDrawnCard = lastDrawnIndex >= 0 ? deck.cards[lastDrawnIndex] : null;
     const lastDrawnDisplay = lastDrawnCard
       ? (modifierDisplay[parseCardType(lastDrawnCard)]
         || { label: lastDrawnCard, color: 'var(--text-muted)' })
       : null;

     const remainingCards = deck.cards.slice(deck.current);
     const blessCount = remainingCards.filter(c => c.includes('bless')).length;
     const curseCount = remainingCards.filter(c => c.includes('curse')).length;

     // Compact badge (always rendered when compact prop is true)
     if (compact) {
       return (
         <>
           <button ref={badgeRef}
             class="modifier-deck modifier-deck--compact"
             onClick={() => setExpanded(!expanded)}
             title={`${deckName}: ${remaining}/${total}`}
           >
             <span class="modifier-deck__icon">{'\u2694'}</span>
             <span class="modifier-deck__badge">{remaining}</span>
           </button>

           {expanded && (
             <div class="modifier-deck-overlay-backdrop"
               onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}
             >
               <div class="modifier-deck-overlay">
                 <div class="modifier-deck__header">
                   <span class="modifier-deck__name">{deckName}</span>
                   <span class="modifier-deck__count">{remaining}/{total}</span>
                   <button class="modifier-deck__close"
                     onClick={() => setExpanded(false)}>&times;</button>
                 </div>

                 {lastDrawnDisplay && (
                   <div class="modifier-deck__last-drawn">
                     <span class="modifier-deck__drawn-label">Last drawn:</span>
                     <span class="modifier-deck__drawn-card"
                       style={{ color: lastDrawnDisplay.color }}>
                       {lastDrawnDisplay.label}
                     </span>
                   </div>
                 )}

                 {!readonly && (
                   <>
                     <div class="modifier-deck__actions">
                       <button class="btn" onClick={onDraw}
                         disabled={remaining <= 0}>Draw</button>
                       <button class="btn" onClick={onShuffle}>Shuffle</button>
                     </div>
                     <div class="modifier-deck__bless-curse">
                       <div class="modifier-deck__bc-row">
                         <span class="modifier-deck__bc-label">Bless: {blessCount}</span>
                         <button class="btn modifier-deck__bc-btn"
                           onClick={onAddBless}>+</button>
                         <button class="btn modifier-deck__bc-btn"
                           onClick={onRemoveBless}>&minus;</button>
                       </div>
                       <div class="modifier-deck__bc-row">
                         <span class="modifier-deck__bc-label">Curse: {curseCount}</span>
                         <button class="btn modifier-deck__bc-btn"
                           onClick={onAddCurse}>+</button>
                         <button class="btn modifier-deck__bc-btn"
                           onClick={onRemoveCurse}>&minus;</button>
                       </div>
                     </div>
                   </>
                 )}
               </div>
             </div>
           )}
         </>
       );
     }

     // Non-compact mode: render expanded inline (unchanged, for non-footer usage)
     return (
       <div class="modifier-deck modifier-deck--expanded">
         {/* ... existing non-compact expanded layout unchanged ... */}
       </div>
     );
   }
   ```

   Add `useRef` to the imports:
   ```typescript
   import { useState, useRef } from 'preact/hooks';
   ```

   Add a helper to parse card ID to card type:
   ```typescript
   function parseCardType(cardId: string): string {
     // "am-plus1-3" → "plus1", "am-null-1" → "null", "am-double-1" → "double"
     const match = cardId.match(/^am-(.+?)-\d+$/);
     return match ? match[1] : cardId;
   }
   ```

2. **Add CSS** to `app/shared/styles/components.css`:

   ```css
   /* Modifier deck floating overlay */
   .modifier-deck-overlay-backdrop {
       position: fixed;
       inset: 0;
       z-index: 55;
   }

   .modifier-deck-overlay {
       position: fixed;
       bottom: 56px; /* above the footer */
       right: 16px;
       width: 260px;
       background: var(--bg-card);
       border: 2px solid var(--accent-gold);
       border-radius: var(--radius-md);
       padding: 12px;
       box-shadow: var(--shadow-heavy);
       z-index: 56;
       display: flex;
       flex-direction: column;
       gap: 8px;
   }
   ```

### Files
- `app/components/ModifierDeck.tsx`
- `app/shared/styles/components.css`

---

## Verification Checklist

After implementing all 4 fixes, verify:

```
[ ] npm run build completes without errors
[ ] Condition picker (+) on bottom standee row: popup appears ABOVE, fully visible, not clipped
[ ] Condition picker (+) on top standee row: popup still visible (doesn't go off-screen top)
[ ] Condition picker: tapping backdrop closes popup
[ ] Condition picker: selecting a condition applies it and closes popup
[ ] Door button: tap shows "Open door to Room X (ref)?" confirmation
[ ] Door confirm: Cancel dismisses, door unchanged
[ ] Door confirm: Open Door triggers room reveal with monster spawns
[ ] Door confirm: backdrop tap dismisses
[ ] Absent character: card hidden from figure grid
[ ] Absent character: small greyscale portrait appears in bench strip
[ ] Absent character: tapping bench portrait opens character detail overlay
[ ] Bench strip: only visible when at least one character is absent
[ ] Modifier deck badge: tap opens floating overlay ABOVE footer
[ ] Modifier deck overlay: footer does NOT shift or resize
[ ] Modifier deck overlay: Draw/Shuffle/Bless/Curse controls work
[ ] Modifier deck overlay: close button (×) or backdrop tap closes
[ ] Modifier deck overlay: shows correct remaining/total count
[ ] All iPad touch: no double-tap zoom, no blue flash
```

## Commit Message

```
fix(batch-8): interaction fixes — condition picker, door confirm, absent bench, modifier overlay

- Condition picker: use fixed-position portal to escape scroll container clipping
- Room reveal: add confirmation overlay to prevent accidental door opens
- Absent characters: filter from figure grid, show in footer bench strip
- Modifier deck: convert expanded mode to floating overlay above footer badge
```
