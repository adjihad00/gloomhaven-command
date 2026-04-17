# Phase 5.x: Book Data Extraction Pipeline — Claude Code Prompt

## Context

You are continuing work on **Gloomhaven Command** (`adjihad00/gloomhaven-command`). Phase 5.1 built a reference SQLite database with 42,948 rows and Phase 5.2 wired consumers. The remaining "See Scenario Book" placeholders are for **win conditions and loss conditions** — text that exists in the physical Frosthaven Scenario Book but is NOT in the GHS JSON data files.

**Goal of this prompt:** Build a reusable book data extraction pipeline that:
1. Extracts structured data from Frosthaven scenario and section book files
2. Stores extracted text in the reference database
3. Provides API endpoints for the extracted data
4. Wires the remaining "See Scenario Book" placeholders to real text
5. Is extensible for future book types (solo scenarios, puzzle book, Gloomhaven books)

---

## CRITICAL: File Format Discovery

The project knowledge "PDF" files are **NOT actual PDFs**. They are **ZIP archives** containing pre-extracted text and images per page:

```
{book}.pdf (actually a ZIP) contains:
  manifest.json         — { num_pages, pages: [{ page_number, image: { path, dimensions }, text: { path } }] }
  1.jpeg, 2.jpeg, ...   — Page images (980×1232)
  1.txt, 2.txt, ...     — Pre-extracted text per page (clean, no OCR needed)
```

### Available book files in project knowledge:
```
Scenario Books (8 files, ~168 pages total):
  fhscenariobook221.pdf      — Scenarios 0-16 (21 pages, page 1=copyright, page 2=intro)
  fhscenariobook2241.pdf     — Scenarios ~17-33 (20 pages)
  fhscenariobook4261.pdf     — Scenarios ~34-53 (20 pages)
  fhscenariobook6281.pdf     — Scenarios ~54-73 (20 pages)
  fhscenariobook82101.pdf    — Scenarios ~74-93 (20 pages)
  fhscenariobook102121.pdf   — Scenarios ~94-113 (20 pages)
  fhscenariobook122141.pdf   — Scenarios ~114-133 (20 pages)
  fhscenariobook142166.pdf   — Scenarios ~134-166 (27 pages)

Section Books (10 files, ~198 pages total):
  fhsectionbook221.pdf       — Sections 2-21 (21 pages)
  fhsectionbook2241.pdf      — Sections 22-41 (20 pages)
  ... (8 more files through section 197)

Other Books:
  fhsoloscenariobook.pdf     — Solo scenarios (24 pages, same ZIP format)
  fhstartingguide.pdf        — Setup guide (4 pages, skip)
  fhpuzzlebook.pdf           — Puzzles (28 pages, defer)
```

### Text structure verified by audit:

**Scenario book pages** — Each page = one scenario (some span 2 pages with "CONT."). Text contains all elements but interleaved due to multi-column layout extraction:

```
Title line (near bottom): "{number} • {location_code} {name}"
  Examples: "0 • N6 Howling in the Snow", "1 • FR A Town in Flames"
  Multi-page: "4 CONT. • Heart of Ice"

Win condition: "The scenario is complete when {condition}."
  Examples: "...when all enemies in it are dead."
            "...when all four doors have been destroyed and all monsters are dead."
            "...when all enemies in it are dead and ice sheet A has been destroyed."

Loss condition (when different from default): "{condition}, the scenario is lost."
  Examples: "If any character becomes exhausted, the scenario is lost."
            "If the scenario's hit point value ever reaches 0, the scenario is lost."
  ~40 scenarios have explicit loss conditions. Others default to "All characters exhausted."

Section links: "read {X.Y}" patterns
  "At the end of that round, read 2.2."
  "When door 1 is opened, read 2.1."

Section headers (as page design labels, appear near bottom of text):
  "Introduction", "Scenario Goals", "Special Rules", "Section Links",
  "Map Layout", "Scenario Key", "Loot", "Scenario Effects"

Introduction: Large narrative text block (story paragraphs)
Special rules: Game mechanic text (card restrictions, ally rules, spawn schedules)
```

**Section book pages** — Each page = multiple sections:

