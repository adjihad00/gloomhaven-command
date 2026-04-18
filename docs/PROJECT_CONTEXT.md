# Gloomhaven Command — Project Context

## Identity
Gloomhaven Command is a multi-device companion system for Gloomhaven/Frosthaven
tabletop sessions. It replaces the patchwork of GHS + ghs-server + custom
controller/phone HTML files with a unified, ground-up architecture.

## Architecture
Server-authoritative command-based system. Clients send small command messages.
Server validates, applies via shared engine, persists to SQLite, broadcasts diffs.

### Components
- **Server** (`server/`): Node.js, Express, ws library, better-sqlite3.
  Single process serves HTTP static files + WebSocket on one port.
- **Shared Engine** (`packages/shared/`): TypeScript. Pure functions for
  game state mutations, validation, turn order, element decay, GHS compat.
- **Shared Components** (`app/components/`): Preact component library shared
  across all three clients. CharacterBar, MonsterGroup, ModifierDeck,
  InitiativeDisplay, ConditionGrid, ElementBoard, etc.
- **Controller Client** (`app/controller/`): iPad landscape. Single-screen
  ScenarioView with overlays. Setup wizard (edition → characters → scenario).
  Initiative numpad, modifier deck controls, door reveals.
- **Phone Client** (`app/phone/`): Player phone, portrait + landscape. Scoped
  to one character. Initiative input, health, conditions, turn actions, loot,
  element board, initiative timeline, condition splash, exhaust/loot popups.
  Per-character accent theming. Landscape two-column layout.
- **Display Client** (`app/display/`): Portrait-oriented TV/monitor (1080×1920).
  Read-only, zero interaction. Dark fantasy war table aesthetic with canvas
  particle effects (embers/snow), edition theming (GH warm gold, FH ice blue).
  Initiative column with auto-scroll to active figure. Character cards with
  per-character accent theming, XP/loot SVG icons. Monster cards with real GHS
  API stat data (flying, shield, retaliate, immunities, conditions on attacks),
  ability card display (right-justified with name), standees below cards.
  Completed figures collapse to compact tray (cards right, standees left).
  AMD card draw splash (3D flip), loot card splash (targets character portrait),
  element board with infusion/consumption animations, transition overlays.
  Production-wired: live WebSocket state, state-driven animation triggers,
  auto-reconnect (no user interaction needed), display role registration,
  PWA manifest + content-hashed SW. Prototype mode at `?prototype=true`.

### Key Files for Understanding the System
- Types: `packages/shared/src/types/gameState.ts` — all data structures
- Commands: `packages/shared/src/types/commands.ts` — every mutation type
- Protocol: `packages/shared/src/types/protocol.ts` — WS message envelopes
- Engine: `packages/shared/src/engine/applyCommand.ts` — mutation logic
- WS Hub: `server/src/wsHub.ts` — connection mgmt, diff broadcast, reconnect
- Design: `docs/DESIGN_DECISIONS.md` — rationale for all architectural choices
- Roadmap: `docs/ROADMAP.md` — phased plan with completion tracking
- Bugs: `docs/BUGFIX_LOG.md` — issue log
- **Rules: `docs/GAME_RULES_REFERENCE.md` — authoritative GH/FH rules. MUST be consulted for all game logic implementation**

