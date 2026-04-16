# Batch 18b: Display UI Polish

Three targeted display client tweaks from Round Four feedback. Pure visual refinement — no engine, server, or data changes.

## Skills to Read FIRST

1. **UI/UX Pro Max skill** — Read ALL `.md` files in:
   `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
2. **Project conventions** — Read `app/CONVENTIONS.md`

---

## Issue 1: Monster Stat Icons — Single Icon + Colored Text

### Problem
When a monster has different stats for normal vs. elite (e.g., Ice Wraith: normal Shield 2, elite Retaliate 2 @ Range 2), the display currently renders the icon twice — once for normal, once for elite. This is visually redundant and wastes horizontal space.

### Fix
Render the icon **once** per stat type. The values appear as text next to the icon:
- **White text** for normal monster values
- **Yellow/gold text** for elite monster values
- If normal and elite have the same value, show it once in a neutral color (or white)
- If only one type has the stat, show just that value in its appropriate color

### Examples

**Ice Wraith (differs between normal/elite):**
```
Before:  [Shield] 2    [Shield] 0     ← two icons
         [Retaliate] 0 [Retaliate] 2 [Range] 2  ← two icons

After:   [Shield] 2                   ← normal only, white
         [Retaliate] 2 [Range] 2      ← elite only, yellow
```

**Algox Guard (same for normal/elite):**
```
After:   [Shield] 1                   ← one icon, white text (or shared color)
```

**Bandit Archer (differs):**
```
After:   [Shield] 1 / 2              ← single icon, "1" white + "/" separator + "2" yellow
```

Pick a format that's consistent and readable at display distance. Best approach is probably:
- If values differ: single icon, `N/E` with `N` in white and `E` in yellow
- If values same: single icon, single value in neutral/white

### Files Likely to Change
- `app/display/components/DisplayFigureCard.tsx` (monster stats section)
- `app/display/styles/display.css` (stat number color styles)
- Possibly the stat icon extraction logic in `useDisplayMonsterData` hook if it currently returns separate normal/elite stat arrays

### Verification
- [ ] Ice Wraith shows single Shield icon with "2" in white (normal only)
- [ ] Ice Wraith shows single Retaliate icon with "2" in yellow + Range icon with "2" in yellow (elite only)
- [ ] Algox Guard (if same stats) shows single Shield icon with value once
- [ ] Monsters where normal and elite differ on a stat show one icon with both values color-coded
- [ ] No duplicate icons anywhere in monster stat display

---

## Issue 2: Hidden Initiatives — `??` Until Round Starts

### Problem
Currently when players enter initiatives during draw phase, the values are immediately visible on the display. Per Gloomhaven rules, initiatives are revealed simultaneously when all players commit. The display should hide character initiative values during draw phase and reveal them when the play phase begins.

### Expected Behavior

**During draw phase** (`state.state === 'draw'`):
- Characters who have entered an initiative show `??` in the initiative circle
- Characters who haven't entered yet show empty / placeholder (current behavior)
- Long-resting characters show the zzz icon as normal (long rest is publicly declared per rules)

**When play phase begins** (`state.state === 'next'`, or equivalent transition):
- All initiatives reveal simultaneously
- Optional: brief reveal animation — the `??` fades/flips to the actual number
- Monster ability cards reveal their drawn initiative at the same moment

### Why This Matters
Players strategize based on visible initiative order. Revealing early breaks the "secret initiative" rule and gives late-committers an advantage. The display is the shared source of truth at the table — it needs to enforce the reveal moment.

### Detection Logic
```typescript
// During draw phase
const displayInitiative = phase === 'draw'
  ? (character.initiative === 0 ? null : (character.longRest ? 'zzz' : '??'))
  : character.initiative;