```
Section title (footer): "{X.Y} • {Title} ({parent_scenario})" or "{X.Y} • {Title}"
  Examples: "2.1 • Howling in the Snow (0)"
            "3.1 • Stables Built"
            "3.2 • Call of the Harbinger (56)"

Sections contain: narrative text, rewards, conclusion text, special rules, section links
Footer markers: "Conclusion", "Rewards", "Special Rules", "Section Links"
```

### Column interleaving warning
The text extraction captures content left-to-right across multi-column layouts. Win conditions may merge with section links on the same line:
```
"The scenario is complete when all When door 1 is opened, read 27."
```
The parser must handle this — split on sentence boundaries, not just periods.

---

## Task 1: Schema Extension

Add a new table to `server/src/referenceDb.ts` for book-extracted data. Keep it separate from GHS JSON data in the existing `scenarios` and `sections` tables.

### New table: `scenario_book_data`
```sql
CREATE TABLE IF NOT EXISTS scenario_book_data (
  edition TEXT NOT NULL,
  scenario_index TEXT NOT NULL,
  introduction TEXT,          -- Story/narrative text
  goal_text TEXT,             -- Win condition: "The scenario is complete when..."
  loss_text TEXT,             -- Loss condition (null = default "All characters exhausted")
  special_rules_text TEXT,    -- Special rules paragraphs
  section_links_json TEXT,    -- JSON array of { trigger, sectionId } objects
  designer TEXT,              -- "Designer: ..." credit line
  writer TEXT,                -- "Writer: ..." credit line
  location_code TEXT,         -- "N6", "FR", "K8", etc.
  raw_text TEXT,              -- Full page text for manual review/re-extraction
  PRIMARY KEY (edition, scenario_index)
);

CREATE INDEX IF NOT EXISTS idx_scenario_book ON scenario_book_data(edition, scenario_index);
```

### Extend `sections` table: Add `narrative_text` column
```sql
ALTER TABLE sections ADD COLUMN narrative_text TEXT;
ALTER TABLE sections ADD COLUMN rewards_text TEXT;
```
(The alter approach works since the import script recreates the schema. Add the columns to the CREATE TABLE in SCHEMA_SQL, and add the column to the insert helper.)

### Add insert + query helpers to `ReferenceDb` class:
```typescript
insertScenarioBookData(edition, scenarioIndex, introduction, goalText, lossText, specialRulesText, sectionLinksJson, designer, writer, locationCode, rawText): void

getScenarioBookData(edition, scenarioIndex): {
  introduction, goal_text, loss_text, special_rules_text,
  section_links_json, designer, writer, location_code
} | null

getSectionNarrative(edition, sectionId): {
  narrative_text, rewards_text, conclusion
} | null
```

### Add API endpoints to `server/src/index.ts`:
```
GET /api/ref/scenario-book/:edition/:index
    → Returns scenario book data (introduction, goals, loss, rules, links)

GET /api/ref/section-narrative/:edition/:sectionId
    → Returns section narrative text + rewards
```

---

## Task 2: Build Extraction Script

Create `scripts/extract-books.ts` — a reusable pipeline with these components:

### 2a. `BookZipReader` class (generic, reusable)
```typescript
class BookZipReader {
  constructor(zipPath: string)
  getManifest(): { num_pages: number; pages: PageInfo[] }
  getPageText(pageNumber: number): string
  getPageImagePath(pageNumber: number): string  // path within ZIP for future use
  getAllPages(): Array<{ pageNumber: number; text: string }>
}
```
Uses Node.js `zlib` or the `adm-zip` npm package (add to devDeps if needed) to read the ZIP files. The `unzipper` or `jszip` packages also work.

### 2b. `ScenarioPageParser` (FH scenario book specific)

Extracts structured data from a single scenario page's text:

```typescript
interface ParsedScenario {
  scenarioIndex: string;      // "0", "1", "2", etc.
  name: string;               // "Howling in the Snow"
  locationCode: string;       // "N6", "FR", "K8"
  isContinuation: boolean;    // true for "CONT." pages
  introduction: string | null;
  goalText: string | null;    // "The scenario is complete when..."
  lossText: string | null;    // "{condition}, the scenario is lost." or null
  specialRulesText: string | null;
  sectionLinks: Array<{ trigger: string; sectionId: string }>;
  designer: string | null;
  writer: string | null;
  rawText: string;
}

function parseScenarioPage(text: string): ParsedScenario | null
```

