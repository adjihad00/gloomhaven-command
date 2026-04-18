# Phase T3 Scope — Town Phase Interactions (v2)

> **Status:** Design doc, revised from v1.
> **Baseline:** T0d + dev-sandbox complete. T2 paused pending this doc.
> **Revises:** [phase-t3-scope-doc v1](./phase-t3-scope-doc-v1.md) after
> Kyle's ten-part review. Open questions all resolved; scope expanded
> with T3-prep research batch, dedicated linked-scenarios batch, and
> outpost assault batch.
> **Supersedes:** portions of the pre-T0 T2a draft that nested shop UX
> inside Player Sheet.

## Why this phase

T0 closed with three canonical sheets (Player / Party / Campaign) as the
campaign's record-keeping surfaces. During active play the **controller**
drives the game and the **display** shows the tableau. But the **phone**
currently has no real home for player interaction during town phase — its
`TownView` is a 49-line waiting card.

That gap pushed the pre-T0 T2a to bolt shopping, crafting, and brewing into
Player Sheet tabs. Wrong home. Player Sheet is a **ledger** — what the
character owns and has become. Town-phase interactions are **verbs**
happening at buildings and during specific rulebook steps. They belong in
a dedicated phone surface that mirrors town phase's step structure, a
controller that drives it, and a **display** that pulls players into the
phase visually rather than leaving them passive observers while the GM
checks boxes.

That last point is the highest-leverage redesign of v2: Kyle's strongest
gripe with outpost phase is that it disengages the players. Every T3 batch
is therefore **display-heavy** — the display earns its pixels every step.

---

## Governing principles

1. **Sheets are ledgers. Phone screens are verbs.**
   Player Sheet records what you own, your progress, your story. Phone
   mode-aware screens are where you *do things*. Crossing that line (putting
   purchase flows on Player Sheet) was the mistake this phase exists to
   correct.

2. **Controller drives the step machine. Phones react. Display pulls the
   players in.**
   Town phase is a linear 5-step process (FH) or 3-step (GH). Controller
   advances steps. Phones render whichever step matches. **Display is the
   central focal point for the table** — candlelit calendar, outpost
   tableau, assault animations, portraits moving between buildings during
   downtime, portraits returning to the town gate when done.

3. **Auto-advance when ready, with controller override.**
   When the current step's completion criteria are met (all characters
   voted, all characters completed downtime, etc.), the machine advances
   automatically. Controller retains a GM-force-advance button for cases
   where a player walked away.

4. **Simultaneous downtime with authoritative validation.**
   All players can interact with downtime buildings at once. Shared
   inventories (shop stock, limited crafting resources) enforce via
   engine-side validation: the first command to arrive wins; losing
   phones receive an optimistic-update rollback with an explanatory
   toast. This is the single hardest engineering requirement in T3 and
   is called out in its own section below.

5. **Player Sheet is reachable but not required.**
   The portrait-button on every phone mode continues to open Player Sheet.
   Player Sheet receives state updates (new items, progress, history) but
   doesn't initiate town-phase verbs.

6. **FH is canonical. GH derives by omission.** (Q4 resolved — option b.)
   GH's 3-step town phase maps onto FH's step machine minus the
   FH-specific steps. GH's "Character Management" becomes a downtime step
   with Store + Enchanter + Sanctuary as the only sub-screens. No separate
   GH-exclusive UI code path.

---

## Answers to v1 open questions (all ten)

