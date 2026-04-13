# Batch 10 — Icon System + Asset Audit

> Paste this entire file into Claude Code. Read `RESPONSE_CONTRACT.md`,
> `app/CONVENTIONS.md`, and `assets/ASSET_PATHS.md` before implementing.
> Execute all 6 fixes, then run the verification checklist.

---

## Context

The controller uses generic SVG shapes and Unicode emoji for game-specific icons.
The playtest flagged these as inconsistent with Gloomhaven/Frosthaven visual language.

Strategy: expand `app/components/Icons.tsx` with custom inline SVG icons that match
the dark fantasy tabletop aesthetic. Inline SVGs avoid dependency on external asset
population. Colors should use CSS `currentColor` so the parent can theme them.

GHS assets (condition icons, element icons, thumbnails) remain at their existing
`/assets/ghs/images/` paths. This batch does NOT change those — only the UI-level
icons that were placeholders.

---

## Fix 10.1 — Character thumbnails in class picker grid

### Problem
`ScenarioSetupOverlay.tsx` (lines 262-278) renders the character class grid with only
name text and HP — no thumbnail image. The `characterThumbnail()` helper exists in
`app/shared/assets.ts` but is never called here.

### Fix
Add a thumbnail `<img>` to each `char-class-card`.

In `app/controller/overlays/ScenarioSetupOverlay.tsx`, update the character class card
(inside the `.char-class-grid` map, ~line 267-275):

```tsx
<button
  key={c.name}
  class="char-class-card"
  style={c.color ? { borderColor: c.color } : undefined}
  onClick={() => handleAddCharacter(c.name)}
>
  <img
    src={characterThumbnail(selectedEdition, c.name)}
    alt={formatName(c.name)}
    class="char-class-card__thumb"
    loading="lazy"
  />
  <span class="char-class-card__name">{formatName(c.name)}</span>
  <span class="char-class-card__hp">HP: {hpAtLevel}</span>
</button>
```

Add the import at the top:
```typescript
import { characterThumbnail } from '../../shared/assets';
```

Add CSS to `app/controller/styles/controller.css`:
```css
.char-class-card__thumb {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid currentColor;
  margin-bottom: var(--space-2);
  background: var(--bg-secondary);
}
```

The thumbnail pulls from `/assets/ghs/images/character/thumbnail/{edition}-{name}.png`.
If the file is missing, the `<img>` shows the `background: var(--bg-secondary)` circle
with no broken image icon (CSS handles it). Do NOT add `onerror` fallbacks — broken
images signal path errors per project convention.

### Files
- `app/controller/overlays/ScenarioSetupOverlay.tsx`
- `app/controller/styles/controller.css`

---

## Fix 10.2 — Health blood drop icon (replaces heart)

### Problem
`Icons.tsx` has `HeartIcon` (line 8-14) — a standard heart shape. The playtest
requests a blood drop to match GH/FH health iconography.

### Fix
Replace `HeartIcon` with `BloodDropIcon` in `app/components/Icons.tsx`:

```tsx
export function BloodDropIcon({ size = 16, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      class={className} aria-hidden="true">
      <path d="M12 2.5C12 2.5 5 11.5 5 15.5C5 19.37 8.13 22.5 12 22.5C15.87 22.5
        19 19.37 19 15.5C19 11.5 12 2.5 12 2.5Z"/>
    </svg>
  );
}
```

This is a teardrop/blood drop shape. Update all imports of `HeartIcon` to
`BloodDropIcon`:

- `app/components/CharacterBar.tsx` line 11: change import and usage at line 99

Keep `HeartIcon` as a deprecated export alias if other files reference it, OR do a
full search-replace across the codebase.

### Files
- `app/components/Icons.tsx`
- `app/components/CharacterBar.tsx`

---

## Fix 10.3 — XP and Gold icons (GH/FH style)

### Problem
`StarIcon` and `CoinIcon` in `Icons.tsx` are generic shapes. GH/FH uses a distinctive
angular XP star and a round coin with center pip.

### Fix
Replace both in `app/components/Icons.tsx`:

**XP Icon** — a 4-pointed angular star (GH style):
```tsx
export function XPIcon({ size = 14, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      class={className} aria-hidden="true">
      <path d="M12 1L14.5 8.5H22L16 13.5L18.5 21L12 16.5L5.5 21L8 13.5L2 8.5H9.5L12 1Z"/>
    </svg>
  );
}
```

**Gold Coin Icon** — a coin with inner ring (GH gold token style):
```tsx
export function GoldIcon({ size = 14, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      class={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.3"/>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="12" y="16" text-anchor="middle" font-size="10" font-weight="700"
        font-family="Cinzel, serif" fill="currentColor">G</text>
    </svg>
  );
}
```