**Parsing strategy (verified against actual text):**

1. **Title extraction**: Find line matching `/(\d+)\s*(CONT\.)?\s*•\s*([A-Z][A-Z0-9]*)\s+(.+)/`
   - Group 1 = scenario number, Group 2 = continuation flag, Group 3 = location code, Group 4 = name
   - Strip trailing copyright line

2. **Win condition**: Find text matching `/The scenario is complete when\s+([^.]+(?:\.[^A-Z])*\.)/` 
   - Must handle column interleaving: if "When door" appears mid-sentence, split there
   - Clean whitespace: collapse `\r\n` and multiple spaces to single space

3. **Loss condition**: Find text matching `/([^.]+the scenario is lost\.)/i`
   - Capture the full condition sentence before "the scenario is lost."
   - If not found, leave null (consumer uses default "All characters exhausted")

4. **Section links**: Find all occurrences of `/(?:read|Read)\s+(\d+\.\d+)/g`
   - Capture surrounding context as the trigger (e.g., "When door 1 is opened", "At the end of that round")
   - Store as `{ trigger, sectionId }` objects

5. **Introduction**: The largest contiguous block of narrative text (story paragraphs without game mechanics keywords). Heuristic: look for paragraphs between the start of narrative voice and the first game-mechanics sentence. Use the presence of story markers (quotes, descriptions, emotions) vs. game markers ("standee", "hit points", "hex", "spawn", "door").

6. **Special rules**: Text containing game mechanics keywords that isn't the win/loss condition or section links. Look for patterns like "Each character", "At the start of each round", "spawn", "initiative", "Do not set up", ability references.

7. **Designer/Writer**: Match `/Designer:\s*(.+?);\s*Writer:\s*(.+)/` (appears on most pages)

8. **Multi-page scenarios** (CONT. pages): When `isContinuation` is true, merge the extracted data with the previous scenario's entry:
   - Append special rules text
   - Append introduction text
   - Merge section links

### 2c. `SectionPageParser` (FH section book specific)

Extracts multiple sections from a single page:

```typescript
interface ParsedSection {
  sectionId: string;          // "2.1", "3.2", etc.
  title: string;              // "Howling in the Snow"
  parentScenario: string | null; // "(0)" → "0"
  narrativeText: string | null;
  rewardsText: string | null;
  isConclusion: boolean;
  rawText: string;            // this section's portion of the page
}

function parseSectionPage(text: string): ParsedSection[]
```

**Parsing strategy:**

1. **Section boundaries**: Find all lines matching `/(\d+\.\d+)\s*•\s*(.+?)(?:\s*\((\d+)\))?\s*$/gm`
   - These appear near the bottom as section footers
   - Each footer delimits a section

2. **Split page text by sections**: Use the section IDs to split the text. Sections appear top-to-bottom on the page; footers at the bottom list them left-to-right.

3. **Within each section**, extract:
   - Narrative text: story paragraphs
   - Rewards: text after "Rewards" or "Gain" patterns
   - Conclusion: text after "Conclusion" header, or detect "New Scenarios:" pattern
   - Special rules: game mechanics text

4. **Note**: Section text splitting is approximate due to column interleaving. Store `rawText` for each section for manual review.

### 2d. Main extraction pipeline