## Repo Layout (condensed)
```
packages/shared/src/    — game logic, types, GHS compat
server/src/             — HTTP + WebSocket server
  referenceDb.ts        — immutable SQLite reference data (schema + queries)
app/components/         — shared Preact UI components
app/hooks/              — shared Preact hooks (useConnection, useGameState, useCommands, useScenarioText)
app/shared/             — shared non-component code (assets.ts, formatName.ts, labelRenderer.ts, characterThemes.ts)
app/shared/hooks/       — shared hooks (useCommitOnPause). Phase T0b.
app/shared/sheets/      — canonical home for multi-client sheet components.
                          Phase T0b: PartySheet + PartySheetContext/Header/Tabs/Intro
                          + tabs/ (Roster, Standing, Location, Resources, Events).
                          Phase T0c: CampaignSheet + CampaignSheetContext/Header/
                          Tabs/Intro + WaxSealHeader (shared primitive) + tabs/
                          (Prosperity, Scenarios, Unlocks, Donations, Achievements,
                          Outpost, Settings).
app/shared/styles/      — CSS theme, typography, component styles, sheets.css (T0a + T0b)
app/controller/         — landscape tablet app (GM)
app/controller/ControllerNav.tsx — persistent ⋯ nav (Phase T0b) mounted from App.tsx;
                          opens MenuOverlay with Party Sheet + Campaign Sheet
                          access from every mode (Campaign Sheet entry added T0c).
app/phone/              — portrait phone app (player)
app/phone/sheets/       — Player Sheet family (PlayerSheet, header, tabs, intro, menu,
                          IlluminatedCapital) + tabs/ (Overview + placeholders). Phase T0a.
app/display/            — portrait TV app (read-only)
app/display/views/      — display view wrappers. Phase T0c: DisplayIdleSheetsView
                          alternates Party Sheet ↔ Campaign Sheet during idle
                          lobby (no setupPhase) and town. DisplayPartySheetView
                          is retained importable + JSDoc-@deprecated for rollback.
scripts/                — data import tooling
  import-data.ts        — populates data/reference.db from .staging/ sources
  extract-books.ts      — extracts scenario/section text from FH book PDFs
data/                   — gitignored runtime databases
  ghs.sqlite            — mutable game state (sessions, saves)
  reference.db          — immutable reference data (scenarios, monsters, items, labels, assets)
assets/                 — game images/data (gitignored, local only)
docs/                   — context, roadmap, decisions, bugs, rules reference
```

## Design Principles
1. Server owns game state. Clients are views that send commands.
2. Commands are small typed payloads (~15 types). No full-state sync.
3. Server validates every command before applying.
4. Diffs broadcast to all clients. Reconnecting clients replay missed diffs.
5. Session tokens + revision tracking = no state loss on reconnect.
6. One port, one origin. No WS/WSS mismatch. No proxy layers.
7. Shared TypeScript engine used by server and clients = zero logic duplication.
8. All clients share a CSS design system (dark parchment theme).
9. Display is portrait-only vertical tower layout.
10. Controller is landscape-only tabbed layout for iPad.
11. Phone is portrait-only, scoped to a single character.

## Connection Protocol Summary
See `docs/COMMAND_PROTOCOL.md` for full spec.
- Connect: client sends `{ type: "connect", gameCode, sessionToken? }`
- Server responds: `{ type: "connected", sessionToken, revision, state }`
- Client command: `{ type: "command", action: "changeHealth", ... }`
- Server broadcast: `{ type: "diff", revision, changes: [...] }`
- Reconnect: client sends token + lastRevision, server replays missed diffs
- Heartbeat: server pings every 15s (protocol-level), client auto-pongs. Client sends 30s keep-alive pong (application-level). visibilitychange triggers aggressive health check (5s timeout)

## Asset Sources (gitignored, populated locally)
- `assets/ghs/` — GHS client release (images, data JSONs)
- `assets/worldhaven/` — Licensed GH/FH asset repo
- `assets/creator-pack/` — Official Cephalofair creator pack
- `assets/nerdhaven/` — Community custom assets

## Tech Stack
- Runtime: Node.js 20+
- Language: TypeScript 5.x throughout
- Server: Express 4, ws 8, better-sqlite3
- Build: esbuild for clients (content-hashed in production), tsc for shared/server
- CSS: Vanilla CSS with custom properties (no framework)
- Fonts: Cinzel (headings), Crimson Pro (body)
- Persistence: SQLite via better-sqlite3

