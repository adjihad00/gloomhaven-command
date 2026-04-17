# Phase T2a — Phone Town Items Tab (Claude Code Prompt)

## Context

You are working in the `gloomhaven-command` repo. Baseline commit for this batch
is **T1 landed** (Phase T1 — `feat(phase-t1): scenario end rewards…`). Run
`git pull` and confirm `state.finishData`, `setBattleGoalComplete`,
`claimTreasure`, and `dismissRewards` exist before starting. If T1 is not landed,
stop and say so.

Read before writing code:

1. `CLAUDE.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/APP_MODE_ARCHITECTURE.md`
4. `docs/DESIGN_DECISIONS.md`
5. `docs/COMMAND_PROTOCOL.md`
6. `docs/GAME_RULES_REFERENCE.md` — sections 10 (scenario setup — player
   count + item slot rules), 12 (leveling — item-slot implications of level),
   and the "Items & Gold" rules for purchase/sell mechanics.
7. `docs/GHS_AUDIT.md` — Item shop UI reference.
8. `app/CONVENTIONS.md`
9. The existing `app/phone/overlays/PhoneRewardsOverlay.tsx` and the T1 work
   as the established phone-overlay pattern.
10. `app/controller/overlays/CharacterSheetOverlay.tsx` — see the existing
    read-only ItemsTab (line 212) that this batch replaces with interactive
    management.

Design skills (read every `.md` file under each):

