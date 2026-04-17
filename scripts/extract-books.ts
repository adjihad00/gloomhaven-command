#!/usr/bin/env npx tsx
/**
 * extract-books.ts — Extracts structured data from Frosthaven scenario/section book PDFs.
 *
 * Usage:
 *   npx tsx scripts/extract-books.ts                        # default location
 *   npx tsx scripts/extract-books.ts --books-dir /path      # custom location
 *   npx tsx scripts/extract-books.ts --scenario-only        # skip section books
 *   npx tsx scripts/extract-books.ts --verify               # output verification TSV
 *
 * The PDFs contain extractable text (not just images). Uses pdfjs-dist to extract
 * per-page text and heuristic parsers to identify win/loss conditions, special rules,
 * introductions, section links, and credits.
 */

import { resolve, join, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { ReferenceDb } from '../server/src/referenceDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'reference.db');

// ── PDF Reader ──────────────────────────────────────────────────────────────

async function loadPdfjs() {
  // pdfjs-dist legacy build works in Node without canvas
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsLib;
}

interface PageText {
  pageNumber: number;
  text: string;
}

async function extractPdfPages(pdfPath: string): Promise<PageText[]> {
  const pdfjsLib = await loadPdfjs();
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages: PageText[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    // Reconstruct text with newlines based on Y position changes
    let text = '';
    let lastY: number | null = null;
    for (const item of tc.items as Array<{ str: string; transform: number[] }>) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
        text += '\n';
      }
      text += item.str;
      lastY = item.transform[5];
    }
    pages.push({ pageNumber: i, text });
  }

  return pages;
}

// ── Copyright-only page detection ───────────────────────────────────────────

/**
 * A copyright-only page contains only the Cephalofair copyright footer and
 * no real scenario/section content. Defensive check; replaces an older
 * conditional "skip pages 1-2 of the first scenario book" heuristic.
 */
function isCopyrightOnlyPage(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length < 200 && /CEPHALOFAIR/i.test(trimmed);
}

// ── Scenario Page Parser ────────────────────────────────────────────────────

interface ParsedScenario {
  scenarioIndex: string;
  name: string;
  locationCode: string;
  isContinuation: boolean;
  introduction: string | null;
  goalText: string | null;
  lossText: string | null;
  specialRulesText: string | null;
  sectionLinks: Array<{ trigger: string; sectionId: string }>;
  designer: string | null;
  writer: string | null;
  rawText: string;
}

/**
 * Parse a scenario page. Some pages contain TWO scenario titles (a CONT + new scenario).
 * Returns an array of parsed scenarios (usually 1, sometimes 2).
 */