Update imports in `CharacterBar.tsx`:
- `StarIcon` → `XPIcon`
- `CoinIcon` → `GoldIcon`

### Files
- `app/components/Icons.tsx`
- `app/components/CharacterBar.tsx`

---

## Fix 10.4 — Door SVG icons (open/closed silhouettes)

### Problem
`ScenarioFooter.tsx` (line 65) uses Unicode squares `◼`/`◻` for door icons.

### Fix
Add door icon components to `app/components/Icons.tsx`:

**Closed Door:**
```tsx
export function DoorClosedIcon({ size = 18, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      class={className} aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="1" fill="currentColor"/>
      <rect x="6" y="4" width="12" height="8" rx="0.5" fill="currentColor" opacity="0.5"/>
      <rect x="6" y="14" width="12" height="6" rx="0.5" fill="currentColor" opacity="0.5"/>
      <circle cx="16" cy="13" r="1.2" fill="currentColor" opacity="0.7"/>
    </svg>
  );
}
```

**Open Door:**
```tsx
export function DoorOpenIcon({ size = 18, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      class={className} aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="1" fill="none"
        stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>
      <rect x="6" y="4" width="5" height="16" rx="0.5" fill="currentColor" opacity="0.4"
        transform="skewY(-5)"/>
    </svg>
  );
}
```

Update `ScenarioFooter.tsx` line 65:
```tsx
<span class="scenario-footer__door-icon">
  {door.revealed ? <DoorOpenIcon size={16} /> : <DoorClosedIcon size={16} />}
</span>
```

Add the imports at the top of `ScenarioFooter.tsx`:
```typescript
import { DoorClosedIcon, DoorOpenIcon } from './Icons';
```

### Files
- `app/components/Icons.tsx`
- `app/components/ScenarioFooter.tsx`

---

## Fix 10.5 — Footer derived-value icons (Trap, Gold, XP, Hazard)

### Problem
`ScenarioFooter.tsx` (lines 77-91) uses Unicode emoji for the derived-value pills:
- `⚠` (U+26A0) for trap damage
- `💰` (U+1F4B0) for gold conversion
- `★` (U+2605) for bonus XP
- `☣` (U+2623) for hazardous terrain

These render inconsistently on iOS and don't match GH/FH iconography.

### Fix
Add game-specific icon components to `app/components/Icons.tsx`:

**Trap Icon** — a bear trap jaw shape:
```tsx
export function TrapIcon({ size = 14, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      class={className} aria-hidden="true">
      <path d="M3 14L6 8L9 14M15 14L18 8L21 14M5 14H10M14 14H19"/>
      <path d="M3 14L6 8L9 14M15 14L18 8L21 14" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <rect x="2" y="14" width="20" height="3" rx="1" fill="currentColor" opacity="0.6"/>
      <circle cx="12" cy="19" r="2" fill="currentColor" opacity="0.4"/>
    </svg>
  );
}
```

**Hazard Icon** — a flame/danger symbol:
```tsx
export function HazardIcon({ size = 14, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      class={className} aria-hidden="true">
      <path d="M12 2L14 8L18 6L16 12L22 14L16 16L18 22L12 18L6 22L8 16L2 14L8 12L6 6L10 8L12 2Z"/>
    </svg>
  );
}
```

Update `ScenarioFooter.tsx` (lines 77-91), replacing each emoji `<span>` with the
corresponding icon component:

```tsx
<div class="footer-derived">
  <span class="derived-pill" title="Trap Damage">
    <TrapIcon size={14} class="derived-icon" />{levelValues.trapDamage}
  </span>
  <span class="derived-pill" title="Gold per Coin">
    <GoldIcon size={14} class="derived-icon" />{levelValues.goldConversion}
  </span>
  <span class="derived-pill" title="Bonus XP">
    <XPIcon size={14} class="derived-icon" />{levelValues.bonusXP}
  </span>
  <span class="derived-pill" title="Hazardous Terrain">
    <HazardIcon size={14} class="derived-icon" />{levelValues.hazardousTerrain}
  </span>
</div>
```

Add the imports:
```typescript
import { TrapIcon, GoldIcon, XPIcon, HazardIcon } from './Icons';
```

Update the CSS for `.derived-icon` in `app/shared/styles/components.css` — it's
currently styled for a `<span>` containing text. Change to handle an SVG:

```css
.derived-icon {
    flex-shrink: 0;
    color: var(--accent-copper);
}
```

Remove any `font-size` or text-specific properties from `.derived-icon` since it's
now an SVG, not text.