- `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
- `C:\Users\Kyle Diaz\.agents\skills\`

Priority: `app/CONVENTIONS.md` > UI/UX Pro Max > agent skills.

---

## Scope — This Batch Only

Phase T2 in the handoff covers Items + Perks + Level Up + Enhancements +
Personal Quest in one prompt. That is too large to ship playtest-ready in
a single batch, so T2 is being split by dependency order. **This prompt is
T2a: Items only.** T2b (Perks + Level Up), T2c (Personal Quest +
Retirement), T2d (Enhancements + FH crafting/brewing) follow.

In scope:

- Phone: tabbed `TownView` (scaffold for full character sheet) with the
  **Items tab** functional. Other tabs exist as visible-but-empty
  placeholders labeled "Coming soon" so the tab layout is testable now
  without half-built features claiming shelf space. (This is the one place
  the handoff's "no placeholder" rule bends — tabs are structural, and
  hiding them forces re-plumbing in T2b/c/d. Empty-tab bodies read
  "Available in next update"; this is distinct from a UI surface for a
  half-built feature.)
- Controller: extend the existing read-only ItemsTab in
  `CharacterSheetOverlay` to support equip/unequip/sell for the selected
  character during town mode. Shop browse stays on phone only — GM-initiated
  purchase isn't needed for playtest (the player taps their own shop).
- Engine commands: `purchaseItem`, `equipItem`, `unequipItem`, `sellItem`.
- Ref DB additions: `getItem`, `getItemsBySlot`, `getItemsByUnlockProsperity`.
- API endpoints: `/api/ref/item/:edition/:id`, `/api/ref/items/:edition?slot=…`,
  `/api/ref/items/:edition?prosperity=…` (extend existing endpoint with
  optional query params rather than adding parallel routes).

Out of scope (explicit):

- Perks / Level Up (T2b)
- Personal Quest / Retirement (T2c)
- Enhancements (T2d)
- FH crafting / brewing (T2d — depends on building state from T3)
- Shop inventory restrictions beyond prosperity + required-building
  (`required_building` column is read, but the corresponding building-state
  check is lightweight now; full building mechanics are T3)

---

## Goal + Deliverable

Any phone can shop, equip, unequip, and sell items during town mode for its
own character. Controller CharacterSheetOverlay shows real inventory with
equip/unequip/sell actions. Gold deducts on purchase, half-refund on sell
(integer floor per §items), inventory updates broadcast to all devices.
Prosperity and `required_building` gate shop availability. Reputation
affects price (per rules: +1/+2/+3 for high reputation, -1/-2/-3 for low).
Slot constraints enforced (one helmet, one body, two hands, etc.).

**Deliverable:** Full shop + inventory loop playable on a phone with the
controller as observer. Works in both GH and FH (FH just adds the
`required_building` visibility + prosperity gate; no crafting UI in this
batch).

---

## Data Shape Clarifications

These are not in the handoff and need to be internalized before writing
commands:

1. **`CharacterProgress.items: CharacterItemModel[]`** carries
   `{ name, edition, id? }` — not raw ids. Every command that manipulates
   items must resolve to this shape before pushing/splicing. The canonical
   lookup: `dataContext.getItem(edition, id) → { name, id, ... }`.

2. **`CharacterProgress.equippedItems: CharacterItemModel[]`** is a separate
   list. The convention is: an item lives in exactly one of `items` or
   `equippedItems` at any time — equip moves from `items` → `equippedItems`,
   unequip moves the other way. **Do not duplicate entries across both
   lists.**

3. **`Party.unlockedItems: CountIdentifier[]`** represents items the party
   has unlocked but not yet bought. Purchases do NOT remove from
   `unlockedItems` — that tracks eligibility, not stock. However, the `count`
   on each `CountIdentifier` represents maximum available stock of that item
   across the party (most items: 1 count; some common items: higher). Buying
   decrements availability tracked separately — see step 3 below for the
   simplest model (count party-wide occurrences in character inventories
   against `unlockedItems[i].count`).

4. **Reputation price modifier** (per GH/FH rules and
   `docs/GAME_RULES_REFERENCE.md`):
   - Reputation ≥ +19: −5g per item
   - ≥ +15: −4g
   - ≥ +11: −3g
   - ≥ +7: −2g
   - ≥ +3: −1g
   - Between −2 and +2: 0g
   - ≤ −3 through −6: +1g
   - ≤ −7 through −10: +2g
   - ≤ −11 through −14: +3g
   - ≤ −15 through −18: +4g
   - ≤ −19: +5g
   - Price floor is 0 (items never cost negative gold).

   Implement as a helper `getReputationPriceModifier(reputation)` in
   `packages/shared/src/data/` (new file `reputationPrice.ts`). Tests
   included.

5. **Item slot rules (enforced on equip):**
   - `head` (helmet) — 1 slot
   - `body` (chest) — 1 slot
   - `legs` (boots) — 1 slot
   - `hands` (one-handed + two-handed distinction) — 2 slots total; two-
     handed items fill both. Represented via `count` field on item? Check
     the items table — `items.count` relates to stack, not slot weight.
     Slot weight is encoded in item `slot` column as strings like
     `"one_hand"`, `"two_hand"`, etc.; audit existing data before writing
     validation.
   - `bag` — no hard slot cap (per rules, small items are uncapped in GH2E;
     in original GH, 2 small items per level/2 rounded up). For this batch,
     **enforce the original GH rule**: `Math.ceil(character.level / 2)`
     small items max. Log it conservatively.

   Build a helper `canEquipItem(character, item)` in
   `packages/shared/src/engine/itemRules.ts` (new file). Returns
   `{ ok: true } | { ok: false, reason: string }`. Called by
   `validateCommand` for `equipItem`. Reason strings surface to the UI as
   toast content.

6. **Sell price** = `Math.floor(cost / 2)` for purchasable items. FH
   craftable items (those with non-empty `resources_json`) sell for 2 gold
   per resource spent — but **this batch only sells back at half-gold**;
   craftables sell at default half-gold of their listed cost too. Full FH
   resource-refund on sell lands with T2d.

---

## Step 1 — Engine

### 1a. New types

Create `packages/shared/src/engine/itemRules.ts`:

```ts
import type { Character, CharacterItemModel } from '../types/gameState.js';
import type { DataContext } from './applyCommand.js';

export interface ItemEligibility {
  ok: boolean;
  reason?: string;
}

export function canEquipItem(
  character: Character,
  item: { id: number; slot: string | null; name: string },
  dataContext: DataContext | undefined,
): ItemEligibility { /* ... */ }

export function itemSellPrice(
  item: { cost: number | null; resources?: unknown },
): number { /* Math.floor((cost ?? 0) / 2) */ }

export function itemPurchasePrice(
  itemCost: number,
  reputation: number,
): number { /* base cost + reputation modifier, floored at 0 */ }
```

Wire tests for all three. Tests go in
`packages/shared/src/engine/__tests__/itemRules.test.ts` or the project's
existing test folder (check `package.json` scripts first).

### 1b. Commands

Append to `packages/shared/src/types/commands.ts`:

```ts
| 'purchaseItem'
| 'equipItem'
| 'unequipItem'
| 'sellItem'
```

```ts
export interface PurchaseItemCommand {
  action: 'purchaseItem';
  payload: {
    characterName: string;
    edition: string;
    itemId: number;
    itemEdition: string;
  };
}