function parseScenarioPages(text: string): ParsedScenario[] {
  // Find all scenario titles on the page
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const titles: Array<{
    lineIndex: number;
    scenarioIndex: string;
    name: string;
    locationCode: string;
    isContinuation: boolean;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    // Full title: "0 • N6 Howling in the Snow" (also matches suffixed "4A", "74B", etc.)
    const m = lines[i].match(/^(\d+[A-Z]?)\s*(CONT\.)?\s*•\s*([A-Z][A-Z0-9-]*)\s+(.+)/);
    if (m) {
      titles.push({
        lineIndex: i,
        scenarioIndex: m[1],
        name: m[4].replace(/\s*\d{4}\s+CEPHALOFAIR.*$/i, '').trim(),
        locationCode: m[3],
        isContinuation: !!m[2],
      });
      continue;
    }
    // CONT without location code: "15 CONT. • Ancient Spire"
    const contMatch = lines[i].match(/^(\d+[A-Z]?)\s+CONT\.\s*•\s*(.+)/);
    if (contMatch) {
      titles.push({
        lineIndex: i,
        scenarioIndex: contMatch[1],
        name: contMatch[2].replace(/\s*\d{4}\s+CEPHALOFAIR.*$/i, '').trim(),
        locationCode: '',
        isContinuation: true,
      });
      continue;
    }
    // Multi-line: "• {code}" with number above and name below (or above number)
    const bulletMatch = lines[i].match(/^•\s*([A-Z][A-Z0-9-]*)\s*$/);
    if (bulletMatch && i > 0) {
      const numMatch = lines[i - 1].match(/^(\d+[A-Z]?)\s*(CONT\.)?$/);
      if (numMatch) {
        // Name is usually on the line after "• CODE", but if that line is copyright,
        // the name may be above the number line
        let scenarioName = '';
        if (i + 1 < lines.length && !/CEPHALOFAIR/i.test(lines[i + 1])) {
          scenarioName = lines[i + 1].replace(/\s*\d{4}\s+CEPHALOFAIR.*$/i, '').trim();
        } else if (i >= 2 && !/^\d+$/.test(lines[i - 2]) && !/CONT\./.test(lines[i - 2]) && !/•/.test(lines[i - 2])) {
          scenarioName = lines[i - 2].trim();
        }
        if (scenarioName) {
          titles.push({
            lineIndex: i,
            scenarioIndex: numMatch[1],
            name: scenarioName,
            locationCode: bulletMatch[1],
            isContinuation: !!numMatch[2],
          });
          continue;
        }
      }
    }
  }

  if (titles.length === 0) return [];

  // Sort: CONT pages first so they get processed before new scenarios
  titles.sort((a, b) => {
    if (a.isContinuation && !b.isContinuation) return -1;
    if (!a.isContinuation && b.isContinuation) return 1;
    return a.lineIndex - b.lineIndex;
  });

  const fullText = lines.join('\n');
  const hasMixed = titles.some(t => t.isContinuation) && titles.some(t => !t.isContinuation);

  return titles.map(t => parseScenarioFromText(fullText, lines, t));
}

/** Build a ParsedScenario from known title info and the page text */
function parseScenarioFromText(
  fullText: string,
  lines: string[],
  title: { scenarioIndex: string; name: string; locationCode: string; isContinuation: boolean },
): ParsedScenario {
  // ── Win condition ──
  // Handles "is/may be complete" + "when/at the end of/once/after/only" plus
  // whitespace-split phrasing (e.g. PDF line break inside "at the end\nof").
  // Also covers scenarios with intentionally hidden goals ("Unknown at this time.").
  const goalText = extractGoalText(fullText);

  // ── Loss condition ──
  const lossText = extractLossText(fullText);

  // ── Section links ──
  const sectionLinks = extractSectionLinks(fullText);

  // ── Designer / Writer ──
  let designer: string | null = null;
  let writer: string | null = null;
  const creditMatch = fullText.match(/Design(?:er)?:\s*(.+?);\s*W\s*rit(?:er|ing)?:\s*(.+?)(?:\n|$)/i);
  if (creditMatch) {
    designer = fixSpacingArtifacts(creditMatch[1].trim());
    writer = fixSpacingArtifacts(creditMatch[2].trim());
  }

  // ── Introduction ──
  const introduction = extractIntroduction(lines);

  // ── Special rules ──
  const specialRulesText = extractSpecialRules(lines, goalText, lossText);

  return {
    scenarioIndex: title.scenarioIndex,
    name: title.name,
    locationCode: title.locationCode,
    isContinuation: title.isContinuation,
    introduction,
    goalText,
    lossText,
    specialRulesText,
    sectionLinks,
    designer,
    writer,
    rawText: fullText,
  };
}

/** Extract loss-condition text. Falls back to a short sentence ending in "the scenario is lost.". */
function extractLossText(fullText: string): string | null {
  const m1 = fullText.match(/(If\s+[\s\S]*?the scenario is lost\.)/i);
  if (m1) return m1[1].replace(/\s+/g, ' ').trim();
  const m2 = fullText.match(/([^.]*?the scenario is lost\.)/i);
  if (m2) {
    const candidate = m2[1].replace(/\s+/g, ' ').trim();
    if (candidate.length > 10 && candidate.length < 300) return candidate;
  }
  return null;
}

