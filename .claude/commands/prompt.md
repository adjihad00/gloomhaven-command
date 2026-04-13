# /prompt — Execute a Prompt File with Full Project Context

You are about to execute a markdown prompt file for the Gloomhaven Command project.
Before doing anything else, you must establish full project context by reading every
project document. Skipping this step has caused bugs and wasted effort in past sessions.

## Step 0: Read All Project Documents

Read ALL of the following files, in this order. Do not skip any.

1. `CLAUDE.md` (project root — conventions, rules, workflow)
2. `docs/PROJECT_CONTEXT.md` (architecture, repo layout, components, commands)
3. `docs/APP_MODE_ARCHITECTURE.md` (UI structure, views, interaction flows)
4. `docs/ROADMAP.md` (what's done, what's next)
5. `docs/DESIGN_DECISIONS.md` (rationale for architectural choices)
6. `docs/BUGFIX_LOG.md` (past bugs — avoid repeating them)
7. `docs/GAME_RULES_REFERENCE.md` (authoritative game rules — required for any game logic)

After reading all documents, confirm to yourself that you understand the current state
of the project, the repo layout, the tech stack, the UI interaction flows, and any
relevant game rules.

## Step 0.5: Load Design Skills (if UI/UX work is involved)

After reading the prompt file (next step), determine whether the work involves ANY
UI/UX changes — new components, layout changes, styling, visual design, interaction
patterns, responsive behavior, animations, or theming.

If it does, read the UI/UX Pro Max skill files before planning or executing:

1. Read all `.md` files in `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\`
   (start with CLAUDE.md, then docs/)
2. Read all `.md` files in `C:\Users\Kyle Diaz\.agents\skills\`
   (frontend native skills — React/Preact patterns, composition, view transitions, web design guidelines)

Apply the priority order from CLAUDE.md:
- (1) `app/CONVENTIONS.md` — project-specific conventions always win
- (2) UI/UX Pro Max skill — design system, patterns, accessibility
- (3) Agent skills — frontend implementation patterns

This ensures all UI work follows the dark fantasy tabletop aesthetic (aged parchment,
copper/gold metallics, Cinzel + Crimson Pro fonts, BEM naming, spacing tokens) rather
than generic defaults.

## Step 1: Read the Prompt File

Read the markdown prompt file provided as argument: `$ARGUMENTS`

## Step 2: Follow the Prompt-Driven Workflow

Now follow the workflow defined in CLAUDE.md, strictly in order:

1. **Review Prompt** — Summarize the intent and scope of the prompt file.

2. **Evaluate Against Codebase** — Cross-reference ALL code references in the prompt
   (file paths, function names, types, interfaces, line numbers, APIs) against the
   actual codebase. Use Grep, Glob, and Read tools to verify what exists and what
   has changed.

3. **Note Inconsistencies** — Explicitly list any mismatches between the prompt and
   the current codebase. Explain how each would be problematic if followed as-written.

4. **Adjust Prompt** — Present corrected technical details aligned with the actual
   codebase state. Get user confirmation before proceeding.

5. **Develop Plan** — Create a clear, step-by-step implementation plan. Present it
   for user review.

6. **Execute** — Implement the plan.

7. **Review & Verify** — After execution:
   - Run `npm run build` and confirm it passes
   - If changes are observable in the browser, verify them using the preview tools
   - Confirm the work matches the prompt's intent

8. **Update Documentation** — Before committing, review and update all project
   documents per the Documentation Currency policy in CLAUDE.md:
   - `docs/BUGFIX_LOG.md`
   - `docs/DESIGN_DECISIONS.md`
   - `docs/ROADMAP.md`
   - `docs/PROJECT_CONTEXT.md`
   - `docs/APP_MODE_ARCHITECTURE.md`
   - `docs/GAME_RULES_REFERENCE.md`

Do NOT commit without updating docs. Do NOT skip the verification step.