export interface EquipItemCommand {
  action: 'equipItem';
  payload: {
    characterName: string;
    edition: string;
    itemId: number;
    itemEdition: string;
  };
}

export interface UnequipItemCommand {
  action: 'unequipItem';
  payload: {
    characterName: string;
    edition: string;
    itemId: number;
    itemEdition: string;
  };
}

export interface SellItemCommand {
  action: 'sellItem';
  payload: {
    characterName: string;
    edition: string;
    itemId: number;
    itemEdition: string;
    /** If true, sell from equipped list (auto-unequip); else from unequipped. */
    fromEquipped?: boolean;
  };
}
```

Add to the `Command` union.

### 1c. Handlers in `applyCommand.ts`

Each handler follows this contract:

- Resolve character: `state.characters.find(c => c.name === payload.characterName && c.edition === payload.edition)`. Return early (no-op) if missing — validation catches the actionable error cases.
- Look up item via `dataContext.getItem(itemEdition, itemId)`. If no dataContext, throw — items require ref DB.
- Apply:
  - **purchaseItem**: check gold ≥ price (validation handles reject); deduct gold; push `{ name, edition, id }` to `char.progress.items`; do NOT touch `unlockedItems`.
  - **equipItem**: call `canEquipItem` (validation handles reject); splice from `items`, push to `equippedItems`.
  - **unequipItem**: splice from `equippedItems`, push to `items`.
  - **sellItem**: compute refund; add to `char.progress.gold`; splice from the appropriate list.
- Validation:
  - All four require `state.mode === 'town'` (not scenario, not lobby).
  - All four require the character to exist.
  - `purchaseItem`: gold ≥ price; item in `party.unlockedItems`; prosperity ≥ `unlock_prosperity`; if `required_building` set, that building must be in `party.buildings` with status ≥ `required_building_level`. If FH building state not yet modeled (T3), tolerate absence as "OK" so a GH game can still purchase without tripping over an FH-only gate.
  - `equipItem`: item must be in `items` (not already equipped); `canEquipItem(character, item).ok === true`.
  - `unequipItem`: item must be in `equippedItems`.
  - `sellItem`: item must be in the specified list.

### 1d. `DataContext` extension

In `applyCommand.ts`:

```ts
getItem?(edition: string, itemId: number): {
  item_id: number;
  name: string | null;
  cost: number | null;
  slot: string | null;
  count: number | null;
  actions_json: string | null;
  resources_json: string | null;
  unlock_prosperity: number | null;
  required_building?: string | null;
  required_building_level?: number | null;
} | null;
```

### 1e. Phone permission whitelist (`server/src/wsHub.ts`)

Add all four to `PHONE_ALLOWED_ACTIONS`. All are character-scoped, so
`getCommandCharacterName` needs a case per new action returning
`payload.characterName`.

---

## Step 2 — Reference DB + API

### 2a. New ReferenceDb methods

In `server/src/referenceDb.ts`:

```ts
getItem(edition: string, itemId: number): {
  item_id: number;
  name: string | null;
  cost: number | null;
  slot: string | null;
  count: number | null;
  actions_json: string | null;
  resources_json: string | null;
  unlock_prosperity: number | null;
  required_building: string | null;
  required_building_level: number | null;
} | null { /* SELECT ... WHERE edition = ? AND item_id = ? */ }

getItemsBySlot(edition: string, slot: string): ItemRow[] { /* ... */ }

getItemsByUnlockProsperity(edition: string, prosperity: number): ItemRow[] {
  /* WHERE edition = ? AND (unlock_prosperity IS NULL OR unlock_prosperity <= ?) */
}
```

Define `ItemRow` as an exported type alongside the class so callers share it.

Audit `data/reference.db` schema at startup to confirm columns
`required_building` and `required_building_level` actually exist on
`items`. If they don't, extend `getItem`'s SELECT list carefully and flag it
— the handoff claims they're there, but **don't assume**; `.schema items`
against the live DB is the source of truth.

### 2b. DataManager + Context wiring

Add `getItem` method to `DataManager` delegating to `refDb.getItem`. Add the
new wiring to `commandHandler.ts` DataContext builder.

### 2c. API endpoints

In `server/src/index.ts`, extend the existing `/api/ref/items/:edition`
route to honor optional query params, and add a new single-item route:

```ts
app.get('/api/ref/items/:edition', (req, res) => {
  if (!refDb) { res.status(503).json({ error: 'Reference DB not available' }); return; }
  const slot = typeof req.query.slot === 'string' ? req.query.slot : undefined;
  const prosperity = typeof req.query.prosperity === 'string'
    ? Number.parseInt(req.query.prosperity, 10) : undefined;
  if (slot) return void res.json(refDb.getItemsBySlot(req.params.edition, slot));
  if (typeof prosperity === 'number' && Number.isFinite(prosperity))
    return void res.json(refDb.getItemsByUnlockProsperity(req.params.edition, prosperity));
  res.json(refDb.getItems(req.params.edition));
});