```typescript
async function main() {
  const db = new ReferenceDb(DB_PATH);
  
  // Process all scenario books
  for (const file of SCENARIO_BOOK_FILES) {
    const reader = new BookZipReader(file.path);
    const pages = reader.getAllPages();
    let prevScenario: ParsedScenario | null = null;
    
    for (const { pageNumber, text } of pages) {
      if (pageNumber === 1) continue; // copyright page
      const parsed = parseScenarioPage(text);
      if (!parsed) continue;
      
      if (parsed.isContinuation && prevScenario) {
        // Merge with previous
        mergeContinuation(prevScenario, parsed);
      } else {
        // Store previous if exists
        if (prevScenario) storeScenario(db, 'fh', prevScenario);
        prevScenario = parsed;
      }
    }
    if (prevScenario) storeScenario(db, 'fh', prevScenario);
  }
  
  // Process all section books
  for (const file of SECTION_BOOK_FILES) {
    const reader = new BookZipReader(file.path);
    for (const { pageNumber, text } of reader.getAllPages()) {
      if (pageNumber === 1) continue;
      const sections = parseSectionPage(text);
      for (const section of sections) {
        storeSection(db, 'fh', section);
      }
    }
  }
  
  // Process solo scenario book
  // ... same pattern as scenario books
  
  db.close();
}
```

### File list for the script:
```typescript
const SCENARIO_BOOKS = [
  'fhscenariobook221.pdf',
  'fhscenariobook2241.pdf',
  'fhscenariobook4261.pdf',
  'fhscenariobook6281.pdf',
  'fhscenariobook82101.pdf',
  'fhscenariobook102121.pdf',
  'fhscenariobook122141.pdf',
  'fhscenariobook142166.pdf',
];

const SECTION_BOOKS = [
  'fhsectionbook221.pdf',
  'fhsectionbook2241.pdf',
  'fhsectionbook4261.pdf',
  'fhsectionbook6281.pdf',
  'fhsectionbook82101.pdf',
  'fhsectionbook102121.pdf',
  'fhsectionbook122141.pdf',
  'fhsectionbook142161.pdf',
  'fhsectionbook162181.pdf',
  'fhsectionbook182197.pdf',
];

const SOLO_BOOKS = ['fhsoloscenariobook.pdf'];
```

**Book file locations:** The book files are loaded as project knowledge in the Claude conversation (at `/mnt/project/`). On Kyle's machine, place them at `.staging/books/` (gitignored like other staging content). The script should check these locations in order:
1. `.staging/books/` (primary — alongside other staging data)
2. Command-line `--books-dir` argument (override)
3. `/mnt/project/` (fallback for Claude Code execution context)

---

## Task 3: Wire Consumers

### 3a. Create `useScenarioBookData` hook

Create `app/hooks/useScenarioBookData.ts`:
```typescript
export function useScenarioBookData(edition: string, scenarioIndex: string): {
  goalText: string | null;
  lossText: string | null;
  specialRules: string | null;
  introduction: string | null;
  loading: boolean;
}
```

Fetches `/api/ref/scenario-book/{edition}/{index}`. Returns null gracefully when book data doesn't exist (e.g., non-FH editions without book PDFs).

### 3b. Wire display footer

In `app/display/ScenarioView.tsx`, replace the remaining "See Scenario Book" for win/loss conditions:

```typescript
// Current (lines 276-283):
const footerRules = prototypeMode
  ? mockScenarioRules
  : {
      specialRules: 'See Scenario Book',
      winConditions: 'See Scenario Book',
      lossConditions: 'See Scenario Book',
    };

// Updated:
const bookData = useScenarioBookData(edition, scenarioIndex);
const footerRules = prototypeMode
  ? mockScenarioRules
  : {
      specialRules: refRules.length > 0 ? refRules : (bookData.specialRules || ['See Scenario Book']),
      winConditions: bookData.goalText || 'See Scenario Book',
      lossConditions: bookData.lossText || 'All characters exhausted.',
    };
```

Note: `DisplayScenarioFooter` currently takes `specialRules` as string. It was changed in 5.2 to accept `string[]` for rules from labels. The win/loss conditions should also support HTML content (for any `%game.action.X%` interpolation).

### 3c. Wire controller LobbyView rules step

In `app/controller/LobbyView.tsx` (step='rules', line ~560):
- Show real win condition from book data
- Show real loss condition (or "All characters exhausted" default)
- Keep existing special rules from label data, supplement with book data if labels are empty

### 3d. Wire phone overlays

In `app/phone/overlays/PhoneRulesOverlay.tsx` and `app/phone/LobbyView.tsx`:
- Same pattern as controller — fetch book data, display real conditions

---

## Task 4: Extensibility Design

