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

## Phase T0c (2026-04-18) — landed; map deferred

Campaign Sheet shipped with all signature elements
(wax-sealed tab headers, prosperity progress bar, donation milestone
pips, building cards with state chips, calendar strip) CSS/SVG-rendered,
no external assets required to ship.

**Resolved this batch:**
- **Wax-seal tab header icons** — `WaxSealHeader.tsx` accepts a generic
  `icon` VNode; each tab supplies its own inline SVG glyph (gears,
  scroll, chest, coin, shield, building, gear). No external assets.
- **Prosperity track row + checkmark visualisation** — pure CSS
  (gilt-gold pip + leather row).
- **Donation milestone pips** — pure CSS (radial-gradient gilt fill).
- **Campaign Sheet intro ("map unfurling")** — inline SVG parchment +
  rolled-end caps + wax seal animated via CSS keyframes.

**Pending requests (Outpost map — deferred to T4 / T0c-polish):**
- **Outpost top-down map background** — when the full top-down outpost
  map view is built (likely T4 or a T0c-polish follow-up), a base
  illustration of the Frosthaven outpost will be needed. Check
  Worldhaven `art/fh/town/` and `asset_manifest category='outpost'` first
  before commissioning.
- **Per-building top-down sprites** — keyed by building name. Check
  `asset_manifest category='building'` /
  `category='building-illustration'`. T0c's Outpost tab uses an inline
  SVG silhouette per building (per `app/CONVENTIONS.md`: explicit
  "no art yet" silhouette is acceptable; faked image is not).
- **Building damaged / wrecked overlays** — fracture / dust / soot
  decals layered onto the building sprites for damaged + wrecked states.
  T0c's CSS uses border + opacity changes only.
- **Edition logo art** for the Settings tab "Campaign Identity"
  section — currently rendered as text chip ("Gloomhaven", "Frosthaven").
  Optional polish.