## Current Phase
Phase R COMPLETE (13 fix batches). Phase 3 Phone ScenarioView — Batch 16 COMPLETE.
Phase 4 Display Client — Design Exploration COMPLETE. Production wiring COMPLETE (Batch 17).
Batch 18a: Server logic bugs + controller standee management COMPLETE.
Batch 18b: Display UI polish COMPLETE (stat icon consolidation, hidden initiatives, stable tray).
Phase 5.1: Reference data schema + import pipeline COMPLETE. SQLite reference database
(`data/reference.db`) stores all GHS edition data (labels, scenarios, monsters, abilities,
items, events, sections, assets) populated from `.staging/` sources via `scripts/import-data.ts`.
Phase 5.2: Consumer wiring + bugfix COMPLETE. All "See Scenario Book" placeholders for special
rules replaced with real label text from reference DB (with inline icon interpolation). Display
monster ability card renderer upgraded from 5 to 30+ action types (conditions, elements,
summons, sub-actions). FH ability card names from source data (926 cards). Mock types replaced
with shared types. Win/loss conditions remain placeholder (deferred to PDF extraction).
Phase 5 Bugfix COMPLETE: display sticky header, phone battle goal card images with tap-to-select,
phone disconnect escape hatch on all screens, monster ability deck overrides from scenario rules
(FH scenario 0 hounds), battle goal deck server-side infrastructure, Worldhaven staging fallback.
Phase 5.x: Book data extraction pipeline COMPLETE. Extracts text from FH scenario/section book
PDFs using pdfjs-dist. 138 scenarios with win/loss conditions (100% goal coverage after 5.x.1
cleanup), 652 section entries with narrative text. All three clients now show real win/loss
conditions from the DB instead of "See Scenario Book" placeholders.
Phase 5.x.1 cleanup: goal regex tolerates PDF line-split whitespace and accepts "may be
complete"/"only" phrasings; "Unknown at this time." fallback preserves intentionally hidden goals;
content-aware `isCopyrightOnlyPage` check replaces book-specific skip. Solo scenario book
(`fh-solo-scenario-book.pdf`) extracted to 17 entries under `group_name='solo'`; `scenario_book_data`
PK extended with `group_name` column, `/api/ref/scenario-book` accepts optional `?group=` param.
Phase T0b COMPLETE (2026-04-17): Party Sheet as shared multi-client sheet.
`app/shared/sheets/` established as canonical home for cross-client sheets
(PartySheet + PartySheetContext/Header/Tabs/Intro + 5 tabs). Consumed by controller
(editable via PartySheetOverlay) and display (decorative via DisplayPartySheetView
with 30 s tab auto-cycle). 5 tabs: Roster, Standing, Location, Resources (FH only),
Events. Signature visual: gilt-bound tab binding (continuous metallic rule broken
only at active tab). `getReputationPriceModifier` helper added for Standing tab's
live price-modifier chip (T2a shopping will reuse). Structured `addPartyAchievement`
/ `removePartyAchievement` commands (GM-only) for array-field mutations.
`Party.sheetIntroSeen?` + leather-book intro animation. `useCommitOnPause` hook
centralises blur/Enter/1000 ms typing-pause commits for editable text. Controller
reachability via new `ControllerNav` promoting `MenuOverlay` to App-level — Party
Sheet reachable from Lobby / Scenario / Town. Display replaces idle-lobby and
town-mode views; scenario mode unchanged. Rules doc §16 Reputation & Economy added.
Phase T0d COMPLETE (2026-04-18): Player Sheet Notes + History tabs close the
T0 arc. Notes tab: editable per-character journal backed by
`CharacterProgress.notes` via existing `setCharacterProgress` command (no new
engine surface — T0a whitelisted `notes` preemptively). 4000-char cap,
hybrid-commit autosave via `useCommitOnPause` (1 s pause + blur; Enter inserts
a newline), "Saved" flash chip, `readOnly`-aware for controller quick-view.
History tab: reverse-chronological timeline of scenario events.
`HistoryEntry` discriminated union on `CharacterProgress.history?` with
variants `scenarioCompleted` + `scenarioFailed` (future batches extend: T2b
levelUp/perkApplied, T2c characterRetired/characterCreated, T2d
enhancementApplied). Engine-only `logHistoryEvent(char, entry)` mutator in
`packages/shared/src/engine/historyLog.ts` (NOT barrel-exported — clients
can't fabricate history entries). `handleCompleteScenario` hooks per-character
log entries sourced from `state.finishData` snapshot with snapshot-less
fallback; absent characters are skipped; defeat entries deliberately omit
`battleGoalChecks` (rules §11 — no battle-goal rewards on defeat). New
`backfillCharacterHistory` command (character-scoped, phone-allowed) seeds
history lazily from `state.party.scenarios[]` on first History-tab render;
engine-gated by `historyBackfilled` flag so repeat invocations are no-ops.
Backfilled entries tagged `backfilled: true` and rendered with a dashed
border + "Reconstructed" chip + no reward detail.
Phase T0c COMPLETE (2026-04-18): Campaign Sheet as third sheet in T0 trio.
Shared `app/shared/sheets/CampaignSheet*` family (Context / Header / Tabs /
Intro + `WaxSealHeader` primitive) consumed by controller (editable via
`CampaignSheetOverlay`) and display (decorative via `DisplayIdleSheetsView`,
which alternates Party Sheet ↔ Campaign Sheet on full tab-cycle wrap with
300 ms fade). 7 tabs: Prosperity / Scenarios / Unlocks / Donations /
Achievements / Outpost (FH only) / Settings. Outpost tab ships dashboard
form (calendar strip / resource pills / building cards with state chips
active/damaged/wrecked/building / campaign stickers); coordinate-based map
deferred to T4 / T0c-polish. Signature visual: wax-sealed tab headers
(per-tab gilt-seal motif). `getProsperityLevel` / `getProsperityProgress`
helpers in `packages/shared/src/data/prosperityLevel.ts` (GH + FH threshold
tables per new GAME_RULES_REFERENCE §17). Structured `addGlobalAchievement` /
`removeGlobalAchievement` commands (GM-only). `Party.campaignSheetIntroSeen?`
+ map-unfurling intro animation. `PartySheet` and `CampaignSheet` accept
optional `onCycleComplete?: () => void` (backward-compatible). Sheets
keyframe `party-sheet-page-turn` renamed `sheet-page-turn` for cross-sheet
reuse. Tests for new prosperity helpers deferred to `docs/TEST_BACKFILL.md`
(created this batch; reputationPrice listed alongside).
Phase T1 COMPLETE: Scenario end rewards experience unified across all three clients.
`state.finishData` snapshot built on `prepareScenarioEnd`, mutated during the pending
window via three new commands (`setBattleGoalComplete`, `claimTreasure`,
`dismissRewards`), applied atomically on `completeScenario`, and cleared on
cancel / completeTownPhase / startScenario. Phone, controller, and display all read
the same snapshot. Includes XP threshold progress bar, per-character battle-goal
stepper (0..3 checks), treasure claim flow (groundwork — in-scenario treasure
discovery persistence is a later batch), FH inspiration banner (4 - playerCount).
Controller summary now includes exhausted characters per rules §11.
Controller is feature-complete for scenario play.
Lobby mode added as first-class AppMode with campaign/one-off game modes.
Phone ScenarioView is feature-complete: health bar, initiative numpad, turn banner,
condition strip/picker, XP/loot counters, character detail overlay (swipe-to-close),
action bar (auto-exhaust popup replaces manual button), element board (interactive
during active turn), initiative timeline (auto-show/dismiss), condition splash on
turn start, per-character accent theming, landscape two-column layout.
Server enforces phone command permissions (whitelist + character match + global actions).
Summon section deferred for joint controller development.
FH loot deck draw integrated via PhoneLootDeckPopup.

Multi-phase scenario setup workflow (Batch 16): 5-phase collaborative setup
(Preview → Chores → Rules → Goals → Start). Controller shows enhanced scenario
preview with monster portraits, room tiles, loot deck config. Auto-assigns setup
chores to players by count. Phone overlays show assigned chores (with monster images),
scenario briefing, and battle goal reminders. All devices synchronize via
`state.setupPhase` and `state.setupData` broadcast.

## Documentation Policy
All project documents MUST be updated to reflect any code changes before committing
and pushing to the repo. Stale docs cause compounding errors across sessions.
Documents to review on every change:
- `docs/BUGFIX_LOG.md` — bug fixes (append-only)
- `docs/DESIGN_DECISIONS.md` — architectural choices (append-only)
- `docs/ROADMAP.md` — completion status
- `docs/PROJECT_CONTEXT.md` — repo layout, components, commands
- `docs/APP_MODE_ARCHITECTURE.md` — UI structure, views, flows
- `docs/GAME_RULES_REFERENCE.md` — game rules implemented or clarified

## GHS Compatibility
The shared engine can import/export GHS JSON game saves via
`packages/shared/src/utils/ghsCompat.ts`. This allows migrating
existing campaigns and provides a fallback bridge if needed.

## Commands Quick Reference
changeHealth, changeMaxHealth, toggleCondition, setInitiative, advancePhase,
toggleTurn, addEntity, removeEntity, moveElement,
drawLootCard, assignLoot, drawMonsterAbility, shuffleMonsterAbilities,
shuffleModifierDeck, drawModifierCard, addModifierCard, removeModifierCard,
revealRoom, undoAction, setScenario, addCharacter, removeCharacter,
setLevel, setExperience, setLoot, toggleExhausted, toggleAbsent,
toggleLongRest, renameCharacter, setLevelAdjustment, setRound,
addSummon, removeSummon, addMonsterGroup, removeMonsterGroup,
setMonsterLevel, importGhsState, updateCampaign,
prepareScenarioEnd, cancelScenarioEnd, completeScenario,
prepareScenarioSetup, confirmChore, proceedToRules,
proceedToBattleGoals, cancelScenarioSetup, startScenario,
completeTownPhase, dealBattleGoals, returnBattleGoals,
setBattleGoalComplete, claimTreasure, dismissRewards,
setCharacterProgress, addPartyAchievement, removePartyAchievement,
addGlobalAchievement, removeGlobalAchievement, abortScenario,
backfillCharacterHistory

### Notable Command Behaviors
- **drawModifierCard:** Bless/curse cards are spliced from the deck on draw
  (returned to supply per rules §5). `lastDrawn` field tracks display.
- **prepareScenarioEnd:** Sets `state.finish = 'pending:victory'` or
  `'pending:failure'` AND builds `state.finishData` — the Phase T1 rewards
  snapshot consumed by phone/controller/display overlays.
- **cancelScenarioEnd:** Clears both `state.finish` and `state.finishData` back
  to undefined. Phones dismiss rewards overlay.
- **completeScenario:** Applies the `state.finishData` snapshot when present
  (XP, gold, resources, battle-goal checks, claimed treasures, FH inspiration).
  Falls back to live-state derivation for pre-T1 saves. Clears monsters/objectives,
  resets character combat state (HP, conditions, initiative, in-scenario
  treasures), resets round/phase, sets elements inert. GH uses `char.loot` for
  gold; FH uses loot card system. Sets `state.finish = 'success'/'failure'` and
  `state.mode = 'town'`. `finishData` persists through the transition and is
  cleared by `completeTownPhase` / `startScenario`.
- **setBattleGoalComplete (T1):** Character-scoped. Clamps `checks` to 0..3 and
  records on the char's snapshot row. Rejected on defeat (rules §11).
- **claimTreasure (T1):** Character-scoped. Moves a treasure id from pending to
  claimed in the snapshot; resolves reward narrative via `DataContext.getTreasure`.
- **dismissRewards (T1):** Character-scoped. Marks the snapshot row as dismissed
  (per-phone local close; other phones unaffected).
- **setCharacterProgress (T0a):** Character-scoped, phone-allowed. Writes a
  whitelisted field on `character.progress`. MVP fields: `sheetIntroSeen`
  (boolean) and `notes` (string). Unknown fields rejected by `validateCommand`.
  Powers the Player Sheet's one-time intro-seen flag and the T0d Notes tab
  without widening `updateCampaign` beyond its party-level scope.
- **backfillCharacterHistory (T0d):** Character-scoped, phone-allowed.
  One-shot migration that seeds `char.progress.history` from
  `state.party.scenarios[]` and flips `historyBackfilled` to true. The
  engine guards on that flag so repeat invocations are no-ops; the client
  fires it from the History tab on first render. Backfilled entries carry
  `backfilled: true` so the UI can distinguish them. Live history entries
  are appended by engine hooks at trigger sites (T0d hooks
  `handleCompleteScenario` for victories and defeats; future batches add
  level-up / retirement / enhancement hooks). All history mutation flows
  through the engine-only `logHistoryEvent` helper (not barrel-exported —
  clients cannot fabricate history entries).
- **addPartyAchievement / removePartyAchievement (T0b):** GM-only (NOT on the
  phone whitelist). Structured array mutations for
  `state.party.achievementsList` that `updateCampaign` can't cleanly handle
  (array replacement vs element splice). Add dedupes + trims whitespace;
  remove is rejected if the entry isn't currently in the list. Consumed by
  the Party Sheet's Standing tab.
- **addGlobalAchievement / removeGlobalAchievement (T0c):** GM-only (NOT on
  the phone whitelist). Parallel to the party-achievement pattern; targets
  `state.party.globalAchievementsList`. Same dedupe / trim / reject-if-absent
  semantics. Consumed by the Campaign Sheet's Achievements tab.
- **abortScenario (T0b):** GM-only. Aborts the current scenario mid-play
  without applying rewards. Clears monsters, non-character figures, character
  combat state, finish/finishData, round/phase/elements; transitions
  `state.mode = 'lobby'` directly (skips town). Does NOT transfer XP/gold or
  record the scenario in `party.scenarios`. Validator rejects when
  `mode !== 'scenario'`. Reachable from the controller scenario-controls
  overlay (click scenario name) with a two-step inline confirm.
- **activateFigure (internal):** Long rest characters heal 2 HP on activation
  (or clear wound/poison/bane/brittle). Fires before wound/regenerate processing.
  Monster activation triggers ability card consume + summon actions via
  `processMonsterAbilityActions()`.
- **revealRoom:** Spawns monsters for the revealed room. During play phase
  (`state.state === 'next'`), also draws ability cards for new monster groups
  and re-sorts figures by initiative (per rules §7: revealed monsters act
  during the round they appear).
- **toggleTurn (monster deactivation):** Processes end-of-turn conditions,
  then triggers ability card infuse actions (per rules §6: infuse at end of
  monster turn). Dead standees are cleaned up at end of round, not immediately.
- **advancePhase (next→draw):** Removes dead monster entities, prunes empty
  monster groups, then calls `endRound()` for round increment + element decay.

### Phone Command Permissions
Phone clients are restricted server-side to character-scoped commands
(setInitiative, changeHealth, toggleCondition, setExperience, setLoot,
toggleExhausted, toggleAbsent, toggleLongRest, addSummon, removeSummon,
toggleTurn, renameCharacter, confirmChore, setBattleGoalComplete, claimTreasure,
dismissRewards, setCharacterProgress, backfillCharacterHistory). Each command's target must match the phone's registered
characterName. Commands targeting summons are allowed if the summon owner
matches. Additionally, `moveElement`, `drawLootCard`, `dealBattleGoals`, and
`returnBattleGoals` are in a `PHONE_GLOBAL_ACTIONS` set that bypasses
character-name validation (these are game-global actions with no character
target). All other commands are rejected with an error.

## Build Process
- `app/build.mjs` — builds all three Preact client apps via esbuild
- **Production** (`npm run build`): content-hashed filenames (`main-[hash].js`),
  auto-generates `dist/index.html` + `dist/sw.js` per app with baked-in precache lists
- **Dev** (`npm run dev`): plain `main.js`, source HTML/SW files served directly
- Static server prefers `dist/` files when present, falls back to source for dev
- `npm run import-data` — populates `data/reference.db` from `.staging/` source files
- `npm run extract-books` — extracts scenario/section text from FH book PDFs into `data/reference.db`
- **SW versioning (Phase 6):** Each build emits `BUILD_VERSION` (overridable via
  `GC_BUILD_VERSION` env). The version is (a) baked into each client bundle via
  `esbuild` `define` and (b) written to `app/<role>/dist/build-version.txt`. The
  server reads the txt file on startup and serves it at `GET /sw-version.json`.
  Both the client watchdog (`app/shared/swRegistration.ts`) and the SW's
  `activate` hook compare against this endpoint and self-heal on mismatch.
  Source `app/<role>/sw.js` files are served with `self.GC_SW_VERSION_INJECTED`
  prepended at request time by `server/src/staticServer.ts`.

## Service Worker & Unbrick Page
All three clients (phone, controller, display) register a self-healing
service worker from their `main.tsx` entry via
`app/shared/swRegistration.ts`. SWs are network-first for both navigations
and static assets — cache is offline fallback only. If a device gets stuck
on a stale install, navigate to `https://<server>/unregister` once. The
page (served from `app/unregister.html` with `Cache-Control: no-store`)
unregisters every SW, deletes every cache, and clears local/session
storage, then offers links back to controller/phone/display.

## Reference Data System (Phase 5.1)
Immutable SQLite database (`data/reference.db`) populated by `scripts/import-data.ts`.
Contains all GHS edition data: labels, scenarios, monsters, ability decks/cards,
items, events, sections, personal quests, buildings, treasures, campaign data,
and an asset manifest cataloging ~11,000 images from GHS client and Worldhaven.

### Reference API Endpoints
```
GET /api/ref/scenario-text/:edition/:index    — scenario rules + label text
GET /api/ref/ability-cards/:edition/:deck      — monster ability cards with names
GET /api/ref/labels/:edition?prefix=...        — label lookup by prefix
GET /api/ref/label/:edition/:key               — single label value
GET /api/ref/section/:edition/:sectionId       — section book data
GET /api/ref/items/:edition                    — item catalog
GET /api/ref/assets/:edition/:category         — asset manifest by category
GET /api/ref/asset/:edition/:category/:name    — specific asset lookup
GET /api/ref/scenario-book/:edition/:index     — scenario book data (goals, conditions, intro)
                                                 optional ?group= query param selects
                                                 solo scenarios (group='solo'); default ''
GET /api/ref/section-narrative/:edition/:id     — section narrative text + rewards
GET /api/ref/campaign/:edition/:key             — campaign_data blob (e.g. xpThresholds)
GET /api/ref/treasure/:edition/:index           — single treasure reward string
```

### Types Quick Reference
`ScenarioFinishData` — Phase T1 rewards snapshot on `GameState.finishData`:
per-character `ScenarioFinishCharacterReward[]` (XP/gold/resources/treasures/
battle-goal checks + thresholds + dismissed flag), `outcome`, `scenarioIndex`,
`scenarioLevel`, optional `inspirationGained` (FH victory), `createdAtRevision`.