### Book source configuration
The script should support a configuration file or command-line arguments for book file locations:
```
npx tsx scripts/extract-books.ts                    # default: look in .staging/books/ and /mnt/project/
npx tsx scripts/extract-books.ts --books-dir /path  # custom location
npx tsx scripts/extract-books.ts --scenario-only    # skip section books
```

### Adding new book types
To add Gloomhaven scenario book support later:
1. Create a `GHScenarioPageParser` (the format may differ from FH)
2. Add GH book files to the configuration
3. Run the extraction script with `edition = 'gh'`

### Verification/review mode
The script should support a `--verify` flag that:
- Outputs a summary of extractions (scenario count, sections with/without text)
- Lists scenarios where heuristic extraction was uncertain (e.g., no win condition found)
- Outputs a TSV file for manual review: `scenario_index, goal_text, loss_text, confidence`

---

## Implementation Order

1. **Add `adm-zip` or `jszip` to devDependencies** (for ZIP reading in Node.js)
2. **Schema extension** — Add `scenario_book_data` table + columns to `sections` table in `referenceDb.ts`
3. **Add insert/query helpers** to `ReferenceDb` class
4. **Add API endpoints** to `server/src/index.ts`
5. **Build `BookZipReader`** — generic ZIP-of-pages reader
6. **Build `ScenarioPageParser`** — heuristic extraction from scenario page text
7. **Build `SectionPageParser`** — heuristic extraction from section page text
8. **Build main pipeline** in `scripts/extract-books.ts`
9. **Run extraction** — process all FH books, verify output
10. **Create `useScenarioBookData` hook**
11. **Wire display footer** — replace win/loss "See Scenario Book"
12. **Wire controller/phone** — replace remaining placeholders
13. **Verify + build**

---

## Verification Checklist

1. **Extraction completeness**: All ~166 FH scenarios have `goal_text` populated
2. **Loss conditions**: ~40 scenarios with explicit loss conditions are correctly extracted
3. **Section book**: Section narrative text extracted for sections referenced by played scenarios
4. **Multi-page scenarios**: Continuation pages merged correctly (scenarios 4, 15, etc.)
5. **Display footer**: Shows real win condition and loss condition
6. **Controller/phone**: Rules overlays show real conditions
7. **No regressions**: Special rules from label data (Phase 5.2) still display
8. **Graceful fallback**: Non-FH editions show "See Scenario Book" without errors
9. **Build succeeds**: `npm run build`

---

## Commit Message

```
feat(phase-5.x): book data extraction pipeline — scenario goals, loss conditions, story text

- Add BookZipReader for ZIP-of-pages book format (JPEG + TXT + manifest)
- Add ScenarioPageParser with heuristic extraction (win/loss/rules/intro/links)
- Add SectionPageParser for section book narrative text
- Add scenario_book_data table + extend sections with narrative_text
- Extract all ~166 FH scenarios + ~198 section book pages
- Add /api/ref/scenario-book and /api/ref/section-narrative endpoints
- Wire display footer, controller, and phone to real win/loss conditions
- Replace remaining "See Scenario Book" placeholders
```

---

## Design Skills

For ALL UI/UX work (scenario text display, footer rendering), read these skill files before implementing:
- `C:\Users\Kyle Diaz\.claude\plugins\marketplaces\ui-ux-pro-max-skill\` — UI/UX Pro Max skill
- `C:\Users\Kyle Diaz\.agents\skills\` — frontend agent skills
- `app/CONVENTIONS.md` — project CSS/component conventions

Priority when skills conflict: (1) app/CONVENTIONS.md, (2) UI/UX Pro Max, (3) agent skills.

---

## DO NOT

- Modify the mutable game DB (`data/ghs.sqlite`)
- Break existing `/api/data/` or `/api/ref/` endpoints
- Hard-code scenario text — everything goes through the database
- Assume all scenarios have explicit loss conditions (only ~40 do, others default)
- Assume section boundaries are precise in the text (column interleaving exists)
- Skip the `raw_text` storage — it enables future re-extraction with better heuristics
- Delete or modify existing `scenarios` or `sections` table data from Phase 5.1
