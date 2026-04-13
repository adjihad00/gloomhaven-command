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

### 2025-03-24 — Assets gitignored, populated locally
**Decision:** Game images/data live in assets/ but are not committed to git.
**Rationale:** GHS images, Worldhaven, Creator Pack, and Nerdhaven assets are
licensed or third-party. The repo contains only code. assets/README.md documents
how to populate the directory from local downloads.