### Files
- `app/components/Icons.tsx`
- `app/components/ScenarioFooter.tsx`
- `app/shared/styles/components.css`

---

## Fix 10.6 — Long Rest zzz/sleep icon

### Problem
- `InitiativeNumpad.tsx` (line 62) shows `⏸` (pause icon) for the rest button
- `InitiativeDisplay.tsx` (line 16) shows "REST" text when `longRest` is true
- Both should show a zzz/sleep icon matching GH/FH visual language

### Fix
Add a `LongRestIcon` to `app/components/Icons.tsx`:

```tsx
export function LongRestIcon({ size = 18, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      class={className} aria-hidden="true">
      <text x="3" y="11" font-size="8" font-weight="700"
        font-family="Cinzel, serif" fill="currentColor" opacity="0.5">z</text>
      <text x="8" y="15" font-size="10" font-weight="700"
        font-family="Cinzel, serif" fill="currentColor" opacity="0.7">z</text>
      <text x="14" y="20" font-size="13" font-weight="700"
        font-family="Cinzel, serif" fill="currentColor">Z</text>
    </svg>
  );
}
```

**Update `InitiativeDisplay.tsx`** (line 15-17):
```tsx
if (longRest) {
  return (
    <span class={`initiative-display initiative-display--${size} initiative-display--rest`}>
      <LongRestIcon size={size === 'large' ? 28 : 20} />
    </span>
  );
}
```

Add import:
```typescript
import { LongRestIcon } from './Icons';
```

**Update `InitiativeNumpad.tsx`** (line 60-63):
```tsx
{key === 'rest' ? (
  <span class="numpad-rest__content">
    <LongRestIcon size={20} class="numpad-rest__icon" />
    <span class="numpad-rest__label">Rest</span>
  </span>
)
```

Replace the `⏸` Unicode span with the `LongRestIcon` component. Add import:
```typescript
import { LongRestIcon } from '../../components/Icons';
```

### Files
- `app/components/Icons.tsx`
- `app/components/InitiativeDisplay.tsx`
- `app/controller/overlays/InitiativeNumpad.tsx`

---

## Final cleanup: remove unused old icon exports

After all fixes, remove from `Icons.tsx`:
- `HeartIcon` (replaced by `BloodDropIcon`)
- `StarIcon` (replaced by `XPIcon`)
- `CoinIcon` (replaced by `GoldIcon`)

Only remove if grep confirms no remaining imports.

```bash
grep -rn "HeartIcon\|StarIcon\|CoinIcon" app/ --include="*.tsx" --include="*.ts"
```

If any remain, update them. If none, delete the old functions.

---

## Verification Checklist

```
[ ] npm run build completes without errors
[ ] Character class picker grid: thumbnail circles visible for each class
[ ] Missing thumbnail: shows bg-secondary circle (no broken image icon)
[ ] CharacterBar health: blood drop icon (not heart)
[ ] CharacterBar XP counter: angular star icon
[ ] CharacterBar gold counter: coin with inner ring and G
[ ] Footer trap pill: trap jaw icon (not ⚠ emoji)
[ ] Footer gold pill: coin icon (not 💰 emoji)
[ ] Footer XP pill: star icon (not ★ emoji)
[ ] Footer hazard pill: hazard icon (not ☣ emoji)
[ ] Footer door buttons: closed door silhouette for unrevealed rooms
[ ] Footer door buttons: open door silhouette for revealed rooms
[ ] Initiative display: zzz icon when character is on Long Rest (not "REST" text)
[ ] Initiative numpad: rest key shows zzz icon + "Rest" label (not ⏸)
[ ] All SVG icons use currentColor (themeable by parent)
[ ] All SVG icons render cleanly at both 14px and 18px sizes
[ ] No remaining Unicode emoji in ScenarioFooter (grep for \u26, \uD83D, \u2605, \u2623)
[ ] No remaining HeartIcon / StarIcon / CoinIcon imports
```

## Commit Message

```
fix(batch-10): icon system — blood drop, GH-style XP/gold, doors, footer pills, rest zzz

- Replace HeartIcon with BloodDropIcon (teardrop shape)
- Replace StarIcon/CoinIcon with XPIcon/GoldIcon matching GH visual language
- Add DoorClosedIcon/DoorOpenIcon SVG silhouettes for footer room controls
- Replace emoji in footer derived-value pills with TrapIcon/HazardIcon SVGs
- Add LongRestIcon (zzz) for initiative display and numpad rest button
- Add character thumbnails to class picker grid in ScenarioSetupOverlay
- Remove deprecated HeartIcon/StarIcon/CoinIcon exports
```
