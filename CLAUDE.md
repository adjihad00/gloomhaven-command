# Gloomhaven Command

Multi-device companion system for Gloomhaven/Frosthaven tabletop play.
Node.js server with command-based state engine. Three client apps: Display, Controller, Phone.

See docs/PROJECT_CONTEXT.md for full architecture.
See docs/ROADMAP.md for execution plan.
See docs/DESIGN_DECISIONS.md for rationale log.
See docs/BUGFIX_LOG.md for issue tracking.

## Tech Stack
- Server: Node.js, TypeScript, Express, ws, better-sqlite3
- Clients: Vanilla TypeScript, single-file HTML builds
- Shared: TypeScript game logic package
- Assets: GHS, Worldhaven, Creator Pack, Nerdhaven

## Commands
- npm install (from repo root)
- npm run dev (starts server + watches clients)
- npm run build (production build)

## Repo Layout
See docs/PROJECT_CONTEXT.md lines 20-60 for full tree.
