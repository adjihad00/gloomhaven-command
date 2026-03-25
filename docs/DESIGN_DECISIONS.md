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

### 2025-03-24 — Assets gitignored, populated locally
**Decision:** Game images/data live in assets/ but are not committed to git.
**Rationale:** GHS images, Worldhaven, Creator Pack, and Nerdhaven assets are
licensed or third-party. The repo contains only code. assets/README.md documents
how to populate the directory from local downloads.
