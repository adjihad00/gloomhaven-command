# App Conventions

## CSS Naming: BEM

All new CSS must follow **BEM** (Block Element Modifier).

### Pattern
```
.block {}
.block__element {}
.block--modifier {}
.block__element--modifier {}
```

### Rules

1. **Block** = component name in kebab-case: `char-card`, `monster-card`, `loading-spinner`
2. **Element** = child within a block, double underscore: `char-card__header`, `char-card__name`
3. **Modifier** = variant/state, double dash: `char-card--active`, `char-card--exhausted`
4. **State modifiers** prefer `--active`, `--disabled`, `--done` over standalone `.active`, `.done`
5. **Size variants**: `--compact`, `--large`, `--header`
6. **Layout variants**: `--horizontal`, `--vertical`, `--grid`

### Grandfathered Names

Existing flat class names (`.char-card`, `.monster-header`, `.standee-row`, `.hp-btn`) are kept as-is.
Do not rename working CSS. New code follows BEM from day one.

### Examples from Codebase

Already BEM:
- `health-control__bar`, `health-control__value`, `health-control--compact`
- `summon-card__header`, `summon-card__name`, `summon-card--dead`
- `monster-stat-card__columns`, `stat-column--elite`
- `error-boundary__message`
- `loading-spinner__ring`, `loading-spinner__label`

## Spacing

Use CSS custom property spacing tokens (defined in `shared/styles/theme.css`):
```css
var(--space-1)  /* 4px */
var(--space-2)  /* 8px */
var(--space-3)  /* 12px */
var(--space-4)  /* 16px */
var(--space-5)  /* 20px */
var(--space-6)  /* 24px */
var(--space-8)  /* 32px */
```

## Icons

Use inline SVG components from `components/Icons.tsx` instead of emoji characters.
SVG icons use `currentColor` fill and `aria-hidden="true"` for decorative icons.

## Accessibility

- Icon-only buttons must have `aria-label`
- Toggle buttons use `aria-pressed`
- Overlays/dialogs use `role="dialog"` and `aria-modal="true"`
- Decorative images use `alt=""`
- Meaningful images use descriptive `alt` text

## CSS Architecture

Load order (defined in each index.html):
1. `shared/styles/theme.css` — variables, reset, focus styles
2. `shared/styles/typography.css` — self-hosted @font-face, heading classes
3. `shared/styles/components.css` — shared component classes
4. `shared/styles/connection.css` — shared connection/setup screen
5. `shared/styles/sheets.css` — Player Sheet (T0a) + Party Sheet (T0b) blocks;
   linked from phone, controller, and display
6. `{device}/styles/{device}.css` — device-specific overrides only

## Shared code layout

### `app/shared/sheets/` (Phase T0b)

Canonical home for **multi-client sheet components** — sheets that are
consumed by more than one client (phone, controller, display). The T0b
Party Sheet lives here; T0c Campaign Sheet will too.

Pattern:
- `XxxSheet.tsx` — root component with `readOnly` / `autoCycle` /
  `layout` props.
- `XxxSheetContext.ts` — tiny context (`readOnly`, `edition`, `onClose`,
  `autoCycle`) so child subtrees don't need to prop-drill.
- `XxxSheetHeader.tsx`, `XxxSheetTabs.tsx`, `XxxSheetIntro.tsx` — header,
  tab strip, one-time intro animation.
- `tabs/*.tsx` — one file per tab.

Each client mounts the shared sheet via a thin wrapper:
- Controller: `app/controller/overlays/XxxSheetOverlay.tsx` with
  `readOnly: false`.
- Display: `app/display/views/DisplayXxxSheetView.tsx` with
  `readOnly + autoCycle + skipIntro`.

T0a's `PlayerSheet` still lives at `app/phone/sheets/` because it was
authored phone-first; controller consumes it via
`app/controller/overlays/PlayerSheetQuickView.tsx`. New multi-client
sheets from T0b onward go in `app/shared/sheets/`.

### `app/shared/hooks/` (Phase T0b)

Cross-client hooks. Currently: `useCommitOnPause` (hybrid-commit for
editable text — blur / Enter / 1000 ms typing pause). Hooks consumed by
only one client's tree belong in that client's directory
(`app/hooks/`, `app/controller/hooks/`, `app/display/hooks/`).
