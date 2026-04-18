# Phase T3-prep — Outpost Reference Extraction (Research Batch)

## Context

Working in the `gloomhaven-command` repo. **Baseline: T0d + dev-sandbox complete.** Run `git pull` and confirm:

- `docs/PHASE_T3_SCOPE.md` exists and describes the T3 plan.
- `.staging/` directory exists locally at `/mnt/c/Users/Kyle\ Diaz/gloomhaven-command/.staging/` (or equivalent Windows path). If it does not exist, **stop and surface**. The staging data lives only on Kyle's machine; it is `.gitignore`d. This batch cannot run without it.

This is a **research batch**. It is explicitly **code-free**. The deliverable is a new doc at `docs/FH_OUTPOST_REFERENCE.md`. Subsequent batches (T3a onward) reference it as the single source of truth for FH outpost / town-phase data.

**Reading order before starting:**

1. `docs/PHASE_T3_SCOPE.md` (the v2 scope doc) — defines what T3 needs to know.
2. `CLAUDE.md` — especially the research-batch / no-commit rules.
3. `scripts/import-data.ts` — the existing importer. Tells you exactly where in `.staging/` each data type lives. Study functions `importBuildings` (line ~811), `importEvents` (~762), `importItems` (~705), `importScenarios` (~582), `importPersonalQuests` (~786), `importCampaignData` (~852), `importLabels` (~414).
4. `server/src/referenceDb.ts` — the reference DB schema + existing query methods. Confirms what's structured and what's narrative.
5. `packages/shared/src/data/levelCalculation.ts` — existing XP-threshold data; your level-up section cross-references this.
6. `docs/GAME_RULES_REFERENCE.md` — existing rules sections (§11, §16, §17 at minimum). Your output extends / cross-references but does not duplicate.
7. `packages/shared/src/types/gameState.ts` — `BuildingModel`, `Party`, `CharacterProgress`. Confirms which fields already exist to receive this data.

---

## Hard rules for this batch

1. **No code changes.** Not even "while I'm here." If a helper obviously wants to exist, log it in the doc under "Suggested engine additions for T3{letter}" but do not create it.
2. **No database rebuilds.** The reference DB already holds imported data; use it read-only via `sqlite3` queries for verification. Don't re-run `npm run import`.
3. **The deliverable is `docs/FH_OUTPOST_REFERENCE.md`** — one committed markdown file. Optionally a companion `docs/FH_OUTPOST_DATA.json` if structured data benefits from being machine-readable (e.g. building-level abilities), but only if it's genuinely useful for later batches — don't ship it speculatively.
4. **Kyle reviews before commit.** Produce the doc, show Kyle. He reviews, surfaces corrections, then you commit. Standing `CLAUDE.md` rule.
5. **If data is missing, say so loudly.** Every unknown gets a "**⚠ DATA MISSING:**" call-out in its section. Do not paper over gaps.
6. **Do not extrapolate from partial data.** If the FH `buildings.json` has three fields for one building and five for another, report the asymmetry; do not infer the missing two.
7. **Kyle has not unlocked every building.** The `.staging/` data is the rulebook's complete set — you have access to information Kyle himself doesn't. That's fine. Note in the doc which buildings are "late-game unlocks" if the data indicates that (e.g. via requirements or construction prerequisites).

---

## Scope — what the doc must cover

The output doc is organized in these top-level sections, in this order:

### 1. FH Town Phase Structure

- The five steps (Passage of Time / Outpost Event / Building Operations / Downtime / Construction), confirmed against the rulebook.
- Which steps have player interactions vs. GM-only actions.
- Auto-advance criteria (rulebook) for each step.

### 2. GH Town Phase Structure

- The three steps (City Event / Character Management / Donate).
- How they decompose into FH-equivalent sub-screens per Q4 (downtime sub-screens: Store, Enchanter, Sanctuary).

### 3. Buildings (FH)

For each building that appears in `.staging/editions/fh/buildings.json` (or equivalent):