app.get('/api/ref/item/:edition/:id', (req, res) => {
  if (!refDb) { res.status(503).json({ error: 'Reference DB not available' }); return; }
  const id = Number.parseInt(req.params.id, 10);
  const item = Number.isFinite(id) ? refDb.getItem(req.params.edition, id) : null;
  item ? res.json(item) : res.status(404).json({ error: 'Item not found' });
});
```

---

## Step 3 — Hooks

Create `app/hooks/useItemsApi.ts`:

```ts
import { useState, useEffect } from 'preact/hooks';

interface ItemData { /* match server ItemRow */ }

export function useItems(edition: string, opts?: { slot?: string; prosperity?: number }) {
  /* GET /api/ref/items/:edition with query params, return { items, loading, error } */
}

export function useItem(edition: string, itemId: number | null) {
  /* GET /api/ref/item/:edition/:id */
}
```

Both use fetch + `AbortController` on cleanup. Match the style of
`useScenarioBookData.ts`.

Extend `app/hooks/useCommands.ts` with wrappers for all four commands.

---

## Step 4 — Phone Town View Scaffold

Replace `app/phone/TownView.tsx` with a tabbed layout. **Structure only.**
Body of non-Items tabs is a single paragraph: "Available in next update".

Tabs: **Items** | Perks | Level Up | Enhancements | Quest. Active tab
indicator is a gold underline (edition-themed via existing CSS vars). Tab
list is a horizontally scrollable row at the top — iPhones can have tight
widths, so the design must reflow gracefully.

Top banner (above tabs): character portrait thumb, title, gold pill with
coin icon (reuse `GoldIcon` from `app/components/Icons.tsx`), career XP
pill with XPIcon, career level pill.

Disconnect menu stays accessible (reuse existing pattern from the
placeholder TownView — portrait tap opens the menu).

### 4a. Items tab sub-structure

Three sub-sections stacked vertically with collapsible headers:

1. **Equipped** — list of equipped items grouped by slot (Head / Body /
   Hands / Legs / Bag). Each row: item image (asset manifest lookup),
   name, slot label, an "Unequip" action. Empty slots show a subtle
   outlined placeholder. Large tap targets (≥44px tall).

2. **Inventory** — unequipped owned items. Each row: image, name, slot
   label, "Equip" action (disabled + reason shown if `canEquipItem`
   returns `ok: false`), "Sell" action with confirm-to-claim (tap once for
   price preview, tap again to confirm — mirror the existing two-tap
   exhaust pattern from `PhoneExhaustPopup`).

3. **Shop** — items unlocked to the party that this character hasn't
   already owned. Filter client-side from `party.unlockedItems` minus the
   character's own `items`+`equippedItems`. Fetch full item data via
   `useItem` per id (batched if reasonable; otherwise per row). Each row:
   image, name, slot, base cost, modified cost (with reputation applied),
   "Buy" action. Buy action requires gold ≥ modified cost (disabled
   otherwise with "Need N more gold" helper text).

Sort within each section by slot order then name.

Show prosperity-locked items in a **dimmed tail** at the bottom of Shop
labeled "Locked — requires prosperity N+" so players can see what's
coming. Dimmed items are non-interactive.

### 4b. Asset resolution

Use the existing asset manifest for item images. Grep for
`itemAssetUrl` / `characterThumbnail` / `assets.ts` to find the established
pattern. If no item-specific helper exists, add one to `app/shared/assets.ts`
that resolves from `/api/ref/asset/:edition/item/:name` or whatever the
manifest uses. **Follow `app/CONVENTIONS.md`: GHS assets only, no fallbacks;
a broken image is a real bug, not a cosmetic glitch.**

### 4c. Styling

All CSS goes in `app/phone/styles/phone.css`, BEM prefix `phone-town-*`.
Reuse theme tokens from `app/shared/styles/theme.css`. Design language
matches the rewards overlay:

- Aged parchment background, inset shadow on cards.
- Copper/gold accents for action buttons; red for destructive (Sell
  second-tap), subtle green halo on successful transitions.
- Candlelight glow on the active tab label.

Refer to UI/UX Pro Max skill for the information hierarchy inside a
shopping / inventory screen. Read the skill's `.md` files before starting
the CSS pass.

---

## Step 5 — Controller: upgrade `CharacterSheetOverlay`'s ItemsTab

The existing `ItemsTab` at line 212 is read-only and admits "Item management
available in Town mode". When `state.mode === 'town'`:

- Show interactive equip / unequip / sell actions on each row.
- Group by equipped/unequipped with the same slot headers used on phone.
- Shop browse is **not added here** — GM uses the phone (or the physical
  rulebook) to guide purchases during playtest. Controller doesn't need
  shopping UI in this batch. (This is a deliberate scope cut — controller
  shopping adds no playtest value over phone shopping.)

Reuse command wrappers from `useCommands.ts`.

---

## Step 6 — Guard rails

1. All four commands must reject (validation) when `state.mode !== 'town'`.
   Scenario-mode item changes are a future concern (consumables during
   play), not part of T2a.
2. Controller ScenarioView never opens CharacterSheetOverlay during scenario
   mode with interactive item buttons — they appear only in town mode.
3. If a purchase would exceed party-wide `unlockedItems[i].count`, reject
   with a clear reason. Count the item's id across every character's
   `items` + `equippedItems`.

---

## Verification Checklist

### Engine

- [ ] Purchase an item: gold deducts by modified price, item appears in
      `char.progress.items`.
- [ ] Reputation +15 = price −4g (verify with a 15g item: 11g paid,
      floor-at-0 never triggers).
- [ ] Reputation −20 = price +5g (verify with a 3g item: 8g paid).
- [ ] Reputation −200 (extreme): price still capped at sane range (verify
      `getReputationPriceModifier` clamps at +5g).
- [ ] Gold floor at 0: item cost 2g with rep +19 modifier −5g → 0g (not
      negative).
- [ ] Insufficient gold → command rejected.
- [ ] Attempt to purchase item not in `party.unlockedItems` → rejected.
- [ ] Attempt to purchase prosperity-locked item → rejected.
- [ ] Attempt to exceed item count (e.g. same 1-count item by two
      characters) → second purchase rejected.
- [ ] Equip to filled slot (head item + head item) → second equip rejected.
- [ ] Equip two-handed weapon while one-handed equipped → rejected.
- [ ] Unequip then equip different item in same slot → works.
- [ ] Sell at half price, fromEquipped=true auto-removes from equipped.
- [ ] Scenario mode: all four commands rejected with clear message.

### Ref DB + API

- [ ] `GET /api/ref/item/gh/2` returns Boots of Striding (or whatever item 2
      is for GH) with all expected fields.
- [ ] `GET /api/ref/items/gh?slot=head` returns only head items.
- [ ] `GET /api/ref/items/gh?prosperity=3` returns items with
      `unlock_prosperity ≤ 3` (including null unlock values).
- [ ] Missing item → 404.
- [ ] FH item `required_building` field returned correctly.

### Phone

- [ ] Two phones connect. A plays Brute, B plays Scoundrel. Both enter
      town mode.
- [ ] Brute phone, Items tab: sees own equipped + inventory + shop. Does
      NOT see Scoundrel's items.
- [ ] Tap Buy on an item the Brute can afford → gold decrements on both
      phones (state sync) and item appears in Brute's Inventory section.
- [ ] Scoundrel phone sees Brute's gold change (via party state) but no
      item list change on Scoundrel's own tab.
- [ ] Tap Equip on Brute's new item → moves to Equipped group.
- [ ] Tap Sell (two-tap confirm) → item removed, gold credited.
- [ ] Prosperity-locked items display dimmed in Shop with correct lock
      label.
- [ ] Insufficient gold shows helper text, button disabled.
- [ ] Slot violation (trying to equip 2 head items) → surfaces the
      canEquipItem reason as a toast/inline message.
- [ ] Tabs are scrollable on a narrow phone (375px wide). Empty tabs
      ("Perks", "Level Up", etc.) show placeholder.
- [ ] Disconnect menu still reachable via portrait tap.

### Controller

- [ ] Open CharacterSheetOverlay in town mode → ItemsTab has interactive
      equip/unequip/sell buttons.
- [ ] Actions fire commands and all devices sync.
- [ ] CharacterSheetOverlay during scenario mode stays read-only.

### FH-specific

- [ ] Shop respects `required_building` — if Brute tries to buy a
      building-gated item with the required building absent, rejected.
      (If building state is fully absent from party state, tolerate and
      allow — T3 adds buildings.)
- [ ] Party-wide `unlockedItems` count respected in FH as well.

### GH-specific

- [ ] GH game never references FH-only fields (no resource refunds, no
      building gating).

### Regressions

- [ ] T1 rewards overlay still fires correctly on scenario end; finishData
      still clears on `completeTownPhase`.
- [ ] Scenario play untouched — round flow, AMD draws, loot cards all fine.
- [ ] `npm run build` succeeds.
- [ ] `tsc --noEmit` clean everywhere.
- [ ] Phone CSS doesn't regress scenario-mode layout.

---

## Documentation Updates (mandatory)

- **`docs/BUGFIX_LOG.md`** — any regressions found + fixed.
- **`docs/DESIGN_DECISIONS.md`** — new entry:
  *"T2a: Phase T2 split into 4 sub-prompts (T2a Items, T2b Perks/Level Up,
  T2c Personal Quest, T2d Enhancements/crafting) to respect the handoff's
  playtest-ready-per-batch principle. Items first because it's the
  highest-interaction surface and has the cleanest independence from
  other progression features. Reputation price modifier centralized in
  `packages/shared/src/data/reputationPrice.ts`. Item slot eligibility
  centralized in `packages/shared/src/engine/itemRules.ts`."*
- **`docs/ROADMAP.md`** — add explicit T2a/b/c/d subdivision under Phase T;
  mark T2a complete.
- **`docs/PROJECT_CONTEXT.md`** — add 4 new commands to Commands Quick
  Reference; add 2 new API endpoint forms.
- **`docs/APP_MODE_ARCHITECTURE.md`** — update the Phone "Character Sheet —
  tabbed" table to reflect what's actually built (Items: done; others:
  next).
- **`docs/COMMAND_PROTOCOL.md`** — document all four commands.

---

## Commit Message

```
feat(phase-t2a): town items tab — shop / equip / unequip / sell

