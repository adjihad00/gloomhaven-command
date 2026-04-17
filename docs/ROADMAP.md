# Gloomhaven Command — Roadmap

## Phase 1: Server + Shared Library
- [x] Define GameState types (gameState.ts) by mapping GHS JSON structure
- [x] Define Command types (commands.ts) — all 33 command payloads
- [x] Define Protocol types (protocol.ts) — WS message envelopes
- [x] Implement applyCommand engine — pure state mutations
- [x] Implement validateCommand — guard invalid mutations
- [x] Implement turnOrder — initiative sort, phase transitions
- [x] Implement conditions utility — lists, toggle logic, expiry
- [x] Implement elements utility — element board decay per round
- [x] Implement ghsCompat — import/export GHS JSON saves
- [x] Implement diffStates — entity-level diff generation + client-side applyDiff
- [x] Build Express static server (staticServer.ts)
- [x] Build WebSocket hub (wsHub.ts) — connect, broadcast, heartbeat
- [x] Build session manager — tokens, revision tracking, replay buffer
- [x] Build game store — SQLite persistence, load/save
- [x] Build command handler — validate → apply → persist → broadcast
- [x] Integration test: connect two clients, send commands, verify sync
- [x] GHS JSON import endpoint — POST /api/import

## Phase 2: Controller Client
- [x] Scaffold controller HTML + TypeScript entry
- [x] Implement connection UI (setup screen)
- [x] Implement shared WebSocket client (clients/shared/lib/connection.ts)
- [x] Implement client-side state store with diff application
- [x] Build Active Play tab — initiative timeline, health, conditions, turns
- [x] Build Monster Management tab — ability cards, standees, modifier deck
- [x] Build Scenario tab — room reveals, element board, round counter
- [x] Build Loot & Decks tab — loot draw/assign, modifier deck state
- [x] Build Campaign tab — party sheet, unlocks, scenario tracking
- [x] Responsive iPad landscape layout, tab navigation

## Phase R: Controller Rebuild (replaces original Phase 2)
- [x] R1: Data layer — edition file loading, stat lookups, scenario auto-spawn
- [x] R2: Preact app scaffold — three entry points, hooks, mode routing, connection screens
- [x] R3: Core shared components + asset population
- [x] R4: Controller single-screen view — ScenarioView with overlays
- [x] R5: Scenario automation — data-driven setup, auto-spawn, room reveals
- [x] R6: Round flow automation — ability draw, turn order, auto-advance, condition/element automation

## Phase R: Controller Rebuild — Post-R6 Batches (bug fixes + polish)
- [x] R7-R8: Interaction fixes — condition picker, door confirm, modifier overlay, absent bench
- [x] R9: XP system overhaul — dual tracking, scenario-end transfer, fill bar
- [x] R10: Icon system — GHS assets + custom SVGs for game-consistent iconography
- [x] R11: PWA + reconnect + setup wizard + FH loot deck
- [x] R12: Game logic — long rest heal, bless/curse removal, scenario cleanup, GH gold

- [x] R13: UX + connection — heartbeat, resources, conditions, z-index, summary

## Phase R: Controller Rebuild — COMPLETE

