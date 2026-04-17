# Phase 5.x Cleanup: Extraction Bug Fixes + Solo Scenario Book

## Context

You are continuing work on **Gloomhaven Command** (`adjihad00/gloomhaven-command`). Phase 5.x book extraction (commit `85919ea`) extracted 138 scenarios with 132 having goal text (95.6% coverage) and 652 section entries. A cleanup audit identified three distinct bugs in `scripts/extract-books.ts` causing scenarios and sections to be missed, plus the solo scenario book was never extracted.

**Goal of this prompt:** Fix the three bugs, extract the solo scenario book, re-run the extraction, and verify improved coverage.

---

## CRITICAL: Three Bugs Identified

### Bug 1: Page 1 blindly skipped (HIGH IMPACT)

**Location:** `scripts/extract-books.ts`, in the main scenario-book processing loop

**Current code:** Skips every page 1 with a comment like "copyright page"

**Problem:** Only 2 of 18 books have copyright on page 1. The other 16 books have real content on page 1.

**Scenarios currently invisible to the parser (verified by audit):**
- Scenario 17 "Haunted Vault" — `fhscenariobook2241.pdf` p1
- Scenario 34 "Top of the Spire" — `fhscenariobook4261.pdf` p1
- Scenario 53 "Underwater Throne" — `fhscenariobook6281.pdf` p1 (book narrative, not the p2 CONT)
- Scenario 65 "A Strong Foundation" — `fhscenariobook82101.pdf` p1
- Scenario 82 "Expedition North" — `fhscenariobook102121.pdf` p1
- Scenario 99 "Prison Break" — `fhscenariobook122141.pdf` p1
- Scenario 117 "A Waiting Game" — `fhscenariobook142166.pdf` p1

Also applies to section books — 8 of 10 section books have real content on page 1.

**Only copyright-only page 1s:**
- `fhscenariobook221.pdf`
- `fhsectionbook221.pdf`

Both contain only: `"2023 CEPHALOFAIR GAMES, LLC. ALL RIGHTS RESERVED. USED WITH PERMISSION."`

**Fix:** Replace the blind skip with content-aware detection:

```typescript
function isCopyrightOnlyPage(text: string): boolean {
  const trimmed = text.trim();
  // A copyright-only page is very short and contains only the copyright notice
  return trimmed.length < 200 && /CEPHALOFAIR/i.test(trimmed);
}

// In the main loop:
for (const { pageNumber, text } of pages) {
  if (isCopyrightOnlyPage(text)) continue;
  // ... existing parsing logic
}
```

### Bug 2: Whitespace breaks goal regex phrases

**Location:** `parseScenarioFromText()` function in `scripts/extract-books.ts`

**Current regex:**
```typescript
const goalMatch = fullText.match(/(The scenario is complete\s+(?:when|at the end of|once|after)\s+[\s\S]*?\.)/i);
```

**Problem:** The literal string `at the end of` doesn't match when PDF extraction inserts a line break between `end` and `of`. Scenarios with goal text like "The scenario is complete at the end of the Nth round" fail extraction because the source text has `at the end \r\nof the Nth round`.

**Affected scenarios:**
- Scenario 115 "Pylon Problems" — "at the end of the tenth round"
- Scenario 128 "A Tall Drunken Tale" — "at the end of the ninth round"
- Scenario 107 "My Private Empire" — uses "may be complete" (separate fix below)

**Fix:** Replace spaces inside phrase alternatives with `\s+`, and add "may be complete" variant:

```typescript
const goalMatch = fullText.match(
  /(The scenario (?:is|may be) complete\s+(?:when|at\s+the\s+end\s+of|once|after|only)\s+[\s\S]*?\.)/i
);
```

Also verify whitespace tolerance in the interleave cleanup regex — it should be fine already but worth a look.

### Bug 3: "Unknown at this time" not recognized as a valid goal

**Location:** `parseScenarioFromText()` in `scripts/extract-books.ts`

**Problem:** Some scenarios have intentionally hidden goals in the physical book. The goal section shows literally "Unknown at this time." These are not extraction failures — they are legitimate goals that should be captured as-is.

**Affected scenarios (verified):**
- Scenario 73 "Flotsam"
- Scenario 78 "The Lurker Problem"
- Scenario 121 "Black Memories"

**Fix:** After the primary goal regex fails, check for the "Unknown" pattern as a fallback:

```typescript
if (!goalText) {
  const unknownMatch = fullText.match(/Unknown at this time\./i);
  if (unknownMatch) {
    goalText = 'Unknown at this time.';
  }
}
```

---

## Task: Solo Scenario Book Extraction

**Source:** `fhsoloscenariobook.pdf` (24 pages, same ZIP-wrapped format on Claude's side; actual PDF on Kyle's side)

### Format Analysis (verified)

Each page is one class-specific solo scenario. Structure differs from the main scenario books:

- **No numeric scenario index** — solo scenarios are identified by NAME only
- **No `X • LOC Name` title line** — the scenario name appears at the bottom just above the copyright footer
- **Has the standard sections** — Introduction, Special Rules, Scenario Goals, Section Links, Conclusion, Rewards
- **One scenario per page** (no multi-page spreads)