/** Extract section-link references ("read 2.1") with the preceding trigger phrase. */
function extractSectionLinks(fullText: string): Array<{ trigger: string; sectionId: string }> {
  const links: Array<{ trigger: string; sectionId: string }> = [];
  const linkPattern = /(?:read|Read)\s+(\d+\.\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(fullText)) !== null) {
    const before = fullText.substring(Math.max(0, m.index - 60), m.index);
    const sentenceStart = Math.max(before.lastIndexOf('.') + 1, before.lastIndexOf('\n') + 1, 0);
    const trigger = before.substring(sentenceStart).replace(/\s+/g, ' ').trim();
    links.push({ trigger, sectionId: m[1] });
  }
  return links;
}

/** Fix PDF text extraction artifacts where capital letters get split from words */
function fixSpacingArtifacts(text: string): string {
  // Pattern: single capital letter followed by space and lowercase continuation
  // "Z achary" → "Zachary", "W riter" → "Writer"
  return text.replace(/([A-Z])\s+([a-z])/g, '$1$2');
}

/** Extract the introduction / narrative text block */
function extractIntroduction(lines: string[]): string | null {
  // The introduction is the largest block of narrative text.
  // Narrative lines: contain story language (quotes, descriptions, dialogue).
  // Non-narrative: game mechanics (spawn, hex, standee, door, initiative, modifier).
  const gameKeywords = /\b(standee|hit point|hex|spawn|door|initiative|modifier|attack modifier|enemy|enemies|dead|damage trap|treasure|loot|scenario is complete|scenario is lost|read \d+\.\d+|Designer:|x\d+$|^\d+$|^•|CEPHALOFAIR|Map Layout|Scenario Goals|Section Links|Scenario Key|Special Rules|Introduction|Scenario Effects)\b/i;

  const narrativeBlocks: string[] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (gameKeywords.test(line) || line.length < 3) {
      if (currentBlock.length >= 3) {
        narrativeBlocks.push(currentBlock.join(' '));
      }
      currentBlock = [];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length >= 3) {
    narrativeBlocks.push(currentBlock.join(' '));
  }

  // Return the longest narrative block
  if (narrativeBlocks.length === 0) return null;
  narrativeBlocks.sort((a, b) => b.length - a.length);
  return narrativeBlocks[0].replace(/\s+/g, ' ').trim() || null;
}

/** Extract special rules text (game mechanics that aren't win/loss/links) */
function extractSpecialRules(
  lines: string[],
  goalText: string | null,
  lossText: string | null,
): string | null {
  const rulesKeywords = /\b(Each character|At the start of each round|spawn|initiative \d|Do not set up|ability deck|Instead|reduces their hand|gains?|adds? one|cannot|allies? to you|escort|hit point value|objective|overlay|trap|difficult terrain)\b/i;

  const ruleLines: string[] = [];
  let inRulesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start collecting after "Special Rules" header
    if (/^Special Rules$/i.test(line)) {
      inRulesSection = true;
      continue;
    }

    // Stop at known section headers
    if (/^(Introduction|Map Layout|Scenario Goals|Section Links|Scenario Key|Loot|Scenario Effects)$/i.test(line)) {
      inRulesSection = false;
      continue;
    }

    if (rulesKeywords.test(line) || inRulesSection) {
      // Skip if this line is part of the goal or loss text
      const normalized = line.replace(/\s+/g, ' ').trim();
      if (goalText && goalText.includes(normalized)) continue;
      if (lossText && lossText.includes(normalized)) continue;
      if (/^\d+$/.test(line) || /^x\d+$/.test(line)) continue;
      if (/CEPHALOFAIR/i.test(line)) continue;

      ruleLines.push(line);
    }
  }

  if (ruleLines.length === 0) return null;
  return ruleLines.join(' ').replace(/\s+/g, ' ').trim() || null;
}

// ── Section Page Parser ─────────────────────────────────────────────────────

interface ParsedSection {
  sectionId: string;
  title: string;
  parentScenario: string | null;
  narrativeText: string | null;
  rewardsText: string | null;
  isConclusion: boolean;
  rawText: string;
}

