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
5. `{device}/styles/{device}.css` — device-specific overrides only