Example text pattern from page 2:
```
[page number]
[map layout: doors, terrain, monsters, markers]
[special rules text]
[Introduction narrative]
[Special Rules game mechanics]
[Conclusion narrative]
[Rewards]
[section number list]
[section counts: x15 etc.]
Scenario Key Loot
Wonder of Nature          ← scenario name, last line before copyright
2023 CEPHALOFAIR GAMES, LLC. ALL RIGHTS RESERVED. USED WITH PERMISSION.
```

### Storage Approach

The existing `scenario_book_data` table has PK `(edition, scenario_index)`. Solo scenarios need a distinct index scheme. Two options:

**Option A (recommended): Extend PK to include group_name**
Matches the existing `scenarios` table schema which uses `(edition, scenario_index, group_name)` PK. Solo scenarios already use `group='solo'` in GHS JSON.

```sql
-- Migration (add to SCHEMA_SQL, drop+recreate the table):
CREATE TABLE IF NOT EXISTS scenario_book_data (
  edition TEXT NOT NULL,
  scenario_index TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT '',   -- '' for main, 'solo' for solo scenarios
  introduction TEXT,
  goal_text TEXT,
  loss_text TEXT,
  special_rules_text TEXT,
  section_links_json TEXT,
  designer TEXT,
  writer TEXT,
  location_code TEXT,
  raw_text TEXT,
  PRIMARY KEY (edition, scenario_index, group_name)
);
```

Update `insertScenarioBookData()` and `getScenarioBookData()` to accept/return `group_name`.

**Option B: Use synthetic index like `solo-1`, `solo-2`**
Simpler but breaks symmetry with the main `scenarios` table. Not recommended.

Use **Option A**.

### Parser

Add `parseSoloScenarioPage(text: string, pageNumber: number): ParsedScenario | null`:

```typescript
function parseSoloScenarioPage(text: string, pageNumber: number): ParsedScenario | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Find scenario name: last non-copyright line
  let scenarioName: string | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/CEPHALOFAIR/i.test(lines[i])) continue;
    if (/^(Scenario Key|Loot|Introduction|Special Rules|Scenario Goals|Section Links|Conclusion|Rewards)$/i.test(lines[i])) continue;
    if (/^x?\d+$/.test(lines[i])) continue;
    if (lines[i].length < 5) continue;
    scenarioName = lines[i];
    break;
  }
  if (!scenarioName) return null;
  
  // Use page number as scenario index (unique within solo group)
  const scenarioIndex = String(pageNumber);
  
  // Reuse the same goal/loss/links extraction from main scenario parser
  const fullText = lines.join('\n');
  const goalText = extractGoalText(fullText);
  const lossText = extractLossText(fullText);
  const sectionLinks = extractSectionLinks(fullText);
  const introduction = extractIntroduction(lines);
  const specialRulesText = extractSpecialRules(lines, goalText, lossText);
  // No designer/writer typically called out for solo scenarios
  
  return {
    scenarioIndex,
    name: scenarioName,
    locationCode: '',   // no location code for solo
    isContinuation: false,
    introduction,
    goalText,
    lossText,
    specialRulesText,
    sectionLinks,
    designer: null,
    writer: null,
    rawText: fullText,
  };
}
```

Then in the main pipeline, process the solo book after the main scenario books:

```typescript
// Process solo scenario book
if (SOLO_BOOKS.length > 0) {
  const soloPath = resolveBookPath('fhsoloscenariobook.pdf');
  if (soloPath) {
    const pages = await extractPdfPages(soloPath);
    for (const { pageNumber, text } of pages) {
      if (isCopyrightOnlyPage(text)) continue;
      if (pageNumber === 1 && /This book contains solo scenarios/i.test(text)) continue; // intro page
      const parsed = parseSoloScenarioPage(text, pageNumber);
      if (parsed) {
        storeScenario(db, 'fh', parsed, 'solo');  // pass group_name='solo'
      }
    }
  }
}
```

The solo book's page 1 is not copyright-only — it's an introduction page starting with "This book contains solo scenarios for the 17 classes in Frosthaven". Skip that specifically.

### Refactor storeScenario to accept group_name

```typescript
function storeScenario(
  db: ReferenceDb,
  edition: string,
  parsed: ParsedScenario,
  groupName: string = '',   // default '' for main scenarios, 'solo' for solo
): void {
  db.insertScenarioBookData(
    edition,
    parsed.scenarioIndex,
    groupName,
    // ... rest of fields
  );
}
```

---

## Task: Re-run Extraction + Verification

### 1. Run the updated extraction
```bash
npx tsx scripts/extract-books.ts
```

### 2. Verify improved coverage
After fixes, expected coverage:
- **Main scenarios**: ~145 (up from 138) with ~143 goals (98%+ coverage)
  - Scenarios 17, 34, 53, 65, 82, 99, 117 newly included from page-1 fix
  - Scenarios 107, 115, 128 newly have goals from regex fix
  - Scenarios 73, 78, 121 newly have "Unknown at this time." goals
