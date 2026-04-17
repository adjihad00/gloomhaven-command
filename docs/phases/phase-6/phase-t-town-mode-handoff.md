# Phase T: Town Mode & Campaign Layer — New Conversation Handoff

## For Claude (new conversation context)

You are continuing work on **Gloomhaven Command**, a multi-device companion system for Gloomhaven/Frosthaven tabletop sessions. The codebase is at `https://github.com/adjihad00/gloomhaven-command`.

### What Exists

The system has three working clients (controller on iPad, phone for each player, display on portrait monitor), a Node.js/Express/WebSocket server, and a shared TypeScript game engine. Phase R (scenario play) and Phase 5 (data pipeline) are complete. The app can fully play a scenario end-to-end with real monster ability cards, scenario rules, win/loss conditions, and section book text — all sourced from a purpose-built reference SQLite database.

**Tech stack:** Node.js 20+, TypeScript, Preact, Express, ws, better-sqlite3, esbuild, vanilla CSS.

**Current campaign situation:** When a scenario ends (`completeScenario` command), the engine transfers XP, converts loot to gold, records scenario completion in `state.party.scenarios`, resets character combat state, and sets `state.mode = 'town'`. All three clients switch to `TownView`. But the TownViews are placeholders — they show a static checklist of town phase steps (3 for GH, 5 for FH) and a "Town Phase Complete" button that fires `completeTownPhase` and transitions back to `'lobby'`. No actual town activities happen:
- No item shop / equipping / crafting
- No level-up flow (XP thresholds exist but no UI to choose new ability cards, perks, or HP increases)
- No perk application (perks modify AMDs but the apply flow isn't built)
- No enhancements (ability card modification system)
- No personal quest tracking / retirement flow
- No FH outpost activities (passage of time, outpost events, building operations, construction, crafting, brewing)
- No city/road event card system
- No world map scenario selection (current lobby lists all scenarios as text)
- No GH town phase variants (city events, sanctuary donations)

All of the reference data for these activities is **already in the database** (Phase 5 delivered it): 942 items, 30 buildings, 796 events, 117 personal quests, 403 treasures, 14 campaign_data entries. The `Party` and `CharacterProgress` types in the shared engine already have all the fields needed (`weeks`, `loot` resources, `inspiration`, `defense`, `soldiers`, `morale`, `buildings`, `campaignStickers`, `items`, `equippedItems`, `perks`, `personalQuest`, etc.).

### What You're Building

**Phase T** is a dedicated Town Mode / campaign layer phase. The goal is to turn the TownView placeholders into the full town phase experience, with campaign persistence across sessions, per-character progression management, edition-appropriate town workflows (GH city vs FH outpost), and world map scenario selection.

---

## Starting State — Current Codebase at Commit `ce0936e`

### Engine (shared package)

**State fields already wired:**
- `GameState.mode: 'lobby' | 'scenario' | 'town' | 'transition'` — mode routing works
- `GameState.party: Party` — full party state with all FH outpost fields
- `Party.scenarios: ScenarioModel[]` — completed scenarios tracked
- `Party.weeks`, `Party.weekSections`, `Party.loot` (resources), `Party.inspiration`, `Party.defense`, `Party.soldiers`, `Party.morale`, `Party.buildings`, `Party.campaignStickers`, `Party.trials`, `Party.prosperity`, `Party.donations`, `Party.reputation`, `Party.achievementsList`, `Party.globalAchievementsList`
- `Party.unlockedItems`, `Party.unlockedCharacters`, `Party.retirements`, `Party.eventCards`, `Party.pets`
- `CharacterProgress`: `experience`, `gold`, `loot` (resources), `items`, `equippedItems`, `personalQuest`, `personalQuestProgress`, `perks[]`, `masteries[]`, `donations`, `retirements`, `enhancements`, `deck`, `battleGoals`

**Commands already implemented:**
- `completeScenario` — XP transfer, gold conversion (per-level rate), FH loot card → resources, scenario completion tracking, combat state reset, mode → `'town'`
- `completeTownPhase` — mode → `'lobby'`
- `updateCampaign` — generic party field updater

**Commands NOT yet implemented (Phase T needs to add):**
- Items: `purchaseItem`, `equipItem`, `unequipItem`, `sellItem`, `craftItem` (FH), `brewPotion` (FH)
- Progression: `applyLevelUp` (add card to deck, HP increase, grant perk mark), `applyPerk` (mark perk as applied → AMD modification), `applyMastery` (FH), `applyEnhancement` (with cost deduction)
- Personal quest: `setPersonalQuest`, `updatePersonalQuestProgress`, `retireCharacter`
- FH outpost: `advanceWeek`, `drawOutpostEvent`, `resolveOutpostEvent` (A/B), `useBuilding`, `constructBuilding`, `upgradeBuilding`, `wreckBuilding`
- Events: `drawCityEvent` (GH), `drawRoadEvent`, `resolveEvent` (A/B)
- Donations: `donateToSanctuary` (GH)
- Town guard: `drawTownGuardPerk`, `applyTownGuardPerk` (FH)

### Reference Database (already populated — Phase 5)

Tables with town-relevant data:
- `items` — 942 rows across editions. Fields: `item_id`, `name`, `cost`, `slot`, `count`, `actions_json`, `resources_json` (FH crafting costs), `unlock_prosperity`, `required_building`, `required_building_level`
- `events` — 796 rows. Fields: `event_type` (`'road'`, `'city'`, `'outpost'`), `event_id`, `narrative`, `options_json` (A/B outcomes)
- `buildings` — 30 rows (FH). Fields: `building_id`, `name`, `costs_json`, `upgrades_json`
- `personal_quests` — 117 rows. Fields: `card_id`, `name`, `requirements_json`, `unlock_character`
- `treasures` — 403 rows. Fields: `treasure_index`, `reward`
- `campaign_data` — 14 rows. Fields: `key`, `value_json` (XP thresholds, gold conversion, etc.)
- `labels` — 11,432 rows. Includes item descriptions, event text, building operations, personal quest text
- `asset_manifest` — 11,188 rows. Includes item cards, event cards, building images, character ability cards

**Existing query methods in `ReferenceDb`:**
- `getItems(edition)` — returns all items for an edition
- `getLabel(edition, key)` / `getLabelsPrefix(edition, prefix)` — label lookup

**Missing query methods (Phase T will add):**
- `getItem(edition, itemId)`, `getItemsBySlot(edition, slot)`, `getItemsByUnlockProsperity(edition, prosperity)`
- `getEvent(edition, type, eventId)`, `getEventDeck(edition, type)`
- `getBuilding(edition, buildingId)`, `getBuildings(edition)`
- `getPersonalQuest(edition, cardId)`, `getPersonalQuests(edition)`
- `getTreasure(edition, treasureIndex)`
- `getCampaignData(edition, key)`

**Existing API endpoints:**
- `GET /api/ref/items/:edition` — full item list
- Needs to be extended: `/api/ref/item/:edition/:itemId`, `/api/ref/events/:edition/:type`, `/api/ref/event/:edition/:type/:eventId`, `/api/ref/buildings/:edition`, `/api/ref/building/:edition/:id`, `/api/ref/personal-quests/:edition`, `/api/ref/personal-quest/:edition/:cardId`, `/api/ref/campaign/:edition/:key`

### Client Placeholders (all TownViews are stubs)

```
app/controller/TownView.tsx       — 88 lines. Static checklist (GH 3 steps / FH 5 steps),
                                     travel reminder, "Town Phase Complete" button
app/phone/TownView.tsx            — 38 lines. Character portrait, "Waiting for GM" message,
                                     disconnect menu. NO character sheet.
app/display/TownView.tsx          — 49 lines. Static step list, fog particles,
                                     edition-specific subtitle.
```

None of these clients currently:
- Display party state (morale/defense/resources for FH, prosperity/donations for GH)
- Show completed scenarios or unlock progression
- Provide any interactive town activities

### Persistence

`GameStore` (SQLite at `data/ghs.sqlite`) persists `GameState` across server restarts. Since `state.party` is part of `GameState`, campaign progress DOES persist — but there's no UI to load/resume a specific campaign. Currently each `gameCode` maps to one game. Kyle's playtest workflow: use a consistent gameCode like `"main"` across sessions.

What doesn't persist: nothing new needed — the existing persistence handles it.

---

## Phase T Prompt Structure

Phase T is too large for a single prompt. It should be broken into sub-prompts that follow the natural dependency order. Each sub-prompt should land working, playtestable functionality — not incomplete scaffolding.

### Prompt T1: Scenario End Rewards + Basic Post-Scenario Flow

**Goal:** Make the scenario-end → town transition a proper rewards experience before anything else.

- Extend `completeScenario` to track per-character scenario stats (XP gained, gold gained, loot cards drawn, damage dealt, kills) so rewards overlay can show them
- Build a rewards overlay (all three clients) showing: XP gained + threshold progress, gold earned, resources gained (FH), treasures claimed, battle goals completed (with checkmark preview), scenario rewards (unlocks, achievements)
- Commands: extend `completeScenario` payload with `battleGoalsCompleted` per character, add `claimTreasure` command
- Reference DB: add `getCampaignData(edition, 'xpThresholds')` lookup to show next level progress
- No new item/perk/level-up flow yet — those are T2/T3

**Deliverable:** A playtest-ready rewards experience after winning or losing a scenario. The town view is still a checklist after rewards close.

### Prompt T2: Phone Character Sheet — Items, Perks, Level Up, Enhancements

**Goal:** Turn the phone TownView into a proper character management sheet. This is the biggest phone surface area and where players spend most of their town-phase time.

- Tabbed character sheet replacing the placeholder phone TownView: Items, Perks, Level Up, Enhancements, Personal Quest
- **Items tab:** Equipped items (by slot), owned items, shop (filtered by prosperity + required buildings), FH crafting UI, FH alchemist brewing UI
- **Perks tab:** Perk points available, perk list with AMD modifications preview, apply/unapply perks
- **Level Up tab:** XP vs threshold, guided flow if eligible (pick new ability card, HP increase, grant perk mark)
- **Enhancements tab:** Ability card browser with enhancement slots, cost calculator (gold deduction on apply)
- **Personal Quest tab:** Quest card description, progress markers, retirement conditions + retire button
- Commands: `purchaseItem`, `equipItem`, `unequipItem`, `sellItem`, `craftItem`, `brewPotion`, `applyLevelUp`, `applyPerk`, `applyMastery`, `applyEnhancement`, `setPersonalQuest`, `updatePersonalQuestProgress`, `retireCharacter`
- Reference DB additions: `getItem`, `getItemsBySlot`, `getItemsByUnlockProsperity`, `getPersonalQuest`, `getPersonalQuests`
- API endpoints: `/api/ref/item/:edition/:itemId`, `/api/ref/personal-quest/:edition/:cardId`
- Server-side phone permission enforcement: all T2 commands must be allowed for phones and target the registered character

**Deliverable:** Each player can fully manage their character during town phase from their phone: shop, level up, apply perks, enhance cards, manage personal quest. Works for both GH and FH.

### Prompt T3: FH Outpost Phase Controller — 5-Step Guided Workflow

**Goal:** Turn the controller TownView into the full FH outpost flow.

- Controller view with 5 sequential steps (Passage of Time → Outpost Event → Building Operations → Downtime → Construction)
- **Passage of Time:** Advance week counter, check for triggered week sections (prompt GM to read), seasonal transition (summer/winter) with appropriate deck reshuffle
- **Outpost Event:** Draw from winter/summer outpost deck, display on monitor for table to read, resolve A/B on controller. Handle attack events separately (target buildings)
- **Building Operations:** List active buildings with available operations (e.g., Sanctuary = donate for bless, Carpenter = lumber costs, etc.). Each operation fires a command
- **Downtime:** Per-character checklist — level up, retire, craft, brew, sell items. Controller shows who's done vs pending
- **Construction:** Building catalog (locked/available/built/damaged/wrecked), resource cost preview, morale spending option
- Commands: `advanceWeek`, `drawOutpostEvent`, `resolveOutpostEvent`, `useBuilding`, `constructBuilding`, `upgradeBuilding`, `wreckBuilding`, `repairBuilding`
- Reference DB additions: `getBuildings`, `getBuilding`, `getEventDeck`, `getEvent`
- API: `/api/ref/buildings/:edition`, `/api/ref/building/:edition/:id`, `/api/ref/events/:edition/:type`, `/api/ref/event/:edition/:type/:eventId`

**Deliverable:** Full FH outpost phase playable end-to-end with real event/building data. GM uses controller to guide the party through each step.

### Prompt T4: Display Town Mode — Outpost Map + Event Overlays

**Goal:** Make the display a proper read-only town surface.

- **FH:** Outpost map with building positions (status-colored: unlocked/built/damaged/wrecked), calendar with season marker and week counter, morale/defense/resources/soldiers/inspiration/trials pills, active event overlay
- **GH:** City map with prosperity track (coloring/ticks), reputation indicator, active event overlay
- Event card overlay — full-card display when `state.party.eventCards` has an active event, large enough for the table to read across the room
- Asset manifest lookups for building images, event card images
- Ambient effects: particles appropriate to edition (snow for FH outpost, warm glow for GH city)

**Deliverable:** The display shows the current town state as a large read-only surface during town phase.

### Prompt T5: World Map Scenario Selection

**Goal:** Replace the current text-list scenario picker in the lobby with a proper world map.

- Worldhaven has scenario map images (check `asset_manifest` for `category='scenario-layout'` or similar). Use these as the backdrop
- Scenario nodes positioned by `scenarios.coordinates_json` (x, y in the JSON — GHS already has these)
- State coloring: locked, available, blocked (by requires), completed, casual
- Party location pin (`state.party.location`)
- Tap a scenario → standard scenario selection flow (preview → chores → rules → goals → startScenario)
- Show road event prompt before starting (FH road deck + boat deck depending on destination)
- `Party.location` update on scenario selection

**Deliverable:** Campaign play feels like a campaign — the geographic flow of the story is visible, and players can see where they've been and where they can go.

### Prompt T6: Event Card System — Road / City / Outpost

**Goal:** Complete event deck management across all phases.

- Road events draw before scenario start (FH)
- City events draw during GH town phase
- Outpost events already drawn in T3
- Phone: pick A/B on player phone when the party must choose
- Display: full card text shown for table to read
- Controller: draws event, presents A/B choice buttons
- Engine: track drawn events in `state.party.eventCards` with resolution outcome
- Handle event deck shuffling at season transitions

**Deliverable:** Events are a proper interactive part of the flow instead of manually looked up in books.

### Prompt T7: GH Town Phase Variant

**Goal:** Simpler GH-specific town flow that shares infrastructure with T3 but has its own steps.

- Controller GH town view: City Event → Character Management → Sanctuary Donations → Next Scenario
- Sanctuary donation with 10g → 2 bless conversion
- City event deck drawing/resolution
- Reuses phone character sheet from T2
- Reuses display town view from T4 (GH variant)

**Deliverable:** Full GH campaign flow works. With T2+T7 done, any GH campaign is playable end-to-end.

---

## Priority Order Within Phase T

1. **T1: Rewards workflow** — highest immediate value. Makes winning/losing a scenario feel like an event with consequences. Foundation for per-character progression visibility.

2. **T2: Phone character sheet** — the biggest player-facing surface. Once this ships, players can level up, equip items, apply perks, retire — the core progression loop. Works in both editions.

3. **T3: FH outpost phase controller** — unlocks FH campaign play. This is the edition Kyle is actively playing (per memory).

4. **T4: Display town mode** — polish pass. Makes town phase feel as rich as scenario mode.

5. **T5: World map scenario selection** — campaign navigation. Big UX win but not blocking.

6. **T6: Event card system** — ties the narrative threads together. Can be integrated incrementally into T3/T7.

7. **T7: GH town phase variant** — brings GH to parity. Last because FH is the active playtest target.

---

## Architecture Principles (from existing codebase)

**Server-authoritative commands** (from Phase R):
- All state mutations are commands sent to the server
- Clients NEVER mutate state locally and sync later
- New T* commands must follow the existing pattern: type definition in `packages/shared/src/types/commands.ts`, handler in `packages/shared/src/engine/applyCommand.ts`, validation in `packages/shared/src/engine/validateCommand.ts`, permission enforcement for phones in `server/src/commandHandler.ts`

**Edition-aware everywhere:**
- GH has no loot deck, no resources, no outpost events, no buildings, no crafting
- FH has all of the above plus winter/summer seasons, inspiration, defense, soldiers, morale
- Jaws of the Lion (jotl), Crimson Scales (cs), Forgotten Circles (fc), Trail of Ashes (toa) are GH-like
- `edition` field on `GameState` and `Party` drives branching; don't assume FH features exist for GH

**Reference vs mutable data (Phase 5 principle):**
- `data/reference.db` (immutable, populated by import script) is the source of truth for items, events, buildings, quests, campaign thresholds
- `data/ghs.sqlite` (mutable, `GameStore`) holds the live game state — purchases, equipment, event outcomes, party progression all go here via commands
- When applying a T command, the engine reads from `DataContext` (reference data) to validate and resolve costs, then mutates `state.party` / `state.characters` (mutable game state)

**Phone permission model (from Phase 3):**
- Phones are restricted to commands targeting their registered character
- `PHONE_GLOBAL_ACTIONS` set bypasses character-name check for genuinely global commands (e.g., `moveElement`, `drawLootCard`)
- All T2 character-management commands must include the target character in the payload and match the phone's registration
- Controller and display have no command restrictions

---

## Key Files for Context

```
# Engine
packages/shared/src/types/gameState.ts          — Party + CharacterProgress types (already complete)
packages/shared/src/types/commands.ts           — Command action list (needs T* additions)
packages/shared/src/engine/applyCommand.ts      — Mutation handlers (handleCompleteScenario at line 1831 is reference)
packages/shared/src/engine/validateCommand.ts   — Command validation
packages/shared/src/data/index.ts               — DataContext interface

# Reference data
server/src/referenceDb.ts                       — ReferenceDb class (needs T* query methods)
scripts/import-data.ts                          — Import pipeline (already imports all town data)

# Server
server/src/index.ts                             — API route definitions (inline, add /api/ref/ routes here)
server/src/commandHandler.ts                    — Phone permission enforcement

# Client placeholders to replace
app/controller/TownView.tsx                     — 88 lines placeholder
app/phone/TownView.tsx                          — 38 lines placeholder
app/display/TownView.tsx                        — 49 lines placeholder

# Hooks to extend/mirror
app/hooks/useCommands.ts                        — Command sender
app/hooks/useDataApi.ts                         — Data fetching pattern
app/hooks/useScenarioBookData.ts                — Phase 5 hook pattern (fetch + graceful fallback)
app/shared/labelRenderer.ts                     — Use for item descriptions, event text with %game.action.X% placeholders

# Project docs (READ ALL before starting)
docs/PROJECT_CONTEXT.md
docs/DESIGN_DECISIONS.md
docs/APP_MODE_ARCHITECTURE.md                   — Has Phase T design notes already
docs/COMMAND_PROTOCOL.md
docs/GAME_RULES_REFERENCE.md                    — Authoritative game rules (town phase rules here)
docs/ROADMAP.md                                 — Phase T sub-phases outlined
docs/BUGFIX_LOG.md
docs/GHS_AUDIT.md                               — GHS town phase UI reference
app/CONVENTIONS.md                              — CSS/component conventions
```

---

## Design Skills & Conventions

For ALL UI/UX work in Phase T, read these skill files before implementing:
- `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\` — UI/UX Pro Max skill (read all .md files)
- `C:\Users\Kyle Diaz\.agents\skills\` — frontend agent skills (read all .md files)
- `app/CONVENTIONS.md` — project CSS/component conventions

Priority when skills conflict: (1) app/CONVENTIONS.md, (2) UI/UX Pro Max, (3) agent skills.

**Aesthetic direction:** Dark fantasy tabletop. Aged parchment, copper/gold metallics, deep browns, candlelight glow effects. NOT generic dashboard/SaaS aesthetics. Town mode should feel like reading an old campaign ledger.

**Font stack:** Cinzel (display/headings) + Crimson Pro (body). Self-hosted woff2.

**Color system:** CSS variables in `app/shared/styles/theme.css` — accent-gold, accent-copper, health-green, negative-red, shield-blue, elite-gold. Edition theming via `data-edition` attribute — GH warm gold, FH ice blue.

**CSS conventions:** BEM naming, spacing tokens, focus-visible accessibility. Preact functional components. GHS assets exclusively (no fallbacks). touch-action: manipulation on all interactive elements. aria-labels on all buttons.

---

## What Success Looks Like

After Phase T is complete:
- A full Frosthaven campaign can be played end-to-end: scenario → rewards → outpost phase (all 5 steps) → travel → scenario → repeat. All activities happen IN the app; no reaching for the physical books for campaign management.
- Phone is a proper character sheet during town: players shop, level up, apply perks, apply enhancements, manage personal quests, retire characters.
- Controller guides the GM through the outpost phase with real event/building data.
- Display shows the outpost state (buildings, calendar, morale) as a read-only surface across the room.
- Events are drawn, displayed, and resolved through the app with proper A/B branching.
- World map scenario selection replaces text-list selection.
- GH campaign flow (city event, character management, sanctuary, next scenario) works in parallel.
- Campaign progress persists across sessions via the existing `GameStore`.

---

## What Playtest-Ready Means for Each Sub-Prompt

Every Phase T sub-prompt should produce something Kyle can actually use at the next playtest — not scaffolding that needs the next sub-prompt to function. If a sub-prompt would land non-functional or mid-flight code, break it smaller. The existing Phase 5 pattern of "ship working, refine next batch" applies here.

---

## DO NOT

- Break existing scenario play — Phase T adds town mode; scenario mode is feature-complete and shouldn't regress
- Modify `data/reference.db` or `scripts/import-data.ts` to "add new fields" — the reference DB is immutable and already has everything Phase T needs
- Add placeholder text that says "Coming in Phase T.Y" — either ship working functionality or don't include the UI surface yet
- Hard-code edition-specific content that should come from the database (item names, event text, building names, quest text)
- Skip the rewards overlay in T1 — it's the foundation for every progression UI in T2
- Assume phones can execute town commands without phone permission whitelisting — all T2 commands need server-side permission enforcement
- Roll your own persistence — `GameStore` already handles everything via `GameState` serialization; just use it
- Reference batches that don't exist (check git log before assuming anything beyond commit `ce0936e`)
- Parse any PDFs — Phase 5.x already extracted the scenario/section book text. Town data comes from GHS JSON via the reference DB.