## Phase 3: Phone Client — Scenario View
- [x] Scaffold phone HTML + TypeScript entry (Phase R2)
- [x] Character selection/registration on connect (Phase R2)
- [x] Character-scoped ScenarioView — health bar, initiative, conditions, XP, loot, summons
- [x] Initiative input with phase-aware numpad overlay
- [x] Turn banner with active/waiting/done states
- [x] Action bar — end turn, long rest toggle, exhaust with confirmation
- [x] Condition strip + condition picker overlay (edition-aware)
- [x] XP + Loot counter row
- [x] Summon section with expandable HP controls
- [x] Character detail overlay (full controls, XP progress, condition grid)
- [x] Dark fantasy CSS styling — stone buttons, carved health bar, candlelight glow
- [x] Loot interaction — FH loot deck draw via PhoneLootDeckPopup, loot counter read-only
- [x] Server-side permission enforcement per character
- [x] Batch 15: Phone view adjustments
  - [x] Element board (PhoneElementRow) — interactive during active turn only
  - [x] Initiative timeline (PhoneInitiativeTimeline) — auto-show/dismiss lifecycle
  - [x] Condition splash (PhoneConditionSplash) — priority queue, per-condition CSS effects
  - [x] Exhaust auto-popup (PhoneExhaustPopup) — replaces manual exhaust button
  - [x] Loot deck draw popup (PhoneLootDeckPopup) — FH loot card draw/assign
  - [x] Per-character accent theming — CSS custom properties from edition data
  - [x] Landscape two-column layout — CSS Grid at max-height 500px
  - [x] Swipe-to-close on character detail overlay
  - [x] Phone global commands (moveElement, drawLootCard) — bypass character-name check
  - [x] Summon section stubbed (deferred for joint controller development)
  - [x] Two-phase scenario end (prepareScenarioEnd/cancelScenarioEnd/completeScenario)
  - [x] Phone rewards overlay — auto-triggered on all phones, shows XP/gold/resources preview
  - [x] FH loot card viewer in character detail overlay
  - [x] Character switch button in detail overlay
  - [x] Batch 16: Multi-phase scenario setup workflow
    - [x] Enhanced scenario preview (monster portraits, room tiles, loot deck, rules)
    - [x] Chore assignment system (auto-assigns monsters/map/overlays/decks to players)
    - [x] Phone chore overlay with item list and confirmation
    - [x] Rules phase overlay (scenario level, derived values, book references)
    - [x] Battle goals phase overlay (edition-appropriate deal count)
    - [x] 5 new commands (prepareScenarioSetup, confirmChore, proceedToRules, proceedToBattleGoals, cancelScenarioSetup)
    - [x] Controller setup phase tracking overlay
    - [x] Cancel at any phase dismisses all devices
  - [x] Batch 16b: Lobby mode + campaign/one-off
    - [x] Fix diff bug (mode, setupPhase, setupData not broadcast to clients)
    - [x] Add 'lobby' as first-class AppMode (new games start in lobby)
    - [x] Add startScenario command (atomic mode transition)
    - [x] Controller LobbyView with sequential steps (mode → edition → party → scenario → preview → chores → rules → goals)
    - [x] Campaign vs One-Off mode selection on first connection
    - [x] Phone LobbyView (waiting screen + setup phase content)
    - [x] Display LobbyWaitingView
    - [x] Remove ScenarioSetupOverlay and SetupPhaseOverlay from ScenarioView
    - [x] completeScenario transitions to town phase, then lobby
  - [x] Batch 16c: Lobby refinements
    - [x] Default to campaign mode + GH edition (skip mode selection on first load)
    - [x] Graphical edition selection with GHS logo assets
    - [x] Spoiler masking for locked characters (class icon + descriptive name)
    - [x] Battle goal deck API endpoint + phone card dealing during goals phase
    - [x] Town phase placeholder (step list, travel reminder, completeTownPhase command)
    - [x] completeTownPhase command transitions town → lobby

## Phase 4: Display Client — Design Exploration
- [x] Scaffold display HTML + TypeScript entry
- [x] Portrait vertical tower layout (1080×1920 target)
- [x] Initiative timeline (vertical, top-to-bottom) with auto-scroll to active figure
- [x] Character panels — health bar, conditions, XP/loot icons, per-character accent theming
- [x] Monster panels — ability card (right-justified with name), standee grid below card
- [x] Monster innate stats from GHS API — flying, shield, retaliate, conditions on attacks, immunities
- [x] Normal/elite stat differentiation (white vs gold values)
- [x] Attack+condition composite icons (e.g., attack with brittle badge)
- [x] Element board with infusion burst + consumption vortex animations
- [x] Round/scenario info header with sticky scroll behavior
- [x] Scenario footer — special rules, victory/defeat conditions (placeholder text)
- [x] AMD card draw splash — 3D flip animation, landscape card shape, special flares
- [x] Loot card splash — targets looting character's portrait
- [x] Canvas ambient particles — embers (GH), snow (FH)
- [x] Edition theming — GH warm gold, FH ice blue CSS variables
- [x] Auto-scroll + completed figure tray — compact cards stack vertically (right), standees group by type (left)
- [x] Pending initiative layout — characters top, monsters bottom, scenario name visible
- [x] Transition overlays — victory, defeat, round, scenario start
- [x] Lobby waiting view + town view with edition-specific steps
- [x] Production wiring — live WebSocket state, state-driven animations, auto-reconnect
- [x] Display role registration with server
- [x] PWA manifest + content-hashed service worker
- [x] Prototype mode preserved behind URL param (`?prototype=true`)
- [x] Connection status indicator (tiny dot, no modals)
- [ ] Scenario database — special rules, victory/loss conditions from scenario books (deferred)
- [ ] Monster stat database — structured innate stats from stat card images (deferred, using GHS JSON)
- [x] Batch 18a: Server logic bugs + controller standee management
  - [x] Round count starts at 1 (not 0) on scenario start
  - [x] Dead standee cleanup at end of round
  - [x] Controller add/remove standee UI (+ Normal, + Elite, × remove)
  - [x] Room reveal draws ability cards for new monster groups during play phase
  - [x] Monster ability special actions: element consume, element infuse, summon