- **Solo scenarios**: ~22 new entries (page 1 is intro, pages 24 may vary)
- **Sections**: More sections per book from page-1 fix (expect 660+)

### 3. Add a verify script or mode

Extend `--verify` output (if it exists) or create a quick diagnostic query. Add to `scripts/extract-books.ts`:

```typescript
async function printCoverageReport(db: ReferenceDb) {
  // Use raw db.exec for reporting; this is a script context
  const stats = {
    main_scenarios: 0,
    main_with_goal: 0,
    main_with_loss: 0,
    solo_scenarios: 0,
    solo_with_goal: 0,
    sections: 0,
    sections_with_narrative: 0,
  };
  // Query and print
  console.log('\n=== Coverage Report ===');
  console.log(`Main scenarios:  ${stats.main_scenarios} (${stats.main_with_goal} with goal, ${stats.main_with_loss} with loss)`);
  console.log(`Solo scenarios:  ${stats.solo_scenarios} (${stats.solo_with_goal} with goal)`);
  console.log(`Sections:        ${stats.sections} (${stats.sections_with_narrative} with narrative)`);
}
```

Add appropriate query methods to `ReferenceDb` for counts, or run `SELECT COUNT(*)` queries directly via `db['db'].prepare(...)`.

---

## API / Consumer Impact (Minimal)

### API endpoints

The existing `/api/ref/scenario-book/:edition/:index` endpoint needs to optionally accept a group parameter. Extend it:

```typescript
app.get('/api/ref/scenario-book/:edition/:index', (req, res) => {
  if (!refDb) { res.status(503).json({ error: 'Reference DB not available' }); return; }
  const group = (req.query.group as string) || '';
  const data = refDb.getScenarioBookData(req.params.edition, req.params.index, group);
  data ? res.json(data) : res.status(404).json({ error: 'Scenario not found' });
});
```

### useScenarioBookData hook

Optionally extend to accept group. Most callers pass main scenarios so default `group=''` works. No changes needed to existing callers.

```typescript
export function useScenarioBookData(
  edition: string,
  scenarioIndex: string,
  group: string = '',
): ScenarioBookDataResult {
  // fetch with ?group= query param when group is non-empty
}
```

Solo scenario support in the UI is out of scope for this cleanup — the data will be in the DB ready for future wiring.

---

## Verification Checklist

After running the fixes:

1. **Bug 1 fix verified**: Query `scenario_book_data` for scenarios 17, 34, 53, 65, 82, 99, 117 — all should exist with goal text
2. **Bug 2 fix verified**: Scenarios 115 and 128 have goal_text populated with "at the end of..." phrasing
3. **Bug 3 fix verified**: Scenarios 73, 78, 121 have goal_text = "Unknown at this time."
4. **Solo scenarios extracted**: Query `scenario_book_data WHERE group_name='solo'` — should return ~22 rows
5. **No regression**: All previously-extracted scenarios still present with same goal text
6. **Display still works**: Display footer, controller lobby, phone lobby/rules overlay still show correct text for known-working scenarios (test with GH scenario 1, FH scenario 0, FH scenario 1)
7. **Build succeeds**: `npm run build`
8. **Coverage report printed**: Script output shows final counts

---

## Implementation Order

1. Add `isCopyrightOnlyPage()` helper, replace blind page-1 skips
2. Fix goal regex (whitespace tolerance + "may be complete")
3. Add "Unknown at this time" fallback
4. Migrate `scenario_book_data` table: add `group_name` column to PK
5. Update `insertScenarioBookData()` / `getScenarioBookData()` signatures
6. Update `/api/ref/scenario-book` endpoint for group query param
7. Add `parseSoloScenarioPage()` function
8. Wire solo book processing into main pipeline
9. Add coverage report output
10. Run extraction, verify improvements
11. Update docs (ROADMAP, BUGFIX_LOG, DESIGN_DECISIONS)

---

## Commit Message

```
fix(phase-5.x): extraction bug fixes + solo scenario book

Extraction bug fixes:
- Replace blind page-1 skip with content-aware copyright detection
  (7 main scenarios + multiple sections were invisible to parser)
- Fix goal regex for whitespace-split phrases ("at the end \r\nof")
- Add "may be complete" alternative phrasing
- Recognize "Unknown at this time." as legitimate goal value

Solo scenario book extraction:
- Add parseSoloScenarioPage() for class-specific solo scenarios
- Extend scenario_book_data PK with group_name column
- Extract ~22 solo scenarios from fhsoloscenariobook.pdf
- API endpoint accepts optional ?group= query param

Coverage: scenarios 17, 34, 53, 65, 73, 78, 82, 99, 107, 115, 117,
121, 128 now populated (previously missed or partial).
```

---

## DO NOT

- Rewrite the entire extraction script — these are targeted fixes
- Change the overall schema beyond adding `group_name` to `scenario_book_data`
- Skip the coverage report — it's how we verify the fixes worked
- Re-run the import for GHS JSON data — only re-run extract-books.ts
- Modify the 3 "Unknown at this time" scenarios' goal text — keep it verbatim
- Break the existing `/api/ref/scenario-book/:edition/:index` endpoint — default group='' preserves current behavior
