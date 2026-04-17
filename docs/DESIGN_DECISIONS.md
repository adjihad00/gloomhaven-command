# Gloomhaven Command — Design Decisions

Append-only log. Each entry: date, decision, rationale. Never delete entries.

---

### 2025-03-24 — Server-authoritative command architecture
**Decision:** Server owns game state. Clients send commands, not state blobs.
**Rationale:** Previous GHS companion apps sent full gameState on every mutation,
causing race conditions, revision conflicts, and the "one behind" desync bug.
Command-based mutations are atomic, validated server-side, and broadcast as diffs.

### 2025-03-24 — Node.js replaces Java ghs-server
**Decision:** Custom Node.js server instead of patching into ghs-server.
**Rationale:** ghs-server's WebSocket protocol was designed for GHS's Angular
client. It has no command validation, no diff broadcasting, no session tokens,
no reconnection replay. Adapting it would require modifying Java source we don't
control. A purpose-built server eliminates the WS/WSS proxy layer entirely.

### 2025-03-24 — Single port, single origin
**Decision:** Server serves static files + WebSocket on one port.
**Rationale:** The HTTPS/WSS mismatch between hosted clients and LAN servers
caused three transport code paths (direct WS, WSS proxy, HTTP polling) and was
the primary source of reconnection churn. Same-origin eliminates this entirely.

### 2025-03-24 — Shared TypeScript engine
**Decision:** Game logic lives in packages/shared, consumed by server + clients.
**Rationale:** Health clamping, auto-kill, condition toggling, turn order, and
element decay were copy-pasted across ghs-controller.html and phone.html. A
shared package means one implementation, tested once, used everywhere.

### 2025-03-24 — Display is portrait vertical tower
**Decision:** Display client uses portrait orientation with single-column layout.
**Rationale:** Physical table setup uses a vertical monitor. A tower layout
(initiative → characters → monsters, top to bottom) fits the aspect ratio and
avoids the two-column cramping that landscape forces on a portrait screen.

### 2025-03-24 — Controller is tabbed landscape
**Decision:** Controller uses tabbed navigation, landscape orientation for iPad.
**Rationale:** Full GM functionality (health, monsters, scenario, loot, campaign)
cannot fit in a single scrolling page. Tabs partition by workflow phase. iPad
landscape provides enough width for content-rich panels without horizontal scroll.

