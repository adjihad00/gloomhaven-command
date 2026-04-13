# Gloomhaven Command

Multi-device companion system for Gloomhaven/Frosthaven tabletop play.
Node.js server with command-based state engine. Three client apps: Display, Controller, Phone.

See docs/PROJECT_CONTEXT.md for full architecture.
See docs/APP_MODE_ARCHITECTURE.md for Scenario/Town mode design + Preact app structure.
See docs/GHS_AUDIT.md for GHS functionality audit and gap analysis.
See docs/ROADMAP.md for execution plan.
See docs/DESIGN_DECISIONS.md for rationale log.
See docs/BUGFIX_LOG.md for issue tracking.

## Tech Stack
- Server: Node.js, TypeScript, Express, ws, better-sqlite3
- Clients: Preact with shared component library, separate entry points per role
- Shared: TypeScript game logic package + data layer for GHS edition files
- Assets: GHS, Worldhaven, Creator Pack, Nerdhaven

## Commands
- npm install (from repo root)
- npm run dev (starts server + watches clients)
- npm run build (production build)

## Repo Layout
See docs/PROJECT_CONTEXT.md for full tree.

## Current Phase
Phase R COMPLETE. Next: Phone + Display views (Phase 3-4) or Phase T (Town mode).

## Design Skills & Conventions

For ALL UI/UX work, read these skill files before implementing:
- `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\` — UI/UX Pro Max skill (read all .md files)
- `C:\Users\Kyle Diaz\.agents\skills\` — frontend agent skills (read all .md files)

Priority when skills conflict: (1) app/CONVENTIONS.md, (2) UI/UX Pro Max,
(3) agent skills.

Aesthetic direction: Dark fantasy tabletop. Aged parchment, copper/gold metallics,
deep browns, candlelight glow effects. NOT generic dashboard/SaaS aesthetics.

Font stack: Cinzel (display/headings) + Crimson Pro (body). Self-hosted woff2.
Color system: CSS variables in app/shared/styles/theme.css — accent-gold, accent-copper,
health-green, negative-red, shield-blue, elite-gold.

CSS conventions: BEM naming, spacing tokens, focus-visible accessibility.
See app/CONVENTIONS.md for full CSS architecture docs.

Component conventions: Preact functional components, useCommands() for interactions,
GHS assets exclusively (no fallbacks), touch-action: manipulation on all interactive
elements, aria-labels on all buttons.

## Prompt-Driven Workflow

When the user provides an MD file prompt (or references one by name/location), follow this workflow **in order**:

1. **Review Prompt** — Read the full MD prompt file. Summarize the intent and scope.
2. **Evaluate Against Codebase** — Cross-reference all code references (file paths, function names, types, interfaces, APIs) in the prompt against the actual codebase. Identify what exists, what has changed, and what the prompt assumes incorrectly.
3. **Note Inconsistencies** — Explicitly list any mismatches between the prompt and the current codebase (wrong file paths, outdated types, missing functions, renamed APIs, etc.) and explain how each would be problematic if followed as-written.
4. **Adjust Prompt** — Present a corrected version of the prompt's technical details, aligned with the actual codebase state. Get user confirmation before proceeding.
5. **Develop Plan** — Create a clear, step-by-step implementation plan based on the adjusted prompt. Present it for user review.
6. **Execute** — Implement the plan.
7. **Review & Verify** — After execution, review the changes for correctness, run any relevant builds/tests, and confirm the work matches the prompt's intent.