Phone TownView rebuilt as a tabbed character sheet. Items tab functional
end-to-end: shop (gated by prosperity + required building + unlocked-items
count), inventory (equip/unequip with slot-rule validation), sell (half
gold refund, optional auto-unequip). Controller CharacterSheetOverlay
ItemsTab upgraded from read-only to interactive during town mode.

Engine:
- purchaseItem, equipItem, unequipItem, sellItem commands with validation
- itemRules.ts: canEquipItem (slot rules, small-item cap by level)
- reputationPrice.ts: GH/FH reputation price modifier (-5g to +5g)

Server:
- ReferenceDb.getItem / getItemsBySlot / getItemsByUnlockProsperity
- /api/ref/item/:edition/:id; /api/ref/items/:edition with ?slot / ?prosperity
- DataContext + phone permission whitelist updated

Phone:
- TownView scaffolded as tabs (Items, Perks, Level Up, Enhancements, Quest)
- Items tab: collapsible Equipped / Inventory / Shop sections
- Reputation-adjusted pricing, prosperity locks, confirm-to-sell pattern
- Asset-manifest item images, character portrait banner, gold/XP pills

Controller:
- CharacterSheetOverlay ItemsTab: equip/unequip/sell actions in town mode

Other tabs scaffolded with "Available in next update" placeholder — T2b
(Perks + Level Up) ships next.

Docs updated per CLAUDE.md §"Documentation Currency".

Baseline: T1 commit. Part of Phase T (Town Mode & Campaign Layer).
```

---

## Notes to Claude Code

- Produce a Plan first and wait for confirmation before writing code.
- Audit `.schema items` against the live reference DB before writing
  `getItem` — do not assume columns exist.
- Grep before guessing barrel exports. `packages/shared/src/index.ts`
  needs to export any new types consumed by clients.
- Tests for `reputationPrice` and `itemRules` are required — this is
  settled game math; we shouldn't be relitigating it every playtest.
- Do NOT modify `data/reference.db` or `scripts/import-data.ts`.
- Do NOT invent enhancement, crafting, or personal-quest functionality —
  that's explicitly other batches.
- If `required_building` / `required_building_level` aren't in the schema,
  stop and ask before extending imports.
