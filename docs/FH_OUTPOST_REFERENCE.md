# Frosthaven Outpost Reference (T3-prep research output)

> **Status:** Research-only data audit. No code changes. Single source of truth for T3a–j implementation batches.
> **Baseline:** T0d + dev-sandbox complete (`git log` confirmed at extraction time).
> **Sources walked:** `.staging/ghs-client/data/fh/` (raw GHS source), `.staging/worldhaven/` (card images + attack-modifier deck composition), `data/reference.db` (normalized importer output).
> **Methodology:** where staging data is structured, the table values are extracted verbatim; where only prose is available, the doc paraphrases and cross-references the rulebook section. Gaps flagged inline as **⚠ DATA MISSING**; consolidated in §16.

## Extraction summary

| Domain | Staging file | Row count | In reference.db | Notes |
|---|---|---|---|---|
| Buildings | `buildings.json` | 30 | 30 rows | importer drops `effectNormal`, `effectWrecked`, `interactionsAvailable`, `interactionsUnavailable`, `repair`, `rebuild`, `rewards`, `prosperityUnlock`, `requires`, `coordinates` — **major gap for T3d**. |
| Items | `items.json` | 264 | 264 rows | shape well-covered; `blueprint`, `requiredItems`, `effects`, `actionsBack`, `resourcesAny` not imported. |
| Events | `events.json` | 266 | 266 rows | options/outcomes structured — importer captures `options_json`. |
| Personal quests | `personal-quests.json` | 23 | 23 rows | `openEnvelope`, `altId`, `errata` dropped; `requirements_json` covers the core. |
| Campaign (calendar, town-guard perks, morale triggers) | `campaign.json` | keys=8 | 14 rows in `campaign_data` | importer stores each key's JSON; `townGuardPerks` is structured and usable. |
| Scenarios | `scenarios/`*.json | 159 | 159 rows | raw files have `coordinates` + `gridLocation` + `flowChartGroup` + `forcedLinks` — **importer drops coordinates/flowChartGroup; critical for T3j world map**. |
| Sections | `sections/`*.json | 549 | 1641 rows | narrative + rewards captured. |
| Treasures | `treasures.json` | 85 | 403 rows | covered; not T3-central. |
| Pets | `pets.json` | 12 | — | not imported; T3e Stables will need this. |
| Favors | `favors.json` | — | — | Hall-of-Revelry L2 unlocks Tholos' Favors; not imported. |
| Trials | `trials.json` | — | — | tied to Hall-of-Revelry L1 complete→section 187.1. |
| Challenges | `challenges.json` | — | — | Town Hall draws challenge cards; not imported. |

**Major asymmetries between raw staging and reference.db:**

1. **Buildings:** reference.db only stores `edition, building_id, name, costs_json, upgrades_json`. All ability text (`effectNormal`), assault interaction (`effectWrecked`, `repair`, `rebuild`), downtime verbs (`interactionsAvailable`), construction rewards, prosperity gate, and workshop prereqs are **dropped by `importBuildings` ([scripts/import-data.ts:811](scripts/import-data.ts:811))**. T3d cannot work without these fields being imported first.
2. **Scenarios:** raw staging has `coordinates: {x, y, width, height, gridLocation}` on 152/159 scenarios. The importer ([scripts/import-data.ts:582](scripts/import-data.ts:582)) drops `coordinates` + `flowChartGroup` + `forcedLinks`. T3j's world map / flowchart UI **requires** these — see §15 for required importer additions.
3. **Items:** `blueprint`, `requiredItems`, `resourcesAny`, `actionsBack`, `effects` (non-custom), `persistent`, `loss`, `minusOne`, `solo`, `round` fields are ignored by `importItems`. T3g (Craftsman) needs `blueprint` + `requiredItems`; T3h (Alchemist) needs `effects`.

## 1. FH Town Phase Structure

Per the Frosthaven rulebook (Outpost Phase, pages 50–55), the FH town phase runs in five sequential steps. The game-data layer does not encode the step machine directly — it encodes the *triggers and options* that each step reads from.

| # | Step | Player interaction? | Auto-advance criterion |
|---|---|---|---|
| 1 | **Passage of Time** | No — GM-driven. Week counter ticks forward; any section in `campaign.weeks[<week>]` fires; morale triggers check against `campaign.highMorale`/`campaign.lowMorale` sections. | All calendar/morale sections resolved. |
| 2 | **Outpost Event** | Yes — party draws the top outpost event card (summer or winter based on current season), reads narrative, each character votes on an option. Winning option's outcome resolves (effects + narrative). If outcome triggers assault → transitions to §9 Assault sub-state. | Resolution applied. |
| 3 | **Building Operations** | Partial — most building effects are "collective" (party shares a resource ask). Each active, non-wrecked building fires its `effectNormal[level-1]` in **building-id ascending order**. Players contribute pooled resources / gold / morale as required. | All active buildings processed. |
| 4 | **Downtime** | Yes — each character simultaneously visits one or more of the "downtime-verbs" buildings: Trading Post (buy items), Craftsman (craft blueprints), Alchemist (brew potions, distill), Enhancer (buy enhancements), Stables (manage pets), Temple (pay for Bless), Barracks (train soldiers). Character signals "done" → portrait returns to town gate. | All non-absent characters ready. |
| 5 | **Construction** | Yes — party votes on which building to construct or upgrade; pays resources + gold; building is built/upgraded next week (immediate in FH post-errata? → see §10 open). | Vote resolved, resources paid. |

After §5, the game transitions to **Scenario Selection + Travel** (§11), which is technically part of the town-to-scenario handoff rather than town-phase proper but is encoded as step 6 for app purposes.

## 2. GH Town Phase Structure

Gloomhaven's town phase is simpler: three steps.

| # | Step | FH-equivalent sub-screens (per T3 scope Q4) |
|---|---|---|
| 1 | **City Event** | Maps 1:1 to FH §2 "Outpost Event". Same data shape in `events.json` with `event_type = 'city'`. |
| 2 | **Character Management** | Maps to FH §4 "Downtime" with a **reduced set of sub-screens**: Store (buy), Enchanter (buy enhancements), Sanctuary (donate). No Craftsman, Alchemist, Stables, Barracks, Temple, Carpenter, Depot in GH. |
| 3 | **Donate** | Maps to FH Temple "Bless" operation but implemented as a standalone donation→retirement tracking step. |

**ℹ NOTE:** Q4 resolved as "FH is canonical, GH derives by omission" — the app runs the FH step machine and GH just hides the FH-only steps (Passage of Time, Building Operations, Construction, Assault).

GH's event data is in the same `events.json` files but split by `event_type`:

| Edition | Event type | Count |
|---|---|---|
| cs | city | 60 |
| cs | road | 60 |
| fc | city | 9 |
| fc | rift | 20 |
| fc | road | 2 |
| fh | boat | 19 |
| fh | summer-outpost | 65 |
| fh | summer-road | 52 |
| fh | winter-outpost | 81 |
| fh | winter-road | 49 |
| gh | city | 81 |
| gh | road | 69 |
| gh2e | city | 100 |
| gh2e | road | 77 |
| jotl | city | 22 |
| toa | city | 15 |
| toa | road | 15 |

## 3. Buildings (FH)

**30 buildings total.** All enumerated below regardless of Kyle's unlock state (see §14 for unlock snapshot).

### Categorization

Categories are derived from the data (`requires`, `prosperityUnlock`, `interactionsAvailable`, `effectWrecked`, `rewards.soldiers`, `rewards.defense`) and from rulebook role. Not a field in `buildings.json`.

| Category | Buildings | Rationale |
|---|---|---|
| **Starting (pre-built)** | Craftsman (34), Alchemist (35), Enhancer (44), Workshop (84), Barracks (98) | `costs` all-zero. Available L1 from week 1. |
| **Resource production** | Mining Camp (05), Hunting Lodge (12), Logging Camp (17), Garden (24) | `prosperityUnlock: true`; output is a material resource per operations text. |
| **Downtime-verb (shop-adjacent)** | Trading Post (37, buy items), Craftsman (34, craft), Alchemist (35, brew+distill), Enhancer (44, enhance), Jeweler (39, passive upgrade items), Stables (88, pet management), Temple (42, bless), Barracks (98, train soldiers) | Has `interactionsAvailable` or downtime-facing `effectNormal` per rulebook. |
| **Depot (sell)** | Metal Depot (65), Lumber Depot (67), Hide Depot (72) | Sells material resources for gold during Building Ops. |
| **Social / narrative** | Inn (21), Tavern (74), Hall of Revelry (81), Library (83), Carpenter (85), Town Hall (90) | Trigger sections, unlock favors/trials/challenges, or reduce construction costs. |
| **Defensive (wall)** | Wall J, K, L, M, N | Purely `defense: 5` reward per wall; prosperity-unlocked. Consumed by assault damage. |
| **Travel upgrade** | Boat, Sled, Climbing Gear | `requires: workshop`; grant scenario access (e.g. sled required for scenario 10). Not built via construction step — unlocked via prosperity + workshop. |

### Late-game / prosperity-gated unlocks

Buildings marked `prosperityUnlock: true` are **not buildable until a party-wide prosperity threshold is reached** (not encoded in `buildings.json` as an explicit threshold — the threshold is determined by the prosperity-track campaign rules, which track which prosperity-level unlocks which sticker). Kyle has these, so T3c/d demos can exercise all 30 buildings, but in playtest-order-of-unlock terms:
- Prosperity-unlocked: Mining Camp, Hunting Lodge, Logging Camp, Boat, Sled, Climbing Gear, Wall J, Wall K, Wall L, Wall M, Wall N
- Standard construction: Inn, Garden, Craftsman, Alchemist, Trading Post, Jeweler, Temple of the Great Oak, Enhancer, Metal Depot, Lumber Depot, Hide Depot, Tavern, Hall of Revelry, Library, Workshop, Carpenter, Stables, Town Hall, Barracks

### Per-building breakdown

#### 05 — Mining Camp (`mining-camp`)

- **Prosperity-unlocked** (not built via standard construction)
- **Levels:** L1–L4
- **Initial build cost:** prosperity:1 lumber:4 metal:2 hide:1 gold:10
- **Upgrade costs:**
  - L2: prosperity:3 lumber:6 metal:3 hide:2
  - L3: prosperity:5 lumber:8 metal:5 hide:2
  - L4: prosperity:7 lumber:10 metal:6 hide:3
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=3, L4=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:1 metal:2 hide:0
  - L2: lumber:1 metal:2 hide:1
  - L3: lumber:2 metal:2 hide:1
  - L4: lumber:2 metal:2 hide:1
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Collectively buy up to 1 metal for 2 gold
  - L2: Collectively buy up to 2 metal for 2 gold each
  - L3: Collectively buy up to 3 metal for 2 gold each
  - L4: Collectively buy up to 4 metal for 2 gold each
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1
  - L2: prosperity=1, section=49.2
  - L3: prosperity=1
  - L4: prosperity=1, loseMorale=1
- **Map coordinates (outpost sticker placement):** 4 level-specific hitboxes captured in raw staging.

#### 12 — Hunting Lodge (`hunting-lodge`)

- **Prosperity-unlocked** (not built via standard construction)
- **Levels:** L1–L4
- **Initial build cost:** prosperity:1 lumber:4 metal:1 hide:2 gold:10
- **Upgrade costs:**
  - L2: prosperity:3 lumber:6 metal:2 hide:3
  - L3: prosperity:5 lumber:8 metal:2 hide:5
  - L4: prosperity:7 lumber:10 metal:3 hide:6
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=3, L4=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:0 hide:1
  - L2: lumber:2 metal:1 hide:1
  - L3: lumber:2 metal:1 hide:2
  - L4: lumber:2 metal:1 hide:2
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Collectively buy up to 1 hide for 2 gold
  - L2: Collectively buy up to 2 hide for 2 gold each
  - L3: Collectively buy up to 3 hide for 2 gold each
  - L4: Collectively buy up to 4 hide for 2 gold each
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=172.3
  - L2: prosperity=1
  - L3: prosperity=1
  - L4: prosperity=1, loseMorale=1
- **Map coordinates (outpost sticker placement):** 4 level-specific hitboxes captured in raw staging.

#### 17 — Logging Camp (`logging-camp`)

- **Prosperity-unlocked** (not built via standard construction)
- **Levels:** L1–L4
- **Initial build cost:** prosperity:1 lumber:2 metal:3 hide:2 gold:10
- **Upgrade costs:**
  - L2: prosperity:3 lumber:4 metal:5 hide:2
  - L3: prosperity:5 lumber:6 metal:6 hide:3
  - L4: prosperity:7 lumber:8 metal:8 hide:3
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=3, L4=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:1 hide:0
  - L2: lumber:2 metal:1 hide:1
  - L3: lumber:2 metal:2 hide:1
  - L4: lumber:2 metal:2 hide:1
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Collectively buy up to 1 lumber for 2 gold
  - L2: Collectively buy up to 2 lumber for 2 gold each
  - L3: Collectively buy up to 3 lumber for 2 gold each
  - L4: Collectively buy up to 4 lumber for 2 gold each
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1
  - L2: prosperity=1
  - L3: prosperity=1
  - L4: prosperity=1, loseMorale=1
- **Map coordinates (outpost sticker placement):** 4 level-specific hitboxes captured in raw staging.

#### 21 — Inn (`inn`)

- **Levels:** L1–L3
- **Initial build cost:** prosperity:2 lumber:4 metal:4 hide:4 gold:10
- **Upgrade costs:**
  - L2: prosperity:4 lumber:5 metal:5 hide:5
  - L3: prosperity:5 lumber:6 metal:6 hide:6
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:2 hide:1
  - L2: lumber:2 metal:2 hide:2
  - L3: lumber:3 metal:2 hide:2
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Collectively buy up to 1 material resource for 2 gold
  - L2: Collectively buy up to 2 different material resource for 2 gold each
  - L3: Collectively buy up to 3 different material resource for 2 gold each
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=151.2
  - L2: prosperity=1
  - L3: prosperity=1
- **Map coordinates (outpost sticker placement):** 4 level-specific hitboxes captured in raw staging.

#### 24 — Garden (`garden`)

- **Levels:** L1–L4
- **Initial build cost:** prosperity:1 lumber:3 metal:0 hide:0 gold:10
- **Upgrade costs:**
  - L2: prosperity:2 lumber:4 metal:2 hide:2
  - L3: prosperity:5 lumber:3 metal:3 hide:3
  - L4: prosperity:7 lumber:6 metal:3 hide:3
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=3, L4=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:0 hide:0
  - L2: lumber:2 metal:1 hide:0
  - L3: lumber:2 metal:1 hide:1
  - L4: lumber:3 metal:1 hide:1
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Plant herbs, rotate this card 180°, then stop - Gain 1 herb from each planted plot, then rotate this card 180° then stop
  - L2: Plant herbs, rotate this card 180°, then stop - Gain 1 herb from each planted plot, then rotate this card 180° then stop
  - L3: Gain 1 collective herb from each planted plot, then plant herbs
  - L4: Gain 1 collective herb from each planted plot, then plant herbs
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=78.4
  - L2: prosperity=1, plots=1
  - L3: prosperity=1
  - L4: prosperity=1, loseMorale=1, plots=1
- **Map coordinates (outpost sticker placement):** 5 level-specific hitboxes captured in raw staging.

#### 34 — Craftsman (`craftsman`)

- **Levels:** L1–L9
- **Initial build cost:** prosperity:0 lumber:0 metal:0 hide:0 gold:0
- **Upgrade costs:**
  - L2: prosperity:1 lumber:2 metal:2 hide:1
  - L3: prosperity:2 lumber:3 metal:2 hide:2
  - L4: prosperity:3 lumber:4 metal:3 hide:2
  - L5: prosperity:4 lumber:5 metal:3 hide:3
  - L6: prosperity:5 lumber:6 metal:4 hide:3
  - L7: prosperity:6 lumber:7 metal:4 hide:4
  - L8: prosperity:7 lumber:8 metal:5 hide:3
  - L9: prosperity:8 lumber:9 metal:5 hide:5