### 2025-03-24 — CSS design system: dark parchment theme
**Decision:** Cinzel (headings) + Crimson Pro (body), dark warm palette
(#1a1410 base, #d3a663 gold accent, #b87333 copper).
**Rationale:** Established in the existing controller/phone apps. Fits the
Gloomhaven aesthetic. Shared via clients/shared/styles/ across all three clients.

### 2026-03-25 — Synchronous SQLite via better-sqlite3
**Decision:** Use better-sqlite3 (synchronous API) instead of async sqlite3.
**Rationale:** Game state saves happen on every command (low frequency, ~1/sec max).
Synchronous writes are simpler, faster for single-writer scenarios, and avoid
callback/promise complexity. The server is single-threaded by design.

### 2026-03-25 — Heartbeat at 15s with 20s stale threshold
**Decision:** Server pings every 15s, marks clients stale after 20s without pong.
**Rationale:** Mobile devices (phones at the table) aggressively kill background
WebSocket connections. 15s keeps NAT mappings alive on most consumer routers.
20s threshold gives one missed cycle before disconnect — avoids false positives
from momentary network hiccups while still catching dead connections quickly.

### 2026-03-25 — Controller setup flow: Import + Manual
**Decision:** After connecting, controller shows "New Game" and "Import GHS Save"
options. No auto-detection of local GHS installations.
**Rationale:** Import provides migration path from existing GHS campaigns. Manual
new game is the clean-start path. Auto-detection adds complexity (needs server-side
filesystem access) with minimal benefit since import covers the use case.

### 2026-03-25 — Vanilla TypeScript with esbuild, no framework
**Decision:** Controller uses vanilla TypeScript with DOM manipulation, bundled
by esbuild. No React, Vue, or other framework.
**Rationale:** The controller is a single-page app with five tabs. State management
is handled by our own StateStore + Connection classes. A framework adds bundle size
and learning curve without proportional benefit for this use case. esbuild produces
a single JS file from TypeScript + workspace imports in <100ms.

### 2026-03-26 — Data layer with abstract loader interface
**Decision:** DataManager in shared package with DataLoader interface. Server uses
filesystem loader; client will use fetch loader. Data API endpoints for client queries.
**Rationale:** GHS edition files contain all character stats, monster stats, scenario
room layouts, and ability decks. Without loading these, the controller can't auto-set
HP, auto-spawn monsters, resolve ability cards, or calculate scenario level. The
abstract loader lets the same lookup code work server-side (for applyCommand automation)
and client-side (for UI dropdowns and stat display).

### 2026-03-26 — DataContext parameter on applyCommand
**Decision:** applyCommand takes an optional DataContext for data-driven automation.
**Rationale:** Commands like setScenario and addCharacter need data lookups (scenario
rooms, character HP tables) but applyCommand must remain a pure function. DataContext
is an interface injected by the server — the engine doesn't know about files or HTTP.
When DataContext is null, commands fall back to payload values or defaults.

### 2026-03-26 — Separate Preact entry points per device role
**Decision:** Three entry points (controller/phone/display) sharing a component
library, not one monolithic app with role conditionals.
**Rationale:** Each device role has fundamentally different interaction patterns
(landscape/portrait, GM/player/read-only). Separate entry points give each device
only the code it needs via tree-shaking. Shared components are the reuse mechanism.
A phone downloads ~26KB, not 80KB+ of controller overlays it never renders.

### 2026-03-26 — Preact over React
**Decision:** Use Preact (3KB) instead of React (40KB+) for the UI framework.
**Rationale:** The app runs on mobile devices over LAN. Preact's API is identical
to React via preact/compat but produces dramatically smaller bundles. All three
entry points are under 28KB minified.

### 2026-04-13 — lastDrawn field on AttackModifierDeckModel
**Decision:** Added `lastDrawn?: string` to the modifier deck model instead of
relying on `deck.cards[deck.current - 1]` for UI display.
**Rationale:** Bless/curse cards are spliced out of `deck.cards` when drawn
(returned to supply per rules). After splice, the index-based approach
(`cards[current - 1]`) points to the wrong card or is out of bounds.
`lastDrawn` stores the actual card ID on every draw, decoupling display
from array position. The UI (`ModifierDeck.tsx`) falls back to the old
index method when `lastDrawn` is undefined for backward compatibility with
pre-batch-12 game saves.

### 2026-04-13 — Dual gold system: FH loot cards + GH coin counter
**Decision:** `handleCompleteScenario()` checks for FH loot deck first, falls
back to `char.loot` (simple coin counter) for GH.
**Rationale:** FH uses a loot card system where card types (money, lumber, etc.)
are drawn and assigned to characters. GH uses a simple counter — each tap of the
gold icon increments `char.loot` by 1. Both editions were already in the codebase
but the scenario-end gold conversion only handled the FH path. Conditional branching
on `state.lootDeck?.cards?.length > 0` cleanly separates the two systems without
breaking either.

### 2026-04-13 — Heartbeat keep-alive vs application-level health check
**Decision:** The 30-second heartbeat monitor sends a keep-alive pong but does NOT
wait for a server response. The more aggressive `checkConnectionHealth()` (send pong,
wait 5s for any server reply) is reserved for `visibilitychange` only.
**Rationale:** The server uses protocol-level WebSocket pings (`ws.ping()`), which
are invisible to the browser's `onmessage` handler. Application-level pong messages
are received by the server but not echoed back. If the heartbeat used
`checkConnectionHealth()`, it would timeout every 30 seconds and force constant
reconnections during idle periods. The keep-alive pong prevents the server's 20s
stale timeout, while `readyState` catches dead sockets. The aggressive health check
is appropriate for `visibilitychange` where the socket may have died during sleep.

### 2026-04-13 — InitiativeNumpad lifted to ScenarioView level
**Decision:** Numpad renders at `ScenarioView` level, outside `.scenario-content`,
instead of inline in `CharacterBar`.
**Rationale:** `-webkit-overflow-scrolling: touch` on `.scenario-content` creates
a new stacking context on iOS Safari. Fixed elements inside cannot escape it, so
elements rendered later in the DOM (like the bench strip) paint over the numpad.
Lifting the numpad outside the scroll container eliminates this entirely. Callback
prop (`onOpenNumpad`) threads through `FigureList` to `CharacterBar`.

### 2026-04-13 — Scenario summary overlay before reward application
**Decision:** Victory/Defeat buttons show a summary overlay instead of firing
`completeScenario` directly. Rewards are only applied after explicit confirmation.
**Rationale:** Players need to see what each character earned before it's committed.
The summary calculates and previews XP (scenario + bonus), gold (coins × conversion),
and FH resources per character. This also prevents accidental taps from completing
a scenario prematurely.

### 2026-04-13 — Poison as visual reminder, not auto-applied to manual HP changes
**Decision:** `handleChangeHealth()` does NOT add +1 damage for poison on manual
HP taps. A comment in the code explains this is deliberate.
**Rationale:** Per game rules, poison adds +1 per damage SOURCE (attack), not per
HP tap on the controller. Manual HP taps represent arbitrary health changes (heals,
damage from various sources). Automated sources (wound at turn start) handle the
poison +1 correctly in `applyTurnStartConditions()`. The UI shows a poison icon as
a visual reminder for the player to account for it during attack resolution.

### 2026-04-13 — Edition-specific condition constants with getConditionsForEdition()
**Decision:** Condition lists are filtered per edition using `getConditionsForEdition()`
in `packages/shared/src/utils/conditions.ts`.
**Rationale:** GH and FH have different condition sets (e.g., bane/brittle/ward/impair
are FH-only). Using a single hardcoded list caused the monster condition picker to show
unavailable conditions. The function takes an edition string and returns the appropriate
conditions, excluding AM deck-only conditions (bless, curse, empower, enfeeble).

### 2026-04-13 — EDITION_INITIAL_SCENARIOS hardcoded fallback
**Decision:** `ScenarioSetupOverlay` uses a hardcoded `EDITION_INITIAL_SCENARIOS` map
(e.g., `gh → "1"`, `fh → "0"`) as a fallback when scenario unlock data is unavailable.
**Rationale:** The data layer doesn't track campaign progress or scenario unlocks yet.
Without a fallback, the setup wizard would have no default scenario to select. The
hardcoded map covers the initial scenario for each supported edition.

### 2026-04-13 — XP_THRESHOLDS with index=level convention
**Decision:** `XP_THRESHOLDS` array in `packages/shared/src/data/levelCalculation.ts`
uses index=level (i.e., `XP_THRESHOLDS[2] = 95` means level 2 requires 95 XP).
**Rationale:** Direct indexing avoids off-by-one errors when checking if a character
can level up. The thresholds match the rulebook exactly: [0, 45, 95, 150, 210, 275,
345, 420, 500].

### 2026-04-13 — Fixed-position popups for condition picker escaping scroll containers
**Decision:** The `StandeeConditionAdder` popup uses `position: fixed` with a
full-viewport backdrop (`.cond-adder-portal`) instead of absolute positioning.
**Rationale:** Monster standee rows render inside a scrolling container. Absolute-
positioned popups clip at the container boundary or get obscured by sibling elements.
Fixed positioning with `inset: 0` and `z-index: 60` ensures the popup escapes any
scroll container stacking context.

### 2026-04-13 — Door confirmation overlay prevents accidental room reveals
**Decision:** Tapping a door SVG in `ScenarioFooter` shows a confirmation panel
("Open door to Room X?") instead of immediately calling `revealRoom`.
**Rationale:** Room reveals are irreversible — they spawn monsters and change the
game board. On a tablet, accidental taps are common. The confirmation overlay
(`pendingDoor` state) adds a Cancel/Open Door choice with minimal friction.

### 2026-04-13 — Absent character bench strip with greyscale portraits
**Decision:** Absent characters render in a horizontal strip below the initiative-
sorted figure grid, with greyscale portrait thumbnails.
**Rationale:** Absent characters should not appear in the initiative order but must
remain accessible for toggling back to active. The bench strip uses `filter: grayscale(1)`
to visually distinguish absent from active characters.

### 2026-04-13 — Dual XP tracking: scenario vs career
**Decision:** `character.experience` tracks in-scenario XP (resets each scenario).
`character.progress.experience` tracks career/total XP (persists across scenarios).
`completeScenario` transfers scenario XP + bonus XP into career XP.
**Rationale:** GHS stores both values but earlier code only used `character.experience`.
The scenario XP dial needs to reset to 0 at scenario start while career XP accumulates.
The transfer happens in `handleCompleteScenario()` before resetting combat state.

### 2026-04-13 — Phone ScenarioView: overlay state machine pattern
**Decision:** Phone ScenarioView uses a discriminated union `OverlayState` for overlay
management, identical pattern to the controller's ScenarioView.
**Rationale:** The controller established this pattern (batch 13) and it works well:
a single `activeOverlay` state prevents multiple overlays from fighting for z-index,
makes close-on-backdrop-tap trivial, and keeps the component tree flat. The phone
has three overlays (numpad, condition picker, character detail) managed by one state.

### 2026-04-13 — Phone components as phone-specific, not shared
**Decision:** Phone components (`PhoneHealthBar`, `PhoneInitiativeSection`, etc.) are
phone-specific in `app/phone/components/`, not added to the shared `app/components/`.
**Rationale:** Phone components have fundamentally different layouts, touch targets,
and visual weight than their controller counterparts. The controller's `CharacterBar`
packs HP, initiative, conditions, XP, and loot into a single card row. The phone
spreads them across the full viewport. Forcing shared components to handle both
layouts would add complexity with no benefit — they share logic patterns but not UI.

### 2026-04-13 — Character color from data API, not stored on Character model
**Decision:** Phone fetches character class color via `useDataApi(\`edition/character/name\`)`.
The color is not part of the `Character` type in `GameState`.
**Rationale:** Character color is edition data (static), not game state (mutable).
Storing it on the Character model would mean duplicating edition data into the game
state. The controller passes it as a prop from edition data lookups; the phone
fetches it directly via the data API hook.

### 2026-04-13 — Phone CSS: layered shadows for carved/stone aesthetic
**Decision:** Phone health bar, numpad keys, and action buttons use layered
`box-shadow` (inset + outer) with subtle gradients to create a carved/embossed feel.
**Rationale:** The controller got "good enough" flat styling during the rapid fix
batches. The phone is the first client built with visual polish as a primary goal.
Layered shadows create the illusion of physical depth — stone tiles, carved bars,
embossed buttons — that fits the dark fantasy tabletop aesthetic without images or
additional assets. All effects use CSS only (no textures, no SVG backgrounds).

### 2025-03-24 — Assets gitignored, populated locally
**Decision:** Game images/data live in assets/ but are not committed to git.
**Rationale:** GHS images, Worldhaven, Creator Pack, and Nerdhaven assets are
licensed or third-party. The repo contains only code. assets/README.md documents
how to populate the directory from local downloads.

### 2026-04-14 — Content-hashed JS bundles with build-time SW generation
**Decision:** esbuild produces `main-[hash].js` in production. Build script
generates `dist/index.html` (with hashed script reference) and `dist/sw.js`
(with baked-in precache list and content-derived cache name) per app role.
Dev/watch mode uses plain `main.js` with source HTML/SW files unchanged.
**Rationale:** The manual `CACHE_VERSION` bump required remembering to update
it on every deploy. Forgetting caused phones to serve stale cached JS (happened
in Phase 3). Content hashing makes cache invalidation automatic — any code or
CSS change produces new hashes, the SW precache list updates, and the SW cache
name changes. Generated files go to gitignored `dist/` dirs so source files
stay clean. Static server prefers `dist/` files when present (production) and
falls back to source files (dev). Hashed JS gets `immutable` cache headers.

### 2026-04-14 — Phone command permission enforcement model
**Decision:** Server enforces a whitelist of 12 commands that phone clients may
send. Each command's character target is extracted and verified against the
phone's registered `characterName`. Non-whitelisted or wrong-target commands
are rejected with an error (not a disconnect).
**Rationale:** Without enforcement, any phone could send commands for any
character or trigger GM actions (advance phase, reveal room, complete scenario).
The whitelist approach is explicit: only character-scoped actions are allowed,
and the target must match. Commands targeting the phone's own summons are
permitted (summon owner = registered character). The extraction logic handles
three payload shapes: `payload.characterName`, `payload.target` (CommandTarget),
and `payload.figure` (FigureIdentifier).

### 2026-04-14 — Phone global commands bypass character-name validation
**Decision:** `moveElement` and `drawLootCard` are added to the phone command
whitelist in a separate `PHONE_GLOBAL_ACTIONS` set that skips character-name
validation.
**Rationale:** Element infusion and FH loot card draws are game-global actions,
not character-scoped. They have no `characterName` or `target` field in their
payloads. Adding them to the standard whitelist would fail the character-match
check. The global actions set allows these through without loosening the
character-scoped enforcement for all other commands.

### 2026-04-14 — Landscape two-column layout at max-height 500px
**Decision:** Phone ScenarioView switches to a CSS Grid two-column layout when
`max-height: 500px` (landscape phones). Left column: HP bar, initiative,
turn banner. Right column: conditions, elements, counters.
**Rationale:** Portrait layout stacks everything vertically, which overflows
badly in landscape. A two-column split uses the extra width while keeping the
most critical controls (HP, initiative) immediately visible. The `max-height`
breakpoint targets landscape phones specifically — tablets in landscape are
tall enough to keep portrait layout.

### 2026-04-14 — Per-character accent theming via CSS custom properties
**Decision:** `App.tsx` sets `--phone-accent`, `--phone-accent-glow`, and
`--phone-accent-dark` CSS custom properties on the root element based on
the character's class color fetched from edition data.
**Rationale:** Each Gloomhaven character class has a signature color. Using it
as the accent color across HP bar, initiative glow, turn banner, action bar,
numpad, and detail overlay makes the phone feel personalized and immediately
identifiable at the table. CSS custom properties avoid duplicating color logic
across components — one set point in App.tsx, consumed everywhere via `var()`.

### 2026-04-14 — Condition splash with CSS-only per-condition effects
**Decision:** `PhoneConditionSplash` shows a full-screen reminder on turn start
with priority-ordered queue (stun first) and per-condition CSS effects
(wound=red vignette, stun=shake+grey-blue, poison=green pulse, etc.).
4-second auto-dismiss or tap to advance.
**Rationale:** On a phone, conditions are easy to forget — a small icon strip
is not enough. The splash forces acknowledgment. Per-condition visual effects
(CSS-only, no images) make each condition instantly recognizable. Priority
ordering ensures stun (which skips the turn) is shown first. The 4-second
auto-dismiss keeps the game moving without requiring interaction.

### 2026-04-14 — Initiative timeline auto-show/dismiss lifecycle
**Decision:** `PhoneInitiativeTimeline` appears automatically when the play
phase starts, auto-dismisses when the player's turn begins, and re-appears
after End Turn. Horizontal strip with character/monster portrait thumbnails
sorted by initiative; active figure has gold glow.
**Rationale:** Phone players need to see turn order but don't need it during
their own turn (they already know it's their turn from the TurnBanner). Showing
it between turns answers "who's next?" without permanent screen real estate
cost. Auto-show/dismiss avoids manual toggling.

### 2026-04-14 — Exhaust auto-detection replaces manual button
**Decision:** Removed the Exhaust button from `PhoneActionBar`. Added
`PhoneExhaustPopup` that auto-triggers when HP reaches 0.
**Rationale:** Manual exhaust was redundant and error-prone — players rarely
need to voluntarily exhaust, and when they do it's because they're at 0 HP.
The popup provides a dramatic full-screen confirmation (skull icon, deep red)
with Confirm (exhaust) or Cancel (back to 1 HP). This prevents accidental
exhaustion while making the intentional case unmissable.

### 2026-04-14 — Summon section deferred for joint development
**Decision:** `PhoneSummonSection` is stubbed (returns null) with a TODO
comment. Deferred until joint development with the controller summon system.
**Rationale:** Summon management on the phone requires interaction patterns
(add summon, track HP, move in initiative) that must be consistent with how
the controller handles summons. Building it independently risks divergence.
Stubbing it now keeps the component slot in place for later implementation.

### 2026-04-14 — Campaign mode as default, GH as default edition
**Decision:** New games default to `party.campaignMode = true` and `edition = 'gh'`. The game mode selection screen (Campaign/One-Off) is accessible from the lobby's "Settings" button but not shown on first load.
**Rationale:** Most players run campaigns. Requiring an explicit mode selection on every new game code adds friction. GH is the most common edition and a sensible default. One-off mode can be enabled from settings for casual play.

### 2026-04-14 — Spoiler masking for locked characters
**Decision:** Character selection in the lobby checks the `spoiler` field from character data and the `unlockedCharacters` arrays on both `GameState` and `Party`. Locked characters show the class SVG icon and `characterClass` name instead of portrait and real name. They cannot be selected.
**Rationale:** Gloomhaven has locked character classes that are unlocked through retirement and campaign progression. Showing their full names and portraits is a spoiler. The GHS character data includes a `spoiler: boolean` field and class icon SVGs exist at `assets/ghs/images/character/icons/{edition}-{name}.svg`.

### 2026-04-14 — Battle goal card dealing via data API
**Decision:** Added `/api/data/:edition/battle-goals` endpoint that reads from `.staging/ghs-client/data/{edition}/battle-goals.json`. Phone LobbyView fetches and deals random cards during the goals phase.
**Rationale:** Battle goal data (cardId, name, checks) exists in GHS data files. Dealing happens client-side (random shuffle + slice) since the server doesn't track which goals each player received. The dealt cards are stable per component mount via `useMemo`.

### 2026-04-14 — Town phase placeholder with step reminders
**Decision:** After `completeScenario`, mode transitions to `'town'` (not `'lobby'`). The TownView shows an ordered list of town phase steps (edition-appropriate: GH has 3 steps, FH has 5). A "Town Phase Complete" button fires `completeTownPhase` which transitions to `'lobby'` for scenario selection. Travel phase reminder is included.
**Rationale:** The full game loop is: scenario → town → travel → scenario. Even without town phase implementation, showing the steps as a checklist keeps players aware of the physical actions needed between scenarios. The placeholder establishes the mode transition pattern for future development.

### 2026-04-14 — Lobby as a first-class AppMode
**Decision:** Added `'lobby'` to the `AppMode` union type. New games start in lobby mode. The lobby is a dedicated full-screen view, not an overlay on ScenarioView.
**Rationale:** The overlay-based setup approach had three problems: (1) overlays inside ScenarioView's scroll container caused stacking context issues on iOS Safari, (2) the "no game in progress" empty state was confusing limbo that didn't clearly communicate the app's state, (3) reconnecting clients had no way to know if setup was in progress without client-side guessing. Making lobby a server-driven mode (`state.mode = 'lobby'`) solves all three: it uses the existing mode routing infrastructure, provides clear separation from scenario play, and handles reconnection automatically.

### 2026-04-14 — Campaign vs One-Off game modes
**Decision:** First connection to a game code presents a "Campaign" or "One-Off" choice. Campaign mode locks in edition and party, so returning connections skip directly to scenario selection. One-off mode shows the full edition → party → scenario flow each time.
**Rationale:** Campaign players don't want to re-select their edition and characters every session. Using `state.party.campaignMode` (already in the GHS Party type) the lobby skip logic is trivial: if `campaignMode && hasCharacters`, jump to scenario selection. Future campaign management (character retirement, party changes) will be handled via a dedicated campaign menu.

### 2026-04-14 — startScenario command atomically transitions to scenario mode
**Decision:** Added `startScenario` command that atomically: runs `handleSetScenario` (spawns monsters, builds decks), sets `mode = 'scenario'`, and clears `setupPhase`/`setupData`. Replaces the previous two-command pattern of `setScenario` + `cancelScenarioSetup`.
**Rationale:** Calling two separate commands left a window where the mode was wrong (still lobby but scenario was being set up). The atomic command ensures all clients transition simultaneously and cleanly.

### 2026-04-14 — Multi-phase scenario setup with chore assignment
**Decision:** Scenario setup uses a 5-phase collaborative workflow (Preview → Chores → Rules → Goals → Start) mirroring the two-phase `prepareScenarioEnd` pattern. New GameState fields `setupPhase` and `setupData` broadcast setup state to all clients. Five new commands: `prepareScenarioSetup`, `confirmChore`, `proceedToRules`, `proceedToBattleGoals`, `cancelScenarioSetup`.
**Rationale:** The immediate `setScenario` flow gave no time for physical table setup. Players scrambled to find standees, tiles, and decks simultaneously. The multi-phase workflow assigns specific chores to each player's phone (monsters, map tiles, overlays, decks) based on player count. Auto-assignment distributes work evenly. Each player confirms completion on their phone, creating a synchronized checkpoint before the GM advances. The rules phase ensures all players see scenario level and derived values. Battle goals phase reminds players of the deal count per edition.

### 2026-04-14 — Chore auto-assignment by player count
**Decision:** Controller auto-assigns chores based on active character count: 1 player gets all, 2 players split monsters/tiles, 3 players spread monsters/map/overlays, 4 players add deck collection as a fourth chore.
**Rationale:** Manual assignment would slow down the setup flow. The auto-assignment is a reasonable default for most scenarios. The chore data is sent in the `prepareScenarioSetup` command payload, so the server doesn't need to know about the assignment logic.

### 2026-04-14 — Data-driven vs book-reference approach for scenario preview
**Decision:** The enhanced scenario preview shows all data available from GHS JSON files (monster types with portraits, room tile references, loot deck config, rule count). For win conditions and detailed rules text, it shows "See Scenario Book" since this narrative content is not in the JSON data.
**Rationale:** The GHS scenario JSON files contain comprehensive structural data (monsters, rooms, overlays, rules conditions) but not the narrative text from the scenario book. Showing what we have is useful (monster portraits help identify standees, tile references help find map tiles), and the book reference keeps the GM anchored to the physical components.

### 2026-04-14 — Loot read-only on phone
**Decision:** Phone loot counter is read-only (no +/- buttons). Loot
assignment is managed by the controller. FH loot draw button triggers
`drawLootCard` command when available.
**Rationale:** Loot is a shared game resource — the GM assigns coins and FH
loot cards from the controller. Letting phones self-increment would cause
double-counting. The read-only display shows what was assigned. The FH draw
button is an exception because drawing from the shared loot deck is a
player-initiated action per the rules.

### 2026-04-14 — Phone element board interactive only during active turn
**Decision:** `PhoneElementRow` renders the shared `ElementBoard` component
but only enables interaction (element cycle clicks) during the character's
active turn.
**Rationale:** Element infusion happens during ability resolution, which only
occurs during your turn. Allowing infusion outside your turn would violate
game rules and cause state conflicts with the controller's element board.

### 2026-04-14 — Two-phase scenario completion with prepareScenarioEnd
**Decision:** Scenario completion uses a two-phase flow: `prepareScenarioEnd`
sets `state.finish = 'pending:victory'` (broadcast to all clients), then
`completeScenario` processes rewards and sets `state.finish = 'success'`.
`cancelScenarioEnd` clears the pending state.
**Rationale:** Phone clients need to show a rewards preview overlay when the
GM initiates scenario end on the controller. The rewards overlay must compute
from the pre-completion state (XP, loot, loot cards haven't been transferred
yet). Broadcasting `pending:*` via normal state diffs lets all phones detect
the transition and show the overlay simultaneously. The GM's "Claim Rewards"
then fires `completeScenario` which processes everything; phones detect the
transition to `'success'` and show a "claimed" confirmation. "Cancel" clears
the pending state, dismissing overlays on all devices.

### 2026-04-14 — Per-character theming from character mat color palettes
**Decision:** `characterThemes.ts` maps character names to hand-picked
`{ bg, accent, flair }` color palettes derived from character mat artwork.
Three CSS variables (`--phone-bg`, `--phone-accent`, `--phone-flair`) set on
`document.documentElement`. Unmapped characters fall back to generating a
palette from the GHS `color` field.
**Rationale:** The single GHS `color` field was insufficient — it only provides
one accent color. Character mats have rich, distinct identities (Boneshaper =
dark green + bright green + pink, Blinkblade = teal + cyan, Drifter = brown +
gold). Storing palettes in a static map avoids runtime image analysis and keeps
the bundle small (~1KB). Setting variables on `:root` via JS ensures they
propagate to all components without prop drilling.

---

### 44. Display client prototype mode (2026-04-15)
**Decision:** Display client runs in `PROTOTYPE_MODE` with full mock data (characters,
monsters, elements, scenario rules) allowing visual design iteration without a live
game session. Keyboard shortcuts (Tab, 1-6, a, l, v, d, r) cycle through states.
**Rationale:** The display is a visual centerpiece — design approval requires
interactive previewing of all states (active, done, pending, compact) without
coordinating multiple devices. Mock data ensures consistent testing scenarios.

### 45. Monster innate stats from GHS API, not hardcoded (2026-04-15)
**Decision:** Display fetches monster stats from `/api/data/{edition}/monster/{name}`
at runtime via `useDisplayMonsterData` hook, extracting flying, shield, retaliate,
conditions on attacks, and immunities from the GHS JSON data at the current scenario
level. Mock data serves as fallback only.
**Rationale:** Hardcoded mock data caused incorrect displays (Snow Imp showed "Ranged"
instead of "Flying"). The GHS JSON files already contain complete per-level stat data
for all editions. Fetching at runtime ensures accuracy as scenario level changes.

### 46. Standees outside monster cards (2026-04-15)
**Decision:** Monster standees render as siblings below the monster card in a
`.figure-group` wrapper, rather than inside the card body.
**Rationale:** Keeps monster card height uniform regardless of standee count. Allows
standees to be independently repositioned (e.g., moved to completed tray at bottom-left)
without affecting card layout.

### 47. Completed figure tray with compact cards + standees (2026-04-15)
**Decision:** When a figure's turn completes, its card transforms to a compact variant
(~1/4 width) and moves to a vertical stack at bottom-right. Monster standees move to
bottom-left grouped by type at full size.
**Rationale:** Players need to see completed figures' health/conditions for targeting
and battle goal tracking, but active figures should dominate the screen. Compact cards
preserve essential info (HP, conditions, shield/retaliate) without competing for
vertical space. Standees stay full-size because individual standee health is
frequently referenced for targeting decisions.

### 48. Action icon inversion for dark backgrounds (2026-04-15)
**Decision:** Action SVG icons (shield, retaliate, attack, fly, move, range, loot, XP)
use `filter: invert(1) brightness(0.85)` to render as white/light grey. Condition icons
(brittle, wound, poison, etc.) are NOT inverted since they are already colored.
**Rationale:** GHS action SVGs are dark-filled, invisible on the dark fantasy background.
Inverting produces clean white icons. Condition icons are multi-colored by design and
must retain their original colors for quick visual identification.

### 49. Attack + condition composite icon (2026-04-15)
**Decision:** When a monster's stat card includes conditions on attacks (e.g., brittle),
display a white inverted attack icon with the colored condition icon overlaid as a small
badge at bottom-right, rather than showing the condition icon alone.
**Rationale:** A standalone condition icon under the monster name is ambiguous — it could
mean the monster is immune to it, applies it, or starts with it. The composite clearly
communicates "attacks from this monster cause this condition."

### 50. Prototype mode gated on URL param (2026-04-15)
**Decision:** Display client's `PROTOTYPE_MODE` changed from a hardcoded `true` constant
to `new URLSearchParams(window.location.search).get('prototype') === 'true'`. Default is
production (live WebSocket data). Accessible at `/display?prototype=true`.
**Rationale:** The prototype mode with mock data and keyboard controls (Tab for active
figure cycling, a/l/v/d/r for splash demos, 1-6 for element cycling) is valuable for
future design iteration. A URL param preserves this workflow without build-time flags or
conditional compilation. The mock data module is only imported in prototype mode.

### 51. State transition detection via useStateTransition hook (2026-04-15)
**Decision:** Created `useStateTransition<T>(value, callback, suppressUntilReady)` hook
that compares previous and current values via `useRef`, firing a callback on change.
Skips the first render to avoid false triggers on initial state load.
**Rationale:** The display needs to trigger animations (AMD card flip, loot splash,
round flourish, victory/defeat overlay) when specific state fields change. A generic
comparison hook keeps ScenarioView clean — each transition is one `useStateTransition`
call rather than manual `useEffect` + ref tracking. The `suppressUntilReady` parameter
prevents animations from firing on reconnect (where current state arrives as a bulk
update, not incremental changes).

### 52. Unattended auto-reconnect for display client (2026-04-15)
**Decision:** Display registers as `role: 'display'` with the server. Auto-connects on
page load from `localStorage` game code. Connection status shown as a tiny dot (10px)
in the top-right corner: hidden when connected, amber pulse when reconnecting, red when
disconnected. No error modals, no banners, no toast notifications.
**Rationale:** The display is a TV/monitor with no keyboard or mouse. Any UI that
requires user interaction to dismiss (modals, banners with close buttons) would block
the display indefinitely. The connection dot is visible from across the room for
debugging but doesn't interfere with gameplay. Errors are logged to console only.

### 53. Hidden config menu on display client (2026-04-15)
**Decision:** Display client has a config menu overlay accessible by clicking the
Round number (scenario mode), edition title (lobby), or "Town Phase" title (town).
The menu shows the current game code and a Disconnect button that clears localStorage
and returns to the connection screen.
**Rationale:** The display is read-only with no visible UI controls, but users need a
way to disconnect and switch game codes without restarting the browser. Making the
Round number clickable keeps the menu hidden from casual observers at the table while
remaining accessible to the person setting up the display. The menu trigger varies by
mode so it works regardless of game state.

### 54. Cert file validation guards against empty files (2026-04-15)
**Decision:** `findCerts()` in `server/src/index.ts` now validates cert files are non-empty
via `statSync().size > 0` before using them. Empty files trigger a console warning and the
server falls back to the next cert source in the search order (Certbot → mkcert → HTTP).
**Rationale:** Certbot on Windows creates 0-byte placeholder files in `live/` when it
fails to create symlinks to `archive/` (symlinks require admin privileges). The previous
`existsSync()` check passed for 0-byte files, causing the server to serve a broken cert.
Chrome caches bad cert state aggressively (HSTS), so even after fixing the files, users
had to manually clear Chrome's security cache. Preventing the server from ever serving an
empty cert eliminates this class of problem entirely.

### 55. Scenario rules footer placeholder (2026-04-15)
**Decision:** In production mode, the scenario footer shows "See Scenario Book" for
special rules, victory conditions, and loss conditions. In prototype mode, mock rules
text is displayed.
**Rationale:** Real scenario rules text is not in the GHS JSON data files — it requires
a scenario database (deferred to Batch 18). The placeholder keeps the footer visible
and structurally correct while clearly directing players to the physical book.

### 56. Monster ability action processing at activation/deactivation (2026-04-16)
**Decision:** Monster ability card special actions (element consume, element infuse, summon)
are processed via `processMonsterAbilityActions()` called at two points: consume + summon
on `activateFigure` (monster turn start), infuse on `handleToggleTurn` deactivation branch
(monster turn end). DataContext is threaded through the toggle/activate call chain.
**Rationale:** Per rules §6, monster element consumption fires at the start of the first
monster's turn (benefits all entities), and infusion fires at the end of the last monster's
turn. In this codebase, monster groups activate/deactivate as a unit, so activation =
consume + summon, deactivation = infuse. Processing at these two existing hook points
avoids adding new command types and keeps the flow consistent with character turn-start
processing already in `activateFigure`.

### 57. Refactored drawMonsterAbilities into composable helpers (2026-04-16)
**Decision:** Extracted `groupMonstersByDeck()` and `drawAbilityForDeckGroup()` from the
monolithic `drawMonsterAbilities()`. Added `drawAbilitiesForNewMonsters()` for room reveal.
**Rationale:** Room reveals during play phase need to draw ability cards for newly spawned
monster groups using the same deck-sharing and shuffle logic as start-of-round draws.
Duplicating the logic would create divergence bugs. The helper functions are reused by both
the start-of-round `drawMonsterAbilities()` and the mid-round `handleRevealRoom()` paths.

### 58. Dead standee cleanup at end of round, not immediately (2026-04-16)
**Decision:** Dead monster entities are removed from `monster.entities[]` during
`handleAdvancePhase()` at the 'next' → 'draw' transition, after end-of-round shuffles
but before `endRound()` deep-clones the state.
**Rationale:** Dead standees persist during the round they died for two reasons: (1) loot
token placement — the GM needs to see where each monster died, and (2) battle goal tracking
("Kill X enemies" goals reference death counts). Cleaning at end-of-round is the natural
GH/FH cadence. Empty monster groups are also pruned to prevent display artifacts.

### 59. Inline standee add/remove in MonsterGroup (2026-04-16)
**Decision:** "+ Normal" and "+ Elite" buttons render inline below the standee list in
`MonsterGroup.tsx`, not in a separate overlay.
**Rationale:** Overlays add interaction friction (open → act → close) for a frequent action.
Monster spawns from special rules, forgotten standees, and mid-round summons need fast access.
Inline buttons match the existing pattern of HP +/- and condition buttons on standee rows.
The remove "×" button mirrors the kill action but operates at the data level (useful for
correcting setup mistakes without dealing damage).

### 60. Initiative hiding on display during draw phase (2026-04-16)
**Decision:** Display client masks character initiative values as `??` during draw phase
(`state.state === 'draw'`). Long rest shows `99` (publicly declared per rules). Monsters
show empty (no ability card drawn yet). All values reveal when play phase begins.
**Rationale:** Per rules §2, initiative cards are selected secretly and revealed
simultaneously. The display is the shared source of truth at the table — showing entered
initiatives before the reveal moment breaks the secrecy rule and gives late-committing
players a strategic advantage. The `phase` prop on `DisplayFigureCard` keeps the masking
logic self-contained.

### 61. Single icon with dual-colored values for monster stats (2026-04-16)
**Decision:** When normal and elite monsters have different values for the same innate stat
(shield, retaliate), render one icon with white (normal) and gold (elite) values separated
by `/`. Range sub-actions follow the same pattern.
**Rationale:** The previous approach rendered two full `StatActionItem` components, each
with its own icon. On a portrait display viewed from across the table, duplicate icons
waste horizontal space and create visual clutter. A single icon with color-coded values
is more readable at distance and eliminates ambiguity about whether both types have the stat.

### 62. Immutable reference database separate from mutable game state (2026-04-16)
**Decision:** Added `data/reference.db` (SQLite, immutable) alongside the existing
`data/ghs.sqlite` (mutable game state). Reference DB is populated by `scripts/import-data.ts`
from `.staging/` source files and never written during gameplay.
**Rationale:** Game reference data (scenarios, monster stats, ability cards, items, labels,
asset paths) is static per edition. Storing it in SQLite gives: (1) fast indexed lookups vs
scanning JSON files at runtime, (2) a single queryable source for all data needs (the
DataManager in-memory approach only loads 5 categories and doesn't handle labels, items,
events, sections, or assets), (3) clean separation from mutable game state, (4) regenerable
from source files at any time. The `ReferenceDb` class opens read-only at server startup;
the import script recreates the entire DB from scratch each run.

### 63. Asset manifest in reference DB for image path lookups (2026-04-16)
**Decision:** Added `asset_manifest` table cataloging ~11,000 images from GHS client
(~550 files: character portraits, monster thumbnails, action/condition/element icons)
and Worldhaven (~10,600 files: stat cards, ability cards, item cards, event cards, etc.).
Each row maps `(edition, category, name)` to a relative file path with source attribution.
**Rationale:** The app currently builds asset URLs with string concatenation in
`app/shared/assets.ts`. This works for the ~10 image types currently used but doesn't
scale to items, events, character ability cards, or other categories needed for town mode.
A queryable manifest enables: (1) API-driven image discovery (`/api/ref/assets/:edition/:category`),
(2) validation that expected assets exist, (3) supporting multiple sources (GHS vs Worldhaven)
for the same game concept with a `source` column.

### 64. Flattened label keys with dot notation (2026-04-16)
**Decision:** GHS label JSON files (nested objects) are flattened to dot-separated keys
on import. Example: `{ "scenario": { "title": { "fh": { "1": "..." } } } }` becomes key
`scenario.title.fh.1`. Queried via `LIKE 'prefix%'` for prefix lookups.
**Rationale:** GHS label files use 3-5 levels of nesting with inconsistent depth across
categories. Flattening to dot keys makes SQLite queries simple (exact match or prefix
LIKE) without requiring JSON path extraction. The import script's `flattenObject()`
handles arbitrary nesting depth. The `getLabelsPrefix()` query method enables bulk
retrieval (e.g., all scenario rule labels for an edition).

### 65. Client-side label key filtering for prefix queries (2026-04-16)
**Decision:** `useScenarioText` hook filters the `rulesLabels` returned by `/api/ref/scenario-text`
client-side, accepting only keys that match exactly `scenario.rules.{edition}.{index}` or start
with `scenario.rules.{edition}.{index}.` (with a trailing dot before sub-index).
**Rationale:** The server's `getLabelsPrefix()` uses SQL LIKE with a prefix pattern. For
single-digit scenario indices (e.g., scenario "1"), `LIKE 'scenario.rules.fh.1%'` would
match scenario "10", "110", "112", etc. Rather than modifying the Phase 5.1 reference DB
(which would require schema changes), the client filters false positives by checking that
the key suffix after the prefix is either empty or starts with `.`.

### 66. Label interpolation via dangerouslySetInnerHTML (2026-04-16)
**Decision:** `interpolateLabelIcons()` returns HTML strings with `<img>` tags for icons.
Consumer components render via Preact's `dangerouslySetInnerHTML`. A `.label-icon` CSS class
handles sizing (1.1em) and filter (invert for action icons, none for condition/element icons).
**Rationale:** GHS label text contains `%game.action.X%` placeholders that must become inline
SVG icon images. Preact has no JSX interpolation for arbitrary HTML — `dangerouslySetInnerHTML`
is the standard pattern. The label text comes from our own reference DB (not user input), so
the injection risk is controlled. Condition and element icons skip the invert filter because
they are already colored.

### 67. Full action tree rendering in MonsterAbilityActions (2026-04-16)
**Decision:** `MonsterAbilityActions` in `DisplayFigureCard.tsx` renders the complete action
tree from the reference DB, not a filtered subset. Actions are categorized: numeric (totalized
against base stats for move/attack/range), condition (colored icon, no value), element/elementHalf
(colored/dimmed icon), summon (text + name), and sub-actions (recursive, smaller). Unknown
action types render as text fallback.
**Rationale:** Phase 5.1's previous approach filtered to only 5 action types (move, attack,
range, shield, heal), losing conditions, elements, and summons from the card display. The
reference DB now provides the full GHS action tree including `subActions[]` arrays. Rendering
the complete tree gives players the information they need without consulting the physical ability
cards. The recursive `renderAction()` function handles the tree structure naturally.

### 68. Win/loss conditions deferred to PDF extraction (2026-04-16)
**Decision:** Win conditions remain "See Scenario Book" and loss conditions remain "All
characters exhausted." despite wiring other scenario text from the reference DB.
**Rationale:** GHS data files contain scenario structure (monsters, rooms, rules mechanics)
but NOT human-readable goal/win/loss condition text. This text exists only in the physical
scenario books (PDFs available in `.staging/worldhaven/images/books/`). A follow-up Phase 5.x
task will extract all scenario text (introductions, goals, conditions, conclusions, story
summaries) from these PDFs comprehensively, rather than attempting partial extraction now.

### 69. Monster ability deck overrides via scenario rules (2026-04-16)
**Decision:** Added `overrideDeck?: string` field to `Monster` interface. After spawning monsters,
`applyScenarioRuleDeckOverrides()` parses `scenario.rules[].statEffects[].statEffect.deck` and
sets the override on matching monster groups. All deck lookup functions check `overrideDeck` first.
**Rationale:** GHS scenario JSON files already encode scenario-specific ability deck assignments
(e.g., FH scenario 0: hounds use `hound-scenario-0` instead of `hound`). The engine previously
ignored this data, causing monsters to always use their default deck. The override pattern is
minimal (one optional field) and doesn't require changing the deck data model or DataManager.

### 70. Battle goal deck server-side infrastructure (2026-04-16)
**Decision:** Added `BattleGoalDeck` type (`cards: string[], current: number`) to GameState.
Added `dealBattleGoals` and `returnBattleGoals` commands. Deck is shuffled once on first deal
and persists across scenarios. `returnBattleGoals` appends unused cards to the bottom.
**Rationale:** Per rules, the battle goal deck is shuffled once and unused cards go to the bottom
after each scenario. The previous implementation dealt client-side (random shuffle per scenario),
which violated this rule. Server-side deck state enables proper persistence. Phone client-side
dealing remains as a fallback until per-player state tracking is implemented.

### 71. Worldhaven staging fallback static route (2026-04-16)
**Decision:** Added a fallback `express.static()` route serving `.staging/worldhaven/images/` at
`/assets/worldhaven/images/` when the directory exists. Primary route remains `assets/worldhaven/`.
**Rationale:** Battle goal card images (and other Worldhaven assets) are in `.staging/worldhaven/`
but `assets/worldhaven/` may not be populated. Rather than requiring manual copy, the fallback
route serves the staging images directly. The primary `assets/` route takes priority if populated.

### 72. PDF text extraction via pdfjs-dist, not ZIP archives (2026-04-16)
**Decision:** The book extraction pipeline uses `pdfjs-dist` (Mozilla PDF.js) to extract text from
Frosthaven scenario and section book PDFs. The prompt initially assumed the files were ZIP archives
containing pre-extracted text, but investigation revealed they are genuine PDF 1.4 documents with
embedded fonts and extractable text.
**Rationale:** `pdfjs-dist` provides per-page text extraction with position data, enabling line
reconstruction from Y-coordinate changes. The legacy Node.js build works without canvas dependencies.
Text quality is high — all game text (goals, conditions, rules, credits, narrative) is embedded in
the PDFs with standard fonts (Microsoft Sans Serif, Germania One). No OCR needed.

### 73. Heuristic scenario page parsing with multi-title handling (2026-04-16)
**Decision:** `parseScenarioPages()` finds ALL scenario titles on a page (not just one), handling
pages with both a CONT title and a new scenario title. CONT titles are processed first to enable
correct merging. Goal/loss text shared between CONT and new scenarios on the same page is assigned
to the new scenario (the CONT inherits its goal from the merge).
**Rationale:** ~25 FH scenario pages share space between a continuation of one scenario and the
start of another. Single-title parsing missed these new scenarios entirely (lost ~10% of scenarios).
Multi-title detection recovered all 138 unique scenarios (0-137).

### 74. Separate scenario_book_data table from GHS-sourced scenarios (2026-04-16)
**Decision:** Book-extracted data (goals, conditions, introduction, credits) is stored in a new
`scenario_book_data` table, not added as columns to the existing `scenarios` table.
**Rationale:** The `scenarios` table contains GHS JSON-sourced structural data (monsters, rooms,
rules). Book data is from a completely different source (PDF extraction with heuristic parsing).
Keeping them separate means: (1) the import pipeline doesn't need to coordinate with the book
extraction pipeline, (2) book data can be regenerated independently, (3) quality issues in
heuristic extraction don't affect GHS data integrity.

### 75. scenario_book_data PK extended with group_name (2026-04-17)
**Decision:** The `scenario_book_data` primary key is now `(edition, scenario_index, group_name)`
(default `''` for main scenarios, `'solo'` for solo scenarios). The `/api/ref/scenario-book` endpoint
accepts an optional `?group=` query parameter; default `''` preserves existing behavior.
**Rationale:** Solo scenarios use the same page-number-based index scheme as main scenarios but live
in a distinct namespace. Mirroring the `scenarios` table's `(edition, index, group)` PK keeps the
two tables shape-compatible for future joins and avoids synthetic `"solo-1"` prefixes that would
break symmetry and filter UIs. The migration drops+recreates `scenario_book_data` at extraction
time — data is fully re-derived from PDFs on every run, so no hand-entered content is lost.

### 76. Solo scenario book extraction (2026-04-17)
**Decision:** `parseSoloScenarioPage()` handles the FH solo book's different page layout —
scenario name at the bottom rather than in a "N • LOC Name" title. Uses the page number as
`scenario_index`, stores with `group_name='solo'`. The credits page (detected via "Playtesting:" +
"Graphic Design:" markers) is skipped; continuation pages ("CONT. • Name" immediately above the
copyright footer) are merged into the prior base scenario using the same `mergeContinuation()` as
the main scenario books. Name detection only inspects the last two concrete lines before copyright
(skipping label noise like "Loot"/"Rewards") to avoid misreading narrative paragraphs as titles.
**Rationale:** Solo scenarios have no numeric index in the book layout, so the main-book title
regex does not fire. A dedicated parser keeps the main parser untouched while sharing the goal /
loss / section-link helpers. The bottom-up "last two concrete lines" heuristic proved strictly
better than a bounded-window search: pages 17-18 of the solo book have both a new base scenario
("Recharge") and a continuation of the prior scenario ("CONT. • Under the Ice") on the same page —
only the two-line inspection catches both.

### 2026-04-17 — Phase T1: `state.finishData` snapshot separates rewards model from live engine state
**Decision:** Introduce `ScenarioFinishData` — a persisted snapshot populated on
`prepareScenarioEnd`, mutated in place during the pending window by the three new
commands (`setBattleGoalComplete`, `claimTreasure`, `dismissRewards`), applied
atomically by `completeScenario`, and cleared on `cancelScenarioEnd` /
`completeTownPhase` / `startScenario`. Phone, controller, and display rewards
overlays all read the same snapshot instead of re-deriving from live state.
**Rationale:** Prior to T1, each client derived rewards (XP, gold, resources,
threshold progress) from live state with its own logic. After `completeScenario`
transferred rewards to `char.progress`, the live-state view went to zero — so
each overlay had to juggle a "claimed" fallback branch. The three views could
disagree on edge cases. A snapshot separates the presentational rewards model
from the live engine state, so rewards can be read uniformly pending and
post-claim, and so per-character battle-goal / treasure choices accumulate in
one place before atomic application.

### 2026-04-17 — Phase T1: Battle-goal checks persist as a count, not per-card identity
**Decision:** `setBattleGoalComplete` takes a `checks: 0..3` integer per
character, stored on `ScenarioFinishCharacterReward.battleGoalChecks` and
applied as `char.progress.battleGoals += checks` on victory at
`completeScenario`. Per-card dealt-goal tracking (which specific card a player
was dealt and whether they completed *that* card) is deferred.
**Rationale:** Today, battle goals are dealt client-side in
`app/phone/LobbyView.tsx` via a `useMemo` shuffle and the selected card lives
only in a local `useState`. The selection is never persisted to state, so a
card-keyed `setBattleGoalComplete(cardId, completed)` would always target an
empty list. Rules §12 only cares about checkmark count for perk progression —
a count-based command works today and upgrades cleanly to card-keyed persistence
in a future batch that wires up dealt-goal server-side state.

### 2026-04-17 — Phase T1: Treasure reward grammar parsed from reference DB
**Decision:** `applyTreasureReward(char, rewardText)` parses pipe-separated
`key:value` entries from the reference DB's `treasures.reward` column. MVP
keys: `gold`/`goldFh`/`goldGh`, `experience`, `item`/`itemFh`/`itemGh`/
`itemBlueprint`, `resource:<type>-N`, `battleGoal:N`. Unrecognized entries
(`custom:…`, `randomItemBlueprint`, `lootCards:N`, `condition:…`, `damage:…`,
`randomScenarioFh`, etc.) pass through as narrative text for the table to
resolve manually.
**Rationale:** The original T1 prompt assumed text like `+15g` / `N gold` /
`<Item 200>`, but the actual DB grammar from `scripts/import-data.ts` is
`goldFh:15` / `experience:5` / `itemFh:200` / `resource:lumber-3` / etc.
Parsing the real grammar is straightforward; anything exotic stays visible to
the table rather than being silently dropped or misapplied.

### 2026-04-17 — Phase T1: Display rewards overlay mounts at App.tsx
**Decision:** `DisplayRewardsOverlay` mounts from `app/display/App.tsx` as a
sibling to the mode view (lobby/scenario/town), gated only on
`state.finishData`. It layers above the active view.
**Rationale:** `completeScenario` transitions `state.mode` from `'scenario'`
to `'town'`, so mounting the overlay from `ScenarioView` would unmount it
mid-ceremony. Hoisting it to the App shell keeps the rewards tableau visible
from `prepareScenarioEnd` through `completeTownPhase`, matching the phone and
controller behavior and letting the table savor the results without the view
switching out from under them.

### 2026-04-17 — Service worker strategy: network-first + server kill-switch
**Decision:** All three service workers (phone, controller, display) use
**network-first** for both navigations and static assets, with cache only as an
offline fallback. `CACHE_NAME` is version-keyed by a server-issued `SW_VERSION`
string, injected at request time. The server exposes a `/sw-version.json`
endpoint; clients verify it before registering and SWs verify it on `activate`.
Mismatch triggers an immediate self-destruct (unregister + delete all caches +
`location.reload`).
**Rationale:** The previous cache-first SW permanently bricked PWAs after the
LAN HTTPS cert origin changed. Cache-first meant the SW never hit the network
after the initial cache, so a stale app shell resurrected itself on every
load. "Delete Website Data and reboot" was inconsistent on iOS.
This app is **LAN-first, not offline-first**: players are at the table with the
server metres away, and a dead SW is far worse than a slow first load. The
network-first model costs one round-trip per navigation in exchange for
structurally ruling out the stuck-PWA state. The kill-switch gives both server-
and client-initiated recovery paths — on server restart, rebuild, or cert
swap, every client converges to the current version within one page load.
A sibling `/unregister` route serves a self-contained reset page for any device
already stuck under the old cache-first SW.

### 2026-04-17 — Build-time version stamping via file + esbuild define
**Decision:** `app/build.mjs` generates a single `BUILD_VERSION` string per
run and (a) writes it to `app/<role>/dist/build-version.txt`, (b) bakes it into
each client bundle via `esbuild` `define: { 'process.env.GC_BUILD_VERSION': ... }`.
The server reads the same txt file on startup and serves it at `/sw-version.json`.
**Rationale:** The SW version, the client watchdog version, and the server
version must agree for the self-heal logic to be meaningful — otherwise
legitimate matches look like mismatches or vice versa. Env-var piping (`GC_BUILD_ID=$(date +%s) npm run build && ... node dist/server/...`) is a bash-ism that's
fragile on Windows (the primary dev platform here). The file-based approach
works identically in dev and prod, survives process boundaries, and a plain
`npm run build` bumps it automatically. The server falls back to a fresh
`srv-<ts>-<rand>` per boot when no file is present (covers the edge case of
starting the server without ever running the build).

### 2026-04-17 — Phase T0a: Player Sheet as canonical character home
**Decision:** Introduced the **Player Sheet** — a full-screen 6-tab modal
(Overview / Items / Progression / Personal Quest / Notes / History) reachable
from every phone mode via the character-portrait button. Absorbs
`PhoneCharacterDetail` into the Overview tab's **Active Scenario** section.
Replaces the controller-side `CharacterSheetOverlay` with a read-only
`PlayerSheetQuickView` rendering the same component with a `readOnly` context
flag. Placeholder tabs ship with "Available in [batch]" bodies so the
navigation pattern is final from T0a onward (one-time exception to the
no-placeholders rule, granted because the shell needs to be settled before
T2a–d build into it).
**Rationale:** Phase T progression work (T2a–d) was about to build items,
perks, level-up, enhancements, crafting, and personal quest into a `TownView`
tab strip — which would make that the de-facto character home by accident.
T0a establishes the canonical home first so all downstream progression work
has a clear destination. Doing the surface before the features also means the
design system (parchment + leather + gilt + class-accent inline tokens,
Cinzel display / Crimson Pro body, BEM with `player-sheet__*` / `overview-tab__*`
prefixes, motion easings) gets settled on a high-visibility surface that
T0b/c (Party Sheet, Campaign Sheet) will inherit. This sets the bar for
"artifacts worth keeping" across all three sheet types.

### 2026-04-17 — Phase T0a: `setCharacterProgress` instead of widening `updateCampaign`
**Decision:** Added a new character-scoped command
`setCharacterProgress({ characterName, edition, field, value })` with a
server-side field whitelist (`sheetIntroSeen: boolean`, `notes: string`).
Validator rejects unknown fields and enforces the expected value type.
**Rationale:** `handleUpdateCampaign` mutates `state.party[field]` only; it
cannot touch `state.characters[i].progress`. Bending it to accept
character-scoped updates would blur a clean invariant. A structured
character-scoped command is also easier to whitelist in the phone
permission enforcement — `updateCampaign` is not on the phone whitelist
and arguably shouldn't be; `setCharacterProgress` is. This also gives T0d's
Notes tab a ready-made write path (`field: 'notes'`).

### 2026-04-17 — Phase T0a: Class accent CSS vars set inline, not via `[data-class=X]` rules
**Decision:** The Player Sheet root sets `--class-accent`, `--class-accent-glow`,
`--class-accent-dim`, `--class-bg`, and `--class-flair` as inline styles,
sourced from the shared `characterThemes` map via a new `withAlpha(hex, alpha)`
helper. No `[data-class='brute'] { --class-accent: ... }` CSS blocks.
**Rationale:** The `characterThemes.ts` map is already the source of truth in
TypeScript. Duplicating per-class colors in CSS would mean two places to edit
every time a new class lands. Inline vars are zero-maintenance: a new class
entry in the map automatically flows to every component that reads the vars.

### 2026-04-17 — Phase T0a: `characterThemes.ts` promoted to `app/shared/`
**Decision:** Moved `app/phone/characterThemes.ts` → `app/shared/characterThemes.ts`
as a standalone logical change (landed before any sheet work). Updated the
two consumers (`app/phone/App.tsx`, `app/display/components/DisplayFigureCard.tsx`).
**Rationale:** The display client was already cross-importing from
`app/phone/` — a directional violation of the client separation. With T0a
introducing controller consumption (via `PlayerSheetQuickView`) the cross-
client import would have become tri-directional. Shared is the correct home;
doing it as a standalone refactor kept the sheet PR focused on the new
surface.

### 2026-04-17 — Phase T0a: Disconnect flow moved into sheet header menu
**Decision:** Portrait buttons in Lobby / Scenario / Town now open the
Player Sheet (previously opened `PhoneDisconnectOverlay` in lobby/town and
`PhoneCharacterDetail` in scenario). Disconnect now lives in the sheet
header's `⋯` menu as a `PlayerSheetMenu` dropdown. `PhoneDisconnectMenu.tsx`
was deleted.
**Rationale:** The portrait is the natural "me" affordance, and the sheet is
the canonical "me" surface. Routing it anywhere else (a separate
disconnect-only sheet, a long-press gesture) would split the model. The
menu hosts disconnect + switch-character; future sheet-level actions
(character settings, audio mute, etc.) have a defined home.

### 2026-04-17 — Phase T0a: Stylized-modern illuminated capital
**Decision:** `IlluminatedCapital` is an inline SVG with a single
flowing corner flourish (vine/ribbon motif) + thin accent rule on the
left margin. Letter in Cinzel 700 at `--class-accent` with class-glow
text-shadow. NOT a heavy medieval manuscript frame.
**Rationale:** Per the T0 design brief's explicit direction — "stylized-
modern, reference modern book design (Penguin Classics covers), not
medieval manuscripts." The full ornate frame would clash with the rest
of the tabletop aesthetic (which leans warm fantasy, not illuminated-book
fantasy). One minimal corner ornament + a marginal rule reads as "book"
without becoming costume.

### 2026-04-17 — Phase T0a: CSS lives in `app/shared/styles/sheets.css` (not `app/phone/styles/`)
**Decision:** The ~500-line Player Sheet stylesheet lives in
`app/shared/styles/sheets.css` and is `<link>`-ed from both
`app/phone/index.html` and `app/controller/index.html`. Both clients also
precache it in their service workers.
**Rationale:** The controller's `PlayerSheetQuickView` renders the same
`PlayerSheet` component and needs the same styles. Placing `sheets.css` in
`app/phone/styles/` would force the controller to reach across client
directories for a stylesheet — the same smell the `characterThemes.ts`
migration resolved. `app/shared/styles/` is the documented home for
cross-client CSS (`theme.css`, `typography.css`, `components.css`,
`connection.css`).

### 2026-04-17 — Phase T0b: Party Sheet as shared multi-client sheet
**Decision:** Landed the Party Sheet as a shared component at
`app/shared/sheets/PartySheet.tsx`, consumed by controller primary
(editable via `PartySheetOverlay`, `readOnly: false`) and display
decorative (via `DisplayPartySheetView`, `readOnly + autoCycle +
skipIntro`) via direct import. Five tabs: Roster, Standing, Location,
Resources (FH only), Events. Resources hides entirely on non-FH editions.
Establishes `app/shared/sheets/` as the canonical home for multi-client
sheet components — T0c `CampaignSheet.tsx` lands here too.
**Rationale:** The Party Sheet is consumed by both the controller
(primary edit surface) and the display (decorative ambient render). The
T0a `PlayerSheetQuickView` pattern already proved that a sheet can be
authored once and mounted with `readOnly` in multiple clients; Party
Sheet generalises that move. Shared sheets belong outside any one
client's tree so neither client is cross-importing from the other.

### 2026-04-17 — Phase T0b: Gilt-bound tab binding as Party Sheet signature
**Decision:** The tab strip's signature visual is a continuous gilt-gold
metallic rule along its inner edge (right on landscape, bottom on
portrait), broken only at the active tab's row/column via a pseudo-
element overlay in the content panel's background colour. Looks like the
active tab "bites into" a brass-reinforced page binding.
**Rationale:** T0a's signature was the illuminated capital; Party Sheet
needed something equally distinctive so the three sheets (Player, Party,
Campaign) each have a clear visual fingerprint. The binding motif also
carries the "leather-bound campaign ledger" metaphor from the intro
animation into the main sheet navigation, reinforcing the book metaphor
without costume-y ornament. Pseudo-elements keep it zero-asset.

### 2026-04-17 — Phase T0b: `addPartyAchievement` / `removePartyAchievement` structured commands
**Decision:** Added two structured character-scope-free commands for
mutating `state.party.achievementsList`. Both are GM-only (NOT on the
phone whitelist in `server/src/wsHub.ts`). Validator rejects empty
achievement strings; `removePartyAchievement` is rejected if the entry
isn't currently in the list.
**Rationale:** `updateCampaign` is a scalar setter that replaces the
whole field. Routing array mutations through it would lose ordering
integrity on undo (undo stack diffs field value, not per-element
splice), and would push dedup/trim logic into UI code instead of the
server. Structured commands keep array mutation semantic and
undo-friendly. Achievements are party-level campaign bookkeeping, so
phone access isn't needed — keeping them GM-only also avoids the
spoiler concern of a phone seeing the full list of other parties'
achievement slugs the GM is drafting.

### 2026-04-17 — Phase T0b: Reputation brackets shipped with Party Sheet
**Decision:** `getReputationPriceModifier(reputation)` lives at
`packages/shared/src/data/reputationPrice.ts`, exported from the shared
barrel. Returns an integer in [−5, +5] per the rules bracket table.
Price floor-at-0 is the caller's responsibility (T2a purchase logic).
`docs/GAME_RULES_REFERENCE.md §16 Reputation & Economy` is the new
authoritative source for the bracket table.
**Rationale:** Party Sheet's Standing tab needs this live — players
should see the shop impact of their reputation in real time as the
slider drags. T2a shopping will re-consume the same helper; landing it
now with the Party Sheet avoids a later "we already have half this
logic for the chip" split. The rules doc didn't have a reputation
section before — adding §16 anchors the helper to the repo's
authoritative game-rules reference so the next person who changes the
helper has to reckon with the doc too.

### 2026-04-17 — Phase T0b: Tests deferred; no test framework added for one helper
**Decision:** `reputationPrice.ts` ships without `.test.ts` files. The
project has no test runner (no vitest/jest/mocha in `package.json`).
Rather than pull one in mid-batch just to test an 11-line pure-integer
bracket function, we skipped it. A future infrastructure batch will
introduce a test framework and backfill tests for this and other shared
helpers at once.
**Rationale:** Adding a test runner mid-feature is the exact kind of
scope balloon the T0b prompt's "stop and flag" warning guards against.
The helper's surface is small, pure, and easy to read-verify against
the bracket table in GAME_RULES_REFERENCE §16. Deferral risk is low
and visible — documented here and in ROADMAP so the next
infrastructure pass doesn't forget.

### 2026-04-17 — Phase T0b: `useCommitOnPause` hook centralised for editable text
**Decision:** Hybrid-commit behaviour (commit on blur, Enter, or 1000 ms
typing pause) extracted into `app/shared/hooks/useCommitOnPause.ts` and
consumed by the Standing tab (party name, notes) + Location tab (current
location). External value updates while the input is NOT focused sync
the local state; updates WHILE focused do not (user's in-progress edit
wins until blur).
**Rationale:** The three editable text sites in T0b alone would have
each re-invented the same timer/focus/sync dance. The controller is
multi-user (GM laptop + phones broadcast diffs), so collaborative edits
are a real concern — a hand-rolled per-field version would almost
certainly get the "don't clobber user's in-progress edit" case wrong at
one of the sites. T0d's Notes tab gets this for free. Naming the hook
"on pause" (vs "on debounced") makes the Enter-to-commit and
blur-to-commit behaviours orthogonal and explicit.

### 2026-04-17 — Phase T0b: `ControllerNav` scoped to Lobby / Town; scenario uses existing `☰`
**Decision:** `app/controller/ControllerNav.tsx` renders a fixed-position
`⋯` button mounted from `app/controller/App.tsx` only when
`mode !== 'scenario'`. In scenario mode, the existing `☰` button in
`ScenarioHeader` (rendered by `ScenarioView`) already opens `MenuOverlay`
— adding a floating nav on top of that would overlap the element board
in the header's top-right. The Party Sheet opener is lifted to App.tsx
state and passed into `ScenarioView` via a new `onOpenPartySheet` prop;
`ScenarioView` then passes it into `MenuOverlay`, so the hamburger has
the Party Sheet entry from every mode with zero duplicate UI affordance.
Scenario-specific actions (Scenario End — Victory/Defeat, Cancel Scenario)
moved out of `MenuOverlay` and into a new `ScenarioControlsOverlay`
triggered by clicking the scenario name in the header. The Cancel
Scenario action uses a new `abortScenario` command — clears scenario
combat state and returns to lobby without applying rewards or recording
the scenario. Two-step inline confirmation because it's destructive.
**Rationale:** The original "floating ⋯ in every mode" plan worked for
Lobby/Town (which have no header menu) but caused a visual collision in
Scenario mode (the new nav overlapped the element board). The restructure
gives each surface one obvious entry point: **hamburger = cross-mode**
(Undo, Party Sheet, Export, Disconnect), **scenario name click =
scenario-specific controls** (End Scenario), **floating ⋯ = modes that
lack a header menu** (Lobby/Town). The scenario-name affordance also
clusters scenario actions next to the scenario title, which reads more
naturally than hiding them in a catch-all menu.

### 2026-04-17 — Phase T0b: Display Party Sheet replaces idle lobby / town views
**Decision:** When the display is in `mode === 'lobby'` AND no
`setupPhase` is active (idle lobby), OR in `mode === 'town'`, the
display renders `DisplayPartySheetView` in place of the existing
`LobbyWaitingView` / `TownView`. During an active setup phase
(chores/rules/goals), `LobbyWaitingView` still renders so the
table-level prompts drive the ceremony. Scenario mode is untouched.
Display mode auto-cycles tabs every 30 s with a page-turn transition;
gilt elements get a 2–4 s candlelight flicker (offset durations so the
effect isn't synchronised).
**Rationale:** Display is a vertical tower sitting on the table. During
setup or scenario, something important owns the display. During idle
lobby and town, the display was showing a minimal "waiting" placeholder
— Party Sheet fills that dead space with at-a-glance campaign context
(party name, reputation, current location, resources, recent
scenarios) that a passer-by at the table can read. Auto-cycling
ensures no single tab hogs the display.

### 2026-04-17 — Phase T0b: "Leather book opening" intro + `Party.sheetIntroSeen`
**Decision:** First-open intro animation on the controller Party Sheet
(~3 seconds): backdrop fade → closed leather book fades in → cover
swings open on Y-axis (CSS transform, transform-origin: left) → party
name + "Your campaign begins…" fade in → fade out. Persisted via a new
`Party.sheetIntroSeen?: boolean` flag, set via existing
`updateCampaign('sheetIntroSeen', true)` (no new command needed — it's
a scalar on `state.party`). Respects `prefers-reduced-motion` (skips
animation, still sets the flag).
**Rationale:** Parallel to T0a's PlayerSheetIntro. Party Sheet is the
campaign's canonical shared surface; the one-time intro sets the
ceremonial tone the same way a leather-bound journal feels different
the first time you crack it open. Using `updateCampaign` avoids a new
command surface for a one-field boolean.

### 2026-04-17 — Phase T0b: Display escape hatch via invisible corner tap-zone
**Decision:** `DisplayPartySheetView` renders a 96×96 invisible
`<button>` pinned to the top-left corner (`z-index: 70`,
`background: transparent`, `border: none`). Tapping it calls
`onOpenMenu` and opens the existing `DisplayConfigMenu` (game code +
Disconnect). Other display views (scenario, lobby, town) surface this
same menu via clickable text affordances — round number /
"Gloomhaven/Frosthaven" title / "Town Phase" title. The decorative
Party Sheet has no such text chrome of its own (the sheet fills the
canvas), so a positional hot-zone substitutes.
**Rationale:** Without this, tapping the display while in idle
lobby/town hits the decorative Party Sheet — which is read-only and
doesn't react — leaving the display with no way to disconnect short
of navigating to `/unregister`. The invisible tap-zone pattern is a
common escape-hatch idiom for kiosk-style screens, and placing it in
the same region where other display views already have clickable
chrome (top area) keeps the muscle memory consistent. 96×96 gives a
comfortable tap target without visibly occluding the sheet.

### 2026-04-17 — Phase T0b: `abortScenario` command for mid-play exit
**Decision:** Added `abortScenario` — a GM-only structured command that
aborts the current scenario without applying rewards and returns
directly to lobby mode (skipping town phase). Handler mirrors the
combat-state cleanup block of `handleCompleteScenario` (monsters /
non-character figures / HP / conditions / summons / in-scenario
counters / elements / round+phase) but skips the XP / gold / resource
transfer and does NOT append to `state.party.scenarios`. Validator
rejects when `state.mode !== 'scenario'`. Exposed as "Cancel Scenario"
in the controller's new `ScenarioControlsOverlay` with a two-step
inline confirm.
**Rationale:** Pre-T0b there was no way to exit a scenario mid-play
— the only paths out were Victory or Defeat, both of which transfer
rewards and record the scenario as completed. Common real-world need:
"we started the wrong scenario" / "we need to restart" / "we're done
playing for the night." Going through Victory and then using Undo is
fragile (undo is bounded, and the town-phase transition can complicate
it). An explicit abort command keeps the semantics clear (NO rewards,
NOT recorded) and keeps state integrity guaranteed. Skipping town
phase is correct: town phase is a reward-resolution surface, and an
aborted scenario has nothing to resolve. Not on the phone whitelist
because the GM owns scenario lifecycle.

### 2026-04-17 — Phase T1.1: Display rewards hide condition decoupled from finishData lifetime
**Decision:** The display's `DisplayRewardsOverlay` mount is now gated by a
dismissal check (`isFinal && every-non-absent-char.dismissed`) in
`app/display/App.tsx`, not just by `state.finishData` existence. Phone and
controller behavior are unchanged.
**Rationale:** T1's "finishData persists through town" was the right call for
phone-reconnect truth, but it inadvertently held the display tableau up for
the entire town phase. Decoupling the display-side hide from the snapshot's
lifetime keeps the reconnect story intact (phones + controller still see the
snapshot) while letting the read-only ceremonial display hand off to the
next surface naturally when the table indicates they're done (every phone
taps Continue). Absent characters don't gate dismissal — their phones
aren't connected, so requiring their `dismissed` flag would freeze the
display forever for any party with a missing player.