/**
 * Parse a section book page. Multiple sections per page.
 * Section footers appear near bottom: "2.1 • Howling in the Snow (0)"
 */
function parseSectionPage(text: string): ParsedSection[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 3) return [];

  // Find section footer lines — they contain "X.Y • Title" patterns
  // Multiple sections may be listed on one line separated by tabs/spaces
  const sectionHeaders: Array<{ id: string; title: string; parent: string | null }> = [];
  const footerPattern = /(\d+\.\d+)\s*•\s*(.+?)(?:\s*\((\d+)\))?\s*(?=\d+\.\d+\s*•|$)/g;

  // Check last few lines for footer patterns
  const footerText = lines.slice(-5).join('\t');
  let fm: RegExpExecArray | null;
  while ((fm = footerPattern.exec(footerText)) !== null) {
    sectionHeaders.push({
      id: fm[1],
      title: fm[2].trim(),
      parent: fm[3] || null,
    });
  }

  if (sectionHeaders.length === 0) return [];

  const fullText = lines.join('\n');

  // For now, store the full page text for each section (approximate splitting)
  // Exact section boundaries are hard due to column interleaving
  const results: ParsedSection[] = [];

  for (const header of sectionHeaders) {
    // Detect if this section has a conclusion
    const isConclusion = /\bConclusion\b/i.test(fullText);

    // Extract rewards text
    let rewardsText: string | null = null;
    const rewardsMatch = fullText.match(/(?:Gain|Each character gains?|Frosthaven gains?|Party gains?)\s+(.+?)(?:\.\s|\n)/i);
    if (rewardsMatch) {
      rewardsText = rewardsMatch[0].replace(/\s+/g, ' ').trim();
    }

    // Extract narrative (non-game text)
    const narrativeText = extractSectionNarrative(lines);

    results.push({
      sectionId: header.id,
      title: header.title,
      parentScenario: header.parent,
      narrativeText,
      rewardsText,
      isConclusion,
      rawText: fullText,
    });
  }

  return results;
}