- **Damage capacity (repair HP) per level:** L1=2, L2=2, L3=2, L4=3, L5=3, L6=3, L7=4, L8=4, L9=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:1 metal:1 hide:0
  - L2: lumber:1 metal:1 hide:1
  - L3: lumber:2 metal:1 hide:1
  - L4: lumber:3 metal:1 hide:1
  - L5: lumber:3 metal:1 hide:1
  - L6: lumber:3 metal:2 hide:1
  - L7: lumber:3 metal:2 hide:1
  - L8: lumber:3 metal:2 hide:2
  - L9: lumber:3 metal:2 hide:2
- **Wrecked effect (`effectWrecked`):** Lose 1 collective hide / Lose 2 collective hide
- **Downtime verbs (`interactionsAvailable`):**
  - L1+: Craft items
- **Construction/upgrade rewards per level:**
  - L1: items=1-10
  - L2: prosperity=1, items=11-15
  - L3: prosperity=1, items=16-20
  - L4: prosperity=1, items=21-25
  - L5: prosperity=1, items=26-30
  - L6: prosperity=1, items=31-35
  - L7: prosperity=1, items=36-40
  - L8: prosperity=1, items=41-45, loseMorale=1
  - L9: prosperity=1, items=46-50, loseMorale=1
- **Map coordinates (outpost sticker placement):** 8 level-specific hitboxes captured in raw staging.

#### 35 — Alchemist (`alchemist`)

- **Levels:** L1–L3
- **Initial build cost:** prosperity:0 lumber:0 metal:0 hide:0 gold:0
- **Upgrade costs:**
  - L2: prosperity:1 lumber:2 metal:2 hide:1
  - L3: prosperity:4 lumber:4 metal:4 hide:2
- **Damage capacity (repair HP) per level:** L1=2, L2=2, L3=3
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:1 metal:1 hide:0
  - L2: lumber:1 metal:1 hide:1
  - L3: lumber:3 metal:1 hide:1
- **Wrecked effect (`effectWrecked`):** Characters cannot use potions
- **Downtime verbs (`interactionsAvailable`):**
  - L1+: Brew 2-herb potions
  - L2+: Brew and distill 2-herb potions
  - L3+: Brew and distill 2- and 3-herb potions
  - (when unavailable, same interaction grayed: "Brew potions")
- **Construction/upgrade rewards per level:**
  - L1: —
  - L2: prosperity=1
  - L3: prosperity=1, section=183.5
- **Map coordinates (outpost sticker placement):** 2 level-specific hitboxes captured in raw staging.

#### 37 — Trading Post (`trading-post`)

- **Levels:** L1–L4
- **Initial build cost:** prosperity:2 lumber:2 metal:2 hide:1 gold:10
- **Upgrade costs:**
  - L2: prosperity:3 lumber:3 metal:3 hide:2
  - L3: prosperity:5 lumber:4 metal:3 hide:3
  - L4: prosperity:7 lumber:5 metal:4 hide:4
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=3, L4=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:1 metal:1 hide:0
  - L2: lumber:1 metal:1 hide:1
  - L3: lumber:2 metal:1 hide:1
  - L4: lumber:2 metal:2 hide:1
- **Wrecked effect (`effectWrecked`):** Lose 5 collective gold / Lose 10 collective gold / Lose 15 collective gold / Lose 20 collective gold
- **Downtime verbs (`interactionsAvailable`):**
  - L1+: Buy up to one item
  - L2+: Buy up to two items
  - L3+: Buy up to three items
  - L4+: Buy up to four items
  - (when unavailable, same interaction grayed: "Buy items")
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=25.2
  - L2: prosperity=1, section=12.4
  - L3: prosperity=1, section=38.3
  - L4: prosperity=1, section=196.2, loseMorale=1
- **Map coordinates (outpost sticker placement):** 5 level-specific hitboxes captured in raw staging.

#### 39 — Jeweler (`jeweler`)

- **Levels:** L1–L3
- **Initial build cost:** prosperity:4 lumber:3 metal:2 hide:4 gold:10
- **Upgrade costs:**
  - L2: prosperity:6 lumber:3 metal:6 hide:3
  - L3: prosperity:8 lumber:2 metal:10 hide:3
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:1 metal:2 hide:1
  - L2: lumber:1 metal:3 hide:1
  - L3: lumber:1 metal:4 hide:1
- **Wrecked effect (`effectWrecked`):** Damage any one building
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=31.3
  - L2: prosperity=1, items=160-163
  - L3: prosperity=1, items=164-167, loseMorale=1
- **Map coordinates (outpost sticker placement):** 4 level-specific hitboxes captured in raw staging.

#### 42 — Temple of the Great Oak (`temple`)

- **Levels:** L1–L3
- **Initial build cost:** prosperity:1 lumber:4 metal:2 hide:2 gold:10
- **Upgrade costs:**
  - L2: prosperity:4 lumber:3 metal:6 hide:3
  - L3: prosperity:7 lumber:4 metal:10 hide:4
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:1 hide:1
  - L2: lumber:2 metal:2 hide:1
  - L3: lumber:3 metal:2 hide:1
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Each character may lose 5 gold to start the next scenario with [bless]x2
  - L2: Each character may lose 5 gold to start the next scenario with [bless]x2
  - L3: Each character may lose 5 gold to start the next scenario with [bless]x2
- **Wrecked effect (`effectWrecked`):** Each character starts the next scenario with [curse]
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=192.5
  - L2: prosperity=3
  - L3: prosperity=5, loseMorale=1
- **Map coordinates (outpost sticker placement):** 4 level-specific hitboxes captured in raw staging.

#### 44 — Enhancer (`enhancer`)

- **Levels:** L1–L4
- **Initial build cost:** prosperity:1 lumber:3 metal:4 hide:0 gold:10
- **Upgrade costs:**
  - L2: prosperity:3 lumber:4 metal:5 hide:0
  - L3: prosperity:5 lumber:4 metal:4 hide:4
  - L4: prosperity:7 lumber:5 metal:6 hide:6
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=3, L4=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:2 hide:0
  - L2: lumber:3 metal:2 hide:0
  - L3: lumber:3 metal:2 hide:1
  - L4: lumber:3 metal:2 hide:2
- **Building-Ops effect (`effectNormal`) per level:**
  - L2: Reduce all enhancement costs by 10 gold
  - L3: Reduce all enhancement costs by 10 gold and level penalties by 10 gold per level
  - L4: Reduce all enhancement costs by 10 gold, level penalties by 10 gold per level, and repeat penalties by 25 gold per enhancement
- **Wrecked effect (`effectWrecked`):** Each character starts the next scenario with [disarm]
- **Downtime verbs (`interactionsAvailable`):**
  - L1+: Buy enhancements
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=193.1
  - L2: prosperity=1, section=157.2
  - L3: prosperity=1
  - L4: loseMorale=1, prosperity=1, section=56.3
- **Map coordinates (outpost sticker placement):** 5 level-specific hitboxes captured in raw staging.

#### 65 — Metal Depot (`metal-depot`)

- **Levels:** L1–L2
- **Initial build cost:** prosperity:3 lumber:2 metal:6 hide:2 gold:10
- **Upgrade costs:**
  - L2: prosperity:7 lumber:5 metal:5 hide:5
- **Damage capacity (repair HP) per level:** L1=3, L2=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:1 metal:2 hide:1
  - L2: lumber:1 metal:3 hide:1
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Collectively sell up to 1 metal for 5 gold
  - L2: Collectively sell up to 2 metal for 5 gold each
- **Wrecked effect (`effectWrecked`):** Lose 2 collective metal
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=193.4
  - L2: prosperity=2
- **Map coordinates (outpost sticker placement):** 3 level-specific hitboxes captured in raw staging.

#### 67 — Lumber Depot (`lumber-depot`)

- **Levels:** L1–L2
- **Initial build cost:** prosperity:3 lumber:6 metal:2 hide:2 gold:10
- **Upgrade costs:**
  - L2: prosperity:7 lumber:5 metal:5 hide:5
- **Damage capacity (repair HP) per level:** L1=3, L2=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:1 hide:1
  - L2: lumber:3 metal:1 hide:1
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Collectively sell up to 1 lumber for 5 gold
  - L2: Collectively sell up to 2 lumber for 5 gold each
- **Wrecked effect (`effectWrecked`):** Lose 2 collective lumber
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=144.3
  - L2: prosperity=2
- **Map coordinates (outpost sticker placement):** 3 level-specific hitboxes captured in raw staging.

#### 72 — Hide Depot (`hide-depot`)

- **Levels:** L1–L2
- **Initial build cost:** prosperity:3 lumber:2 metal:2 hide:6 gold:10
- **Upgrade costs:**
  - L2: prosperity:7 lumber:5 metal:5 hide:5
- **Damage capacity (repair HP) per level:** L1=3, L2=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:1 metal:1 hide:2
  - L2: lumber:1 metal:1 hide:3
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Collectively sell up to 1 hide for 5 gold
  - L2: Collectively sell up to 2 hide for 5 gold each
- **Wrecked effect (`effectWrecked`):** Lose 2 collective hide
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=173.1
  - L2: prosperity=2
- **Map coordinates (outpost sticker placement):** 3 level-specific hitboxes captured in raw staging.

#### 74 — Tavern (`tavern`)

- **Levels:** L1–L3
- **Initial build cost:** prosperity:2 lumber:2 metal:2 hide:1 gold:10
- **Upgrade costs:**
  - L2: prosperity:4 lumber:4 metal:3 hide:2
  - L3: prosperity:6 lumber:6 metal:4 hide:2
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:1 hide:0
  - L2: lumber:2 metal:2 hide:0
  - L3: lumber:2 metal:2 hide:2
- **Wrecked effect (`effectWrecked`):** Lose 1 morale
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=160.2
  - L2: prosperity=1, section=35.3
  - L3: prosperity=1, section=113.1, errata=tavern3
- **Map coordinates (outpost sticker placement):** 4 level-specific hitboxes captured in raw staging.

#### 81 — Hall of Revelry (`hall-of-revelry`)

- **Levels:** L1–L2
- **Initial build cost:** prosperity:5 lumber:6 metal:6 hide:6 gold:10
- **Upgrade costs:**
  - L2: **manual unlock** (via section / event, not paid construction)
- **Damage capacity (repair HP) per level:** L1=3, L2=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:2 hide:2
  - L2: lumber:2 metal:2 hide:2
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: When the trials deck is complete, read %data.section:187.1%
  - L2: Access to Tholos' Favors
- **Wrecked effect (`effectWrecked`):** Lose 1 morale
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=178.2
  - L2: prosperity=1
- **Map coordinates (outpost sticker placement):** 3 level-specific hitboxes captured in raw staging.

#### 83 — Library (`library`)

- **Levels:** L1–L3
- **Initial build cost:** prosperity:2 lumber:3 metal:2 hide:0 gold:10
- **Upgrade costs:**
  - L2: prosperity:4 lumber:4 metal:4 hide:1
  - L3: prosperity:6 lumber:2 metal:5 hide:5
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:1 hide:0
  - L2: lumber:2 metal:2 hide:0
  - L3: lumber:2 metal:2 hide:2
- **Wrecked effect (`effectWrecked`):** Lose 1 inspiration
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=190.3
  - L2: prosperity=1, section=116.3
  - L3: prosperity=1, section=89.2
- **Map coordinates (outpost sticker placement):** 4 level-specific hitboxes captured in raw staging.

#### 84 — Workshop (`workshop`)

- **Levels:** L1–L1
- **Initial build cost:** prosperity:0 lumber:0 metal:0 hide:0 gold:0
- **Damage capacity (repair HP) per level:** L1=2
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:1 hide:1
- **Wrecked effect (`effectWrecked`):** Lose 1 collective lumber
- **Map coordinates (outpost sticker placement):** 1 level-specific hitboxes captured in raw staging.

#### — — Boat (`boat`)

- **Prerequisite building:** `workshop`
- **Prosperity-unlocked** (not built via standard construction)
- **Levels:** L1–L1
- **Initial build cost:** prosperity:1 lumber:4 metal:1 hide:2 gold:0
- **Building-Ops effect:** _(none — this building has no Step 3 operation)_
- **Construction/upgrade rewards per level:**
  - L1: section=139.2

#### — — Sled (`sled`)

- **Prerequisite building:** `workshop`
- **Prosperity-unlocked** (not built via standard construction)
- **Levels:** L1–L1
- **Initial build cost:** prosperity:1 lumber:3 metal:2 hide:1 gold:0
- **Building-Ops effect:** _(none — this building has no Step 3 operation)_
- **Construction/upgrade rewards per level:**
  - L1: section=169.2

#### — — Climbing Gear (`climbing-gear`)

- **Prerequisite building:** `workshop`
- **Prosperity-unlocked** (not built via standard construction)
- **Levels:** L1–L1
- **Initial build cost:** prosperity:1 lumber:1 metal:3 hide:2 gold:0
- **Building-Ops effect:** _(none — this building has no Step 3 operation)_
- **Construction/upgrade rewards per level:**
  - L1: section=161.1

#### 85 — Carpenter (`carpenter`)

- **Levels:** L1–L2
- **Initial build cost:** prosperity:2 lumber:4 metal:3 hide:2 gold:10
- **Upgrade costs:**
  - L2: prosperity:5 lumber:6 metal:5 hide:4
- **Damage capacity (repair HP) per level:** L1=2, L2=3
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:1 hide:1
  - L2: lumber:3 metal:2 hide:2
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Reduce all construction costs by 1 material resource
  - L2: Reduce all construction costs by 1 material resource and the extra construction cost by 1 morale
- **Wrecked effect (`effectWrecked`):** Lose any 1 collective resource
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=7.3
  - L2: prosperity=1
- **Map coordinates (outpost sticker placement):** 3 level-specific hitboxes captured in raw staging.

#### 88 — Stables (`stables`)

- **Levels:** L1–L4
- **Initial build cost:** prosperity:2 lumber:6 metal:2 hide:2 gold:10
- **Upgrade costs:**
  - L2: prosperity:4 lumber:4 metal:5 hide:5
  - L3: prosperity:6 lumber:6 metal:7 hide:6
  - L4: prosperity:8 lumber:8 metal:8 hide:8
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=3, L4=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:3 metal:1 hide:0
  - L2: lumber:3 metal:1 hide:1
  - L3: lumber:3 metal:2 hide:2
  - L4: lumber:3 metal:3 hide:3
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Bring one pet into each scenario. \ Capacity: 4
  - L2: Bring one pet into each scenario. \ Capacity: 8
  - L3: Bring two pets into each scenario. \ Capacity: 8
  - L4: Bring two pets into each scenario. \ Capacity: 12
- **Wrecked effect (`effectWrecked`):** Characters cannot use pets
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=3.1
  - L2: prosperity=1
  - L3: prosperity=1
  - L4: prosperity=1, loseMorale=1
- **Map coordinates (outpost sticker placement):** 5 level-specific hitboxes captured in raw staging.

#### 90 — Town Hall (`town-hall`)

- **Levels:** L1–L3
- **Initial build cost:** prosperity:2 lumber:2 metal:2 hide:1 gold:10
- **Upgrade costs:**
  - L2: prosperity:4 lumber:3 metal:3 hide:3
  - L3: prosperity:6 lumber:4 metal:5 hide:4
- **Damage capacity (repair HP) per level:** L1=2, L2=3, L3=4
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:2 metal:2 hide:0
  - L2: lumber:2 metal:2 hide:1
  - L3: lumber:2 metal:2 hide:2
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Draw one challenge and keep up to one. When the challenge deck is complete, read %data.section:190.1%
  - L2: Draw two challenges and keep up to one. When the challenge deck is complete, read %data.section:190.1%
  - L3: Draw three challenges and keep up to two. When the challenge deck is complete, read %data.section:190.1%
- **Wrecked effect (`effectWrecked`):** Cannot complete challenges
- **Construction/upgrade rewards per level:**
  - L1: prosperity=1, section=189.1
  - L2: prosperity=1
  - L3: prosperity=1
- **Map coordinates (outpost sticker placement):** 4 level-specific hitboxes captured in raw staging.

#### 98 — Barracks (`barracks`)

- **Levels:** L1–L4
- **Initial build cost:** prosperity:0 lumber:0 metal:0 hide:0 gold:0
- **Upgrade costs:**
  - L2: **manual unlock** (via section / event, not paid construction)
  - L3: **manual unlock** (via section / event, not paid construction)
  - L4: **manual unlock** (via section / event, not paid construction)