1. **Downtime is simultaneous** with live shared-inventory reactivity. See
   [Simultaneous Downtime Correctness](#simultaneous-downtime-correctness)
   below.
2. **Auto-advance on criteria met** with controller GM-force-advance.
3. **`abortTownPhase` added** as a companion to existing `abortScenario`.
   **Linked scenarios** get their own batch (T3a2).
4. **GH uses FH structure** via downtime-with-subset-sub-screens.
5. **Scenario selection + travel phase = T3j.** Dedicated final-town
   batch. Display: world map with available scenarios, zoom-to-scenario
   on select. Controller: flowchart + synopsis card overlay (description,
   win condition type, complexity, map region). Phone: waiting card.
6. **Display is richly involved throughout.** Candlelit calendar,
   outpost art during passage of time; event card large; assault with
   building damage visuals and Town Guard AMD; downtime with portraits
   moving between buildings; portraits migrating to the town gate when
   each player finishes.
7. **Enhancement application is immediate** at Enchanter (RAW, simpler UX).
8. **Resource contribution is either/or.** Per-player contribute buttons
   for personal resources, plus controller pay-with-pooled-resources
   button. Engine supports both paths via separate commands.
9. **T3-prep is a dedicated pre-implementation batch** producing
   `docs/FH_OUTPOST_REFERENCE.md`. No code changes. Source of truth for
   every subsequent T3 batch.
10. **Outpost assault is its own batch (T3c)**, sits between event
    (T3b) and building operations (T3d). Engine-heavy, display-heavy.

---

## Architecture

### Town phase state machine

New field `state.party.townPhase?: TownPhaseState` — optional so pre-T3
saves and in-scenario state don't need it.

```ts
export type TownStepId =
  | 'passage-of-time'
  | 'outpost-event'           // includes assault sub-state
  | 'building-operations'     // FH only
  | 'downtime'
  | 'construction'            // FH only
  | 'scenario-selection';     // always last, includes travel

export interface TownPhaseState {
  /** Current step. Undefined = between steps (settling animation). */
  step?: TownStepId;
  /** Step-specific sub-state. */
  subState?: TownSubState;
  /** Characters who've completed the current step. */
  completedBy?: string[];
  /** Building operations: currently processed building. */
  activeBuildingId?: string;
  /** Simultaneous downtime: per-character active building (or null if
   *  idle / at the downtime menu / at town gate). */
  downtimeLocation?: Record<string, string | null>; // charId → buildingId|null
  /** Characters who've indicated "I'm done with downtime" (→ town gate). */
  downtimeDoneBy?: string[];
  /** Assault in progress (see T3c for full shape). */
  assault?: AssaultState;
}

export type TownSubState =
  | { kind: 'event-drawn'; eventCardId: string }
  | { kind: 'event-voting'; eventCardId: string; votesByCharacter: Record<string, string> }
  | { kind: 'event-resolved'; eventCardId: string; resolution: string }
  | { kind: 'event-triggers-assault'; eventCardId: string }   // transitions into assault
  | { kind: 'building-op-active'; buildingId: string; interactionsByCharacter: Record<string, unknown> }
  | { kind: 'downtime-active' }
  | { kind: 'construction-voting'; preferencesByCharacter: Record<string, string> }
  | { kind: 'scenario-selection-active' }
  | { kind: 'travel-event-active'; cardId: string; votesByCharacter: Record<string, string> };
```

This is the **v2 sketch.** T3a locks exact shapes — some fields may move
or restructure once handlers go in.

### Command surfaces (preliminary)

Transitions:
- `advanceTownStep` (controller + auto-fired by engine when criteria met)
- `selectTownStep(step)` (controller override — GM jump)
- `forceAdvanceTownStep` (controller GM-force — criteria bypassed)
- `completeTownPhaseStepFor(characterName)` (phone — per-player step completion signal)
- `abortTownPhase` (controller — discards current town phase, returns to lobby)

Linked scenarios (T3a2):
- `completeScenario` payload gets an optional `linkedNextScenario?: { index, edition }` — engine skips town-phase on victory when present.

Event:
- `drawEventCard(type: 'outpost' | 'city' | 'road' | 'boat')` (controller)
- `castEventVote(characterName, optionId)` (phone)
- `resolveEvent(resolutionId)` (controller)

Assault (T3c):
- `startAssault(assaultData)` (controller, triggered by event resolution)
- `drawTownGuardCard` (controller)
- `applyAssaultDamage(buildingId, amount)` (controller)
- `spendSoldier(amount)` (controller — party pooled)
- `spendDefense(amount)` (controller — party pooled)
- `endAssault(outcome)` (controller)

Building ops (T3d):
- `startBuildingOp(buildingId)` (controller)
- `castBuildingVote(characterName, optionId)` (phone)
- `applyBuildingOp(buildingId, outcomeId)` (controller)
- `contributeResourceForBuilding(characterName, resource, amount, buildingId)` (phone, personal pay)
- `spendPooledResourceForBuilding(resource, amount, buildingId)` (controller, party pool pay)

Downtime (T3e-h):
- `setCharacterTownLocation(characterName, buildingId | null)` (phone — tracks which building the portrait is at)
- `setCharacterDowntimeReady(characterName)` (phone — portrait moves to town gate)
- `purchaseItem` (phone, Store sub-screen)
- `craftItem` (phone, Craftsman)
- `brewPotion` (phone, Alchemist)
- `applyEnhancement` (phone, Enchanter — immediate application)
- `donateToSanctuary(amount)` (phone, GH Sanctuary)

Construction (T3i):
- `castConstructionVote(characterName, buildingId)` (phone)
- `beginBuildingConstruction(buildingId)` (controller — after votes + resources)
- `upgradeBuilding(buildingId)` (controller)
- `gmOverrideConstruction(buildingId)` (controller — resolve tied votes)

Scenario selection + travel (T3j):
- `selectScenarioForNext(index, edition)` (controller, possibly phone-polled via votes)
- `drawTravelEvent(type: 'road' | 'boat')` (controller, after scenario selected)
- `resolveTravelEvent(resolutionId)` (controller)

**This is a v2 preliminary list.** Final command signatures land in their
respective batches. Not every listed command ships in every batch — some
are stubs that T4/T5/T8 refine.

### Simultaneous Downtime Correctness

Kyle's Q1 concern: two phones both see the last pair of boots in the shop,
both tap Buy. Only one can win.

**Architecture:**

1. **Engine is authoritative.** Every purchase/craft/brew command passes
   through `validateCommand` → `applyCommand`, both running on the server.
2. **Party-count check is a validation predicate.** On `purchaseItem`:
   `countPartyWideOwnership(itemId) >= unlockedItems[i].count` → reject.
3. **Winning command broadcasts updated state via the existing diff
   mechanism** (WsHub already does this). All phones re-render with the
   new count.
4. **Losing phone's optimistic UI rolls back.** The client command sender
   should track whether a command was accepted or rejected (existing
   `useCommands` returns success/failure). On rejection, the phone shows
   a toast: "Another player bought that first — your gold is intact."
   The shop row updates to hide the item (now unavailable).

**Implementation notes for the T3f (Store) batch:**

- `purchaseItem`, `craftItem`, `brewPotion` all reject on stock
  exhaustion with a reason string. The phone UI surfaces the reason as
  a toast.
- Optimistic UI for shop: tapping Buy immediately shows "pending"
  state + disables the button. On accept: Inventory tab (Player Sheet)
  updates via broadcast + toast "Purchased." On reject: button re-enables
  with red flash + toast with rejection reason.
- Race window: typical command round-trip is <100ms. Races are rare but
  real. The architecture handles them correctly; UI makes the handling
  visible.

This is a cross-cutting concern — T3f/g/h each need to implement the
pattern. T3f establishes it; T3g/h follow the same pattern.

### Phone routing (revised)

Phone's `TownView` becomes a step router. New file layout:

```
app/phone/town/
├── TownView.tsx                  — router, reads state.party.townPhase.step
├── screens/
│   ├── PassageOfTimeScreen.tsx   — T3a (placeholder) → T3b2 (content)
│   ├── OutpostEventScreen.tsx    — T3b
│   ├── AssaultScreen.tsx         — T3c
│   ├── BuildingOpsScreen.tsx     — T3d
│   ├── DowntimeMenuScreen.tsx    — T3e
│   ├── ConstructionScreen.tsx    — T3i
│   └── ScenarioSelectionScreen.tsx — T3j
├── building/
│   ├── StoreScreen.tsx           — T3f
│   ├── CraftsmanScreen.tsx       — T3g
│   ├── AlchemistScreen.tsx       — T3h
│   └── EnchanterScreen.tsx       — T3h
```

### Controller side (revised)

`TownView.tsx` rewrites from 90-line static checklist to a **step
controller** with per-step screens:
- Step advancement (auto + manual force).
- Readiness indicators (who's voted, who's at which building, who's done).
- GM overrides (pick resolution, pay from pool, force-advance, abort).

### Display side (revised)

Idle Party↔Campaign rotation pauses when `townPhase?.step` is set.
Display renders a step-specific tableau:

- **Passage of time:** candlelit calendar ticking forward. Ambient
  outpost-at-dusk art. Seasons shifting.
- **Outpost event:** event card large and centered. Vote tallies animate
  in as phones cast. Resolution narrative fades in.
- **Assault:** outpost map with each building visualized. Damage flashes
  when `applyAssaultDamage` fires. Town Guard AMD card draws animate.
  Soldier/defense counter pills prominent. Assault resolution card at end.
- **Building ops:** current building zoomed/focused. Building card front
  + abilities legend. Active voting overlay.
- **Downtime:** outpost town map. Character portraits *at their current
  building* via `downtimeLocation`. Portraits migrate to town gate when
  player completes downtime.
- **Construction:** building cards with "next" indicator, vote tallies,
  resource costs.
- **Scenario selection:** world map, scenario pins, hover/selected
  scenario zooms + synopsis card overlay.
- **Travel event:** travel event card + vote tallies.

**Display investment is high throughout.** This is not negotiable per
Kyle's Q6 answer; it's the core redesign goal. Every batch's display
half is roughly equal in effort to its controller + phone halves
combined.

---

## Batch plan (revised)

11 main T3 batches, plus 3 Player Sheet retrofits that can land in
parallel, plus 1 linked-scenarios mini-batch. Sequenced to respect
dependencies.

### T3-prep — Outpost reference extraction (research batch)

**Scope:** zero code changes. Claude Code walks `.staging/editions/fh/`
files + campaign-data + label tables + rulebook prose. Produces
`docs/FH_OUTPOST_REFERENCE.md` (possibly with a companion
`docs/FH_OUTPOST_DATA.json` for structured data).

**Contents of the output doc:**
- **All FH buildings** — id, name, starting state, construction cost
  (resources + gold), upgrade path (levels 1→3 or 1→4, costs per upgrade).
- **Per-building abilities** — for each level of each building, the
  player-facing operations and GM-facing effects. Uses rulebook text
  where available; structured data from `.staging` where present.
- **Downtime-accessible buildings** — which buildings expose verbs during
  downtime (Store, Craftsman, Alchemist, Enchanter, Sanctuary,
  Stables?, Pet Shop?, etc.). Enumerate them all.
- **Level-up requirements per class level** — XP thresholds (these are
  also in `packages/shared/src/data/levelCalculation.ts` — cross-check).
  Abilities/perks/masteries granted at each level.
- **Outpost event deck** — structure, typical card shapes, whether the
  staging data has structured options/resolutions or just narrative text.
- **Outpost assault** — full rulebook procedure, Town Guard AMD structure,
  damage application rules, soldier/defense mechanics, assault event card
  type, win/loss conditions.
- **Crafting recipes** — resource → item mapping, Craftsman level gating.
- **Brewing recipes** — resource → potion, Alchemist level gating.
- **Enhancement costs** — per ability-card slot, per enhancement type.
  Enchanter level gating.
- **GH city event deck** — parallel to outpost events.
- **Road + boat event deck** — for travel phase.

**Deliverable:** a committed Markdown doc (and possibly JSON) that is
the single source of truth referenced by every T3a-j prompt. Kyle
reviews + approves before T3a starts. If Claude Code can't find specific
data (e.g., a building Kyle hasn't unlocked), the doc flags it as "data
not available in staging; will need rulebook extraction at T3{letter}."

**Important:** this batch is **code-free.** Any temptation to "just add
a helper while we're here" is deferred. This is a research output, not
a code output.

### T2a revised — Player Sheet Items tab (small)

**Scope (trimmed from pre-T0 T2a):**
- Display owned items (equipped + inventory), grouped by slot.
- `equipItem` / `unequipItem` engine commands + UI.
- `sellItem` as one-tap value→gold housekeeping (Q1).
- Store breadcrumb visible only when `townPhase.step === 'downtime'` AND
  the player's current `downtimeLocation` matches a Store-building id.
  (Q2 — context-sensitive.)

**Out of scope (moved to T3f):** purchasing.

**Dependencies:** can land before or after T3-prep; doesn't depend on
town-phase machinery. Simplest to land after T3-prep so sell pricing
cross-references confirmed rulebook data, but fine to parallelize if Kyle
wants a quick win.

### T2b — Player Sheet Progression tab

**Scope:** level-up flow + perk application + mastery unlock + applying
previously-purchased enhancements to ability-card slots.

**Engine:** `applyLevelUp`, `applyPerk`, `applyMastery`, `applyEnhancement`
(this one is applied-to-slot, not buy-enhancement — that's T3h).

**History hooks:** per T0d plan, this batch adds the first
non-scenario `HistoryEntry` variants: `levelUp`, `perkApplied`,
`masteryUnlocked`. Hooks added at each trigger site via `logHistoryEvent`.

**Dependencies:** can run in parallel with T3 batches. Recommend after
T3-prep to confirm per-class level-up data is accurate.

### T2c — Player Sheet Personal Quest + Retirement

**Scope:** personal quest tracking + retirement fulfillment.

**Engine:** `setPersonalQuest`, `updatePersonalQuestProgress`,
`retireCharacter`.

**History hooks:** `personalQuestFulfilled`, `characterRetired`,
`characterCreated` variants.

**Dependencies:** independent. Can land anywhere in the T2/T3 sequence.

### T3a — Town phase state machine + step routing shells

**Scope:** the architecture in all three clients. No step content yet —
every step screen is a placeholder.

**Deliverables:**
- `TownPhaseState` + `TownSubState` types on `state.party`.
- Engine commands: `advanceTownStep`, `selectTownStep`,
  `forceAdvanceTownStep`, `completeTownPhaseStepFor`, `abortTownPhase`.
- Auto-advance mechanism: engine checks completion criteria after every
  state diff that might satisfy them; auto-fires `advanceTownStep` when
  met. Controller's force-advance bypasses criteria.
- Phone `TownView` rewrite — step router + placeholder screens.
- Controller `TownView` rewrite — step controller + placeholder UI.
- Display idle-rotation pause logic; step-specific placeholder tableau.
- `completeScenario` defaulting to set `townPhase.step = 'passage-of-time'`
  (FH) or `= 'city-event'` (GH).
- `completeTownPhase` handler unsets `townPhase` entirely.

**Why now:** every other T3 batch depends on this existing.

### T3a2 — Linked scenarios

**Scope:** optional `linkedNextScenario` on `completeScenario` payload.
On victory with a linked next scenario, engine:
- Skips town phase entirely.
- Starts the next scenario via internal `startScenario` call.
- Still logs a History entry for the linked scenario completion.
- Still records the scenario in `party.scenarios`.

**UI:** Controller scenario-end flow needs a "linked: → Scenario N" path.
Display rewards overlay still fires (players see their gains) but
dismisses into the linked scenario's intro rather than town phase.

**Small batch.** Engine-level. Isolated.

**Why between T3a and T3b:** `townPhase` machinery now exists, linked
scenarios need to *bypass* it cleanly. Landing linked before the T3
content batches means every subsequent batch's "what happens after
scenario" assumption is correct.

### T3b — Outpost event / City event (draw, vote, resolve)

**Scope:** full implementation of the event step. Shared between FH and
GH.

**Engine:**
- Event card data shape verification (depends on T3-prep output).
- `drawEventCard`, `castEventVote`, `resolveEvent`.
- Engine tracks drawn + resolved events on `state.party.eventCards`.
- Resolution detects `event-triggers-assault` sub-state and transitions
  into T3c's assault flow (stubbed in T3b; implemented in T3c).

**UI:**
- Phone `OutpostEventScreen` — event card text, vote options, own-vote
  indicator.
- Controller — draws card, sees live tally, picks resolution (or auto-
  applies majority).
- Display — event card large, vote tallies animate.

### T3c — Outpost assault

**Scope:** the mini-engine inside certain event resolutions.

**Engine:**
- `AssaultState` shape on `townPhase`: per-building damage tracking,
  current round, active Town Guard card.
- `startAssault`, `drawTownGuardCard`, `applyAssaultDamage`,
  `spendSoldier`, `spendDefense`, `endAssault(outcome)`.
- Town Guard attack modifier deck — sourced from ref DB (already
  imported as `attack-modifier-card` category, but verify via T3-prep).
  Separate from scenario AMD; reshuffled per assault.
- Damage application: which buildings take hits depends on assault card
  — T3-prep confirms.

**UI:**
- Phone `AssaultScreen` — player-facing info: party pool (soldiers,
  defense), spend buttons (contribute from pool? rules-dependent),
  current threat level.
- Controller — draws Town Guard cards, applies damage, manages pool.
- Display — **the showpiece.** Outpost map with all buildings visible;
  each building with damage indicator; Town Guard AMD animated draw; red
  flash on damage; soldier/defense counters prominent. This is where the
  display investment pays off most.

### T3d — Building operations (FH only)

**Scope:** step 3 of FH town phase. Each active building in initiative
order gets processed; the building's "operation" (from T3-prep data) is
applied; any player-facing interactions surface on phone.

**Engine:**
- `startBuildingOp`, `applyBuildingOp`, `castBuildingVote`.
- `contributeResourceForBuilding` (phone, personal pay — Q8).
- `spendPooledResourceForBuilding` (controller, pool pay — Q8).
- Per-building-ability table sourced from T3-prep.

**UI:**
- Phone `BuildingOpsScreen` — current building, player's available
  contributions + vote options.
- Controller — advances building-by-building, picks outcomes, manages
  pool spend.
- Display — zoomed/focused building card + live state.

**Complexity:** high. Depends heavily on T3-prep enumeration of building
abilities per level.

### T3e — Downtime menu skeleton

**Scope:** phone's downtime hub + `downtimeLocation` tracking +
`setCharacterDowntimeReady` + display integration.

**Deliverables:**
- Phone `DowntimeMenuScreen` — list of available buildings.
- Routing: tap Store → `StoreScreen` placeholder. Tap Craftsman →
  `CraftsmanScreen` placeholder. Etc.
- `setCharacterTownLocation(characterName, buildingId | null)` fires when
  player taps a building; `null` on return to menu.
- "I'm done with downtime" button → `setCharacterDowntimeReady` →
  portrait migrates to town gate.
- Display renders the outpost map with portraits positioned per
  `downtimeLocation`. Portrait moves animated (not teleport).
- Auto-advance to construction step when all non-absent characters have
  `setCharacterDowntimeReady`.

**This is the first batch that makes the display feel alive** — portraits
at buildings is the kind of table-wide UX nothing else achieves.

### T3f — Store (shopping) + simultaneous-inventory correctness

**Scope:** the Store sub-screen under downtime. Retargets the pre-T0 T2a
shop implementation.

**Engine:** `purchaseItem` with strict validation + party-count check.

**UI:**
- Phone `StoreScreen` — shop list, prosperity filter, required-building
  filter, reputation-price modifier live, Buy action.
- Optimistic UI + rollback pattern (from Simultaneous Downtime
  Correctness section).
- Controller — read-only shop view (can see what's available,
  who's buying what).
- Display — focused Store building on the outpost map; showing active
  buyers.

**Cross-batch impact:** establishes the optimistic-rollback pattern for
T3g/h.

### T3g — Craftsman (FH crafting)

**Scope:** crafting at the Craftsman building.

**Engine:** `craftItem` — validates Craftsman level + resource costs +
party-count (if crafted items have unique count cap).

**UI:**
- Phone `CraftsmanScreen` — browse craftable items (filtered by
  Craftsman level), see cost, craft action.
- Display — focused Craftsman with active crafters.

**Data dependency:** T3-prep must have surfaced complete crafting recipes.

### T3h — Alchemist + Enchanter (brewing + enhancing)

**Scope:** two buildings in one batch (tightly related — both are
consumables-adjacent).

**Engine:**
- `brewPotion` — Alchemist.
- `applyEnhancement` — Enchanter. Immediate application to an
  ability-card slot (Q7 — RAW). Phone shows ability-card slot picker
  inline.

**UI:**
- Phone `AlchemistScreen` — potions, cost, brew action.
- Phone `EnchanterScreen` — enhancements, cost, ability-card slot
  picker, immediate apply.
- Display — focused building per active player.

**May split** into T3h1 / T3h2 if one proves meatier than expected.

### T3i — Construction

**Scope:** step 5 of FH town phase.

**Engine:**
- `castConstructionVote` (phone).
- `beginBuildingConstruction` (controller — after votes + resources
  paid).
- `upgradeBuilding` (controller — if party votes for an upgrade instead
  of new construction).
- `gmOverrideConstruction` (controller — tie-break).

**UI:**
- Phone `ConstructionScreen` — vote options, resources preview.
- Controller — vote tallies, resolve + apply.
- Display — outpost map with "under construction" building highlighted +
  cost preview.

### T3j — Scenario selection + travel phase (absorbs old T5)

**Scope:** the final town-phase step + travel. Kyle's Q5 vision
implemented fully.

**Engine:**
- `selectScenarioForNext(index, edition)` — controller action.
- `drawTravelEvent(type: 'road' | 'boat')` — controller.
- `resolveTravelEvent(resolutionId)` — controller.
- Travel event votes may or may not be phone-driven per rulebook check —
  T3-prep clarifies.

**UI:**
- **Display:** world map with all available scenarios as pins; scenario
  hover/select zooms into the region; synopsis card overlay with win
  condition type, complexity, map region art. (Synopsis data dependency
  — some scenarios need rulebook extraction.)
- **Controller:** scenario flowchart (tree/graph of available scenarios
  + their lock/unlock state) with tap-to-select; synopsis card on
  select; confirm button.
- **Phone:** waiting card with "Selecting next scenario..." + your
  character portrait + step indicator.
- After selection: travel event step. Event card on display + phone
  vote + controller resolve.
- `completeTownPhase` fires after travel event resolution, launching
  `startScenario` for the selected scenario.

**Note:** linked-scenarios (T3a2) skip this step entirely — goes from
scenario → scenario directly. T3j only runs for un-linked completions.

---

## Reference data additions

Most of these enumerated / confirmed by T3-prep:
- **Event cards** — verify shape in staging.
- **Building abilities per level** — new structured data layer.
- **Crafting recipes** — new.
- **Brewing recipes** — new.
- **Enhancement table** — new.
- **Town Guard AMD** — verify in ref DB.
- **Scenario synopsis metadata** (win condition type, complexity, map
  region) — some in staging; some need extraction.

---

## Player Sheet impact

T0's sheets are mostly unchanged. Small retrofits:

- **Items tab** (T2a revised) — equip / unequip / sell + context-sensitive
  Store breadcrumb.
- **Progression tab** (T2b) — full implementation.
- **Personal Quest tab** (T2c) — full implementation.
- **History tab** (T0d already shipped) — T2b + T2c add variants via
  the extension pattern T0d set up.

Party Sheet and Campaign Sheet are **reactive** to T3 events but not
rewritten. Campaign Sheet Outpost tab (T0c) automatically reflects
building state changes as they happen.

---

## Sequencing summary

```
T3-prep                      (research, no code)
├── T2a revised              (small Player Sheet retrofit, parallel-able)
├── T2b Progression          (parallel-able)
├── T2c PQ + Retirement      (parallel-able)
│
├── T3a State machine        (blocking for all T3b+)
├── T3a2 Linked scenarios    (small, independent)
├── T3b Event                (→ T3c)
├── T3c Assault              (→ T3d)
├── T3d Building ops         (→ T3e)
├── T3e Downtime menu        (→ T3f/g/h)
├── T3f Store                (establishes optimistic pattern)
├── T3g Craftsman
├── T3h Alchemist + Enchanter
├── T3i Construction         (→ T3j)
└── T3j Scenario selection + travel
```

12 main batches (11 T3 + 1 linked-scenarios mini) + 3 parallel Player
Sheet retrofits + T3-prep research batch. Realistically spans many
sessions. Each batch is small and focused, which is the point — the
phase's size is the cost of getting town phase right.

## Open sub-questions (emerging from v1 answers)

Smaller items that can be punted to their specific batches but logged
here so nothing is lost:

- **Q3-follow-up (linked-scenario UI):** do linked scenarios also skip
  the scenario rewards screen (T1)? Or show rewards, wait for dismiss,
  then linked-start? Probably the latter — rewards are character-
  facing and shouldn't be suppressed. Confirm during T3a2.
- **Q6-follow-up:** during passage of time, what's the actual display
  animation duration? Short enough to not drag (5-10s?), long enough to
  feel present. Tuning at T3b2 or dedicated polish batch.
- **Q8-follow-up:** some building ops allow *multiple* characters to
  contribute to a single payment. Does the engine batch contributions,
  or fire one command per contributor? Probably the latter; engine
  accumulates. Lock at T3d.
- **Q10-follow-up:** does the Town Guard AMD get reshuffled between
  assaults, or persist across assaults in the same campaign? Rulebook
  check needed; T3-prep should capture.
- **T3-prep meta:** should the extracted reference doc also identify
  which FH buildings Kyle has already unlocked (via current state), so
  T3c/d can prioritize the ones that will be exercised immediately? Yes
  — small addition to the prep batch output.

---

## What this doc is NOT

- A code prompt. No `npm run dev:sandbox` instruction, no file-level
  edit scopes. T3-prep and T3a-j are written as Claude Code prompts
  after this doc is accepted.
- Final. Changes fine until T3-prep ships. T3a-j sub-batches may get
  refinements when T3-prep reveals details that adjust scope.
- A rulebook summary. Assumes rules knowledge; describes the app-rule
  mapping.

---

## Next steps

1. Kyle reviews this v2 doc. Surfaces anything still wrong or missing.
2. Doc lands in repo as `docs/PHASE_T3_SCOPE.md`.
3. **T3-prep prompt written and pasted.** Output: committed
   `docs/FH_OUTPOST_REFERENCE.md`. Kyle reviews + approves.
4. Pick one of T2a-revised / T2b / T2c / T3a and start the code
   sequence.

The v1 doc's "~8-10 batches" estimate is superseded. Realistic: ~15
batches for T3 + T2 combined, with T3-prep as the critical front-loaded
research that keeps every subsequent batch honest.
