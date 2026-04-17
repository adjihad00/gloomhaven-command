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
    // Full title: "0 • N6 Howling in the Snow"
    const m = lines[i].match(/^(\d+)\s*(CONT\.)?\s*•\s*([A-Z][A-Z0-9-]*)\s+(.+)/);
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
    const contMatch = lines[i].match(/^(\d+)\s+CONT\.\s*•\s*(.+)/);
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
      const numMatch = lines[i - 1].match(/^(\d+)\s*(CONT\.)?$/);
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
  let goalText: string | null = null;
  const goalMatch = fullText.match(/(The scenario is complete\s+(?:when|at the end of|once|after)\s+[\s\S]*?\.)/i);
  if (goalMatch) {
    let raw = goalMatch[1];
    // Handle column interleaving: if "When door" appears mid-sentence, split there
    const interleaveIdx = raw.search(/\s+When\s+(door|a|the|all|any)\s/i);
    if (interleaveIdx > 30) {
      raw = raw.substring(0, interleaveIdx) + '.';
    }
    goalText = raw.replace(/\s+/g, ' ').trim();
  }

  // ── Loss condition ──
  let lossText: string | null = null;
  const lossMatch1 = fullText.match(/(If\s+[\s\S]*?the scenario is lost\.)/i);
  if (lossMatch1) {
    lossText = lossMatch1[1].replace(/\s+/g, ' ').trim();
  }
  if (!lossText) {
    const lossMatch2 = fullText.match(/([^.]*?the scenario is lost\.)/i);
    if (lossMatch2) {
      const candidate = lossMatch2[1].replace(/\s+/g, ' ').trim();
      if (candidate.length > 10 && candidate.length < 300) lossText = candidate;
    }
  }

  // ── Section links ──
  const sectionLinks: Array<{ trigger: string; sectionId: string }> = [];
  const linkPattern = /(?:read|Read)\s+(\d+\.\d+)/g;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkPattern.exec(fullText)) !== null) {
    const before = fullText.substring(Math.max(0, linkMatch.index - 60), linkMatch.index);
    const sentenceStart = Math.max(before.lastIndexOf('.') + 1, before.lastIndexOf('\n') + 1, 0);
    const trigger = before.substring(sentenceStart).replace(/\s+/g, ' ').trim();
    sectionLinks.push({ trigger, sectionId: linkMatch[1] });
  }

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
      const parsedList = parseScenarioPages(text);
      if (parsedList.length === 0) {
        // Skip known non-scenario pages (copyright, intro, empty)
        if (pageNumber <= 2 && filename === SCENARIO_BOOKS[0]) continue;
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

function storeScenario(db: ReferenceDb, edition: string, s: ParsedScenario): void {
  db.insertScenarioBookData(
    edition, s.scenarioIndex,
    s.introduction, s.goalText, s.lossText,
    s.specialRulesText,
    s.sectionLinks.length > 0 ? JSON.stringify(s.sectionLinks) : null,
    s.designer, s.writer,
    s.locationCode || null, s.rawText,
  );
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