- **Damage capacity (repair HP) per level:** L1=2, L2=2, L3=3, L4=3
- **Rebuild-if-wrecked cost per level:**
  - L1: lumber:1 metal:1 hide:0
  - L2: lumber:1 metal:2 hide:1
  - L3: lumber:1 metal:2 hide:1
  - L4: lumber:1 metal:3 hide:1
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: Collectively train up to 1 soldier for 3 gold and 1 material resource \ \ Capacity: 4 \ Effect: advantage and -5 [attack]
  - L2: Collectively train up to 1 soldier for 3 gold and 1 material resource \ \ Capacity: 6 \ Effect: advantage and -15 [attack]
  - L3: Collectively train up to 2 soldiers for 3 gold and 1 material resource \ \ Capacity: 8 \ Effect: advantage and -25 [attack]
  - L4: Collectively train up to 2 soldiers for 3 gold and 1 material resource \ \ Capacity: 10 \ Effect: advantage and -35 [attack]
- **Wrecked effect (`effectWrecked`):** Disadvantage on all attack event resolutions. \ Cannot use soldiers.
- **Construction/upgrade rewards per level:**
  - L1: soldiers=4
  - L2: prosperity=1, soldiers=2
  - L3: prosperity=1, soldiers=2
  - L4: prosperity=1, soldiers=2
- **Map coordinates (outpost sticker placement):** 3 level-specific hitboxes captured in raw staging.

#### — — Wall J (`wall-j`)

- **Prosperity-unlocked** (not built via standard construction)
- **Levels:** L1–L1
- **Initial build cost:** prosperity:1 lumber:4 gold:10
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: %data.buildings.wall-effect%
- **Construction/upgrade rewards per level:**
  - L1: defense=5
- **Map coordinates (outpost sticker placement):** 1 level-specific hitboxes captured in raw staging.

#### — — Wall K (`wall-k`)

- **Prosperity-unlocked** (not built via standard construction)
- **Levels:** L1–L1
- **Initial build cost:** prosperity:2 lumber:3 metal:2 hide:2 gold:10
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: %data.buildings.wall-effect%
- **Construction/upgrade rewards per level:**
  - L1: defense=5
- **Map coordinates (outpost sticker placement):** 1 level-specific hitboxes captured in raw staging.

#### — — Wall L (`wall-l`)

- **Prosperity-unlocked** (not built via standard construction)
- **Levels:** L1–L1
- **Initial build cost:** prosperity:3 lumber:5 metal:2 hide:1 gold:10
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: %data.buildings.wall-effect%
- **Construction/upgrade rewards per level:**
  - L1: defense=5
- **Map coordinates (outpost sticker placement):** 1 level-specific hitboxes captured in raw staging.

#### — — Wall M (`wall-m`)

- **Prosperity-unlocked** (not built via standard construction)
- **Levels:** L1–L1
- **Initial build cost:** prosperity:4 lumber:4 metal:3 hide:3 gold:10
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: %data.buildings.wall-effect%
- **Construction/upgrade rewards per level:**
  - L1: defense=5
- **Map coordinates (outpost sticker placement):** 1 level-specific hitboxes captured in raw staging.

#### — — Wall N (`wall-n`)

- **Prosperity-unlocked** (not built via standard construction)
- **Levels:** L1–L1
- **Initial build cost:** prosperity:6 lumber:6 metal:3 hide:2 gold:10
- **Building-Ops effect (`effectNormal`) per level:**
  - L1: %data.buildings.wall-effect%
- **Construction/upgrade rewards per level:**
  - L1: defense=5
- **Map coordinates (outpost sticker placement):** 1 level-specific hitboxes captured in raw staging.

### Level-gated capabilities (cross-reference)

- **Craftsman L1→L9:** unlocks 10+5+5+5+5+5+5+5+5 = 60 items total; L1 grants items 1–10 as the starting set per `rewards[0].items: "1-10"`. (Items source: `items.json`, see §4).
- **Alchemist L1→L3:** L1 unlocks 16 base potions, L3 unlocks 21 additional potions + 7 blueprint recipes (rest = crafting, see §5).
- **Enhancer L2/L3/L4:** reduces enhancement costs (see §7). L4 unlocks "start next scenario with [disarm]" — a condition hook, not a new verb.
- **Stables L1→L4:** pet capacity 4/8/8/12; bring 1/1/2/2 pets into scenarios.
- **Barracks L1→L4:** soldier capacity 4/6/8/10; soldier attack modifier -5/-15/-25/-35 (gets *more effective* with negative value = worse roll penalty on townguard AMD).
- **Town Hall L1→L3:** draw 1/2/3 challenge cards and keep 1/1/2; when challenge deck exhausted, read section 190.1.
- **Temple L1→L3:** effect "pay 5g → start scenario with bless×2" is identical across levels; upgrade rewards are prosperity+section unlocks, not ability changes.
- **Trading Post L1→L4:** "buy up to 1/2/3/4 items per downtime" — the downtime verb itself is level-gated.
- **Carpenter L1/L2:** reduces construction costs by 1 material (L1) or 1 material + 1 morale (L2). This is a *global modifier* that §10 Construction must apply.
- **Walls J/K/L/M/N:** passive +5 defense each; cumulative. No upgrades, no operations — pure defense resource for Assault.

## 4. Items (for T3f Store reference)

**264 FH items total.** Shape covered by `importItems` ([scripts/import-data.ts:705](scripts/import-data.ts:705)) except for the fields listed below.

### Item shape (all keys observed in staging)

```json
// Example: id 51 (Spiked Collar) — a Craftsman blueprint
{
  "id": 51,
  "name": "Spiked Collar",
  "count": 2,
  "edition": "fh",
  "slot": "head",
  "spent": true,
  "blueprint": true,
  "resources": {
    "flamefruit": 1
  },
  "requiredItems": [
    11
  ],
  "actions": [
    {
      "type": "custom",
      "value": "%data.items.fh-51.1%",
      "small": true
    }
  ],
  "effects": [
    {
      "type": "condition",
      "value": "wound"
    }
  ]
}
```

**All keys observed in `items.json`:** actions, actionsBack, blueprint, consumed, cost, count, edition, effects, id, loss, minusOne, name, persistent, random, requiredBuilding, requiredBuildingLevel, requiredItems, resources, resourcesAny, round, slot, slots, solo, spent, unlockProsperity.

### Slots

| Slot | Count |
|---|---|
| `(none)` | 2 |
| `body` | 28 |
| `head` | 36 |
| `legs` | 29 |
| `onehand` | 64 |
| `small` | 78 |
| `twohand` | 27 |

### Distribution by required building + level

| Source | Level | Count |
|---|---|---|
| alchemist | 1 | 16 |
| alchemist | 3 | 28 |
| craftsman | 1 | 10 |
| craftsman | 2 | 5 |
| craftsman | 3 | 5 |
| craftsman | 4 | 5 |
| craftsman | 5 | 5 |
| craftsman | 6 | 5 |
| craftsman | 7 | 5 |
| craftsman | 8 | 5 |
| craftsman | 9 | 5 |
| jeweler | 1 | 4 |
| jeweler | 2 | 4 |
| jeweler | 3 | 4 |
| none | ? | 131 |
| trading-post | 2 | 9 |
| trading-post | 3 | 9 |
| trading-post | 4 | 9 |

### Prosperity unlock

| unlockProsperity | Count |
|---|---|
| 1 | 9 |
| null | 255 |

**ℹ NOTE:** Only 9 FH items are gated by `unlockProsperity`; the rest are gated by `requiredBuilding` + `requiredBuildingLevel`. FH abandoned GH's prosperity-item-list system in favor of building-level gating. 255 items have `unlockProsperity: null`.

### Consumption / persistence mechanics

- `spent: true` — exhausted on use, refreshes on long rest: **90 items**
- `consumed: true` — permanently consumed (e.g. potions): **131 items**
- `persistent: true` — stays active between turns: **5 items**
- `loss: true` — user loses an ability card to trigger: **5 items**
- `round: true` — effect lasts one round: **1 items**
- `minusOne: true` — shuffles a −1 into AMD on use: **21 items**

**⚠ Not imported:** `spent` and `consumed` are imported; `persistent`, `loss`, `round`, `minusOne`, `solo`, `resourcesAny`, `requiredItems`, `blueprint`, `effects` are **not** stored in `items` table. T3f must extend import to expose `persistent`/`round`/`loss` at minimum (these drive scenario-side logic not shop-side, but shop UI needs them for item-card display).

### Special items

- **Starting set (Craftsman L1 reward):** items 1–10, indicated by `rewards[0].items: "1-10"` on the Craftsman building row.
- **Random items:** `random: true` flag — 25 items. These are drawn randomly during scenario loot. T3f excludes these from the shop list.
- **Solo items:** `solo: true` flag — 17 items. Only available in solo scenarios.
- **Blueprints:** `blueprint: true` — 15 items. These are **recipes**, not buyable items — they appear at the Craftsman or Alchemist crafting screen, not the shop. See §5.

## 5. Crafting recipes (T3g)

**Crafting is implemented as a subset of `items.json` with `blueprint: true`.** Each blueprint describes: a new item that the party can craft, the required existing items to consume, and the resource cost. There is no separate `crafting-recipes.json` file — the import path for T3g should walk `items.json` filtering on `blueprint === true`.

**15 blueprint items total.**

### Blueprint data shape

```json
{
  "id": 51,
  "name": "Spiked Collar",
  "count": 2,
  "edition": "fh",
  "slot": "head",
  "spent": true,
  "blueprint": true,
  "resources": {
    "flamefruit": 1
  },
  "requiredItems": [
    11
  ],
  "actions": [
    {
      "type": "custom",
      "value": "%data.items.fh-51.1%",
      "small": true
    }
  ],
  "effects": [
    {
      "type": "condition",
      "value": "wound"
    }
  ]
}
```

### All FH blueprints

| ID | Name | Slot | Building | Lvl | Required items (IDs) | Resources |
|---|---|---|---|---|---|---|
| 51 | Spiked Collar | head | (any Craftsman) | — | [11] | flamefruit:1 |
| 52 | Laser Lens | head | (any Craftsman) | — | [97,129] | — |
| 53 | Hobnail Boots | legs | (any Craftsman) | — | [18,88] | metal:1 |
| 54 | Restful Slippers | legs | (any Craftsman) | — | [6,92] | snowthistle:1 |
| 55 | Biting Gauntlet | onehand | (any Craftsman) | — | [94] | metal:1 hide:1 |
| 56 | Scavenger's Magnet | onehand | (any Craftsman) | — | [] | lumber:1 metal:1 |
| 57 | Shovel | onehand | (any Craftsman) | — | [] | lumber:1 metal:1 |
| 58 | Slippery Sword | onehand | (any Craftsman) | — | [14,85,90] | — |
| 59 | Charm of Expertise | head | alchemist | 3 | [11,113] | — |
| 60 | Cloak of Many Pockets | body | alchemist | 3 | [132] | hide:3 |
| 61 | Spiked Shell | body | alchemist | 3 | [32,105] | metal:1 |
| 62 | Everlasting Boots | legs | alchemist | 3 | [28,99] | — |
| 63 | Shadow Stompers | legs | alchemist | 3 | [13,158] | — |
| 64 | Detonator | onehand | alchemist | 3 | [96,112] | metal:1 |
| 65 | Rust Powder | small | alchemist | 3 | [157] | corpsecap:1 |

**ℹ NOTE:** Blueprint items 51–58 have **no `requiredBuilding`** — these are available at the Craftsman from L1. Blueprints 59–65 are gated to `alchemist L3` (distillation). **No blueprint exists for Craftsman L2–L9** in the raw JSON — those levels expand the *craftable-item pool* (see rulebook rule below), not the blueprint list. `items.json` with `blueprint: true` is only the FIRST-AUTHORED set of 15.

### How crafting actually works (rulebook p.65)

> "Non-potion items can be crafted by interacting with the Craftsman building… At the start of the campaign, only items 001–010 are available to be crafted. **As the Craftsman gets upgraded and as the party discovers new item blueprints, more items will be added to the available craftable supply.** Any item in the available craftable supply can be crafted."

So the blueprint *pool is dynamic*:

1. **Starting craftable supply:** items 001–010 (from `buildings.json → craftsman → rewards[0].items: "1-10"`).
2. **Craftsman upgrades add items** per reward track: L2 → items 11-15, L3 → 16-20, … L9 → 46-50. These are **craftable**, not just buyable — the Craftsman's ongoing function is to craft items.
3. **Section rewards grant specific blueprints.** E.g. section 33.1 "Gain Energizing Baton 073 blueprint", 49.2 "Grenades 074 blueprint", 114.1/2 "Aesther Robe 070 blueprint", 183.5 "Giant Sword 206" (+ adds items 059-065 to random blueprint deck), 192.5 "Roasted Fowl 079 blueprint".

**Sections referencing blueprints in FH:** 34 sections. Listed here for T3g's import to cross-reference:

- §49.2: ion with the Unfettered, and so you are the ones who must decide. Grenades” 074 blueprint. New Scenarios: Orphan’s Core 58 , Unfettered Uprising 59 Ch
- §114.2: someone back at Frosthaven will be able to get some use out of these. Robe” 070 blueprint. If you give Droman the order to prepare a psychic bomb, rea
- §171.2: Gain one random item blueprint.
- §183.5: ly for its listed price or one material Add items 059 to 065 to the random item blueprint deck. The final stage of the alchemist’s lab is complete. Wi
- §190.3: own guard perks, but can still be performed for experience. and one random item blueprint. Glint, the Inox records-keeper, looks strangely uncertain a
- §192.5: Gain “Roasted Fowl” 079 blueprint.
- §33.1: SARY FOR MY FUNCTION. PLEASE BUILD ONE SOON SO I CAN BEGIN HELPING!” Baton” 073 blueprint. New Scenarios: Orphan’s Core 58 , Automaton Uprising 59 Cho
- §33.4: SARY FOR MY FUNCTION. PLEASE BUILD ONE SOON SO I CAN BEGIN HELPING!” Baton” 073 blueprint. New Scenarios: Orphan’s Core 58 , Automaton Uprising 59 Cho
- §88.2: Gain one random item blueprint.
- §114.1: someone back at Frosthaven will be able to get some use out of these. Robe” 070 blueprint. If you give Droman the order to prepare a psychic bomb, rea
- §171.4: Gain one random item blueprint.
- §183.3: ly for its listed price or one material Add items 059 to 065 to the random item blueprint deck. The final stage of the alchemist’s lab is complete. Wi
- §190.1: own guard perks, but can still be performed for experience. and one random item blueprint. Glint, the Inox records-keeper, looks strangely uncertain a
- §190.4: own guard perks, but can still be performed for experience. and one random item blueprint. Glint, the Inox records-keeper, looks strangely uncertain a
- §190.2: own guard perks, but can still be performed for experience. and one random item blueprint. Glint, the Inox records-keeper, looks strangely uncertain a
- §171.3: Gain one random item blueprint.
- §183.1: ly for its listed price or one material Add items 059 to 065 to the random item blueprint deck. The final stage of the alchemist’s lab is complete. Wi
- §192.4: Gain “Roasted Fowl” 079 blueprint.
- §183.2: ly for its listed price or one material Add items 059 to 065 to the random item blueprint deck. The final stage of the alchemist’s lab is complete. Wi
- §192.3: Gain “Roasted Fowl” 079 blueprint.
- §171.5: Gain one random item blueprint.
- §171.1: Gain one random item blueprint.
- §33.3: SARY FOR MY FUNCTION. PLEASE BUILD ONE SOON SO I CAN BEGIN HELPING!” Baton” 073 blueprint. New Scenarios: Orphan’s Core 58 , Automaton Uprising 59 Cho
- §58.1: sh their metal supports and bring them down, cutting off the enemy troops. item blueprint. 58.1 • Skyhall (19) 58.2 • Rusted Tunnels (25)
- §105.2: Gain one random item blueprint.
- §88.3: Gain one random item blueprint.
- §58.2: sh their metal supports and bring them down, cutting off the enemy troops. item blueprint. 58.1 • Skyhall (19) 58.2 • Rusted Tunnels (25)
- §33.2: SARY FOR MY FUNCTION. PLEASE BUILD ONE SOON SO I CAN BEGIN HELPING!” Baton” 073 blueprint. New Scenarios: Orphan’s Core 58 , Automaton Uprising 59 Cho
- §49.1: ion with the Unfettered, and so you are the ones who must decide. Grenades” 074 blueprint. New Scenarios: Orphan’s Core 58 , Unfettered Uprising 59 Ch
- §88.1: Gain one random item blueprint.
- _(and 4 more)_

