# Asset Requests

Living log of assets that surface during phase work but aren't yet available
in `.staging/` / the asset manifest / the existing `app/shared/assets.ts`
helpers. Each entry: date, phase, asset description, current fallback.

Append entries chronologically. Clear entries once the asset is sourced and
wired up (note the resolution inline before removing — leave a note in the
BUGFIX_LOG if appropriate).

---

## Phase T0a (2026-04-17) — no gaps

Player Sheet built entirely from existing assets:
- **Class sigil** on the sheet header — resolved via existing
  `characterIcon(edition, name)` helper (`/assets/ghs/images/character/
  icons/{edition}-{name}.svg`). Already in use by lobby spoiler masking.
- **Illuminated capital corner flourish** — generated as inline SVG in
  `IlluminatedCapital.tsx`. No external asset needed.
- **Wax-seal "Level Up" indicator** — CSS-only (gilt-gold gradient + inset
  shadow). No image needed.
- **Card-back placeholder** in the Overview Hand preview — generated as
  inline SVG (parchment rect + accent rules). Real card art arrives in T2b.

No outstanding asset requests at T0a completion.

---

## Phase T0b — pending

TBD. Party Sheet's signature element is **gilt tab edges** (CSS-rendered)
and the **leather-bound** aesthetic (CSS gradients). Likely no asset gaps,
but confirm when T0b scoping begins.

## Phase T0c — pending

The **Outpost tab** (FH) will likely need:
- **Outpost top-down map background** — check Worldhaven for a suitable
  base illustration before commissioning.
- **Per-building top-down sprites** — check
  `asset_manifest category='building-illustration'`.
- **Wax-seal tab header icons** — one reusable SVG seal shape + swap-in
  tab-specific glyphs from `Icons.tsx`. CSS + existing icons, no new assets.

Flag gaps here when T0c scoping begins.