- [x] Batch 18b: Display UI polish
  - [x] Single icon + colored text for normal/elite monster stat differentiation
  - [x] Hidden initiatives during draw phase (??), simultaneous reveal at play phase
  - [x] Stable compact card tray positioning (always bottom-right)

## Phase 5: Data Pipeline & Polish
- [x] Phase 5.1: Reference data inventory, schema design, and import pipeline
  - [x] Exhaustive inventory of .staging/ data sources (25 editions, ~43K rows)
  - [x] SQLite reference database schema (17 tables + indexes)
  - [x] Import script (scripts/import-data.ts) — labels, scenarios, monsters, abilities, items, events, sections, assets
  - [x] Asset manifest — ~11,000 images cataloged from GHS client + Worldhaven
  - [x] Reference API endpoints (8 new /api/ref/ routes)
  - [x] Server integration (ReferenceDb class, auto-load on startup)
- [x] Phase 5.2: Wire consumers to reference DB — real scenario text, full ability cards
  - [x] Label interpolation engine (app/shared/labelRenderer.ts) — %game.action.X% → inline icons
  - [x] useScenarioText hook — fetches /api/ref/scenario-text, parses labels with prefix filtering
  - [x] Display footer wired to real special rules (fallback for scenarios without labels)
  - [x] Controller LobbyView + SetupPhaseOverlay wired to real rules text
  - [x] Phone PhoneRulesOverlay + LobbyView wired to real rules text
  - [x] useDisplayMonsterData switched from /api/data/ to /api/ref/ability-cards
  - [x] MonsterAbilityActions renderer handles all 30+ action types (conditions, elements, summons, sub-actions)
  - [x] Mock types replaced with shared MonsterAbilityAction — DisplayAbility/DisplayBaseStats types
  - [x] Win/loss conditions remain "See Scenario Book" (data not in DB — deferred to Phase 5.x PDF extraction)
- [x] Phase 5 Bugfix
  - [x] Fixed label icon sizing (16px fixed instead of 1.1em)
  - [x] Phone battle goal card images from Worldhaven + tap-to-select interaction
  - [x] Phone disconnect escape hatch (portrait tap on lobby, button in CharacterDetail for scenario)
  - [x] Display sticky header scroll lock fix (flex layout)
  - [x] Display ability card names from source data (926 FH cards with real names via import fix)
  - [x] Monster ability deck overrides from scenario rules (overrideDeck field, FH scenario 0 hounds)
  - [x] Battle goal deck server-side infrastructure (BattleGoalDeck type, deal/return commands)
  - [x] Worldhaven staging fallback static route for card images
- [x] Phase 5.x: Scenario book PDF text extraction — goals, win/loss conditions, story text
  - [x] BookPdfReader using pdfjs-dist for PDF text extraction
  - [x] ScenarioPageParser with heuristic extraction (win/loss/rules/intro/links)
  - [x] SectionPageParser for section book narrative text
  - [x] scenario_book_data table + extend sections with narrative_text/rewards_text
  - [x] Extract 138 FH scenarios (132 with goal text, 42 with explicit loss conditions)
  - [x] Extract 652 section book entries with narrative text
  - [x] /api/ref/scenario-book and /api/ref/section-narrative endpoints
  - [x] useScenarioBookData hook for all three clients
  - [x] Wire display footer, controller lobby, phone lobby/rules to real win/loss conditions
  - [x] Graceful fallback for non-FH editions and missing book data