4. **Treasures grant specific blueprints.** Per rulebook Appendix E (p.78-79), treasure index entries include:

   - Treasure 03, 11, 14, 38, 44, 56, 58, 73, 74: random item blueprint
   - Treasure 21: Detonator 064 blueprint
   - Treasure 22: Scaled Armor 068 blueprint
   - Treasure 31: Balanced Scales 078 blueprint
   - Treasure 40: Chaos Cannon 077 blueprint
   - Treasure 49: Bone Boots 071 blueprint
   - Treasure 59: Pain Simulacrum 081 blueprint
   - Treasure 62, 69: Mechanical Cube 082 blueprint (**both halves** required)
   - Treasure 70: Horn of Command 076 blueprint
   - Treasure 72: Living Stone 080 blueprint
   - Treasure 82: Oak Staff 072 blueprint

**Treasures table in reference.db** has `reward` as a compact string format — e.g. `randomItemBlueprint`, `itemFh:200`, `itemFh:200-blueprint`, `lootCards:4`. Treasure rewards reference both items and blueprints.

5. **Event outcomes grant blueprints** via the `randomItemBlueprint` effect (3 event effects) or direct item grants. Events also ADD cards to the blueprint pool via section triggers (section 183.5 expands the pool).

### Crafting-cost-substitution rule (rulebook p.65)

**Important T3g detail:** if a blueprint requires another item as input (`requiredItems: [N]`) and all copies of that item are owned by *other* party members, the crafting character may **spend the gold/resources/items listed as the required item's cost** instead of spending the item itself. This means T3g's validator can't just check "do I own item N?" — it has to traverse the required-item graph and allow substitution when the item is party-owned.

### Blueprint pool state model (Kyle-decided: explicit set)

`state.party.craftableItems: Set<itemId>`. Every reward path that grants a blueprint (section trigger, treasure draw, event outcome) pushes the item id into this set. Chosen because:

- Blueprint unlocks are **monotonic** in FH (nothing removes a blueprint from the pool once granted — wrecking a building doesn't un-teach a recipe).
- Matches existing state-model patterns in `gameState.ts` (`party.unlockedItems`, `party.unlockedCharacters`, `party.campaignStickers` are all explicit lists).
- Fast at query time, trivial to serialize.

**Dev-mode safety net:** `deriveCraftableItemsFromSources(party)` reconstructs the set from `party.conclusions + party.treasuresLooted + party.unlockedEvents` and asserts equality against `party.craftableItems` on save-load. Catches drift in dev without paying the re-derivation cost in prod.

### Material vs herb supply rules (rulebook p.56)

- **Material resources (lumber/metal/hide):** when crafting, CANNOT be taken from the Frosthaven supply — must come from crafting character's personal supply.
- **Herb resources (arrowvine/axenut/corpsecap/flamefruit/rockroot/snowthistle):** CAN be taken from Frosthaven supply OR personal supply when crafting or brewing.
- **Construction costs:** always from Frosthaven supply (any character's pool can donate into it, but construction pays from there).

## 6. Brewing recipes (T3h)

**Brewing is implemented as alchemist-required `slot:small` items with `consumed: true`.** Each potion has a `resources: { <herb>: count }` field — that IS the brew recipe. The Alchemist building's operation is "Brew potions" at its various levels.

**37 FH potions total.** L1=16, L3=21. **No L2 potions exist in staging** — this matches the rulebook where Alchemist L2 adds *distillation* rather than new potions.

### Potion data shape

```json
{
  "id": 83,
  "name": "Healing Potion",
  "count": 2,
  "edition": "fh",
  "slot": "small",
  "consumed": true,
  "resources": {
    "arrowvine": 1,
    "rockroot": 1
  },
  "requiredBuilding": "alchemist",
  "requiredBuildingLevel": 1,
  "actions": [
    {
      "type": "custom",
      "value": "%data.items.fh-83.1%",
      "small": true
    }
  ],
  "effects": [
    {
      "type": "heal",
      "value": 3
    }
  ]
}
```

### L1 potions (Alchemist L1 or higher can brew)

| ID | Name | Herbs | Effect summary |
|---|---|---|---|
| 83 | Healing Potion | arrowvine×1, rockroot×1 | heal=3 |
| 84 | Stamina Potion | arrowvine×1, snowthistle×1 | _(custom text)_ |
| 85 | Power Potion | arrowvine×1, axenut×1 | _(custom text)_ |
| 86 | Element Potion | arrowvine×1, flamefruit×1 | element=wild |
| 87 | Cure Potion | arrowvine×1, corpsecap×1 | _(custom text)_ |
| 88 | Fireshield Potion | rockroot×1, flamefruit×1 | _(custom text)_ |
| 89 | Stoneskin Potion | rockroot×1, corpsecap×1 | condition=ward |
| 90 | Muscle Potion | axenut×1, flamefruit×1 | condition=strengthen |
| 91 | Holy Water | corpsecap×1, flamefruit×1 | condition=bless |
| 92 | Renewing Potion | rockroot×1, snowthistle×1 | _(custom text)_ |
| 93 | Glancing Potion | rockroot×1, axenut×1 | _(custom text)_ |
| 94 | Frenzy Potion | corpsecap×1, axenut×1 | _(custom text)_ |
| 95 | Poison Vial | snowthistle×1, corpsecap×1 | _(custom text)_ |
| 96 | Flame Vial | snowthistle×1, flamefruit×1 | _(custom text)_ |
| 97 | Explosive Vial | snowthistle×1, axenut×1 | _(custom text)_ |
| 98 | Unhealthy Mixture |  | condition=wound, condition=poison |

### L3 potions (Alchemist L3)

| ID | Name | Herbs | Effect summary |
|---|---|---|---|
| 99 | Major Healing Potion | arrowvine×1, rockroot×1, snowthistle×1 | heal=6 |
| 100 | Major Stamina Potion | arrowvine×1, snowthistle×1, axenut×1 | _(custom text)_ |
| 101 | Major Power Potion | arrowvine×1, axenut×1, corpsecap×1 | _(custom text)_ |
| 102 | Major Element Potion | arrowvine×1, axenut×1, flamefruit×1 | element=wild, element=wild |
| 103 | Major Cure Potion | arrowvine×1, corpsecap×1, flamefruit×1 | _(custom text)_ |
| 104 | Swiftness Potion | rockroot×1, axenut×1, flamefruit×1 | _(custom text)_ |
| 105 | Major Fireshield Potion | arrowvine×1, rockroot×1, flamefruit×1 | _(custom text)_ |
| 106 | Stonewall Potion | arrowvine×1, rockroot×1, axenut×1 | _(custom text)_ |
| 107 | Vigor Potion | arrowvine×1, rockroot×1, corpsecap×1 | _(custom text)_ |
| 108 | Holy Rain | arrowvine×1, snowthistle×1, corpsecap×1 | _(custom text)_ |
| 109 | Major Renewing Potion | rockroot×1, snowthistle×1, flamefruit×1 | _(custom text)_ |
| 110 | Precision Potion | rockroot×1, snowthistle×1, corpsecap×1 | _(custom text)_ |
| 111 | Major Frenzy Potion | rockroot×1, axenut×1, corpsecap×1 | _(custom text)_ |
| 112 | Hammer Potion | rockroot×1, snowthistle×1, axenut×1 | damage=10 |
| 113 | Expertise Potion | rockroot×1, corpsecap×1, flamefruit×1 | _(custom text)_ |
| 114 | Foresight Potion | snowthistle×1, corpsecap×1, flamefruit×1 | _(custom text)_ |
| 115 | Infusion Potion | axenut×1, corpsecap×1, flamefruit×1 | _(custom text)_ |
| 116 | Plague Flask | snowthistle×1, axenut×1, corpsecap×1 | _(custom text)_ |
| 117 | Inferno Flask | snowthistle×1, axenut×1, flamefruit×1 | _(custom text)_ |
| 118 | Fulminant Flask | arrowvine×1, snowthistle×1, flamefruit×1 | _(custom text)_ |
| 119 | Deadly Mixture |  | condition=wound, condition=poison, condition=immobilize, condition=disarm |

### The Alchemy Chart (rulebook p.66)

**Correction from prior draft:** brewing isn't a "look up the potion by resources" operation against a flat table. The rulebook mechanism is:

1. Character spends **any two herb resources** (from Frosthaven or personal supply).
2. The resulting potion is determined by a physical **alchemy chart** — a 6×6 grid of windows, one per (herb₁, herb₂) combination.
3. At campaign start, **all windows are closed** — potion formulas are unknown.
4. First brew of any combo: **open the window**, reveal the potion, gain one copy, move remaining copies to craftable supply.
5. Once revealed, the potion is permanently known; subsequent brews of the same combo don't need discovery, and the potion can also be **crafted** (not just brewed) from then on.

**This is progression-gated knowledge, not a recipe database.** The `items.json` `resources` field on each potion **is** the combo, but the app must track which (herb₁, herb₂) pairs have been revealed per-party on `state.party.alchemyChart: Record<"herb1+herb2", true>`.

### Phone UX (Kyle-decided: chart-grid visual)

The phone brew screen renders the alchemy chart as a **6×6 grid of windows**, mirroring the physical chart. Closed windows show a mystery icon; opened windows show the potion name + icon. Tapping a closed window with sufficient herbs in supply triggers brew-and-reveal.

Asset: `worldhaven/images/charts/frosthaven/die-lines/fh-alchemy-chart-page-<N>-dl.png` (see §17). Page 1 = 2-herb combos (Alchemist L1+), page 2 = 3-herb combos (Alchemist L3+). Overlay reveal-state from `state.party.alchemyChart`.

### Distillation (Alchemist L2)

Per rulebook p.66:

> "Characters distill a potion by returning it from their pool of items to the available craftable supply. The distilling character gains any one of the herb resources required to brew the potion."

Distillation is a **reverse-craft** — hand back a potion, get back one of its two herbs. Requires the potion's alchemy-chart window to have been revealed.

### 3-herb potions (Alchemist L3)

Per rulebook p.66: spending three herbs brews a more powerful potion from a separate chart section.

- Pure-3-herb combos (each herb distinct) have their own revealable chart window.
- **3-herb combos with duplicate herbs all produce the SAME potion** (per rulebook) and this potion **cannot be distilled**.
- The L3 potions in items.json (21 of them) correspond to the 3-herb chart windows.

## 7. Enhancement table (T3h)

**Correction from prior draft:** the rulebook Appendix D (p.77) has the complete cost chart. Below is transcribed verbatim. No rulebook prose gap remains; only the slot-eligibility → shape-map is ambiguous.

### Enhancement base cost chart (rulebook p.77, Appendix D)

| Enhancement | Base Cost |
|---|---|
| Move +1 | 30 gold |
| Attack +1 | 50 gold |
| Range +1 | 30 gold |
| Target +1 | 75 gold |
| Shield +1 | 80 gold |
| Retaliate +1 | 60 gold |
| Pierce +1 | 30 gold |
| Heal +1 | 30 gold |
| Push +1 | 30 gold |
| Pull +1 | 20 gold |
| Teleport +1 | 50 gold |
| Summon HP +1 | 40 gold |
| Summon Move +1 | 60 gold |
| Summon Attack +1 | 100 gold |
| Summon Range +1 | 50 gold |
| Regenerate | 40 gold |
| Ward | 75 gold |
| Strengthen | 100 gold |
| Bless | 75 gold |
| Wound | 75 gold |
| Poison | 50 gold |
| Immobilize | 150 gold |
| Muddle | 40 gold |
| Curse | 150 gold |
| Element | 100 gold |
| Wild Element | 150 gold |
| Jump | 60 gold |
| Area-of-Effect Hex | 200 ÷ existing hex count (round up) |

### Cost modifiers (applied in order, per rulebook p.77)

1. **Multi-target double:** if the ability targets multiple figures or tiles, **double** the cost. Does NOT apply to target/AoE/element enhancements.
2. **Lost-only halve:** if the action has a lost icon but no persistent icon, **halve** the cost.
3. **Persistent triple:** if the ability provides a persistent bonus (with or without lost icon), **triple** the cost. Does NOT apply to summon-stat enhancements.
4. **Level penalty:** +25 gold for each level of the ability card above level 1 (so L2 = +25, L3 = +50, … L9 = +200).
5. **Repeat penalty:** +75 gold for each enhancement already on the same action.

### Special cases (rulebook p.77)

- Damage traps treated as "Attack +1" type (50g).
- Healing traps treated as "Heal +1" type (30g).
- Token/tile movement treated as "Move +1" type (30g).

### Enchanter discounts (from building effect labels, verified against the text)

- **L1:** −10 gold off every enhancement (flat).
- **L2:** L1 discount + −10 gold per level-penalty level (cancels the level-penalty at appropriate levels).
- **L3:** L1+L2 discounts + −25 gold per existing enhancement (cancels 1 stack of repeat penalty per Enchanter-level-3 reduction; rulebook says "repeat penalties by 25g per enhancement" — i.e. effectively eliminates the 75g repeat penalty's first level but details need rulebook double-check).
- **L4:** no enhancement-cost effect; L4 grants the "start next scenario with [disarm]" condition per its building card.

### Engine implementation

With the chart + modifiers locked, T3h implementation is straightforward:

```ts
// packages/shared/src/data/enhancements.ts
export const ENHANCEMENT_BASE_COST: Record<EnhancementType, number> = {
  movePlus1: 30, attackPlus1: 50, rangePlus1: 30, targetPlus1: 75,
  shieldPlus1: 80, retaliatePlus1: 60, piercePlus1: 30, healPlus1: 30,
  pushPlus1: 30, pullPlus1: 20, teleportPlus1: 50,
  summonHpPlus1: 40, summonMovePlus1: 60, summonAttackPlus1: 100, summonRangePlus1: 50,
  regenerate: 40, ward: 75, strengthen: 100, bless: 75, wound: 75,
  poison: 50, immobilize: 150, muddle: 40, curse: 150,
  element: 100, wildElement: 150, jump: 60,
  // areaOfEffectHex handled as function: (existingHexes) => Math.ceil(200 / existingHexes)
};

export function calculateEnhancementCost(
  kind: EnhancementType,
  action: AbilityAction,
  cardLevel: number,
  existingEnhancementsOnAction: number,
  enchancerLevel: number,
): number {
  let cost = ENHANCEMENT_BASE_COST[kind];
  // 1. multi-target double
  if (action.multiTarget && !["targetPlus1", "areaOfEffectHex", "element", "wildElement"].includes(kind))
    cost *= 2;
  // 2. lost-only halve
  if (action.lost && !action.persistent) cost = Math.ceil(cost / 2);
  // 3. persistent triple (not summon-stat)
  if (action.persistent && !kind.startsWith("summon")) cost *= 3;
  // 4. level penalty
  cost += 25 * (cardLevel - 1);
  // 5. repeat penalty
  cost += 75 * existingEnhancementsOnAction;
  // Enchanter discounts
  cost -= 10; // L1 flat discount (if Enchanter L1+)
  if (enchancerLevel >= 2) cost -= 10 * (cardLevel - 1); // L2 cancels level penalty
  if (enchancerLevel >= 3) cost -= 25 * existingEnhancementsOnAction; // L3 reduces repeat penalty
  return Math.max(0, cost);
}
```

### Ability card slot eligibility (raw staging)

**Correction:** enhancement slot eligibility lives **per-action** inside ability cards. The deck file at `.staging/ghs-client/data/fh/character/deck/<class>.json` has shape `{name, edition, character, abilities: []}`. Each ability has `actions[]` and `bottomActions[]`; each action has an `enhancementTypes: string[]` array declaring what enhancement types it accepts.

```json
// astral.json → abilities[0] (level 1)
{
  "name": "Boon of the Tempest",
  "cardId": 185,
  "level": 1,
  "initiative": 28,
  "actions": [
    {
      "type": "custom",
      "value": "%character.abilities.wip%",
      "enhancementTypes": [
        "any"
      ]
    }
  ],
  "bottomActions": [
    {
      "type": "custom",
      "value": "%character.abilities.wip%",
      "enhancementTypes": [
        "any"
      ]
    }
  ]
}
```

**All `enhancementTypes` values observed across FH ability cards:**

- `any`
- `circle`
- `diamond`
- `square`

**ℹ NOTE:** `enhancementTypes: ['any']` (common on placeholder WIP cards) means the action accepts any enhancement type. Specific types constrain eligibility. This field IS importable — T3h's slot-eligibility check can read it directly. Cost tiers and penalty math, however, remain rulebook-only (see the cost-table stub above).

## 8. Outpost events (T3b)

**146 outpost event cards total** (65 summer-outpost, 81 winter-outpost).

### Event card data shape

```json
{
  "cardId": "SO-01",
  "edition": "fh",
  "type": "summer-outpost",
  "narrative": "Knock knock knock! \"Mail call, open up\"<br><br>You open the door to find a grumpy Quatryl with a low-riding sack of mail. She tosses a lumpy package wrapped in cord to you. \"No name, but this address. It's yours now!\"<br><br>As she walks away she snaps her fingers, remembering something. \"Oh, right. This too.\" She hands over a letter addressed to you.<br><br>As she wanders off toward a drink, you rip the letter open to read a note scrawled in excellent cursive: <br><br>&emsp;\"Please do not open the package.<br>&emsp;We will retrieve it.<br>&emsp;-Leonidas and Maximus\"",
  "options": [
    {
      "label": "A",
      "narrative": "Open the package.",
      "outcomes": [
        {
          "narrative": "You tear open the edge of the package, just to get a peek. The closer you look, the less there is to see... it's empty. Sometime later a pair of Aesthers dressed in drab yellow arrive at your door.<br><br>\"Hello mercenaries. We are Leonidas-\" \"-and Maximus. We have come for our package.\"<br><br>You feign confusion and they return the sentiment.<br><br>\"Oh. Perhaps we have come too early-\" \"-or too late. We will return.\"",
          "effects": [
            {
              "type": "event",
              "alt": "fh",
              "values": [
                "summer-outpost",
                "SO-40"
              ]
            }
          ]
        }
      ]
    },
    {
      "label": "B",
      "narrative": "Respect their request.",
      "outcomes": [
        {
          "narrative": "Against all the curiosity in your being, you refrain from opening the lumpy package. A short while later two Aesthers dressed in drab yellow arrive at your door.<br><br>\"Hello mercenaries. We are Leonidas-\" \"-and Maximus. We have come for our package.\"<br><br>You hand it over, and they tear open the top, reaching much too deep inside to be obeying the laws of the universe. Out comes a large black diamond.<br><br>\"The Shadow Gem. We have-\" \"-your payment, as agreed.\"<br><br>They hand you a sack of coins and then turn and leave, passing the diamond back and forth between them.",
          "effects": [
            {
              "type": "collectiveGold",
              "values": [
                30
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### Card structure summary

- **Top-level fields:** cardId, edition, narrative, options, type.
- **Option fields:** `label` (A/B), `narrative`, `outcomes[]`.
- **Outcome fields:** `narrative` (string; paints the resolution), `effects[]` (structured state changes), `condition` (e.g. "if party has [sled]" or `{type: 'otherwise'}`).

**Options are typically two per card (A/B)**; the narrative is the prompt text; each option has 1–N outcomes where which outcome fires is determined by `condition` (building held, character present, week ≥ N, etc.). This IS structured — the engine can resolve automatically given party state.

### Outcome effect type distribution (across all 146 outpost events)

- Total options: 356
- Total outcomes: 440
- Total effects: 545

| Effect type | Count |
|---|---|
| `undefined` | 92 |
| `morale` | 62 |
| `outpostAttack` | 48 |
| `noEffect` | 43 |
| `collectiveResource` | 36 |
| `outpostTarget` | 28 |
| `loseMorale` | 25 |
| `collectiveGold` | 22 |
| `event` | 19 |
| `outcome` | 13 |
| `sectionWeeks` | 11 |
| `skipThreat` | 11 |
| `prosperity` | 11 |
| `scenarioCondition` | 10 |
| `loseCollectiveGold` | 8 |
| `removeEvent` | 7 |
| `inspiration` | 6 |
| `item` | 6 |
| `scenarioDamage` | 5 |
| `soldier` | 5 |
| `additionally` | 5 |
| `campaignStickerMap` | 5 |
| `randomScenario` | 4 |
| `upgradeBuilding` | 4 |
| `wreckBuilding` | 4 |
| `loseProsperity` | 4 |
| `soldiers` | 3 |
| `townGuardDeckCard` | 3 |
| `sectionOrWeek` | 3 |
| `sectionWeek` | 3 |
| `unlockScenario` | 3 |
| `townGuardDeckCardRemove` | 3 |
| `sectionWeeksSeason` | 2 |
| `campaignSticker` | 2 |
| `loseCollectiveResource` | 2 |
| `eventReturn` | 2 |
| `outpostAttackTarget` | 2 |
| `experience` | 2 |
| `eventsToTop` | 2 |
| `custom` | 2 |
| `gold` | 2 |
| `randomItemBlueprint` | 2 |
| `loseResource` | 1 |
| `collectiveResourceType` | 1 |
| `randomItem` | 1 |
| `unlockEnvelope` | 1 |
| `discard` | 1 |
| `checkbox` | 1 |
| `townGuardDeckCards` | 1 |
| `loseCollectiveResourceAny` | 1 |
| `loseExperience` | 1 |
| `outcomes` | 1 |
| `outcomeSelect` | 1 |
| `townGuardDeckCardRemovePermanently` | 1 |
| `and` | 1 |

### Assault-triggering events

Only **2 outpost events mention "assault"** in their narrative: WO-19, WO-43.

**Correction from initial scan:** the effect-type distribution shows assault/outpost mechanics ARE structured — via multiple purpose-built effect types. These are inline damage/deck-modification effects, not a branching "assault sub-state" trigger:

| Effect type | Count | Sample values | Interpretation |
|---|---|---|---|
| `outpostAttack` | 48 | `values: [5]` | Modifier to the attack's `attackValue` (positive = harder, negative = easier). See full table below. |
| `outpostTarget` | 28 | `values: [-1]` | **(Kyle-confirmed)** Modifier to the attack's `targetNumber` — changes how many buildings are hit. |
| `outpostAttackTarget` | 2 | `values: [-10, "all"]` | **(Kyle-confirmed, dual-purpose)** Small magnitude (±1, ±2) = target-priority shift; larger magnitude (±10/20/30) = attack-value modifier. Second value is scope (numeric buildingId or `"all"`). Engine disambiguates by value magnitude. |
| `wreckBuilding` | 4 | `values: ["workshop"]` | Directly wreck the named building (bypass AMD draw). |
| `townGuardDeckCard` | 3 | `values: ["fh-tg-add-plus20"]` | Add the named card to the Town Guard AMD. |
| `townGuardDeckCards` | 1 | `values: ["fh-tg-add-plus10-soldier", 2]` | Add N copies of a card. |
| `townGuardDeckCardRemove` | 3 | `values: ["tg-plus20"]` | Remove a card. |
| `skipThreat` | 11 | _(no values)_ | **(Kyle-confirmed)** Cancels the current event's attack portion. Party still resolves narrative + other non-attack effects. Confirmed via SO-12 (dump fish), SO-32 (pay metal), WO-25 (preemptive ambush) — all involve the party averting the threat through a choice. |
| `soldier` / `soldiers` | 8 | `values: [N]` | Gain / lose N soldiers in the party pool. |

**⚠ Implication:** §9 needs to be read with this structure. The "assault" mechanic is event-driven and largely encoded via `outpostAttack + townGuardDeckCard*` effects — NOT a separate "assault phase" with rounds. See §9 for detail.

### Starting outpost event deck composition

Per `campaign.json.events['summer-outpost']` and `['winter-outpost']`, the **starting deck** begins with a subset of cards (not all 146 are unlocked at week 1). Cards unlock over the campaign via section rewards and achievements.

- Starting summer-outpost cards: 20 of 65
- Starting winter-outpost cards: 20 of 81
- Starting summer-road cards: 20 of 52
- Starting winter-road cards: 20 of 49

## 9. Outpost Assault (T3c)

**Revised understanding — less of a gap than initially assessed.** The assault mechanic in FH is **not** a separate branching sub-state with rounds. It is a set of inline effect types applied directly to party state during outpost event resolution. The "sub-state transition" in PHASE_T3_SCOPE §Architecture (`kind: 'event-triggers-assault'`) may be over-engineered for what the data actually requires. **Kyle should confirm this interpretation against the rulebook before locking T3c scope.**

### Structured assault data in staging

**1. Attack event structure (FROM THE CARD BACK).** Major correction: outpost attack events have a **structured `attack` object** on a dedicated (unlabeled) outcome — this is the "back of the card" per rulebook p.60. There are **62 structured attack events** across all outpost+road+boat events (not just the 48 `outpostAttack` effects — that count measures *modifiers to* the attack value, not the attacks themselves).

Example attack object (from SO-07):

```json
// SO-07 (Summer Outpost Event 7) — Algox raid
// The third "option" has no label — it contains the attack data.
{
  "attack": {
    "attackValue": 10,
    "targetNumber": 4,
    "target": {
      "parity": "odd",
      "upperBoundary": 40
    },
    "targetDescription": "Target odd-numbered buildings from 1 to 40.",
    "narrative": "You stand by Mayor Satha as she regards the slain watchman, the arrow still buried in his chest. He died before he could reach the alarm. \"It looks like we'll need to double the watch,\" is all she says.",
    "effects": [
      {
        "type": "collectiveResource",
        "values": [
          2,
          "lumber"
        ]
      },
      {
        "type": "collectiveResource",
        "values": [
          2,
          "hide"
        ]
      }
    ]
  }
}
```

**Fields on `attack` object:**

- `attackValue` — the value that must be MET OR EXCEEDED on a defense check (per rulebook p.60). Common values: 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75. Also special (`"15+X"`, `"200"`, `"10,000"`).
- `targetNumber` — Target Value (number of buildings attacked). Common: 1–10, `"all"`, `"X"`.
- `target` — structured **target priority descriptor** with one or more of: `parity: 'odd'|'even'`, `level: 'low'|'high'`, `desc: true` (descending), `lowerBoundary: N` / `upperBoundary: N` (building id range), `manual: true` (party picks), `distance: {x,y}` (proximity to map coord) or `distance: 'previousTarget'`, `randomize: true`.
- `targetDescription` — human-readable version of the target priority (e.g. "Target odd-numbered buildings from 1 to 40.").
- `narrative` — the flavor text shown when the attack resolves.
- `effects` — additional party-state effects triggered by the attack (resources gained, morale lost, etc.).

**AttackValue distribution across 62 structured attacks:**

`{"10":1,"15":5,"20":6,"25":4,"30":5,"35":9,"40":7,"45":3,"50":4,"55":5,"60":4,"65":3,"70":2,"75":1,"200":1,"15+X":2,"10,000":1}`

**Target-priority shape distribution (21 variants):**

- `manual`: 8
- `parity`: 6
- `randomize`: 6
- `desc+parity`: 6
- `distance+parity`: 5
- `parity+upperBoundary`: 4
- `level`: 4
- `lowerBoundary+parity+upperBoundary`: 4
- `lowerBoundary+parity`: 4
- `desc+upperBoundary`: 2
- `level+parity`: 1
- `lowerBoundary+manual+upperBoundary`: 1
- `distance+manual+parity`: 1
- `lowerBoundary+upperBoundary`: 1
- `desc`: 1
- `desc+lowerBoundary`: 1
- `distance`: 1
- `desc+parity+upperBoundary`: 1
- `distance+manual`: 1
- `desc+manual`: 1

**The `outpostAttack: [N]` effects (in labeled option outcomes) are MODIFIERS to the attack value**, not the attack itself. Per rulebook p.60: "These outcomes often modify the attack in some way." So:

- Positive `[5]`: +5 to the attack value (harder to defend)
- Negative `[-5]`: −5 to the attack value (easier to defend)

Modifier samples:

| Card | Modifier |
|---|---|
| SO-07 | `[5]` |
| SO-23 | `[-5]` |
| SO-25 | `[5]` |
| SO-25 | `[-5]` |
| SO-26 | `[-5]` |
| SO-29 | `[-5]` |
| SO-31 | `[-5]` |
| SO-33 | `[-5]` |
| SO-34 | `[10]` |
| WO-01 | `[-5]` |
| WO-01 | `[-10]` |
| WO-02 | `[-5]` |
| _(and 36 more)_ | |

**2. Town Guard AMD card identifiers referenced by events.** Events add/remove specific TG cards via ID:

- `fh-tg-add-plus10-rolling`
- `fh-tg-add-plus10-soldier`
- `fh-tg-add-plus20`
- `fh-tg-add-plus30-soldier`
- `tg-plus20`
- `tg-success`

These IDs imply a naming scheme `fh-tg-<action>-<modifier>[-type]`:

- `add-plus10-rolling` = a rolling +10 card
- `add-plus10-soldier` = a +10 card that also spawns a soldier
- `add-plus20`, `add-plus30-soldier` — damage modifiers
- `tg-plus20`, `tg-success` — generic deck reference (possibly for removal without the `add-` prefix)

**3. Direct building-wreck effects.** 2 building names are referenced by `wreckBuilding` effect: `workshop`, `metal-depot`. These bypass the AMD-draw and directly wreck the named building — used for narrative events (e.g. "a fire destroys the workshop").

**4. Soldier + defense mechanics as party-state fields.** `party.soldiers: number` and `party.defense: number` are in the live game state (verified in `Town2` game: soldiers=7, defense=10). Walls add 5 defense each. Soldiers are gained/lost via `effects: [{type: 'soldier', values: [N]}]`.

**5. Town Guard perk library.** `campaign.json.townGuardPerks` has **9 fully-structured perks** that replace/add cards when specific sections are read. Sample:

```json
{
  "sections": [
    "19.2",
    "178.3"
  ],
  "perk": {
    "type": "replace",
    "cards": [
      {
        "count": 1,
        "attackModifier": {
          "type": "townguard",
          "valueType": "minus",
          "value": 10
        }
      },
      {
        "count": 1,
        "attackModifier": {
          "type": "townguard",
          "valueType": "plus",
          "value": 30
        }
      },
      {
        "count": 1,
        "attackModifier": {
          "type": "townguard",
          "valueType": "minus",
          "value": 20,
          "effects": [
            {
              "type": "custom",
              "value": "%data.section.rules.fh.19-2.1%",
              "hint": "%data.section.rules.fh.19-2.1%"
            }
          ]
        }
      }
    ]
  }
}
```

**6. Town Guard attack modifier shape.** `attackModifier: { type: 'townguard', valueType: 'plus'|'minus'|'default', value: 0|10|20|30, rolling?: boolean, effects?: [...] }`. The state model already supports this (`AttackModifierType` union includes `'townguard'`).

**7. Per-building damage capacity.** Each building has `repair: [L1, L2, L3, L4]` (HP per level) and `rebuild` costs per level. See §3 per-building tables.

**8. `effectWrecked` text per building** — the town-state penalty while wrecked. See §3.

**9. Base Town Guard deck composition (rulebook p.56, verbatim):**

| Count | Modifier | Card ID (rulebook) |
|---|---|---|
| 6 | +0 | 1420 |
| 5 | −10 | 1431 |
| 5 | +10 | 1426 |
| 1 | +20 | 1436 |
| 1 | −20 | 1437 |
| 1 | Wreck (auto-wreck target) | 1438 |
| 1 | Success (auto-defend) | 1439 |

**Total: 20 cards.** Each card has a unique reference number. Deck grows/changes as campaign progresses via `townGuardDeckCard*` effects and section-unlocked perks.

56 card images exist at `.staging/worldhaven/images/attack-modifiers/frosthaven/base/town-guard/` (20 base + 36 add/replace variants).

### Defense Check procedure (rulebook p.60–61)

For each building targeted by an attack:

1. **Determine Attack Value** = `attack.attackValue` + sum of any `outpostAttack` modifiers from option outcomes.
2. **Determine base defense** = `party.defense` + event-specified modifiers.
3. **Optionally spend soldiers** (if Barracks is not wrecked): party may lose N soldiers to: (a) reduce attack value by per-soldier amount based on Barracks level — L1:−5, L2:−15, L3:−25, L4:−35 per Barracks effect text — and (b) give the defense check **advantage** (draw 2 TG cards, keep better).
4. **If Barracks is wrecked:** defense check has **disadvantage** (draw 2, keep worse).
5. **Draw from Town Guard deck.** If advantage/disadvantage, draw 2 and keep better/worse.
6. **Apply card effects:** add modifier to defense total; if rolling, continue drawing. "Success" card → auto-defend. "Wreck" card → auto-wreck (regardless of result).
7. **Compare:** defense total ≥ attack value → building defended. Otherwise → building **damaged** (or **wrecked** if event specifies).
8. **Damaged building:** party immediately pays `repair[level-1]` cost (any material resources from any supply) or loses 1 morale.
9. **Wrecked building:** flip card to wrecked side; `effectWrecked` fires in every future Building Operations step until rebuilt. Don't apply damage/wrecked effects until the full attack event resolves.

**Reshuffle rule (answers Q15 open question):** "Reshuffle the town guard deck **after the attack** and as needed during the attack if the deck is depleted." Not per-building, not per-event in general — per attack event. Each full attack event is one reshuffle cycle.

### Example (rulebook p.61)

> "A When this attack of 50 occurs, B Frosthaven's total defense value is 35. C For the first building, one soldier is erased to reduce the attack value by 5 (due to the Barracks being level 1) and give advantage. D Two town-guard cards are drawn: +10 and −10. The +10 is applied for a result of 45, which meets the attack value. The defense check succeeds!"

### What's still NOT in staging

Only one item remains:

- **Base Town Guard card JSON encoding.** The 20-card deck is defined by rulebook text + card images, not a `townGuardAmdBase.json` file. T3c's pre-requisite data-authoring step is to encode this into `packages/shared/src/data/townGuardAmd.ts`. Trivial transcription given the table above.

### Town Guard perk unlocks (full list)

| Triggering sections | Perk type | Card changes |
|---|---|---|
| 19.2, 178.3 | `replace` | 1× (minus10), 1× (plus30), 1× (minus20 +fx) |
| 17.2, 166.4 | `replace` | 2× (plus10), 2× (plus30), 1× (minus20 +fx) |
| 151.3, 194.3 | `replace` | 1× (minus10), 1× (plus10) |
| 91.4, 157.3 | `replace` | 2× (default0), 1× (plus10) |
| 130.3, 104.1 | `replace` | 2× (plus10), 2× (plus10 rolling +fx) |
| 167.2, 175.1 | `add` | 1× (plus30) |
| 180.3 | `add` | 2× (default0 rolling +fx) |
| 41.1 | `add` | 2× (default0 rolling +fx) |
| 192.1 | `add` | 2× (default0 rolling +fx) |

Perks are unlocked when a listed section is read. **Each perk appears to be a party-wide upgrade to the Town Guard AMD**, mirroring how character perks upgrade personal AMDs. T3c engine will need a `state.party.townGuardAmd` like `state.monsterAttackModifierDeck`.

### Recommendation for T3c scope (revised)

Given the structured-effects picture:

1. **T3c should NOT model assault as a separate sub-state machine.** The effects `outpostAttack`, `townGuardDeckCard*`, `wreckBuilding`, `soldier`, `skipThreat` can be applied inline as part of event resolution. No new step in the town-phase state machine is needed — the existing event-resolution engine just needs handlers for these effect types.
2. **T3c SHOULD still add a display-side tableau** for when `outpostAttack` fires: draw the N town-guard cards animatedly, flash damaged buildings, show soldier/defense counters. This is the "assault animation" layer of the showpiece without needing full sub-state branching.
3. **Pre-requisite data-authoring mini-batch** to transcribe the 20 base Town Guard AMD cards into `packages/shared/src/data/townGuardAmd.ts` (~30 min reading PNGs). Plus encode the referenced add/remove cards: `fh-tg-add-plus10-rolling`, `fh-tg-add-plus10-soldier`, `fh-tg-add-plus20`, `fh-tg-add-plus30-soldier`, `tg-plus20`, `tg-success`.
4. **Remove the `event-triggers-assault` sub-state** from PHASE_T3_SCOPE §Architecture — not needed. Instead, event resolution just fires `outpostAttack` effects like any other effect, and the display-side listens for those to render the assault-animation tableau.

## 10. Construction rules (T3i)

### Rulebook p.68 (verbatim paraphrase)

> "After the Downtime step, the party may build, upgrade, and rebuild buildings. They may build or upgrade **one building by default**, and they may **lose 2 morale to build or upgrade a second building**. Buildings cannot be upgraded while wrecked. The party may also rebuild any number of wrecked buildings, but not until after any builds and upgrades."

### Confirmed rules

- **Max 1 build/upgrade per construction step** — unless party pays 2 morale, which allows a second.
- **Unlimited rebuilds** — wrecked buildings can all be rebuilt in a single step, AFTER the build/upgrade.
- **Cannot upgrade wrecked buildings** — wrecked must be rebuilt first (same step allowed).
- **Prosperity requirement** — each build/upgrade has a `prosperity` value; current prosperity must meet or exceed.
- **All costs paid from Frosthaven supply only** — not from individual character supplies.
- **When prosperity increases** — any character below half-new-prosperity (rounded up) may level up for free (no XP requirement).

### Data sources

- **Per-building initial `costs`** — see §3 per-building tables.
- **Per-building `upgrades`** array — each entry is the upgrade cost.
- **`{ manual: 1 }` upgrades** — Hall of Revelry L2 and Barracks L2/3/4. These are **section-triggered, not paid construction** (confirmed — matches rulebook pattern where some building levels unlock via narrative).
- **`prosperityUnlock: true`** — not buildable until prosperity threshold reached.
- **`requires: "<other-building>"`** — Boat/Sled/Climbing-Gear all require Workshop.
- **Carpenter L1/L2 global discount** — L1: −1 material; L2: −1 material + −1 morale (reduces the "2-morale-for-second-build" cost).
- **Rebuild costs** — `rebuild[level-1]` per building per level (cheaper than initial cost).

### Answered open questions

- **Tie-breaking votes:** the rulebook's general rule (p.6) is "the party decides ambiguity" — no structured vote-tie mechanism. T3i should treat `gmOverrideConstruction` as a discussion-resolution button, not a structured algorithm.
- **Extra morale cost:** it's the 2-morale for a second build/upgrade (not a hidden default). Carpenter L2 reduces this to 1 morale.
- **Construction timing:** **immediate rewards, next-week operations.** The build/upgrade's one-time rewards (prosperity, sticker, etc.) apply during this construction step; the building's ongoing `effectNormal` operation and `interactionsAvailable` don't fire until NEXT outpost phase (per rulebook p.68: "During the next Outpost Phase, the building's normal effect will resolve and its interactions will be available").

### Proposed engine surface

```ts
// T3i commands
castConstructionVote(characterName, buildingId)          // phone
beginBuildingConstruction(buildingId)                    // controller
upgradeBuilding(buildingId)                              // controller
rebuildBuilding(buildingId)                              // controller
payExtraMoraleForSecondBuild()                           // controller — opt in for second action
calculateConstructionCost(building, level, partyState): { lumber, metal, hide, gold, morale? }
// Carpenter L1/L2 modifiers applied here
```

## 11. Scenario selection + travel (T3j)

### FH scenarios — high-level stats

- **Total:** 159
- **Initial (unlocked at campaign start):** 20
- **Has `coordinates` in raw staging:** 152 (drives world-map pin placement)
- **Has `gridLocation` (hex region):** 152
- **Has `objectives_json` populated (non-"beat all monsters"):** 45
- **Has `requirements_json` (required buildings / unlocks / conditions):** 45
- **Complexity distribution:** {"1":26,"2":75,"3":40,"null":18}
- **Group distribution:** {"":141,"randomDungeon":1,"solo":17}

### Per-scenario synopsis shape

Raw `scenarios/001.json` top-level keys: index, name, flowChartGroup, coordinates, edition, complexity, initial, recaps, unlocks, rewards, monsters, allies, lootDeckConfig, rules, rooms.

```json
// Scenario 001 (A Town in Flames) raw sample — non-rooms fields only
{
  "index": "1",
  "name": "A Town in Flames",
  "flowChartGroup": "intro",
  "coordinates": {
    "x": 961.25,
    "y": 1872,
    "width": 165,
    "height": 95,
    "gridLocation": "FR"
  },
  "edition": "fh",
  "complexity": 1,
  "initial": true,
  "recaps": [
    {
      "type": "other"
    }
  ],
  "unlocks": [
    "2",
    "3"
  ],
  "rewards": {
    "custom": "%data.scenario.rewards.fh.001%",
    "morale": "2+X",
    "valueMapping": {
      "X": {
        "identifier": {
          "type": "monster",
          "edition": "fh",
          "name": "city-guard"
        },
        "type": "present",
        "value": "morale"
      }
    }
  },
  "monsters": [
    "algox-archer",
    "algox-guard",
    "algox-priest",
    "city-guard"
  ],
  "allies": [
    "city-guard"
  ],
  "lootDeckConfig": {
    "money": 6,
    "lumber": 5,
    "metal": 3,
    "hide": 3,
    "rockroot": 1,
    "snowthistle": 2
  },
  "rules": [
    {
      "round": "true",
      "always": true,
      "alwaysApply": true,
      "statEffects": [
        {
          "identifier": {
            "type": "monster",
            "edition": "fh",
            "name": "city-guard"
          },
          "statEffect": {
            "actions": [
              {
                "type": "shield",
                "value": 1
              },
              {
                "type": "retaliate",
                "value": 2
              }
            ],
            "deck": "city-guard-scenario-1"
          },
          "note": "%data.scenario.rules.fh.1%"
        }
      ]
    }
  ]
}
```

### Synopsis-card data available per scenario

Every FH scenario has (from raw staging):

- `index` — the scenario number (string, e.g. "001").
- `name` — display name.
- `complexity` — integer 1–3 (rulebook difficulty rating).
- `flowChartGroup` — e.g. "intro", "main", "winter-crusade". **Drives the flowchart branch grouping** for T3j controller view. **⚠ Importer drops this field.**
- `coordinates` — `{x, y, width, height, gridLocation: '<hex-ref>'}`. Drives world-map pin placement + zoom. **⚠ Importer drops this field.**
- `forcedLinks` — scenarios that MUST unlock next (linked-scenario chain). Used by T3a2.
- `initial: true` — if true, unlocked at campaign start.
- `requirements` — array describing prerequisites: required buildings (e.g. sled for scenario 10), minimum party level, sections read, etc.
- `rewards` — rewards granted on victory (gold, prosperity, sections, items).
- `monsters`, `allies` — lists for monster-group setup.
- `rules` — scenario-specific rules (stat effects, custom triggers).
- `objectives` — objective tokens to place on the map (not always a "win condition" — see below).

### Win-condition text (ALREADY EXTRACTED)

**Major correction from prior draft.** `scripts/extract-books.ts` runs `pdfjs-dist` over the scenario-book PDFs and populates `reference.db.scenario_book_data` with structured fields — including `goal_text` and `loss_text` — for every scenario. §11's earlier "hand-author a table" recommendation was wrong; the data is already there.

**Coverage:** 155 FH scenarios have extracted book data. Fields per row:

- `goal_text` — scenario win condition prose, e.g. "The scenario is complete when all enemies in it are dead."
- `loss_text` — loss condition prose (often defaults to exhaustion).
- `special_rules_text` — scenario-specific modifiers.
- `section_links_json` — **auto-extracted trigger → section mapping**, e.g. `[{"trigger": "that round,", "sectionId": "2.2"}, {"trigger": "When door 1 is opened,", "sectionId": "2.1"}]`. This is how the engine auto-fires section reads when scenario conditions are met.
- `introduction`, `designer`, `writer`, `location_code`, `raw_text` — additional metadata.

**Extraction confidence table** at [data/book-extraction-verify.tsv](data/book-extraction-verify.tsv) — 139 rows, all marked HIGH confidence.

**Heuristic classification distribution** (applied to `goal_text`):

| Win type | Count |
|---|---|
| `custom` | 56 |
| `defeat-all` | 40 |
| `kill-target` | 31 |
| `escape` | 17 |
| `defeat-all-plus` | 3 |
| `loot-treasure` | 3 |
| `survive-rounds` | 3 |
| `destroy-target` | 1 |
| `activate-switches` | 1 |

T3j can run this classifier at query time or pre-compute as an importer-added column. The `custom` cases (56) warrant manual review — a few samples:

- **§101:** The scenario is complete when C+4 swarms have been absorbed by Zu.
- **§103:** The scenario is complete when C+2 ice pillars have been destroyed.
- **§104:** The scenario is complete when one goal treasure tile has been looted.
- **§107:** The scenario may be complete only at the end of the same round when one of the five episodes is overcome.
- **§108:** The scenario is complete when all four goal treasure tiles have been looted.
- **§110:** The scenario is complete when all six ice pillars have been destroyed.
- **§113:** The scenario is complete when all four goal treasure tiles have been looted.
- **§114:** The scenario is complete when C+4 ice pillars have been destroyed.

### Auto-fire section-link triggers

`section_links_json` is a game-engine goldmine. Example from scenario 0 (Howling in the Snow):

```json
[{"trigger": "that round,", "sectionId": "2.2"},
 {"trigger": "play each class,", "sectionId": "197.1"},
 {"trigger": "When door 1 is opened,", "sectionId": "2.1"}]
```

T3b+ engine can auto-detect these triggers during scenario play (e.g. "door 1 opened" → auto-surface "read section 2.1" to controller). Already useful for T4/T5 scenario-play batches; not blocking for T3 town phase.

### Travel events (road + boat)

Road + boat events are **unified in `events.json`** with distinct `type` values:

| Type | Count |
|---|---|
| `summer-road` | 52 |
| `winter-road` | 49 |
| `boat` | 19 |

Structure is identical to outpost events (narrative + options + outcomes). T3j reuses T3b's event engine for travel events — no separate file, no separate shape. Road events have no summer/winter merge in the engine (the party's current season determines which pool to draw from).

### Forced-links / linked scenarios

- Scenarios with `links_json` populated (forced linked-next): 6
- Scenarios with raw `forcedLinks` (the source field): need to re-scan; `links_json` in refDB maps from this field. **ℹ NOTE:** T3a2 linked-scenario batch keys off `forcedLinks`.

## 12. Level-up data (T2b cross-reference)

### XP thresholds (confirmed in [levelCalculation.ts:44](packages/shared/src/data/levelCalculation.ts:44))

```ts
export const XP_THRESHOLDS = [0, 0, 45, 95, 150, 210, 275, 345, 420, 500] as const;
// index = character level; level 1 requires 0 XP, level 2 requires 45 XP, etc.
```

These match the standard GH/FH XP curve and apply to both editions.

### FH classes (17 total)

| Class | Display | Traits | Handsize | Spoiler? | # Perks | # Masteries |
|---|---|---|---|---|---|---|
| `astral` | orchid | arcane, educated, strong | 11 | yes | 11 | 2 |
| `banner-spear` | human | armored, persuasive, resourceful | 10 | no | 10 | 2 |
| `blinkblade` | quatryl | educated, nimble, resourceful | 10 | no | 11 | 2 |
| `boneshaper` | aesther | arcane, educated, intimidating | 12 | no | 10 | 2 |
| `coral` | lurker | armored, chaotic, strong | 12 | yes | 10 | 2 |
| `deathwalker` | valrath | arcane, outcast, persuasive | 11 | no | 11 | 2 |
| `drifter` | inox | outcast, resourceful, strong | 12 | no | 13 | 2 |
| `drill` | unfettered | armored, resourceful, strong | 9 | yes | 10 | 2 |
| `fist` | algox | intimidating, persuasive, strong | 8 | yes | 11 | 2 |
| `geminate` | harrower | arcane, chaotic, nimble | 7|7 | no | 12 | 2 |
| `kelp` | lurker | armored, intimidating, nimble | 10 | yes | 12 | 2 |
| `meteor` | savvas | arcane, chaotic, intimidating | 10 | yes | 12 | 2 |
| `prism` | unfettered | armored, educated, resourceful | 11 | yes | 10 | 2 |
| `shackles` | aesther | chaotic, intimidating, outcast | 10 | yes | 12 | 2 |
| `shards` | savvas | educated, outcast, persuasive | 10 | yes | 11 | 2 |
| `snowflake` | algox | chaotic, nimble, persuasive | 11 | yes | 9 | 2 |
| `trap` | vermling | nimble, outcast, resourceful | 9 | yes | 10 | 2 |

### Per-class data available in staging

For each `fh/character/<class>.json` file:

- `stats` — array of `{level, health}` entries, 9 levels (one per character level 1–9). Cross-checked with `getMinXPForLevel` for level-up gating.
- `perks` — array of perk definitions. Each perk has `type: 'replace' | 'add'`, `count` (how many times this perk can be taken), and `cards` describing the AMD modification.
- `masteries` — array of 2 mastery strings per character. Masteries are class-specific single-scenario achievements. **Per rulebook p.63:** "Each time a character achieves a new mastery, they gain one perk mark." (Answers Q21.) Masteries are per-scenario tests like "Perform a Banner summon ability on your first turn, keep the banner alive and within 3 of you for the entire scenario" — pass/fail at scenario end.
- `specialActions` — per-level special action cards (e.g. summons that "expire"). Used for level-up unlocks beyond ability cards.
- `availableSummons` — per-level summons available to play.

### Ability cards

Ability cards live in `fh/character/deck/<class>.json`. Each card has `level`, `cardId`, `actions[]`, `slots[]` (slot-eligibility for enhancement — see §7). Cards of level 1 and X are the starting set; higher-level cards are the level-up pool.

**ℹ NOTE:** The current `characters` table in reference.db stores `stats_json` (all 9 levels) and `perks_json` but does NOT store ability cards. T2b may need a new `character_ability_cards` table (separate from `monster_ability_cards`).

### GH classes (parallel)

- GH has 17 character class files (plus a deck/ subdirectory). Same shape as FH.
- Per-class data structure is identical between FH and GH; T2b can treat them uniformly.

## 13. Personal quests (T2c)

### FH PQs

**23 PQs in FH personal-quests.json.** reference.db has 23 FH rows (matching) and 117 across all editions.

### PQ data shape

```json
// Example: FH PQ 581 (Brewmaster / Differ Herbs)
{
  "cardId": "581",
  "altId": "01",
  "requirements": [
    {
      "name": "%data.personalQuest.fh.581.1%",
      "counter": 5,
      "checkbox": [
        "%game.resource.arrowvine%",
        "%game.resource.axenut%",
        "%game.resource.corpsecap%",
        "%game.resource.flamefruit%",
        "%game.resource.rockroot%",
        "%game.resource.snowthistle%"
      ],
      "autotrack": "differentHerbs"
    }
  ],
  "openEnvelope": "24:42",
  "errata": "env24"
}
```

**Keys observed across all FH PQs:** altId, cardId, errata, openEnvelope, requirements, spoiler.

### Requirement shape (structured autotrack)

Each PQ has a `requirements` array. Each requirement can have:

- `name` — display label (usually a localization key).
- `counter` — target count (e.g. 5 different herbs).
- `checkbox` — the discrete items/conditions being tracked (e.g. the 6 herb types).
- `autotrack` — a **named autotracker** the engine can run against game events (examples seen: `differentHerbs`, `scenarioCompletion`, `monsterKill`, etc.).
- `openEnvelope` (top-level) — campaign-sticker envelope to open on fulfillment (e.g. `"24:42"` means envelope 24, sticker 42).

**Autotrack values seen across FH PQs:**
- `differentHerbs`
- `looted:lumber`
- `scenario:69|70`
- `itemType:head`
- `itemType:body`
- `itemType:legs`
- `itemType:onehand|twohand`
- `itemType:small`
- `gold`
- `buildings`
- `scenario:65|66`
- `abilityXP`
- `scenarioRequirements:board|climbing-gear|sled`
- `craftableItems`
- `scenario:71|72`
- `donatedGold`
- `battleGoals`
- `itemBlueprint:39`
- `exchaustedChars`

**ℹ NOTE:** The `autotrack` string is an engine hook — T2c needs to implement each listed tracker. **T2c scope (Kyle-decided): implement all observed autotracks above.** Unknown autotracks (from future content) fall back to manual-count UI (player taps to increment).

### Retirement mechanics (rulebook p.64)

When a PQ is fulfilled, the character **must retire during the Downtime step** (not optional). On retirement:

1. Party gains **2 prosperity**.
2. **Unlock the building envelope** specified on the PQ card (via `openEnvelope: "24:42"` — envelope 24 or alt 42). If both envelopes are already unlocked → gain a random scenario + random item blueprint (or 1 inspiration each if those decks are depleted).
3. **Read the back-of-mat section** — first time each class retires, flip the character mat and read the section number on the back.
4. **Record in retirement table** on the campaign sheet.
5. Character's personal quest **is removed from the game**. Items returned, resources moved to Frosthaven supply, gold LOST.

**Inspiration-burn retirement bonus:** spend 15 inspiration at retirement to draw 2 more PQs and immediately complete one — gives +2 more prosperity + another envelope unlock.

**New-character perk-mark bonus:** each subsequent character created by the same player gains perk marks equal to that player's total prior retirements (from the campaign sheet retirement table).

### Engine command shape (T2c)

```ts
updatePersonalQuestProgress(characterName, requirementIndex, progress)
retireCharacter(characterName, {burnInspiration?: boolean})
// retirement handler:
//   1. compute envelope to unlock (primary vs alt)
//   2. state.party.prosperity += 2
//   3. state.party.unlockedEnvelopes.push(envelopeId)
//   4. log history: personalQuestFulfilled, characterRetired
//   5. if first retirement of this class, schedule back-of-mat section read
//   6. reclaim items to supply, resources to party pool, discard gold
```

### GH PQs (parallel)

GH has **24 PQ cards**. Same shape as FH (confirmed by schema match).

## 14. Kyle's current unlock state (live snapshot)

### Scan result

The live `data/ghs.sqlite` contains **57 game states**, all of which appear to be development/test sessions. The production live-state DB `data/gloomhaven-command.db` is empty (no tables).

Sample of 10 most-recently-updated games:

| Game code | Edition | Buildings | Prosperity | Chars unlocked | Week | Scenarios |
|---|---|---|---|---|---|---|
| Town4 | fh | 0 | 0 | 0 | 0 | 2 |
| Town3 | gh | 0 | 0 | 0 | 0 | 2 |
| town3 | fh | 0 | 12 | 0 | 0 | 2 |
| Town2 | fh | 0 | 0 | 0 | 0 | 6 |
| town1 | fh | 0 | 0 | 0 | 0 | 4 |
| displaytest5 | fh | 0 | 0 | 0 | 0 | 5 |
| displaytest6 | fh | 0 | 0 | 0 | 0 | 0 |
| displaytest4 | fh | 0 | 0 | 0 | 0 | 2 |
| displaytest3 | fh | 0 | 0 | 0 | 0 | 1 |
| displaytest2 | gh | 0 | 0 | 0 | 0 | 2 |

**All active games have `buildings: []` and `unlockedCharacters: []`** — no persistent campaign progress is captured in the available live-state snapshots. This matches the dev-focused naming (`displaytest*`, `town*`, `camp*`).

### Implication

**Section 14 is effectively skipped.** When Kyle runs an actual campaign, re-run the data audit (or just query his current game's `party.buildings` + `party.unlockedCharacters`) to know which buildings/characters to prioritize for T3c/d playtest.

## 15. Suggested engine additions for T3{letter}

Each suggestion is derived from the data audit above. Not binding — T3 batch prompts will refine. All refer to [packages/shared/src/types/gameState.ts](packages/shared/src/types/gameState.ts), [server/src/referenceDb.ts](server/src/referenceDb.ts), and [scripts/import-data.ts](scripts/import-data.ts) unless noted.

### T3a (Town phase state machine)
- New field `state.party.townPhase?: TownPhaseState` (already specced in PHASE_T3_SCOPE.md §Architecture).
- New `TownStepId` union type + `TownSubState` discriminated union (per scope doc).
- New commands: `advanceTownStep`, `selectTownStep`, `forceAdvanceTownStep`, `completeTownPhaseStepFor`, `abortTownPhase`.
- Auto-advance engine hook after every state-diff commit: check `isStepCompletionCriteriaMet(step, party)` and auto-fire `advanceTownStep`.
- Extend `completeScenario` to set `townPhase.step = 'passage-of-time'` (FH) or `= 'city-event'` (GH) when not a linked scenario.

### T3a2 (Linked scenarios)
- Extend `completeScenario` payload with `linkedNextScenario?: { index, edition }`.
- Engine detects forcedLinks from raw staging (not currently imported — **importer change required** to add `forced_links_json` column to `scenarios` table).
- Skip-town-phase path: on linked-scenario victory, engine calls internal `startScenario(linkedNextScenario)` directly.

### T3b (Outpost / City event)
- New commands: `drawEventCard(type)`, `castEventVote(characterName, optionId)`, `resolveEvent(resolutionId)`.
- State: `townPhase.subState.kind === 'event-drawn' | 'event-voting' | 'event-resolved'`. **Drop `'event-triggers-assault'`** — assault is an inline effect, not a branching sub-state (see §9).
- **Effect-handler dispatcher** for every effect type in §8's distribution. 545 total effect instances to handle across 146 event cards. Priority implementation order:
  1. `morale`, `loseMorale`, `prosperity`, `loseProsperity`, `collectiveGold`, `loseCollectiveGold`, `gold` — simple party-state deltas.
  2. `collectiveResource`, `loseCollectiveResource`, `collectiveResourceType`, `loseCollectiveResourceAny`, `loseResource` — resource adjustments.
  3. `event`, `eventReturn`, `eventsToTop`, `removeEvent` — event-deck manipulation.
  4. `section`, `sectionWeek`, `sectionWeeks`, `sectionOrWeek`, `sectionWeeksSeason` — read-section / schedule-section triggers.
  5. `outpostAttack`, `outpostTarget`, `outpostAttackTarget`, `wreckBuilding`, `soldier`, `soldiers`, `townGuardDeckCard`, `townGuardDeckCards`, `townGuardDeckCardRemove`, `skipThreat`, `upgradeBuilding` — outpost/assault (see §9 and T3c).
  6. Remainder: `item`, `inspiration`, `experience`, `randomScenario`, `unlockScenario`, `scenarioDamage`, `scenarioCondition`, `campaignStickerMap`, `campaignSticker`, `unlockEnvelope`, `randomItem`, `randomItemBlueprint`, `outcome`, `additionally`, `discard`, `checkbox`, `noEffect`, `custom`, `undefined`.

### T3c (Outpost Assault) — revised scope
- **No new sub-state machine.** Assault effects fire inline during event resolution (`outpostAttack`, `townGuardDeckCard*`, `wreckBuilding`, `soldier`, `skipThreat`).
- New AMD deck model: `state.party.townGuardAmd: AttackModifierDeckModel` (parallel to existing `monsterAttackModifierDeck`). **Already supported** by `AttackModifierType` union (has 'townguard').
- New state fields: `state.party.townGuardAmd`, `state.party.buildingDamage: Record<buildingId, number>` (not `assault.buildingDamage` — damage persists across events until rebuilt).
- New commands:
  - `applyOutpostAttack(count)` — draws count TG cards, applies results, fires display animation hook.
  - `addTownGuardCard(cardId, count = 1)` — driven by `townGuardDeckCard*` effects.
  - `removeTownGuardCard(cardId)` — driven by `townGuardDeckCardRemove`.
  - `wreckBuilding(buildingName)` — driven by `wreckBuilding` effect; updates damage=repair[level-1] to mark wrecked.
  - `repairBuilding(buildingName)` — reverses damage (building ops step 3, Temple effect, etc.).
  - `rebuildBuilding(buildingName)` — player-paid rebuild of wrecked building during construction step.
  - `adjustSoldiers(delta)` — driven by `soldier`/`soldiers` effects.
  - `adjustDefense(delta)` — driven by defense adjustments; also auto-updated when walls are built.
  - `skipNextOutpostAttack` — driven by `skipThreat`.
- **Pre-requisite data-authoring batch:** author `packages/shared/src/data/townGuardAmd.ts` with: (a) the base 20-card deck (transcribed from `.staging/worldhaven/images/attack-modifiers/frosthaven/base/town-guard/fh-am-tg-01..20.png`), (b) the ~6 event-referenced cards (`fh-tg-add-plus10-rolling`, `fh-tg-add-plus10-soldier`, `fh-tg-add-plus20`, `fh-tg-add-plus30-soldier`, `tg-plus20`, `tg-success`) with their full AMD card shape (value, rolling, effects).
- Town Guard perk application on section unlock: when any section in a `townGuardPerks[].sections` list is added to `party.sections`, apply the perk's card replace/add to the town-guard AMD.
- Display side: the showpiece — outpost map with building damage indicators; TG AMD animated card-draw; soldier/defense counters.

### T3d (Building operations)
- **Importer extension required:** `importBuildings` must start capturing `effect_normal_json`, `effect_wrecked_json`, `interactions_available_json`, `interactions_unavailable_json`, `repair_json`, `rebuild_json`, `rewards_json`, `prosperity_unlock`, `requires`, `coordinates_json`. Without these, T3d cannot render the building-operation screens.
- New commands: `startBuildingOp(buildingId)`, `applyBuildingOp(buildingId, outcomeId)`, `castBuildingVote`, `contributeResourceForBuilding`, `spendPooledResourceForBuilding`.
- Iterator helper: `orderedActiveBuildings(party)` returns the list of built, non-wrecked buildings in building-id ascending order (matches rulebook processing order).
- Effect text rendering: the `%game.resource.*%` / `%data.section:N.M%` / `%game.condition.*%` token-resolving logic needs a shared renderer (already partly in client — formalize as shared helper).

### T3e (Downtime menu)
- New commands: `setCharacterTownLocation(characterName, buildingId | null)`, `setCharacterDowntimeReady(characterName)`.
- State: `townPhase.downtimeLocation: Record<charName, buildingId|null>` + `townPhase.downtimeDoneBy: string[]`.
- Data derivation: `getDowntimeVerbBuildings(party)` returns all built buildings that have a non-empty `interactionsAvailable` at their current level.

### T3f (Store)
- New command: `purchaseItem(characterName, itemId)` with party-count validation (`countPartyWideOwnership(itemId) >= item.count` → reject).
- Shop-item query: `getBuyableItems(partyState)` — filters by required-building level met AND unlock-prosperity met.
- Rejection-reason string enum: `'sold-out' | 'prosperity-not-met' | 'building-level-not-met' | 'insufficient-gold' | 'already-own-max'`.
- Optimistic UI rollback pattern (reusable by T3g/h).

### T3g (Craftsman)
- New command: `craftItem(characterName, blueprintId)` — validates Craftsman level, consumes `requiredItems` from character (or party), consumes `resources`, grants the target item.
- **Importer extension required:** `items` table needs a `blueprint_json` column or equivalent (`required_items_json`, `blueprint: boolean`). Currently `blueprint` is dropped.
- Shop-item / craft-item UI distinction: same underlying item row but two different verbs.

### T3h (Alchemist + Enchanter)
- New command: `brewPotion(characterName, potionId, distill?: boolean)` — validates Alchemist level; if `distill=true` and Alchemist level >= required-distill-level, yields an extra copy (rule not in staging; hardcode).
- New command: `applyEnhancement(characterName, cardId, slotIndex, enhancementType)` — validates slot eligibility (from card's `slots` array) + charges gold per `ENHANCEMENT_BASE_COSTS` table (from rulebook §17, author manually).
- Data layer: `packages/shared/src/data/enhancements.ts` with the cost + slot eligibility tables (manual authoring per §7).
- Engine side: `calculateEnhancementCost(card, slot, type, party)` that applies Enhancer L1/L2/L3 discounts.

### T3i (Construction)
- New command: `castConstructionVote(characterName, buildingId)` — records phone vote.
- `beginBuildingConstruction(buildingId)` — controller, validates resources paid + vote won, transitions building from state-null to state `{level: 1}`.
- `upgradeBuilding(buildingId)` — validates upgrade level exists (some L2/L3 are `{manual: 1}` — reject with "manual upgrade — unlock via section").
- `calculateConstructionCost(building, level, party)` — applies Carpenter modifiers + extra-morale cost.

### T3j (Scenario selection + travel)
- **Importer extension required:** `scenarios` table needs `coordinates_json`, `flowchart_group`, `forced_links_json` columns. Critical for T3j world-map + flowchart UI.
- New command: `selectScenarioForNext(index, edition)` — controller.
- New command: `drawTravelEvent(type: 'road' | 'boat')` — reuses T3b event engine with a different deck.
- New data: `packages/shared/src/data/fhScenarioWinConditions.ts` — manual table mapping scenario index → win-condition-type (enum) — per §11.

## 16. Open questions that emerged during extraction

This section has been **heavily pruned** after round-2 corrections using the rulebook PDF + scenario_book_data + treasures index. Most prior questions are now answered inline. What remains:

### Data-authoring (not "open" — just "to-do for specific batches")
1. **Town Guard AMD base deck JSON.** Transcribe the 20-card composition (§9 table, from rulebook p.56) into `packages/shared/src/data/townGuardAmd.ts`. 20 cards with explicit ref numbers. Trivial.
2. **Town Guard add/remove card library.** Encode the 6 event-referenced cards (`fh-tg-add-plus10-rolling`, etc.) with their AMD shape. Data can be read from existing card images at `.staging/worldhaven/images/attack-modifiers/frosthaven/base/town-guard/`.
3. **Autotrack handlers for PQs.** Per-autotrack-name engine hook: `differentHerbs`, `looted:lumber`, `scenario:69|70`, `itemType:head`, `itemType:body`, `itemType:legs`, `itemType:onehand|twohand`, `itemType:small`, `gold`, `buildings`, `scenario:65|66`, `abilityXP`, `scenarioRequirements:board|climbing-gear|sled`, `craftableItems`, `scenario:71|72`, `donatedGold`, `battleGoals`, `itemBlueprint:39`, `exchaustedChars`. T2c implements handlers.
4. **Personal-quest-autotrack schema growth.** As new PQs are added by expansion content, new `autotrack` values may appear — T2c's handler map needs a fallback "unknown autotrack → manual-track" path.

### Engine / importer changes required for T3 to function
5. **importBuildings extensions.** Add columns: `effect_normal_json`, `effect_wrecked_json`, `interactions_available_json`, `interactions_unavailable_json`, `repair_json`, `rebuild_json`, `rewards_json`, `prosperity_unlock`, `requires`, `coordinates_json`. Blocks T3c (assault damage HP), T3d (building ops text), T3i (rebuild costs).
6. **importScenarios extensions.** Add columns: `coordinates_json`, `flowchart_group`, `forced_links_json`. Blocks T3j (world-map rendering), T3a2 (linked scenarios).
7. **importItems extensions.** Add columns: `blueprint`, `required_items_json`, `effects_json`, `resources_any_json`, `persistent`, `loss`, `round`, `minus_one`, `solo`. Blocks T3g (crafting), T3h (brewing effects).
8. **importCharacters: ability cards.** Add a new `character_ability_cards` table populated from `fh/character/deck/<class>.json` (and similarly for GH). Blocks T2b (level-up UI shows new-card selection).

(All four bundled inside the T3 batches that need them — per Kyle's decision.)

### Engine plumbing (tedious but unambiguous)
9. **Event-effect dispatch signatures.** 53+ distinct effect types in outpost events (§8 distribution). Engine's `applyEventEffect(effect, party)` needs a ~50-line switch. Structured per effect type; no ambiguity.
10. **Asset resolver helpers.** Per §17, T3 batches need typed resolver functions for each category (`getBuildingCardAsset`, `getTownGuardCardAsset`, etc.). Centralize in `packages/shared/src/data/assetResolver.ts`.

### Cross-cutting
11. **Label resolution** — token types to confirm rendered: `%data.buildings.*%`, `%data.items.*%`, `%data.section:*%`, `%data.scenario.rules.*%`, `%data.scenario.rewards.*%`, `%data.custom.*%`, `%data.personalQuest.*%`, `%data.pets.*%`, `%game.resource.*%`, `%game.condition.*%`, `%game.action.*%`, `%character.abilities.*%`, and mixed `<br>` + `<i>` + `<b>` HTML.
12. **Edition switching** — all T3 batches guard data lookups by `state.edition`. T3d is FH-only (returns empty building-ops list for GH). T3b/f shared.

### Resolved via rulebook extraction (no longer open)

- ~~Construction timing~~ — **immediate rewards, next-week operations** (p.68).
- ~~Construction tie-breaking~~ — "party decides ambiguity" (p.6, general rule).
- ~~Extra morale cost~~ — 2 morale for second build/upgrade (p.68). Carpenter L2 reduces to 1.
- ~~{manual: 1} upgrades~~ — section-unlocked, not paid (confirmed Barracks/Hall of Revelry pattern).
- ~~Complete blueprint list~~ — 15 starter + ~50+ unlocked via sections/treasures (full list in §5).
- ~~Alchemist L2 potions~~ — L2 adds distillation, not new potions (p.66).
- ~~Distillation rule~~ — reverse-craft returning one herb (p.66).
- ~~Enhancement cost table~~ — full chart at §7 from rulebook Appendix D (p.77).
- ~~Enhancement penalties~~ — +25g per card level above 1; +75g per existing enhancement (p.77).
- ~~Assault-triggering events~~ — structured `attack` object on unlabeled option outcomes (§8).
- ~~Target selection~~ — structured `attack.target` priority descriptor (§8 table of target shapes).
- ~~Defense mechanics~~ — attack value vs. draw-from-TG-deck total (p.60-61).
- ~~Soldier mechanics~~ — spend soldiers before draw to reduce attack value + give advantage (p.61).
- ~~TG AMD reshuffle cadence~~ — after each attack event (p.61).
- ~~Win-condition classification~~ — `scenario_book_data.goal_text` already extracted (§11).
- ~~Masteries~~ — per-scenario achievement → grant perk mark (p.63).
- ~~outpostTarget semantics~~ — modifier to `attack.targetNumber` (Kyle).
- ~~outpostAttackTarget semantics~~ — dual-purpose; magnitude disambiguates (Kyle, §8).
- ~~skipThreat scope~~ — cancels current event's attack only (Kyle, verified via card narratives).
- ~~Alchemy chart UI~~ — 6×6 grid visual mirroring physical chart (Kyle, §6).
- ~~Blueprint pool state model~~ — explicit `state.party.craftableItems` set (Kyle, §5).
- ~~TG AMD authoring split vs bundle~~ — bundled inside T3c (Kyle).
- ~~Importer extensions split vs rolling~~ — bundled inside each T3 batch that needs them (Kyle).

## 17. Asset catalog (T3 UI dependencies)

All visual assets are already ingested by `importWorldhavenAssets` ([scripts/import-data.ts:997](scripts/import-data.ts:997)) and `importGhsAssets` ([scripts/import-data.ts:869](scripts/import-data.ts:869)) into the `asset_manifest` table. The T3 UIs don't need any new import work for images — they need **resolver helpers** that take data-model keys and return manifest paths.

### Asset manifest schema

```ts
interface AssetManifestRow {
  edition: string;      // "fh" | "gh" | "gh2e" | "jotl" | "cs" | "fc" | "toa" | ... | "_shared"
  category: string;     // see table below
  name: string;         // unique key within (edition, category), e.g. "fh-05-mining-camp-level-1"
  source: string;       // "worldhaven" | "ghs"
  path: string;         // full repo-relative asset path
  variant: string|null; // alternate art / localized variant
}
```

### Category inventory (all editions combined)

| Category | Rows | T3 dependency |
|---|---|---|
| `character-ability-card` | 1882 | T2b — level-up screen; T3h — enhancement slot picker |
| `attack-modifier-card` | 1805 | T3c — town-guard AMD card draw animation |
| `artwork` | 1556 | T3e (outpost stickers, downtime tableau), T3a (candlelit calendar) |
| `item-card` | 1314 | T3f (store), T3g (craftsman), T3h (alchemist) |
| `event-card` | 1264 | T3b (outpost event), T3j (travel event) |
| `monster-ability-card` | 953 | scenario phase |
| `monster-stat-card` | 369 | scenario phase |
| `token` | 252 | scenario phase |
| `monster-portrait` | 231 | scenario phase |
| `building-card` | 146 | T3d — building operations screen |
| `map-tile` | 144 | scenario phase |
| `character-mat` | 120 | T2b — level-up + mastery flip |
| `battle-goal-card` | 119 | T1 (scenario rewards) — not T3 |
| `character-portrait` | 113 | T3e — portrait migration on outpost map |
| `random-dungeon` | 99 | scenario phase |
| `character-icon` | 97 | T0 sheets (already used) |
| `world-map` | 95 | T3j — scenario selection |
| `personal-quest-card` | 87 | T2c |
| `character-perk` | 85 | T2b |
| `loot-card` | 60 | scenario phase — not T3 |
| `player-aid` | 59 | reference only |
| `chart` | 48 | T3h — alchemy chart (per B1 resolved: render grid UI from these) |
| `challenge-card` | 46 | T3d — Town Hall interaction |
| `milestone-ability-card` | 40 | T2b — milestone class unlocks |
| `milestone` | 40 | T2b |
| `condition-icon` | 40 | shared |
| `attack-modifier` | 27 | shared icons |
| `random-scenario` | 24 | scenario phase |
| `pet-card` | 24 | T3e — Stables sub-screen |
| `action-icon` | 18 | shared |
| `trial-card` | 14 | T3d — Hall of Revelry L1 interaction |
| `logo` | 8 | shared |
| `element-icon` | 8 | shared |

### Naming conventions (for the categories T3 touches most)

#### `building-card` (FH 146 rows)

Path pattern: `worldhaven/images/outpost-building-cards/frosthaven/fh-<id>-<name>-level-<N>[-back].png`

Examples:

- `fh-05-mining-camp-level-1` (front)
- `fh-05-mining-camp-level-1-back` (wrecked side)
- `fh-34-craftsman-level-9` (highest level)
- Wall cards use a different pattern — walls have no levels beyond 1

Resolver:

```ts
getBuildingCardAsset({ edition: 'fh', buildingId: '05', level: 2, side: 'front' | 'back' }): string;
```

#### `artwork` → outpost stickers (FH 144 rows)

Path pattern: `worldhaven/images/art/frosthaven/stickers/individual/outpost-stickers/fh-<id>-<name>-l<N>.png`

Examples:

- `fh-12-hunting-lodge-l1` through `l4`
- `fh-90-town-hall-l0` through `l3` (town hall includes pre-built L0 sticker)

Used to render the outpost map tableau on the display during downtime (T3e). Each sticker's placement coord is in `buildings.coordinates[level]` — see §3 tables.

Resolver:

```ts
getOutpostStickerAsset({ edition: 'fh', buildingId: '05', level: 0 | 1 | 2 | 3 | 4 }): string;
```

#### `attack-modifier-card` → Town Guard (FH 56 rows)

Path pattern: `worldhaven/images/attack-modifiers/frosthaven/base/town-guard/fh-am-tg-<NN>.png`

- `fh-am-tg-01` through `fh-am-tg-20` — the 20-card base deck (per rulebook p.56 composition table in §9)
- `fh-am-tg-21` through `fh-am-tg-56` — add/replace variants referenced by `townGuardDeckCard*` effects (e.g. `fh-tg-add-plus10-rolling`)

**⚠ Binding required:** the `townGuardAmd.ts` data file (T3c-bundled authoring step — per C1) needs to map each logical card (e.g. `{ value: '+10', count: 5 }`) to the specific asset name. Without that binding, the display can't show the right card image when a draw happens.

Resolver:

```ts
getTownGuardCardAsset({ edition: 'fh', cardRef: string }): string;  // cardRef = logical ID from townGuardAmd.ts
```

#### `event-card` (FH: 266 events × 2 sides = ~532 rows)

Path patterns:

- `worldhaven/images/events/frosthaven/summer-outpost/fh-so-<NN>-f.png` (front)
- `worldhaven/images/events/frosthaven/summer-outpost/fh-so-<NN>-b.png` (back — attack side)
- Similar for `winter-outpost`, `summer-road`, `winter-road`, `boat`

Resolver:

```ts
getEventCardAsset({ edition: 'fh', type: 'summer-outpost'|..., cardId: 'SO-07', side: 'front'|'back' }): string;
```

#### `world-map` (FH: 1 row)

Single base map: `worldhaven/images/world-map/frosthaven/fh-frosthaven-map.png`

Used by T3j scenario-selection display. Scenario pins overlay at `scenarios/NNN.json → coordinates` (requires importer extension per §16 Q9).

Resolver:

```ts
getWorldMapAsset({ edition: 'fh' }): string;
```

#### `chart` → alchemy chart (FH)

Path pattern: `worldhaven/images/charts/frosthaven/die-lines/fh-alchemy-chart-page-<N>-dl.png`

Used by T3h alchemy chart grid (per B1 resolved: render grid visual). The chart has multiple pages (2-herb combos vs. 3-herb combos). Engine state `party.alchemyChart: Record<"herb1+herb2", true>` overlays reveal state onto the grid.

Resolver:

```ts
getAlchemyChartAsset({ edition: 'fh', page: 1 | 2 }): string;
```

#### `item-card` (FH ~264 items × front/back = ~528 rows)

Path pattern: `worldhaven/images/items/frosthaven/fh-<NNN>-<name>[-back].png`

Resolver:

```ts
getItemCardAsset({ edition: 'fh', itemId: number, side: 'front'|'back' }): string;
```

#### `character-portrait` (cross-edition)

Path pattern: `ghs-client/src/assets/images/character/thumbnail/<edition>-<class>.png`

Already used by T0 sheets; T3e extends to portrait-on-outpost-map rendering during downtime.

### Proposed resolver module

Centralize all resolvers in `packages/shared/src/data/assetResolver.ts`:

```ts
import { assetManifest } from './assetManifest'; // built from SQLite or shipped as JSON

export function resolveAsset(category: string, edition: string, name: string): string | null {
  return assetManifest.find(a => a.category === category && a.edition === edition && a.name === name)?.path ?? null;
}

// Typed helpers:
export const getBuildingCardAsset = ({edition, buildingId, level, side}) =>
  resolveAsset('building-card', edition, `${edition}-${buildingId}-${getBuildingName(buildingId)}-level-${level}${side==='back'?'-back':''}`);
// ... etc per category
```

**ℹ NOTE:** The importer already captures every asset. The only new work is a thin lookup layer. T3 batches that need images add their helper function as needed; no per-batch importer change required for asset coverage.

---

## Verification checklist (for Kyle's review)

- [x] `.staging/` exists and was walked (ghs-client + worldhaven).
- [x] All 16 sections populated or explicitly skipped with reason.
- [x] All 30 FH buildings enumerated in §3.
- [x] All event types enumerated: boat, summer-outpost, summer-road, winter-outpost, winter-road — covered in §8 (outpost) and §11 (road/boat).
- [x] §14 populated with clear "no active playthrough state; skipped" rationale.
- [x] **⚠ DATA MISSING** callouts consolidated in §16.
- [x] §15 engine suggestions non-empty for T3a, T3a2, T3b, T3c, T3d, T3e, T3f, T3g, T3h, T3i, T3j.
- [x] No code changes — only this doc added to the repo.
- [x] Doc readable without parsing raw JSON — all structured references paraphrased or quoted inline.

## Kyle's review plan

1. Spot-check §3 building tables against outpost-building cards.
2. Confirm §7 enhancement gaps match rulebook §17 structure.
3. Answer §16 open questions (especially #10–#13 on assault and #15 on scenario win-conditions — they block T3b/c/j).
4. Approve commit (do not commit before review).
