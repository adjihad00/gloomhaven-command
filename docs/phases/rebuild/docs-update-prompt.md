# Update Project Documentation — Post-Batch 13

> Paste this into Claude Code. Update ALL project documentation to reflect
> the current state after 13 fix batches. No code changes — docs only.

---

## Files to Update

### 1. `CLAUDE.md` — Update Current Phase + Commands

**Current Phase** section says:
```
Phase R COMPLETE. Next: Phone + Display views (Phase 3-4) or Phase T (Town mode).
```

Replace with:
```
Phase R COMPLETE (13 fix batches). Next: Phase 3 (Phone Client).
Controller is feature-complete for scenario play.
```

**Commands** section says:
```
npm install (from repo root)
npm run dev (starts server + watches clients)
npm run build (production build)
```

Verify these are accurate. Add any new commands if the build process changed.

### 2. `docs/COMMAND_PROTOCOL.md` — Add Missing Commands

The command table (### Command Actions) is missing commands added in batches 5-13.
Add these to the table:

| Action | Payload |
|--------|---------|
| toggleLongRest | { characterName, edition } |
| renameCharacter | { characterName, edition, title } |
| setLevelAdjustment | { adjustment } |
| addModifierCard | { deck, cardType: 'bless' \| 'curse' } |
| removeModifierCard | { deck, cardType: 'bless' \| 'curse' } |
| completeScenario | { outcome: 'victory' \| 'defeat' } |

Update the count in the heading: "### Command Actions (37 total)" (or whatever the
actual count is — count the methods in `clients/shared/lib/commandSender.ts`).

### 3. `docs/PROJECT_CONTEXT.md` — Update Component Count + Current Phase

**Current Phase** says Phase R COMPLETE. Update to include batch completion.

**Components** section: the repo now has 17 shared components, 8 controller overlays,
4 shared hooks. Update any counts or lists.

**Commands Quick Reference**: add `completeScenario`, `toggleLongRest`,
`renameCharacter`, `setLevelAdjustment`, `addModifierCard`, `removeModifierCard`.

### 4. `docs/APP_MODE_ARCHITECTURE.md` — Update Controller Description

The controller section describes "single GHS-style screen." Update to reflect the
current state:

- Single-screen with initiative-sorted figure grid
- Overlays: CharacterDetail, CharacterSheet, ScenarioSetup (3-step wizard),
  InitiativeNumpad (lifted to ScenarioView level), MenuOverlay (with scenario
  end), ScenarioSummary, LootDeckOverlay
- Footer: phase button, door SVGs with confirmation, derived-value pills with
  SVG icons, modifier deck floating overlay, loot deck badge
- Header: scenario info, element board (top-right)
- Absent character bench strip below figure grid

Update the **Phone** section to note that the scaffold exists (App, ConnectionScreen,
CharacterPicker, placeholder ScenarioView) but the scenario view is not yet built.

### 5. `docs/GHS_STATE_MAP.md` — Add New Fields

Add `lastDrawn?: string` to AttackModifierDeckModel section.

### 6. `docs/DESIGN_DECISIONS.md` — Verify Completeness

Verify all batch 7-13 architectural decisions are recorded. The following should
be present (check and add if missing):

- Poison as visual reminder, not auto-applied to manual HP changes (B7.1)
- Edition-specific condition constants with getConditionsForEdition() (B7.3)
- Hardcoded EDITION_INITIAL_SCENARIOS fallback for scenario unlock (B7.4)
- XP_THRESHOLDS with index=level convention (B7.5)
- Fixed-position portals for popups escaping scroll containers (B8.1)
- Door confirmation overlay preventing accidental reveals (B8.2)
- Absent bench strip with greyscale portraits (B8.3)
- Dual XP: character.experience (scenario) vs progress.experience (career) (B9.1)
- completeScenario command with GH/FH gold dual-path (B12.4)
- lastDrawn field for bless/curse display after removal (B12.2)
- Heartbeat monitor as visibilitychange fallback for PWA (B13.1)
- InitiativeNumpad at ScenarioView level for z-index (B13.4)
- ScenarioSummaryOverlay before reward application (B13.5)

### 7. `docs/ROADMAP.md` — Verify All Items Current

Phase R batches should all be [x]. Phase 3 (Phone) should have its items unchecked.
Verify Phase 5 checkboxes reflect what was actually completed in batches
(setup wizard, PWA manifest).

---

## Verification

After updating, run:
```bash
grep -rn "Phase R COMPLETE\|Next:" CLAUDE.md docs/PROJECT_CONTEXT.md docs/ROADMAP.md
```
All should reference "Phase 3 (Phone Client)" as next.

```bash
grep -c "completeScenario" docs/COMMAND_PROTOCOL.md
```
Should return at least 1.

## Commit Message

```
docs: update all project documentation post-batch 13

- CLAUDE.md: current phase, updated commands
- COMMAND_PROTOCOL.md: 6 new commands added
- PROJECT_CONTEXT.md: component counts, command list
- APP_MODE_ARCHITECTURE.md: controller overlay list, phone scaffold
- GHS_STATE_MAP.md: lastDrawn field
- DESIGN_DECISIONS.md: verify batch 7-13 entries
- ROADMAP.md: verify completion status
```