- **Identity:** building_id, display name, category (craft / social / military / etc. — pick categories that emerge from the data, don't impose).
- **Construction:** initial cost (gold + resources), construction prerequisite buildings if any, rulebook reference.
- **Upgrades:** for each level (typically 1→4), cost to upgrade + any structural changes.
- **Building Operations ability:** what happens when this building is processed during step 3. Text from rulebook; structured form if data has it.
- **Downtime operations:** what verbs are available to players at this building during downtime.
  - If Store: purchase items (filtered by Store level + party prosperity).
  - If Craftsman: craft items (filtered by Craftsman level + available recipes).
  - If Alchemist: brew potions.
  - If Enchanter: apply enhancements.
  - If Sanctuary: donate (Kyle's GH structure has Sanctuary; verify it exists in FH).
  - If passive / no downtime verbs: note that explicitly.
- **Assault interaction:** whether the building takes damage during assaults and what consequences come from it being damaged or wrecked.
- **Level-gated capabilities:** features that unlock at specific levels (e.g. "Craftsman level 2 unlocks prosthetic items").

Kyle has stated he hasn't unlocked all buildings — enumerate the **complete** set the data knows about. Later batches will gate UI by current state.

### 4. Items (for T3f Store reference)

Existing `.staging/editions/fh/items.json` has most of this. Confirm the shape + any gaps:

- Base cost, slot, resource cost components (if any), unlock prosperity, required building + level.
- Call out if items have consumption/spent mechanics that need engine tracking.
- How many items per prosperity level unlock.
- Special items (starting items, legendary items, etc.) — anything that's structurally different.

### 5. Crafting recipes (T3g)

If `.staging/` has a crafting-recipes file — walk it. Capture:
- Input resources + quantities per recipe.
- Output item.
- Required Craftsman level.
- Gold cost if any.

If crafting recipes are **embedded in items.json** rather than a separate file, describe that structure.

**⚠ DATA MISSING:** if no crafting data exists in staging, say so explicitly. T3g will need rulebook extraction.

### 6. Brewing recipes (T3h)

Mirror of crafting for Alchemist / potions:
- Resource inputs.
- Output potion (and its effect — likely in a `potions.json` or `items.json` subset).
- Required Alchemist level.

**⚠ DATA MISSING:** flag if absent.

### 7. Enhancement table (T3h)

Enhancement rules are complex. Capture what's structured:
- Enhancement types (+1 attack, +1 move, element imbue, attack-hex, etc.).
- Cost table by ability-card slot type + existing enhancements.
- Required Enchanter level per enhancement type.
- Slot eligibility rules (what can be enhanced on what card).

**⚠ Very likely that some of this is rulebook-only** and not in staging. Flag sections as "rules-prose" vs "structured".

### 8. Outpost events (T3b)

From `.staging/editions/fh/events.json` (filter `type === 'outpost'`):

- Total card count.
- Each card's shape: `cardId`, `narrative`, `options`.
- Options structure — do options have ids? resolution text? outcomes? (Structured outcomes are ideal; pure prose means engine has to leave resolution application to the GM manually.)
- Whether any cards trigger assault (see section 9).

### 9. Outpost assault (T3c)

**Highest-stakes research item.** Probably the least-structured.

- Rulebook procedure: how assault is triggered, how rounds work, win/lose conditions.
- Town Guard attack modifier deck — source (likely `.staging/worldhaven/data/fh/attack-modifiers-townguard.json` or similar), deck composition, shuffle rules, reshuffle rules between assaults.
- Building damage rules: what damages what, damage flow, party defense mechanics.
- Soldier mechanics: what soldiers do, how they spawn, how they're spent.
- Defense mechanics: defense value vs. damage, can it be spent or is it per-round?
- Assault event data: if an outpost event card triggers assault, what parameters does it carry? (Specific threat level? Number of rounds? Specific monsters? A separate `assaults.json`?)

**⚠ EXPECT SUBSTANTIAL DATA MISSING HERE.** The assault mechanic is novel enough that staging data may have only skeleton support. T3c will either need rulebook-text extraction OR will need to wait for a separate data-authoring batch to fill the gaps. Call this out clearly.

### 10. Construction rules (T3i)

- How the construction step works: party votes preference → pay resources → building gets built/upgraded next week.
- Construction cost sources: pure gold, pure resources, mixed? Tied to building identity or unified tables?
- What happens with tied votes (GM override, re-vote, etc.)?

### 11. Scenario selection + Travel (T3j)

For each FH scenario in staging:
- Has `complexity`? `objectives`?
- `objectives` shape — is win condition classifiable as a type (escort / kill all / puzzle / survive / reach exit / etc.)? This drives the "synopsis card" data.
- `unlocks` / `requires` — enough to build the flowchart graph?
- Map region indicator — does staging have it? (Likely a `coordinates` or `hex` field on the scenario, or in a separate `world-map.json`.)

**For road / boat events:**
- Are there separate `road-events.json` / `boat-events.json` files, or are they `event_type = 'road' / 'boat'` rows in the unified events.json?
- Structure parallel to outpost events?

### 12. Level-up data (T2b cross-reference)

For each FH class:
- XP thresholds per level (cross-check against `levelCalculation.ts`).
- Abilities unlocked per level (probably in `character-ability-cards/` + level-group labels).
- Perks available to choose from (likely in a per-class perks file).
- Masteries / personal quest triggers per level.

GH classes get a parallel section for T2b.

### 13. Personal quests (T2c)

From `.staging/editions/fh/personal-quests.json`:
- Card count.
- Structure: `cardId`, `name`, `requirements`, `unlockCharacter`?
- How progress is tracked (requirements are typically countable events — kill N monsters of type X, complete N scenarios with Y modifier, etc.). Is the staging structured or prose-only?
- What happens on fulfillment (rule: retire + unlock next character).

GH parallel.

### 14. Kyle's current unlock state snapshot (bonus)

**Optional but high-value.** If Kyle has a live reference.db or game save accessible, read `state.party.unlockedCharacters`, `state.party.buildings`, and similar to note which buildings/items/characters/events Kyle has already encountered vs. what's still locked. This is purely informational — lets T3c/d prioritize the buildings Kyle will actually exercise first in playtest.

If the live data is not accessible (no active game save, no reference.db read permission, etc.), skip this section. Don't fake it.

### 15. Suggested engine additions for T3{letter}

One list per future T3 batch. Each entry is a bullet describing a helper, type, command, or data structure the research suggests the batch will need.

Example format:

```
### T3c (Outpost Assault)
- New engine state: `AssaultState` on `townPhase.assault`.
  Fields discovered: round_number, town_guard_deck_state, per_building_damage.
- Town Guard AMD needs its own deck type — distinct from scenario AMD on `state.attackModifierDeck`.
- Command: `drawTownGuardCard` — similar shape to existing `drawModifierCard` but targets party's TG deck.
- (etc.)
```

This is Claude Code's contribution to the scoping of later batches. It's not binding — Kyle + Claude revise when writing the actual T3c prompt — but having informed suggestions here means T3c's design isn't starting from zero.

### 16. Open questions that emerged during extraction

Anything that the data can't settle. Examples:
- "Staging has potions but no potion-brew-recipe file. Are potions crafted like items, or do they have their own system?"
- "Outpost event card 42 says 'trigger assault' but no `assaultId` field. How does the engine know which assault configuration to instantiate?"
- "Enhancement slot eligibility rules appear to be rulebook-only; not in staging. T3h needs manual encoding."

Kyle reviews these and either answers or punts them to the relevant batch.

---

## How to walk the data

### Working directory

`.staging/` under repo root. Top-level structure (from `scripts/import-data.ts`):

```
.staging/
├── ghs-client/
│   ├── data/               # GHS client data — per-edition folders
│   │   ├── fh/
│   │   │   ├── buildings.json
│   │   │   ├── items.json
│   │   │   ├── events.json
│   │   │   ├── personal-quests.json
│   │   │   ├── characters.json
│   │   │   ├── monsters.json
│   │   │   ├── scenarios/        # per-scenario JSON files
│   │   │   ├── sections/
│   │   │   ├── labels.json       # localized strings
│   │   │   ├── campaign.json
│   │   │   └── ...
│   │   ├── gh/ ...
│   │   ├── jotl/ ...
│   │   └── ...
│   └── src/assets/images/  # card images, portraits, icons
└── worldhaven/
    ├── data/               # worldhaven structured data
    └── images/             # worldhaven images including item-card, building-card, etc.
        ├── items/fh/...
        ├── outpost-building-cards/fh/...
        └── ...
```

The existing importer walks most of this; study `importEdition` (line 360) for the sequence.

### Commands to run

```bash
# Quick tour of what's available for FH
ls .staging/ghs-client/data/fh/

# Check buildings data
cat .staging/ghs-client/data/fh/buildings.json | head -200

# Scan for building ability text in labels
grep -i "build" .staging/ghs-client/data/fh/labels.json | head -50

# Events — filter to outpost type
node -e 'const d=require("./.staging/ghs-client/data/fh/events.json"); console.log(JSON.stringify(d.filter(e=>e.type==="outpost").slice(0,3), null, 2))'

# Look for assault / town-guard data
grep -ril "townguard\|assault" .staging/

# etc.
```

Use a mix of filesystem walk + `node -e` + `grep` + opening files directly via the `view` tool. Prefer loading specific JSON files over broad dumps — staging is hundreds of MBs.

### Existing reference.db

Kyle has a populated `data/reference.db` (not in git). You can query it read-only:

```bash
sqlite3 data/reference.db "SELECT * FROM buildings WHERE edition='fh' LIMIT 5;"
sqlite3 data/reference.db "SELECT event_type, COUNT(*) FROM events WHERE edition='fh' GROUP BY event_type;"
sqlite3 data/reference.db ".schema"
```

The importer has already normalized the data — reference.db is the most convenient shape for "what's actually extractable today." But `.staging/` has the raw source — useful when reference.db's columns have dropped fields.

### Card image inspection

For building ability text that's only on the card art (not structured), open the PNG via `view` tool:

```
view .staging/worldhaven/images/outpost-building-cards/fh/craftsman-1.png
```

That lets you read the ability text visually and transcribe. Use sparingly — this is slow. Only do it for buildings where structured text isn't available.

---

## Output format

`docs/FH_OUTPOST_REFERENCE.md` is a long doc — expect 2000–4000 lines depending on how much staging data is structured. Organize with `##` for the 16 sections above and `###` / `####` for sub-items.

Style guidance:
- Use tables where structure lends itself (building list, XP thresholds, enhancement costs).
- Use code fences for JSON snippets illustrating data shape.
- Use `**⚠ DATA MISSING:**` callouts for gaps.
- Use `**ℹ NOTE:**` callouts for judgment calls you made (e.g. "categorized 'Coliseum' as social rather than military because it has no assault interaction").
- Link related sections where cross-cutting (e.g. Store building entry links to Items section).

Keep prose tight. This is a reference doc, not a narrative essay.

---

## Verification checklist

Before declaring done:

- [ ] `.staging/` exists and is walkable.
- [ ] All 16 sections have content OR a documented reason for being empty/minimal.
- [ ] Every FH building from `buildings.json` is enumerated in section 3.
- [ ] Every unique event type in `events.json` appears in either section 8 (outpost) or 11 (travel) or is explicitly noted as out-of-scope.
- [ ] Section 14 (Kyle's unlock state) is either populated OR explicitly skipped with a reason.
- [ ] `⚠ DATA MISSING` callouts are consolidated into section 16 (open questions) as well as inline.
- [ ] Suggested engine additions (section 15) are non-empty for T3a, T3b, T3c, T3d, T3e, T3f, T3g, T3h, T3i, T3j.
- [ ] No code changes in the repo (verify with `git status` — only `docs/FH_OUTPOST_REFERENCE.md` should be new).
- [ ] The doc is Kyle-readable — someone reviewing it can verify each section matches their rulebook understanding without needing to parse raw JSON.

---

## Not a commit

Per `CLAUDE.md` — do not commit. Present the doc to Kyle for review. Kyle will:
- Spot-check against his rulebook knowledge.
- Correct any misreadings.
- Answer the open questions in section 16.
- Approve the commit.

After Kyle's review and approval, commit with this message:

```
docs(phase-t3-prep): FH outpost reference — data audit for T3 batches

Walks .staging/editions/fh and the existing reference.db to enumerate
every FH outpost-phase data entity: buildings (ids, costs, upgrades,
operations, downtime verbs), items (existing + cross-references),
crafting / brewing / enhancement data, outpost events, outpost assault
mechanics, construction rules, scenario synopsis data, level-up data
per class, personal quests.

Produced as single source of truth for T3a-j implementation batches.
Gaps flagged with ⚠ DATA MISSING callouts; open questions consolidated
for Kyle review.

No code changes.

Baseline: T0d + dev-sandbox complete. Part of Phase T3 (Town Phase
Interactions). Precedes T3a.
```

---

## Notes to Claude Code

1. **Do not write code.** Not a helper. Not a script. Not a test. Not a migration. The doc is the work product.

2. **Do not attempt to populate missing data by extrapolation.** If staging doesn't have it, say so. Kyle's rulebook knowledge fills those gaps in review.

3. **Be thorough on buildings and assault.** These are the highest-risk areas for later batches. Over-index on specificity here.

4. **Be concise on items.** They're already well-structured in existing staging + refDB. T3f will cross-check during its implementation; don't duplicate the items.json here.

5. **Optional JSON companion file.** If extraction produces a structured JSON view of building-level abilities or enhancement costs that would be useful for T3d/T3h engine code, commit a `docs/FH_OUTPOST_DATA.json` alongside the markdown. Otherwise the markdown alone is enough.

6. **Walk the reference.db AND staging.** They're complementary — reference.db tells you what the existing import captures; staging tells you what's there to capture. Differences between them are themselves useful information ("staging has a `description` field on buildings but the importer drops it — T3d needs this descrption for the building operations screen").

7. **Do not produce the doc in chat.** Write it directly to `docs/FH_OUTPOST_REFERENCE.md` and let Kyle open it from the file system. Chat response should be a short summary — "doc produced at {path}, 3200 lines, main gaps: assault mechanics, enhancement slot eligibility. Open questions for review: ..."

8. **Time estimate:** expect 30-90 minutes of work. If it's going over 2 hours, stop and surface — probably you're going too deep in one section.

9. **Kyle reviews before commit.** Surface the doc, do not commit yet. Standing rule.