function extractSectionNarrative(lines: string[]): string | null {
  const gameKeywords = /\b(Gain|Rewards|Conclusion|Section Links|Special Rules|CEPHALOFAIR|^\d+\.\d+\s*•|^x\d+|^spawn|^Each character|^At the start)\b/i;

  const narrativeLines: string[] = [];
  for (const line of lines) {
    if (gameKeywords.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (line.length < 5) continue;
    if (/^--\s*\d+\s*of\s*\d+\s*--$/.test(line)) continue;
    narrativeLines.push(line);
  }

  if (narrativeLines.length < 2) return null;
  return narrativeLines.join(' ').replace(/\s+/g, ' ').trim() || null;
}

// ── Merge continuation pages ────────────────────────────────────────────────

function mergeContinuation(base: ParsedScenario, cont: ParsedScenario): void {
  // Goal/loss: prefer whichever has data (base first, then CONT)
  if (!base.goalText && cont.goalText) base.goalText = cont.goalText;
  if (!base.lossText && cont.lossText) base.lossText = cont.lossText;
  if (cont.specialRulesText) {
    base.specialRulesText = base.specialRulesText
      ? base.specialRulesText + ' ' + cont.specialRulesText
      : cont.specialRulesText;
  }
  if (cont.introduction) {
    base.introduction = base.introduction
      ? base.introduction + ' ' + cont.introduction
      : cont.introduction;
  }
  if (!base.designer && cont.designer) base.designer = cont.designer;
  if (!base.writer && cont.writer) base.writer = cont.writer;
  base.sectionLinks.push(...cont.sectionLinks);
  base.rawText += '\n\n--- CONTINUATION PAGE ---\n\n' + cont.rawText;
}

// ── Book file configuration ─────────────────────────────────────────────────

const SCENARIO_BOOKS = [
  'fh-scenario-book-2-21.pdf',
  'fh-scenario-book-22-41.pdf',
  'fh-scenario-book-42-61.pdf',
  'fh-scenario-book-62-81.pdf',
  'fh-scenario-book-82-101.pdf',
  'fh-scenario-book-102-121.pdf',
  'fh-scenario-book-122-141.pdf',
  'fh-scenario-book-142-166.pdf',
];

const SECTION_BOOKS = [
  'fh-section-book-2-21.pdf',
  'fh-section-book-22-41.pdf',
  'fh-section-book-42-61.pdf',
  'fh-section-book-62-81.pdf',
  'fh-section-book-82-101.pdf',
  'fh-section-book-102-121.pdf',
  'fh-section-book-122-141.pdf',
  'fh-section-book-142-161.pdf',
  'fh-section-book-162-181.pdf',
  'fh-section-book-182-197.pdf',
];

const SOLO_BOOKS = [
  'fh-solo-scenario-book.pdf',
];

// ── Solo Scenario Page Parser ───────────────────────────────────────────────

type SoloParseResult =
  | { kind: 'base'; scenario: ParsedScenario }
  | { kind: 'continuation'; ofName: string; addendum: ParsedScenario }
  | { kind: 'skip' };

/**
 * Solo scenarios have no numeric index or "X • LOC Name" title. The scenario
 * name appears on the last non-copyright line, just above the copyright footer.
 * Some scenarios span two pages; the second page's last line is "CONT. • Name".
 * Uses the page number as the scenario_index for base pages; continuations are
 * merged into the prior base.
 */
function parseSoloScenarioPage(text: string, pageNumber: number): SoloParseResult {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Credits page (printing info + playtester list) — not a scenario.
  if (/Playtesting:/i.test(text) && /Graphic Design:/i.test(text)) {
    return { kind: 'skip' };
  }

  const labelNoiseWord = /^(Scenario|Key|Loot|Introduction|Special|Rules|Goals|Section|Links|Conclusion|Rewards|Map|Layout|Effects|Boss)$/i;
  const isContLine = (l: string): RegExpMatchArray | null => l.match(/^CONT\.\s*•\s*(.+)$/i);
  const looksLikeScenarioName = (l: string): boolean => {
    if (l.length < 5 || l.length > 60) return false;
    if (!/^[A-Z]/.test(l)) return false;          // must start with capital
    if (/[0-9"“”.,;:!?]/.test(l)) return false;   // no digits, quotes, or sentence punctuation anywhere
    // Reject PDF concatenation artifacts like "LootScenario" (lower-then-upper).
    if (/[a-z][A-Z]/.test(l)) return false;
    // Reject lines that consist entirely of label-noise words.
    const words = l.split(/\s+/);
    if (words.every(w => labelNoiseWord.test(w))) return false;
    return true;
  };

  // The real solo-book layout puts the scenario title (or "CONT. • Name"
  // marker) on the line IMMEDIATELY above the copyright footer, with label
  // noise ("Loot", "Rewards", etc.) above it. Some pages have BOTH a plain
  // title AND a CONT of the prior scenario (e.g. page 18: "Recharge" base +
  // "CONT. • Under the Ice"). Inspect up to 2 concrete bottom lines so we
  // can find both; but stop before walking into narrative paragraphs.
  const isNoiseLine = (l: string): boolean => {
    if (/CEPHALOFAIR/i.test(l)) return true;
    if (labelNoiseWord.test(l)) return true;
    if (/^x?\d+$/.test(l)) return true;
    if (/^\d+(\s+\d+)+$/.test(l)) return true;
    const words = l.split(/\s+/);
    if (words.every(w => labelNoiseWord.test(w))) return true;
    // Glued-but-label-only artifacts: "LootScenario" → [Loot, Scenario].
    if (words.every(w => w.split(/(?=[A-Z])/).every(chunk => labelNoiseWord.test(chunk)))) return true;
    return false;
  };

  let contName: string | null = null;
  let plainName: string | null = null;
  let concreteInspected = 0;
  for (let i = lines.length - 1; i >= 0 && concreteInspected < 2; i--) {
    const l = lines[i];
    if (isNoiseLine(l)) continue;
    concreteInspected++;
    const cm = isContLine(l);
    if (cm) { if (!contName) contName = cm[1].trim(); continue; }
    if (looksLikeScenarioName(l)) { plainName = l; continue; }
    break; // narrative paragraph — stop looking
  }

  const fullText = lines.join('\n');
  const addendum: ParsedScenario = {
    scenarioIndex: String(pageNumber),
    name: plainName ?? (contName ?? ''),
    locationCode: '',
    isContinuation: !!contName && !plainName,
    introduction: extractIntroduction(lines),
    goalText: extractGoalText(fullText),
    lossText: extractLossText(fullText),
    specialRulesText: extractSpecialRules(lines, null, null),
    sectionLinks: extractSectionLinks(fullText),
    designer: null,
    writer: null,
    rawText: fullText,
  };

  if (contName && !plainName) {
    // Pure continuation page.
    return { kind: 'continuation', ofName: contName, addendum };
  }
  if (!plainName) return { kind: 'skip' };
  // Base page (may also contain a CONT for a previous scenario — we store the
  // base and rely on the previous scenario already having its core content).
  return { kind: 'base', scenario: addendum };
}

/** Goal-text extraction shared between main and solo parsers. */
function extractGoalText(fullText: string): string | null {
  const m = fullText.match(
    /(The scenario (?:is|may be) complete\s+(?:when|at\s+the\s+end\s+of|once|after|only)\s+[\s\S]*?\.)/i,
  );
  if (m) {
    let raw = m[1];
    const interleaveIdx = raw.search(/\s+When\s+(door|a|the|all|any)\s/i);
    if (interleaveIdx > 30) raw = raw.substring(0, interleaveIdx) + '.';
    return raw.replace(/\s+/g, ' ').trim();
  }
  if (/Unknown at this time\./i.test(fullText)) return 'Unknown at this time.';
  return null;
}

// ── Main pipeline ───────────────────────────────────────────────────────────

interface VerifyEntry {
  scenarioIndex: string;
  name: string;
  goalText: string;
  lossText: string;
  confidence: string;
}

async function main() {
  const args = process.argv.slice(2);
  const booksDir = getArg(args, '--books-dir')
    || join(ROOT, '.staging', 'worldhaven', 'images', 'books', 'frosthaven');
  const scenarioOnly = args.includes('--scenario-only');
  const verifyMode = args.includes('--verify');

  if (!existsSync(booksDir)) {
    console.error(`Books directory not found: ${booksDir}`);
    process.exit(1);
  }

  console.log(`Books directory: ${booksDir}`);
  console.log(`Database: ${DB_PATH}`);

  const db = new ReferenceDb(DB_PATH);
  // scenario_book_data gained a group_name column in the PK (for solo scenarios).
  // Drop the old table so createSchema() rebuilds it with the new PK — the data
  // is fully re-derived from the PDFs on every run.
  try { db.transaction(() => { (db as any).db.exec('DROP TABLE IF EXISTS scenario_book_data'); }); } catch (_) { /* ignore */ }
  // Ensure schema has the new tables and columns
  db.createSchema();
  // Add new columns to existing sections table if missing (for DBs created before this change)
  try { db.transaction(() => { (db as any).db.exec('ALTER TABLE sections ADD COLUMN narrative_text TEXT'); }); } catch (_) { /* already exists */ }
  try { db.transaction(() => { (db as any).db.exec('ALTER TABLE sections ADD COLUMN rewards_text TEXT'); }); } catch (_) { /* already exists */ }

  const verifyEntries: VerifyEntry[] = [];

  // ── Process scenario books ──
  console.log('\n=== Processing Scenario Books ===');
  let totalScenarios = 0;
  let scenariosWithGoal = 0;
  let scenariosWithLoss = 0;

  for (const filename of SCENARIO_BOOKS) {
    const filepath = join(booksDir, filename);
    if (!existsSync(filepath)) {
      console.warn(`  SKIP: ${filename} not found`);
      continue;
    }

    console.log(`  Processing: ${filename}`);
    const pages = await extractPdfPages(filepath);
    let prevScenario: ParsedScenario | null = null;

    for (const { pageNumber, text } of pages) {
      if (isCopyrightOnlyPage(text)) continue;
      const parsedList = parseScenarioPages(text);
      if (parsedList.length === 0) {
        if (text.trim().length < 50) continue;
        console.warn(`    Page ${pageNumber}: could not parse`);
        continue;
      }

      for (const parsed of parsedList) {
        if (parsed.isContinuation && prevScenario) {
          console.log(`    Page ${pageNumber}: ${parsed.scenarioIndex} CONT.`);
          mergeContinuation(prevScenario, parsed);
        } else {
          if (prevScenario) {
            storeScenario(db, 'fh', prevScenario);
            trackVerify(prevScenario, verifyEntries);
            totalScenarios++;
            if (prevScenario.goalText) scenariosWithGoal++;
            if (prevScenario.lossText) scenariosWithLoss++;
          }
          prevScenario = parsed;
          console.log(`    Page ${pageNumber}: Scenario ${parsed.scenarioIndex} — ${parsed.name}`);
        }
      }
    }

    if (prevScenario) {
      storeScenario(db, 'fh', prevScenario);
      trackVerify(prevScenario, verifyEntries);
      totalScenarios++;
      if (prevScenario.goalText) scenariosWithGoal++;
      if (prevScenario.lossText) scenariosWithLoss++;
    }
  }

  console.log(`\nScenario extraction summary:`);
  console.log(`  Total scenarios: ${totalScenarios}`);
  console.log(`  With goal text: ${scenariosWithGoal}`);
  console.log(`  With explicit loss condition: ${scenariosWithLoss}`);

  // ── Process section books ──
  if (!scenarioOnly) {
    console.log('\n=== Processing Section Books ===');
    let totalSections = 0;
    let sectionsWithNarrative = 0;

    for (const filename of SECTION_BOOKS) {
      const filepath = join(booksDir, filename);
      if (!existsSync(filepath)) {
        console.warn(`  SKIP: ${filename} not found`);
        continue;
      }

      console.log(`  Processing: ${filename}`);
      const pages = await extractPdfPages(filepath);

      for (const { pageNumber, text } of pages) {
        if (isCopyrightOnlyPage(text)) continue;
        const sections = parseSectionPage(text);
        if (sections.length === 0) {
          console.warn(`    Page ${pageNumber}: no sections found`);
          continue;
        }
        console.log(`    Page ${pageNumber}: ${sections.map(s => s.sectionId).join(', ')}`);
        for (const section of sections) {
          storeSection(db, 'fh', section);
          totalSections++;
          if (section.narrativeText) sectionsWithNarrative++;
        }
      }
    }

    console.log(`\nSection extraction summary:`);
    console.log(`  Total sections: ${totalSections}`);
    console.log(`  With narrative text: ${sectionsWithNarrative}`);
  }

  // ── Process solo scenario book ──
  console.log('\n=== Processing Solo Scenario Book ===');
  let totalSolo = 0;
  let soloWithGoal = 0;
  for (const filename of SOLO_BOOKS) {
    const filepath = join(booksDir, filename);
    if (!existsSync(filepath)) {
      console.warn(`  SKIP: ${filename} not found`);
      continue;
    }
    console.log(`  Processing: ${filename}`);
    const pages = await extractPdfPages(filepath);
    let prevSolo: ParsedScenario | null = null;
    const flushPrev = () => {
      if (prevSolo) {
        storeScenario(db, 'fh', prevSolo, 'solo');
        totalSolo++;
        if (prevSolo.goalText) soloWithGoal++;
        prevSolo = null;
      }
    };
    for (const { pageNumber, text } of pages) {
      if (isCopyrightOnlyPage(text)) continue;
      // Page 1 is the "This book contains solo scenarios" introduction.
      if (pageNumber === 1 && /This book contains solo scenarios/i.test(text)) continue;
      const result = parseSoloScenarioPage(text, pageNumber);
      if (result.kind === 'skip') {
        console.log(`    Page ${pageNumber}: skip (non-scenario)`);
        continue;
      }
      if (result.kind === 'continuation') {
        console.log(`    Page ${pageNumber}: CONT. ${result.ofName}`);
        if (prevSolo && prevSolo.name === result.ofName) {
          mergeContinuation(prevSolo, result.addendum);
        } else {
          console.warn(`    Page ${pageNumber}: continuation without matching base "${result.ofName}"`);
        }
        continue;
      }
      // Base: flush previous, start new.
      flushPrev();
      prevSolo = result.scenario;
      console.log(`    Page ${pageNumber}: ${prevSolo.name}`);
    }
    flushPrev();
  }
  console.log(`\nSolo extraction summary:`);
  console.log(`  Total solo scenarios: ${totalSolo}`);
  console.log(`  With goal text: ${soloWithGoal}`);

  // ── Coverage report ──
  printCoverageReport(db);

  // ── Verify mode: output TSV ──
  if (verifyMode) {
    const tsvPath = join(ROOT, 'data', 'book-extraction-verify.tsv');
    const header = 'scenario_index\tname\tgoal_text\tloss_text\tconfidence';
    const rows = verifyEntries.map(e =>
      `${e.scenarioIndex}\t${e.name}\t${e.goalText}\t${e.lossText}\t${e.confidence}`
    );
    writeFileSync(tsvPath, [header, ...rows].join('\n'), 'utf-8');
    console.log(`\nVerification TSV written to: ${tsvPath}`);
  }

  db.close();
  console.log('\nDone.');
}

function storeScenario(
  db: ReferenceDb,
  edition: string,
  s: ParsedScenario,
  groupName = '',
): void {
  db.insertScenarioBookData(
    edition, s.scenarioIndex, groupName,
    s.introduction, s.goalText, s.lossText,
    s.specialRulesText,
    s.sectionLinks.length > 0 ? JSON.stringify(s.sectionLinks) : null,
    s.designer, s.writer,
    s.locationCode || null, s.rawText,
  );
}

function printCoverageReport(db: ReferenceDb): void {
  const raw = (db as any).db as {
    prepare(sql: string): { get(...params: unknown[]): unknown };
  };
  const main = raw.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN goal_text IS NOT NULL AND goal_text != '' THEN 1 ELSE 0 END) AS with_goal,
            SUM(CASE WHEN loss_text IS NOT NULL AND loss_text != '' THEN 1 ELSE 0 END) AS with_loss
       FROM scenario_book_data
      WHERE group_name = ''`,
  ).get() as { total: number; with_goal: number; with_loss: number };
  const solo = raw.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN goal_text IS NOT NULL AND goal_text != '' THEN 1 ELSE 0 END) AS with_goal
       FROM scenario_book_data
      WHERE group_name = 'solo'`,
  ).get() as { total: number; with_goal: number };
  const sec = raw.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN narrative_text IS NOT NULL AND narrative_text != '' THEN 1 ELSE 0 END) AS with_nar
       FROM sections`,
  ).get() as { total: number; with_nar: number };

  console.log('\n=== Coverage Report ===');
  console.log(`  Main scenarios:  ${main.total} (${main.with_goal} with goal, ${main.with_loss} with loss)`);
  console.log(`  Solo scenarios:  ${solo.total} (${solo.with_goal} with goal)`);
  console.log(`  Sections:        ${sec.total} (${sec.with_nar} with narrative)`);
}

function storeSection(db: ReferenceDb, edition: string, s: ParsedSection): void {
  db.insertSectionNarrative(
    edition, s.sectionId, s.parentScenario,
    s.title, s.narrativeText, s.rewardsText,
  );
}

function trackVerify(s: ParsedScenario, entries: VerifyEntry[]): void {
  let confidence = 'HIGH';
  if (!s.goalText) confidence = 'LOW — no goal text';
  else if (s.goalText.length < 20) confidence = 'MEDIUM — very short goal';
  entries.push({
    scenarioIndex: s.scenarioIndex,
    name: s.name,
    goalText: s.goalText || '(none)',
    lossText: s.lossText || '(default: all exhausted)',
    confidence,
  });
}

function getArg(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return null;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