- [x] Phase T0a: Player Sheet shell + Overview tab (2026-04-17)
  - [x] `characterThemes.ts` promoted to `app/shared/` (+ `withAlpha` helper);
        display + phone imports updated, cross-client smell removed
  - [x] Design tokens extended in `theme.css` (parchment / leather / gilt /
        class-accent defaults / motion easings / sheet radii)
  - [x] New `setCharacterProgress` command (character-scoped, phone-allowed)
        with whitelisted fields `sheetIntroSeen: boolean` and `notes: string`
  - [x] `CharacterProgress.sheetIntroSeen?` added; pre-T0a saves unaffected
  - [x] `app/phone/sheets/` tree: PlayerSheet container + header + tabs +
        IlluminatedCapital + menu + intro; `tabs/` Overview +
        5 structural placeholders
  - [x] Overview tab: XP bar (wax-seal level-up cue + near-threshold pulse +
        MAX state), 4-up stat medallions (Gold/HP/Scenarios/Perks with
        number-change flash + haptics), **Active Scenario** section
        absorbing all PhoneCharacterDetail controls, Hand preview stub
  - [x] 3-second intro animation ("Your story begins…") persists via
        `setCharacterProgress(sheetIntroSeen, true)`; skip-tap + reduced-motion
        paths both set the flag
  - [x] Controller `PlayerSheetQuickView` replaces `CharacterSheetOverlay`;
        `readOnly` gates progression tabs but preserves Active Scenario
        interactivity for GM
  - [x] Portrait buttons on Lobby / Scenario / Town now open PlayerSheet;
        disconnect flow moved into the sheet header's `⋯` menu
  - [x] `app/shared/styles/sheets.css` (~500 lines) with BEM; wired into
        phone + controller `index.html` and SW precache
  - [x] Removed: `PhoneCharacterDetail.tsx`, `PhoneDisconnectMenu.tsx`,
        `CharacterSheetOverlay.tsx` (absorbed)