```

Note: `character.initiative === 0` typically means "not yet entered" — keep showing placeholder for those. `character.initiative > 0` during draw phase means entered but should display as `??`.

### Files Likely to Change
- `app/display/components/DisplayFigureCard.tsx` (initiative rendering)
- `app/display/components/DisplayInitiativeColumn.tsx` (if it renders initiative labels)
- Possibly a shared helper for initiative display formatting

### Reveal Animation (Optional Polish)
When phase transitions from `'draw'` to `'next'`:
- The `??` can flip or fade to the actual number with a brief animation (~400ms)
- Stagger the reveal across characters (50ms delay per character) for a cinematic effect
- This is a nice-to-have — ship without it if time-constrained

### Edge Cases
- **Long rest characters**: Always show zzz icon regardless of phase (long rest is publicly declared)
- **Reconnecting mid-draw-phase**: Show `??` for already-entered initiatives (don't reveal them on reconnect)
- **Monster initiatives**: Monsters' drawn ability cards contain their initiative. During draw phase, monsters haven't drawn yet so their initiative slot is empty/placeholder. When play phase begins, monster ability cards reveal and show their initiative — same reveal moment as characters.

### Verification
- [ ] During draw phase, characters who entered initiative show `??`
- [ ] Characters who haven't entered show empty/placeholder
- [ ] Long-resting characters show zzz icon (not `??`)
- [ ] When play phase begins, all initiatives reveal simultaneously
- [ ] Monster initiatives (from drawn ability cards) reveal at same moment
- [ ] Reconnecting during draw phase doesn't spoil entered initiatives
- [ ] Figure ordering in the initiative column during draw phase — decide whether to sort by actual initiative (which would leak info) or show in a default order (by character order, monsters at bottom). Round Three notes already specified: "When initiatives are pending, all characters should be at the top, allies and monsters at the bottom." Confirm this is the current behavior.

---

## Issue 3: Compacted Cards Always Right-Stack Vertically

### Problem
Current behavior: compacted cards (completed figures that have finished their turn) stack on the left when there are no monster standees in the completed area, and shift to the right when standees appear. This causes visual jitter as the layout shifts mid-round.

### Fix
Compacted character/monster cards should **always** stack vertically on the right side, regardless of whether the completed standee tray (bottom-left) has any standees yet. The position is fixed and predictable.

### Layout Rules
- **Compacted cards**: Always bottom-right, stacking vertically (newest completed on top or bottom — pick one, be consistent)
- **Completed standees**: Always bottom-left, grouped by monster type
- Both trays have fixed positions and don't shift based on each other's content
- Empty tray is just invisible — no layout shift when it populates

### Stacking Direction
Vertical stack. Round Three notes said "compacted cards stack in a column." Confirm direction:
- **Top-to-bottom**: Newest completion at top, oldest pushed down
- **Bottom-to-top**: Oldest at bottom of screen, newest added above (preferred for readability — eyes naturally start from the active figure and scan down)

Pick whichever feels more natural at the table. Document the choice.

### Files Likely to Change
- `app/display/components/DisplayInitiativeColumn.tsx` (layout for completed tray)
- `app/display/styles/display.css` (flexbox/grid positioning for compact card stack)

### Verification
- [ ] Compacted cards always appear bottom-right, regardless of standee tray content
- [ ] Completed standees always appear bottom-left, regardless of compact card tray content
- [ ] No layout shift when the first standee dies (compact cards don't move)
- [ ] No layout shift when the first figure completes a turn (standee tray doesn't move)
- [ ] Both trays are visually independent
- [ ] Vertical stacking is consistent and readable

---

## Implementation Order

1. **Issue 3 (compact card positioning):** CSS-only change, fastest, eliminates layout jitter
2. **Issue 1 (single icon + colored text):** Stat rendering refactor, scoped to monster cards
3. **Issue 2 (hidden initiatives):** Involves state transition logic + possible reveal animation

---

## Verification Scenario

Run a playtest-style verification on the display with prototype mode + live connection:

1. Start scenario with 3 characters + 2 monster groups (Ice Wraith + Algox Guard for stat differentiation)
2. During draw phase, enter initiatives for 2 characters → verify `??` shown
3. Third character declares long rest → verify zzz icon shown
4. Advance to play phase → all initiatives reveal at same moment
5. Ice Wraith monster card → single Shield icon, single Retaliate+Range icons, correctly colored
6. First character completes turn → compact card appears bottom-right
7. First monster standee dies → standee tray appears bottom-left
8. Verify compact card tray did NOT shift position when standee tray appeared
9. More figures complete turns → vertical stack grows on right without moving left-tray

---

## Docs to Update

- `docs/BUGFIX_LOG.md` — append entries for the three polish fixes
- `docs/DESIGN_DECISIONS.md` — append entry for initiative hiding during draw phase (rules enforcement via display)
- `docs/GAME_RULES_REFERENCE.md` — confirm initiative secrecy rule is documented (should already be in Section 2, Card Selection Phase)

**Commit message:** `polish: monster stat icon consolidation, hidden initiatives, stable compact card tray`
