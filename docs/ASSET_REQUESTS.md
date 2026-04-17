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

## Phase T0b (2026-04-17) — one pending request

Party Sheet shipped with the signature elements (gilt-bound tab binding,
leather surface, candlelight flicker, page-turn animation) all
CSS/SVG-rendered, no external assets. `IlluminatedCapital` pattern from
T0a carried over directly; the "leather book opening" intro uses an
inline two-layer SVG.

**Pending request — event card images:**
- **Event card art** for the Events tab (gh/fh road, city, outpost,
  autumn/winter/personal event decks). `app/shared/assets.ts` has no
  `eventCardImage()` helper, and the `asset_manifest` table does not
  currently catalogue event card images. T0b renders cards text-only
  with gilt borders (per `app/CONVENTIONS.md`: broken image is a real
  bug; text-only is better than placeholder art).
- Resolution path: when T6 (event draw/resolve flows) lands, either
  cross-reference Worldhaven's `art/<edition>/events/` set or register
  a new asset source. Add an `eventCardImage(edition, type, cardId)`
  helper in `app/shared/assets.ts` and update EventsTab to use it
  with `onError` fallback to the existing text-only row.

All other T0b surfaces render from existing asset helpers
(`characterThumbnail`, `characterIcon`, `resourceIcon`) or
CSS/inline-SVG.

## Phase T0c — pending

The **Outpost tab** (FH) will likely need:
- **Outpost top-down map background** — check Worldhaven for a suitable
  base illustration before commissioning.
- **Per-building top-down sprites** — check
  `asset_manifest category='building-illustration'`.
- **Wax-seal tab header icons** — one reusable SVG seal shape + swap-in
  tab-specific glyphs from `Icons.tsx`. CSS + existing icons, no new assets.

Flag gaps here when T0c scoping begins.