- [x] Phase T0b: Party Sheet on controller (+ display decorative) (2026-04-17)
  - [x] Shared home `app/shared/sheets/` for multi-client sheet components
        (PartySheet, PartySheetContext, PartySheetHeader, PartySheetTabs,
        PartySheetIntro + tabs/*). Consumed by controller primary and display
        decorative via direct import.
  - [x] Five tabs: Roster, Standing, Location, Resources (FH only), Events
  - [x] Standing tab: party name, reputation slider with live price-modifier
        chip, party notes, party achievements (add/remove)
  - [x] Resources tab hidden entirely on non-FH editions (gh, jotl, cs, fc, toa)
  - [x] `getReputationPriceModifier(reputation)` helper in
        `packages/shared/src/data/reputationPrice.ts` (brackets per
        GAME_RULES_REFERENCE §16; T2a shopping will reuse)
  - [x] Structured commands `addPartyAchievement` / `removePartyAchievement`
        (GM-only; NOT on phone whitelist; updateCampaign can't cleanly
        mutate arrays)
  - [x] `abortScenario` command (GM-only, mode==='scenario' only) — resets
        scenario combat state, skips town, transitions directly to lobby
        without applying rewards or recording the scenario. Surfaced via
        the controller's scenario-controls overlay with two-step confirm.
  - [x] `Party.sheetIntroSeen?: boolean` flag; leather-book intro animation
        persists via `updateCampaign('sheetIntroSeen', true)`
  - [x] `useCommitOnPause` hybrid-commit hook in `app/shared/hooks/`
        (blur/Enter/1000 ms typing pause); reused by T0d Notes
  - [x] `ControllerNav` persistent ⋯ button mounted at `app/controller/App.tsx`
        in Lobby / Town only (scenario uses the existing ☰ in ScenarioHeader
        to avoid overlapping the element board). Party Sheet reachable
        from every mode via MenuOverlay. Scenario-specific controls
        (Scenario End — Victory / Defeat, Cancel Scenario) moved to a
        new `ScenarioControlsOverlay` triggered by clicking the scenario
        name in the scenario header.
  - [x] `DisplayPartySheetView` replaces idle-lobby (no setupPhase) and
        town-mode views on display. 30 s tab auto-cycle + page-turn
        transition + gilt candlelight flicker. Skips intro, ignores Escape.
  - [x] Gilt-bound tab binding as Party Sheet's signature visual
        (continuous metallic rule broken only at active tab)
  - [x] CSS extended in `app/shared/styles/sheets.css` (appended T0b section,
        ~800 lines) with BEM prefixes (`.party-sheet__*`, `.roster-tab__*`,
        `.standing-tab__*`, `.location-tab__*`, `.resources-tab__*`,
        `.events-tab__*`). Display SW precache + `index.html` link added.
  - [x] Reduced-motion handling for intro / page-turn / gold flash / flicker
  - [x] Tests deferred: no test framework in repo today; helper is pure
        integer logic with small surface. See DESIGN_DECISIONS for rationale.
- [ ] Phase T0c: Campaign Sheet on controller (+ display decorative)
- [ ] Phase T0d: Notes + History tabs (engine additions to `CharacterProgress`)
- [x] Phase T1.1: Display rewards auto-hide when all phones dismiss (2026-04-17)
  - [x] `shouldShowRewards` decoupled from `finishData` lifetime —
        hides once `finish` is final AND every non-absent character
        has `dismissed: true`
  - [x] `finishData` itself still persists through town phase for
        phone/controller reconnect consumption
- [x] Phase T1: Scenario end rewards + cross-device overlays (2026-04-17)
  - [x] `ScenarioFinishData` snapshot type + lifecycle (build on prepare, apply on
        complete, clear on cancel/completeTownPhase/startScenario)
  - [x] Three new commands: `setBattleGoalComplete` (0..3 checks), `claimTreasure`,
        `dismissRewards` — all character-scoped, phone-allowed
  - [x] Engine `applyTreasureReward` helper parsing reference-DB grammar
        (`gold*:N`, `experience:N`, `item*:ID`, `resource:<t>-N`, `battleGoal:N`)
  - [x] `handleCompleteScenario` reads from snapshot when present; fallback path
        preserved for pre-T1 saves
  - [x] ReferenceDb `getCampaignData` / `getTreasure` methods; `/api/ref/campaign/:ed/:key`
        and `/api/ref/treasure/:ed/:index` routes
  - [x] DataContext extended with optional `getCampaignData` / `getTreasure`;
        CommandHandler wires refDb into DataContext
  - [x] Phone `PhoneRewardsOverlay` refactored to read snapshot; adds battle-goal
        stepper, XP-threshold progress bar, treasure claim UI, inspiration banner
  - [x] Controller `ScenarioSummaryOverlay` refactored to card grid; per-character
        battle-goal stepper + treasure claims; rules-§11 fix (includes exhausted chars)
  - [x] New `DisplayRewardsOverlay` — full-bleed read-only tableau mounted from
        App.tsx so it stays visible across scenario→town transition
  - [x] `useFinishData` hook wraps snapshot access with phase flags
- [x] Phase 5.x.1: Extraction cleanup (2026-04-17)
  - [x] Goal regex tolerates whitespace-split `at\s+the\s+end\s+of` and accepts `may be`/`only`
        phrasings (fixes scenarios 107, 115, 128)
  - [x] `Unknown at this time.` fallback preserves hidden goals verbatim (fixes 73, 78, 121)
  - [x] `isCopyrightOnlyPage` content-aware check replaces book-specific page skip
  - [x] Title regex accepts optional letter suffix (`4A`/`74B`) for future variants
  - [x] `scenario_book_data` PK extended with `group_name` column (default `''`)
  - [x] Solo scenario book extraction (`fh-solo-scenario-book.pdf` → 17 solo scenarios with 100%
        goal coverage, stored under `group_name='solo'`)
  - [x] `/api/ref/scenario-book/:edition/:index` accepts optional `?group=` query parameter
  - [x] Coverage report prints at end of extraction run
  - [x] Main coverage improved: 132 → 138 scenarios with goals (100% of 138 extracted)
- [ ] Phase 5.y: Extend display ability card rendering with remaining edge cases
- [ ] GHS save file import/export UI in controller
- [ ] Campaign persistence across sessions
- [x] Undo/redo stack (bounded, 50 actions)
- [x] Scenario setup wizard in controller (batch 11)
- [ ] Monster stat reference overlay
- [x] PWA manifests for phone + controller (batch 11)
- [x] Content-hashed JS bundles + auto-generated SW precache (batch 14)
- [x] Phase 6: Service worker unbrick + self-healing (2026-04-17)
  - [x] `/unregister` static reset page — clears SWs, caches, local/session storage
  - [x] `/sw-version.json` server endpoint + `GC_BUILD_VERSION` file-based version pipeline
  - [x] Network-first SWs for phone/controller/display (new source `app/display/sw.js`)
  - [x] Activate-time server version check → self-destruct on mismatch
  - [x] Client-side `app/shared/swRegistration.ts` watchdog (pre-register version check + `updateViaCache: 'none'` + 5-min poll + `sw-self-destructed` message handler)
  - [x] SW registration moved from inline `<script>` to `main.tsx` on all three clients
  - [x] `BYPASS_PATHS` guard for `/api/`, `/assets/`, `/sw-version.json`, `/unregister`, `/sw.js`
- [ ] Docker image for server deployment
- [ ] README with setup instructions
