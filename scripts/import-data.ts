#!/usr/bin/env npx tsx
/**
 * import-data.ts — Populates data/reference.db from .staging/ source files.
 *
 * Usage:  npx tsx scripts/import-data.ts
 *
 * Recreates the entire reference database from scratch each run.
 * Safe to re-run at any time.
 */

import { resolve, join, relative, extname, dirname } from 'path';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';

// ── Paths ────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const STAGING = join(ROOT, '.staging');
const GHS_DATA = join(STAGING, 'ghs-client', 'data');
const GHS_IMAGES = join(STAGING, 'ghs-client', 'src', 'assets', 'images');
const WORLDHAVEN = join(STAGING, 'worldhaven');
const WORLDHAVEN_IMAGES = join(WORLDHAVEN, 'images');
const WORLDHAVEN_DATA = join(WORLDHAVEN, 'data');
const DB_PATH = join(ROOT, 'data', 'reference.db');

// Editions we consider "substantial" for full import
// Others are imported too, but we log stats for these
const MAJOR_EDITIONS = ['gh', 'fh', 'jotl', 'cs', 'fc', 'gh2e', 'toa'];

// Map worldhaven expansion directory names to edition codes
const WORLDHAVEN_EDITION_MAP: Record<string, string> = {
  'gloomhaven': 'gh',
  'frosthaven': 'fh',
  'jaws-of-the-lion': 'jotl',
  'crimson-scales': 'cs',
  'forgotten-circles': 'fc',
  'trail-of-ashes': 'toa',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.json'))
    .map(e => e.name);
}

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

function listFilesRecursive(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath, base));
    } else {
      results.push(relative(base, fullPath).replace(/\\/g, '/'));
    }
  }
  return results;
}

/** Flatten a nested object into dot-separated key-value pairs */
function flattenObject(obj: unknown, prefix = ''): Array<[string, string]> {
  const result: Array<[string, string]> = [];
  if (obj === null || obj === undefined) return result;
  if (typeof obj === 'string') {
    result.push([prefix, obj]);
    return result;
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    result.push([prefix, String(obj)]);
    return result;
  }
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const newPrefix = prefix ? (key === '' ? prefix : `${prefix}.${key}`) : key;
      result.push(...flattenObject(value, newPrefix));
    }
  }
  return result;
}

function jsonOrNull(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  return JSON.stringify(val);
}

// ── Schema (imported from referenceDb.ts inline for standalone script) ───────

// We import the schema SQL directly to avoid circular dependency
// The schema is defined in server/src/referenceDb.ts but we duplicate the
// DDL here for the standalone import script.

function createSchema(db: Database.Database): void {
  // Read the referenceDb.ts and extract schema... or just inline it.
  // For maintainability, we'll use the same pattern as GameStore.
  db.exec(`
DROP TABLE IF EXISTS asset_manifest;
DROP TABLE IF EXISTS campaign_data;
DROP TABLE IF EXISTS treasures;
DROP TABLE IF EXISTS buildings;
DROP TABLE IF EXISTS personal_quests;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS battle_goals;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS monster_stats;
DROP TABLE IF EXISTS monsters;
DROP TABLE IF EXISTS characters;
DROP TABLE IF EXISTS editions;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS scenario_spawns;
DROP TABLE IF EXISTS scenario_rooms;
DROP TABLE IF EXISTS scenarios;
DROP TABLE IF EXISTS monster_ability_cards;
DROP TABLE IF EXISTS monster_ability_decks;
DROP TABLE IF EXISTS labels;

CREATE TABLE labels (
  edition TEXT NOT NULL,
  key TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  value TEXT NOT NULL,
  PRIMARY KEY (edition, key, locale)
);
CREATE TABLE monster_ability_decks (
  edition TEXT NOT NULL,
  deck_name TEXT NOT NULL,
  PRIMARY KEY (edition, deck_name)
);
CREATE TABLE monster_ability_cards (
  edition TEXT NOT NULL,
  deck_name TEXT NOT NULL,
  card_id INTEGER NOT NULL,
  name TEXT,
  initiative INTEGER NOT NULL,
  shuffle INTEGER NOT NULL DEFAULT 0,
  actions_json TEXT NOT NULL,
  PRIMARY KEY (edition, deck_name, card_id)
);
CREATE TABLE scenarios (
  edition TEXT NOT NULL,
  scenario_index TEXT NOT NULL,
  group_name TEXT DEFAULT '',
  name TEXT NOT NULL,
  complexity INTEGER,
  is_initial INTEGER DEFAULT 0,
  unlocks_json TEXT,
  links_json TEXT,
  blocks_json TEXT,
  requires_json TEXT,
  requirements_json TEXT,
  rewards_json TEXT,
  monsters_json TEXT,
  allies_json TEXT,
  objectives_json TEXT,
  loot_deck_config_json TEXT,
  rules_json TEXT,
  sections_json TEXT,
  PRIMARY KEY (edition, scenario_index, group_name)
);
CREATE TABLE scenario_rooms (
  edition TEXT NOT NULL,
  scenario_index TEXT NOT NULL,
  group_name TEXT DEFAULT '',
  room_number INTEGER NOT NULL,
  ref TEXT DEFAULT '',
  is_initial INTEGER DEFAULT 0,
  connected_rooms_json TEXT,
  marker TEXT,
  treasures_json TEXT,
  objectives_json TEXT,
  PRIMARY KEY (edition, scenario_index, group_name, room_number)
);
CREATE TABLE scenario_spawns (
  edition TEXT NOT NULL,
  scenario_index TEXT NOT NULL,
  group_name TEXT DEFAULT '',
  room_number INTEGER NOT NULL,
  spawn_index INTEGER NOT NULL,
  monster_name TEXT NOT NULL,
  always_type TEXT,
  player2_type TEXT,
  player3_type TEXT,
  player4_type TEXT,
  marker TEXT,
  PRIMARY KEY (edition, scenario_index, group_name, room_number, spawn_index)
);
CREATE TABLE sections (
  edition TEXT NOT NULL,
  section_id TEXT NOT NULL,
  parent_scenario TEXT,
  name TEXT,
  conclusion INTEGER DEFAULT 0,
  monsters_json TEXT,
  rooms_json TEXT,
  rewards_json TEXT,
  rules_json TEXT,
  PRIMARY KEY (edition, section_id)
);
CREATE TABLE editions (
  edition TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  conditions_json TEXT NOT NULL
);
CREATE TABLE characters (
  edition TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT,
  color TEXT,
  hand_size INTEGER,
  spoiler INTEGER DEFAULT 0,
  stats_json TEXT NOT NULL,
  perks_json TEXT,
  PRIMARY KEY (edition, name)
);
CREATE TABLE monsters (
  edition TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT,
  deck_name TEXT,
  standee_count INTEGER,
  is_boss INTEGER DEFAULT 0,
  is_flying INTEGER DEFAULT 0,
  PRIMARY KEY (edition, name)
);
CREATE TABLE monster_stats (
  edition TEXT NOT NULL,
  monster_name TEXT NOT NULL,
  level INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'normal',
  health TEXT NOT NULL,
  movement INTEGER NOT NULL,
  attack INTEGER NOT NULL,
  range_val INTEGER,
  actions_json TEXT,
  immunities_json TEXT,
  PRIMARY KEY (edition, monster_name, level, type)
);
CREATE TABLE items (
  edition TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  name TEXT,
  cost INTEGER,
  slot TEXT,
  count INTEGER,
  spent INTEGER DEFAULT 0,
  consumed INTEGER DEFAULT 0,
  actions_json TEXT,
  resources_json TEXT,
  unlock_prosperity INTEGER,
  required_building TEXT,
  required_building_level INTEGER,
  PRIMARY KEY (edition, item_id)
);
CREATE TABLE battle_goals (
  edition TEXT NOT NULL,
  card_id TEXT NOT NULL,
  name TEXT,
  checks INTEGER,
  PRIMARY KEY (edition, card_id)
);
CREATE TABLE events (
  edition TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  narrative TEXT,
  options_json TEXT,
  PRIMARY KEY (edition, event_type, event_id)
);
CREATE TABLE personal_quests (
  edition TEXT NOT NULL,
  card_id TEXT NOT NULL,
  name TEXT,
  requirements_json TEXT,
  unlock_character TEXT,
  PRIMARY KEY (edition, card_id)
);
CREATE TABLE buildings (
  edition TEXT NOT NULL,
  building_id TEXT NOT NULL,
  name TEXT,
  costs_json TEXT,
  upgrades_json TEXT,
  PRIMARY KEY (edition, building_id)
);
CREATE TABLE campaign_data (
  edition TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  PRIMARY KEY (edition, key)
);
CREATE TABLE treasures (
  edition TEXT NOT NULL,
  treasure_index INTEGER NOT NULL,
  reward TEXT NOT NULL,
  PRIMARY KEY (edition, treasure_index)
);
CREATE TABLE asset_manifest (
  edition TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  path TEXT NOT NULL,
  variant TEXT
);

CREATE INDEX idx_labels_lookup ON labels(edition, key);
CREATE INDEX idx_ability_cards_deck ON monster_ability_cards(edition, deck_name);
CREATE INDEX idx_scenario_rooms ON scenario_rooms(edition, scenario_index);
CREATE INDEX idx_spawns_room ON scenario_spawns(edition, scenario_index, room_number);
CREATE INDEX idx_monster_stats ON monster_stats(edition, monster_name, level);
CREATE INDEX idx_sections_parent ON sections(edition, parent_scenario);
CREATE INDEX idx_items_edition ON items(edition);
CREATE INDEX idx_assets_category ON asset_manifest(edition, category);
CREATE INDEX idx_assets_source ON asset_manifest(source, category);
CREATE UNIQUE INDEX idx_assets_unique ON asset_manifest(edition, category, name, source, COALESCE(variant, ''));
  `);
}

// ── Import Functions ─────────────────────────────────────────────────────────

interface Counters {
  labels: number;
  editions: number;
  characters: number;
  monsters: number;
  monsterStats: number;
  abilityDecks: number;
  abilityCards: number;
  scenarios: number;
  rooms: number;
  spawns: number;
  sections: number;
  items: number;
  battleGoals: number;
  events: number;
  personalQuests: number;
  buildings: number;
  treasures: number;
  campaignData: number;
  assets: number;
}

function importEdition(db: Database.Database, edition: string, counters: Counters): void {
  const edDir = join(GHS_DATA, edition);
  if (!existsSync(join(edDir, 'base.json'))) return;

  // ── 1. Labels ──────────────────────────────────────────────────────────
  importLabels(db, edition, counters);

  // ── 2. Base (edition metadata) ─────────────────────────────────────────
  const base = readJson<Record<string, unknown>>(join(edDir, 'base.json'));
  const editionName = base.edition as string || edition;
  const conditions = (base.conditions as string[]) || [];
  db.prepare(`INSERT OR REPLACE INTO editions (edition, name, conditions_json) VALUES (?, ?, ?)`)
    .run(edition, editionName, JSON.stringify(conditions));
  counters.editions++;

  // ── 3. Characters ──────────────────────────────────────────────────────
  importCharacters(db, edition, edDir, counters);

  // ── 4. Monsters + Stats ────────────────────────────────────────────────
  importMonsters(db, edition, edDir, counters);

  // ── 5. Monster Ability Decks + Cards ───────────────────────────────────
  importMonsterDecks(db, edition, edDir, counters);

  // ── 6. Scenarios + Rooms + Spawns ──────────────────────────────────────
  importScenarios(db, edition, edDir, counters);

  // ── 7. Sections ────────────────────────────────────────────────────────
  importSections(db, edition, edDir, counters);

  // ── 8. Items ───────────────────────────────────────────────────────────
  importItems(db, edition, edDir, counters);

  // ── 9. Battle Goals ────────────────────────────────────────────────────
  importBattleGoals(db, edition, edDir, counters);

  // ── 10. Events ─────────────────────────────────────────────────────────
  importEvents(db, edition, edDir, counters);

  // ── 11. Personal Quests ────────────────────────────────────────────────
  importPersonalQuests(db, edition, edDir, counters);

  // ── 12. Buildings (FH) ─────────────────────────────────────────────────
  importBuildings(db, edition, edDir, counters);

  // ── 13. Treasures ──────────────────────────────────────────────────────
  importTreasures(db, edition, edDir, counters);

  // ── 14. Campaign Data ──────────────────────────────────────────────────
  importCampaignData(db, edition, edDir, counters);
}

// ── Label Import ─────────────────────────────────────────────────────────────

function importLabels(db: Database.Database, edition: string, counters: Counters): void {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO labels (edition, key, locale, value) VALUES (?, ?, ?, ?)`,
  );

  // Main label file
  const labelPath = join(GHS_DATA, edition, 'label', 'en.json');
  if (existsSync(labelPath)) {
    const data = readJson<unknown>(labelPath);
    const flat = flattenObject(data);
    for (const [key, value] of flat) {
      if (key && value) {
        stmt.run(edition, key, 'en', value);
        counters.labels++;
      }
    }
  }

  // Spoiler label file
  const spoilerPath = join(GHS_DATA, edition, 'label', 'spoiler', 'en.json');
  if (existsSync(spoilerPath)) {
    const data = readJson<unknown>(spoilerPath);
    const flat = flattenObject(data, 'spoiler');
    for (const [key, value] of flat) {
      if (key && value) {
        stmt.run(edition, key, 'en', value);
        counters.labels++;
      }
    }
  }
}

// ── Character Import ─────────────────────────────────────────────────────────

function importCharacters(db: Database.Database, edition: string, edDir: string, counters: Counters): void {
  const charDir = join(edDir, 'character');
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO characters
     (edition, name, display_name, color, hand_size, spoiler, stats_json, perks_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const file of listJsonFiles(charDir)) {
    const data = readJson<Record<string, unknown>>(join(charDir, file));
    const name = data.name as string;
    const spoiler = data.spoiler ? 1 : 0;
    stmt.run(
      edition, name,
      null, // display_name resolved from labels later
      (data.color as string) || null,
      (data.handSize as number) || null,
      spoiler,
      JSON.stringify(data.stats || []),
      jsonOrNull(data.perks),
    );
    counters.characters++;
  }
}

// ── Monster Import ───────────────────────────────────────────────────────────

function importMonsters(db: Database.Database, edition: string, edDir: string, counters: Counters): void {
  const monsterDir = join(edDir, 'monster');
  const monsterStmt = db.prepare(
    `INSERT OR REPLACE INTO monsters
     (edition, name, display_name, deck_name, standee_count, is_boss, is_flying)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const statsStmt = db.prepare(
    `INSERT OR REPLACE INTO monster_stats
     (edition, monster_name, level, type, health, movement, attack, range_val, actions_json, immunities_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const file of listJsonFiles(monsterDir)) {
    const data = readJson<Record<string, unknown>>(join(monsterDir, file));
    const name = data.name as string;
    const deck = (data.deck as string) || null;
    const isBoss = data.boss ? 1 : 0;
    const isFlying = data.flying ? 1 : 0;

    monsterStmt.run(
      edition, name, null, deck,
      (data.count as number) || null,
      isBoss, isFlying,
    );
    counters.monsters++;

    // Stats per level per type
    const stats = (data.stats as Array<Record<string, unknown>>) || [];
    for (const stat of stats) {
      const level = stat.level as number;
      if (level == null) continue; // Skip malformed stat entries
      const type = (stat.type as string) || 'normal';
      const health = String(stat.health ?? 0);
      const movement = (stat.movement as number) ?? 0;
      const attack = (stat.attack as number) ?? 0;
      const rangeVal = stat.range != null ? (stat.range as number) : null;
      const actions = (stat.actions as unknown[]) || null;
      const immunities = (stat.immunities as string[]) || null;

      statsStmt.run(
        edition, name, level, type, health, movement, attack,
        rangeVal, jsonOrNull(actions), jsonOrNull(immunities),
      );
      counters.monsterStats++;
    }

    // Boss base stats (immunities at base level, not per-level)
    const baseStat = data.baseStat as Record<string, unknown> | undefined;
    if (baseStat?.immunities) {
      // These are global immunities, update existing stat rows
      // Already stored per-level if present in stats[], but base-level ones
      // are separate. We store them as a separate "base" entry.
    }
  }
}

// ── Monster Ability Deck Import ──────────────────────────────────────────────

function importMonsterDecks(db: Database.Database, edition: string, edDir: string, counters: Counters): void {
  const deckDir = join(edDir, 'monster', 'deck');
  if (!existsSync(deckDir)) return;

  const deckStmt = db.prepare(
    `INSERT OR REPLACE INTO monster_ability_decks (edition, deck_name) VALUES (?, ?)`,
  );
  const cardStmt = db.prepare(
    `INSERT OR REPLACE INTO monster_ability_cards
     (edition, deck_name, card_id, name, initiative, shuffle, actions_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const file of listJsonFiles(deckDir)) {
    const data = readJson<Record<string, unknown>>(join(deckDir, file));
    const deckName = data.name as string;

    deckStmt.run(edition, deckName);
    counters.abilityDecks++;

    const abilities = (data.abilities as Array<Record<string, unknown>>) || [];
    for (let ci = 0; ci < abilities.length; ci++) {
      const card = abilities[ci];
      const cardId = (card.cardId as number) ?? ci;
      // Try to resolve card name from labels: deck.{deckName}.{cardId}
      // Labels are already imported, so we can query
      const labelKey = `deck.${deckName}.${cardId}`;
      const labelRow = db.prepare(
        `SELECT value FROM labels WHERE edition = ? AND key = ? AND locale = 'en'`,
      ).get(edition, labelKey) as { value: string } | undefined;

      // Use label name first, then card's own name field (FH cards have names), then null
      const cardName = labelRow?.value ?? (card.name as string | undefined) ?? null;

      cardStmt.run(
        edition, deckName, cardId,
        cardName,
        card.initiative as number,
        card.shuffle ? 1 : 0,
        JSON.stringify(card.actions || []),
      );
      counters.abilityCards++;
    }
  }
}

// ── Scenario Import ──────────────────────────────────────────────────────────

function importScenarios(db: Database.Database, edition: string, edDir: string, counters: Counters): void {
  const scenarioDir = join(edDir, 'scenarios');
  if (!existsSync(scenarioDir)) return;

  const scenarioStmt = db.prepare(
    `INSERT OR REPLACE INTO scenarios
     (edition, scenario_index, group_name, name, complexity, is_initial,
      unlocks_json, links_json, blocks_json, requires_json, requirements_json,
      rewards_json, monsters_json, allies_json, objectives_json,
      loot_deck_config_json, rules_json, sections_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const roomStmt = db.prepare(
    `INSERT OR REPLACE INTO scenario_rooms
     (edition, scenario_index, group_name, room_number, ref, is_initial,
      connected_rooms_json, marker, treasures_json, objectives_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const spawnStmt = db.prepare(
    `INSERT OR REPLACE INTO scenario_spawns
     (edition, scenario_index, group_name, room_number, spawn_index,
      monster_name, always_type, player2_type, player3_type, player4_type, marker)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const file of listJsonFiles(scenarioDir)) {
    const data = readJson<Record<string, unknown>>(join(scenarioDir, file));
    const index = data.index as string;
    const group = (data.group as string) || '';
    const name = data.name as string;

    // Collect allies from both "allies" and "allied" fields
    const allies = [
      ...((data.allies as string[]) || []),
      ...((data.allied as string[]) || []),
    ];

    scenarioStmt.run(
      edition, index, group, name,
      (data.complexity as number) ?? null,
      data.initial ? 1 : 0,
      jsonOrNull(data.unlocks),
      jsonOrNull(data.links),
      jsonOrNull(data.blocks),
      jsonOrNull(data.requires),
      jsonOrNull(data.requirements),
      jsonOrNull(data.rewards),
      jsonOrNull(data.monsters),
      allies.length > 0 ? JSON.stringify(allies) : null,
      jsonOrNull(data.objectives),
      jsonOrNull(data.lootDeckConfig),
      jsonOrNull(data.rules),
      jsonOrNull(data.sections),
    );
    counters.scenarios++;

    // Rooms + spawns
    const rooms = (data.rooms as Array<Record<string, unknown>>) || [];
    for (const room of rooms) {
      const roomNumber = room.roomNumber as number;

      roomStmt.run(
        edition, index, group, roomNumber,
        (room.ref as string) || '',
        room.initial ? 1 : 0,
        jsonOrNull(room.rooms),
        (room.marker as string) ?? null,
        jsonOrNull(room.treasures),
        jsonOrNull(room.objectives),
      );
      counters.rooms++;

      // Monster spawns in this room
      const monsters = (room.monster as Array<Record<string, unknown>>) || [];
      for (let si = 0; si < monsters.length; si++) {
        const spawn = monsters[si];
        spawnStmt.run(
          edition, index, group, roomNumber, si,
          spawn.name as string,
          (spawn.type as string) ?? null,
          (spawn.player2 as string) ?? null,
          (spawn.player3 as string) ?? null,
          (spawn.player4 as string) ?? null,
          (spawn.marker as string) ?? null,
        );
        counters.spawns++;
      }
    }
  }
}

// ── Section Import ───────────────────────────────────────────────────────────

function importSections(db: Database.Database, edition: string, edDir: string, counters: Counters): void {
  const sectionDir = join(edDir, 'sections');
  if (!existsSync(sectionDir)) return;

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO sections
     (edition, section_id, parent_scenario, name, conclusion,
      monsters_json, rooms_json, rewards_json, rules_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const file of listJsonFiles(sectionDir)) {
    const data = readJson<Record<string, unknown>>(join(sectionDir, file));
    stmt.run(
      edition,
      data.index as string,
      (data.parent as string) ?? null,
      (data.name as string) ?? null,
      data.conclusion ? 1 : 0,
      jsonOrNull(data.monsters),
      jsonOrNull(data.rooms),
      jsonOrNull(data.rewards),
      jsonOrNull(data.rules),
    );
    counters.sections++;
  }
}

// ── Item Import ──────────────────────────────────────────────────────────────

function importItems(db: Database.Database, edition: string, edDir: string, counters: Counters): void {
  const itemsPath = join(edDir, 'items.json');
  if (!existsSync(itemsPath)) return;

  const items = readJson<Array<Record<string, unknown>>>(itemsPath);
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO items
     (edition, item_id, name, cost, slot, count, spent, consumed,
      actions_json, resources_json, unlock_prosperity,
      required_building, required_building_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const item of items) {
    stmt.run(
      edition,
      item.id as number,
      (item.name as string) ?? null,
      (item.cost as number) ?? null,
      (item.slot as string) ?? null,
      (item.count as number) ?? null,
      item.spent ? 1 : 0,
      item.consumed ? 1 : 0,
      jsonOrNull(item.actions),
      jsonOrNull(item.resources),
      (item.unlockProsperity as number) ?? null,
      (item.requiredBuilding as string) ?? null,
      (item.requiredBuildingLevel as number) ?? null,
    );
    counters.items++;
  }
}

// ── Battle Goal Import ───────────────────────────────────────────────────────

function importBattleGoals(db: Database.Database, edition: string, edDir: string, counters: Counters): void {
  const bgPath = join(edDir, 'battle-goals.json');
  if (!existsSync(bgPath)) return;

  const goals = readJson<Array<Record<string, unknown>>>(bgPath);
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO battle_goals (edition, card_id, name, checks) VALUES (?, ?, ?, ?)`,
  );

  for (const goal of goals) {
    stmt.run(
      edition,
      String(goal.cardId ?? goal.id ?? ''),
      (goal.name as string) ?? null,
      (goal.checks as number) ?? null,
    );
    counters.battleGoals++;
  }
}

// ── Event Import ─────────────────────────────────────────────────────────────

function importEvents(db: Database.Database, edition: string, edDir: string, counters: Counters): void {
  const eventsPath = join(edDir, 'events.json');
  if (!existsSync(eventsPath)) return;

  const events = readJson<Array<Record<string, unknown>>>(eventsPath);
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO events (edition, event_type, event_id, narrative, options_json)
     VALUES (?, ?, ?, ?, ?)`,
  );

  for (const event of events) {
    stmt.run(
      edition,
      (event.type as string) || 'unknown',
      String(event.cardId ?? ''),
      (event.narrative as string) ?? null,
      jsonOrNull(event.options),
    );
    counters.events++;
  }
}

// ── Personal Quest Import ────────────────────────────────────────────────────

function importPersonalQuests(db: Database.Database, edition: string, edDir: string, counters: Counters): void {
  const pqPath = join(edDir, 'personal-quests.json');
  if (!existsSync(pqPath)) return;

  const quests = readJson<Array<Record<string, unknown>>>(pqPath);
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO personal_quests
     (edition, card_id, name, requirements_json, unlock_character)
     VALUES (?, ?, ?, ?, ?)`,
  );

  for (const quest of quests) {
    stmt.run(
      edition,
      String(quest.cardId ?? ''),
      (quest.name as string) ?? null,
      jsonOrNull(quest.requirements),
      (quest.unlockCharacter as string) ?? null,
    );
    counters.personalQuests++;
  }
}

// ── Building Import (FH) ─────────────────────────────────────────────────────

function importBuildings(db: Database.Database, edition: string, edDir: string, counters: Counters): void {
  const buildPath = join(edDir, 'buildings.json');
  if (!existsSync(buildPath)) return;

  const buildings = readJson<Array<Record<string, unknown>>>(buildPath);
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO buildings (edition, building_id, name, costs_json, upgrades_json)
     VALUES (?, ?, ?, ?, ?)`,
  );

  for (const building of buildings) {
    stmt.run(
      edition,
      String(building.id ?? building.name ?? ''),
      (building.name as string) ?? null,
      jsonOrNull(building.costs),
      jsonOrNull(building.upgrades),
    );
    counters.buildings++;
  }
}

// ── Treasure Import ──────────────────────────────────────────────────────────

function importTreasures(db: Database.Database, edition: string, edDir: string, counters: Counters): void {
  const treasurePath = join(edDir, 'treasures.json');
  if (!existsSync(treasurePath)) return;

  const treasures = readJson<Array<string>>(treasurePath);
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO treasures (edition, treasure_index, reward) VALUES (?, ?, ?)`,
  );

  for (let i = 0; i < treasures.length; i++) {
    stmt.run(edition, i + 1, treasures[i]);
    counters.treasures++;
  }
}

// ── Campaign Data Import ─────────────────────────────────────────────────────

function importCampaignData(db: Database.Database, edition: string, edDir: string, counters: Counters): void {
  const campaignPath = join(edDir, 'campaign.json');
  if (!existsSync(campaignPath)) return;

  const campaign = readJson<Record<string, unknown>>(campaignPath);
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO campaign_data (edition, key, value_json) VALUES (?, ?, ?)`,
  );

  for (const [key, value] of Object.entries(campaign)) {
    stmt.run(edition, key, JSON.stringify(value));
    counters.campaignData++;
  }
}

// ── Asset Import ─────────────────────────────────────────────────────────────

function importGhsAssets(db: Database.Database, counters: Counters): void {
  if (!existsSync(GHS_IMAGES)) {
    console.log('  GHS images not found, skipping');
    return;
  }

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO asset_manifest (edition, category, name, source, path, variant) VALUES (?, ?, ?, ?, ?, ?)`,
  );

  // Character thumbnails: {edition}-{name}.png
  const thumbDir = join(GHS_IMAGES, 'character', 'thumbnail');
  if (existsSync(thumbDir)) {
    for (const file of readdirSync(thumbDir)) {
      const match = file.match(/^([^-]+)-(.+)\.(png|jpg|webp)$/);
      if (match) {
        stmt.run(match[1], 'character-portrait', match[2], 'ghs',
          `ghs-client/src/assets/images/character/thumbnail/${file}`, null);
        counters.assets++;
      }
    }
  }

  // Character icons: {edition}-{name}.svg
  const iconDir = join(GHS_IMAGES, 'character', 'icons');
  if (existsSync(iconDir)) {
    for (const file of readdirSync(iconDir)) {
      const match = file.match(/^([^-]+)-(.+)\.svg$/);
      if (match) {
        stmt.run(match[1], 'character-icon', match[2], 'ghs',
          `ghs-client/src/assets/images/character/icons/${file}`, null);
        counters.assets++;
      }
    }
  }

  // Monster thumbnails: {edition}-{name}.png
  const monThumbDir = join(GHS_IMAGES, 'monster', 'thumbnail');
  if (existsSync(monThumbDir)) {
    for (const file of readdirSync(monThumbDir)) {
      const match = file.match(/^([^-]+)-(.+)\.(png|jpg|webp)$/);
      if (match) {
        stmt.run(match[1], 'monster-portrait', match[2], 'ghs',
          `ghs-client/src/assets/images/monster/thumbnail/${file}`, null);
        counters.assets++;
      }
    }
  }

  // Action icons: {name}.svg
  const actionDir = join(GHS_IMAGES, 'action');
  if (existsSync(actionDir)) {
    for (const file of readdirSync(actionDir)) {
      if (file.endsWith('.svg')) {
        const name = file.replace('.svg', '');
        stmt.run('_shared', 'action-icon', name, 'ghs',
          `ghs-client/src/assets/images/action/${file}`, null);
        counters.assets++;
      }
    }
  }

  // Condition icons: {name}.svg
  const condDir = join(GHS_IMAGES, 'condition');
  if (existsSync(condDir)) {
    for (const file of readdirSync(condDir)) {
      if (file.endsWith('.svg') || file.endsWith('.png')) {
        const name = file.replace(/\.(svg|png)$/, '');
        stmt.run('_shared', 'condition-icon', name, 'ghs',
          `ghs-client/src/assets/images/condition/${file}`, null);
        counters.assets++;
      }
    }
  }

  // Element icons: {name}.svg
  const elemDir = join(GHS_IMAGES, 'element');
  if (existsSync(elemDir)) {
    for (const file of readdirSync(elemDir)) {
      if (file.endsWith('.svg') || file.endsWith('.png')) {
        const name = file.replace(/\.(svg|png)$/, '');
        stmt.run('_shared', 'element-icon', name, 'ghs',
          `ghs-client/src/assets/images/element/${file}`, null);
        counters.assets++;
      }
    }
  }

  // Summon images: {edition}-{name}.png
  const summonDir = join(GHS_IMAGES, 'summons');
  if (existsSync(summonDir)) {
    for (const file of readdirSync(summonDir)) {
      const match = file.match(/^([^-]+)-(.+)\.(png|jpg|webp|svg)$/);
      if (match) {
        stmt.run(match[1], 'summon', match[2], 'ghs',
          `ghs-client/src/assets/images/summons/${file}`, null);
        counters.assets++;
      }
    }
  }

  // Attack modifier images
  const amDir = join(GHS_IMAGES, 'attackmodifier');
  if (existsSync(amDir)) {
    for (const file of readdirSync(amDir)) {
      if (file.match(/\.(png|jpg|svg|webp)$/)) {
        const name = file.replace(/\.(png|jpg|svg|webp)$/, '');
        stmt.run('_shared', 'attack-modifier', name, 'ghs',
          `ghs-client/src/assets/images/attackmodifier/${file}`, null);
        counters.assets++;
      }
    }
  }

  // Logo images
  const logoDir = join(GHS_IMAGES, 'logos');
  if (existsSync(logoDir)) {
    for (const file of readdirSync(logoDir)) {
      if (file.match(/\.(png|jpg|svg|webp)$/)) {
        const name = file.replace(/\.(png|jpg|svg|webp)$/, '');
        stmt.run('_shared', 'logo', name, 'ghs',
          `ghs-client/src/assets/images/logos/${file}`, null);
        counters.assets++;
      }
    }
  }
}

function importWorldhavenAssets(db: Database.Database, counters: Counters): void {
  if (!existsSync(WORLDHAVEN_IMAGES)) {
    console.log('  Worldhaven images not found, skipping');
    return;
  }

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO asset_manifest (edition, category, name, source, path, variant) VALUES (?, ?, ?, ?, ?, ?)`,
  );

  // Category mappings: worldhaven dir -> (category, hasEditionSubdirs)
  const categories: Array<[string, string, boolean]> = [
    ['monster-stat-cards', 'monster-stat-card', true],
    ['monster-ability-cards', 'monster-ability-card', true],
    ['character-ability-cards', 'character-ability-card', true],
    ['character-mats', 'character-mat', true],
    ['character-perks', 'character-perk', true],
    ['items', 'item-card', true],
    ['events', 'event-card', true],
    ['battle-goals', 'battle-goal-card', true],
    ['personal-quests', 'personal-quest-card', true],
    ['map-tiles', 'map-tile', true],
    ['attack-modifiers', 'attack-modifier-card', true],
    ['art', 'artwork', true],
    ['tokens', 'token', true],
    ['loot-deck', 'loot-card', true],
    ['outpost-building-cards', 'building-card', true],
    ['books', 'book-page', true],
    ['charts', 'chart', true],
    ['random-dungeons', 'random-dungeon', true],
    ['random-scenarios', 'random-scenario', true],
    ['world-map', 'world-map', true],
    ['milestones', 'milestone', true],
    ['milestone-ability-cards', 'milestone-ability-card', true],
    ['trial-cards', 'trial-card', true],
    ['pet-cards', 'pet-card', true],
    ['challenge-cards', 'challenge-card', true],
    ['player-aid-cards', 'player-aid', true],
  ];

  for (const [dirName, category, hasEditionSubdirs] of categories) {
    const catDir = join(WORLDHAVEN_IMAGES, dirName);
    if (!existsSync(catDir)) continue;

    if (hasEditionSubdirs) {
      for (const editionDir of listDirs(catDir)) {
        const edition = WORLDHAVEN_EDITION_MAP[editionDir] || editionDir;
        const edPath = join(catDir, editionDir);

        // Walk all files recursively (some categories have sub-subdirectories)
        const files = listFilesRecursive(edPath);
        for (const file of files) {
          const ext = extname(file).toLowerCase();
          if (!['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) continue;

          const name = file.replace(/\.(png|jpg|jpeg|webp|svg)$/i, '').replace(/\//g, '/');
          stmt.run(edition, category, name, 'worldhaven',
            `worldhaven/images/${dirName}/${editionDir}/${file}`, null);
          counters.assets++;
        }
      }
    } else {
      const files = listFilesRecursive(catDir);
      for (const file of files) {
        const ext = extname(file).toLowerCase();
        if (!['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) continue;

        const name = file.replace(/\.(png|jpg|jpeg|webp|svg)$/i, '');
        stmt.run('_shared', category, name, 'worldhaven',
          `worldhaven/images/${dirName}/${file}`, null);
        counters.assets++;
      }
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('=== Gloomhaven Command Reference Data Import ===\n');

  if (!existsSync(GHS_DATA)) {
    console.error(`GHS data directory not found: ${GHS_DATA}`);
    console.error('Ensure .staging/ghs-client/data/ exists.');
    process.exit(1);
  }

  // Ensure data/ directory exists
  const dataDir = join(ROOT, 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Open database (will create if not exists)
  console.log(`Database: ${DB_PATH}`);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = OFF');  // Fast import, not needed for durability
  db.pragma('cache_size = -64000'); // 64MB cache

  console.log('Creating schema...\n');
  createSchema(db);

  const counters: Counters = {
    labels: 0, editions: 0, characters: 0, monsters: 0, monsterStats: 0,
    abilityDecks: 0, abilityCards: 0, scenarios: 0, rooms: 0, spawns: 0,
    sections: 0, items: 0, battleGoals: 0, events: 0, personalQuests: 0,
    buildings: 0, treasures: 0, campaignData: 0, assets: 0,
  };

  // Discover editions
  const editionDirs = listDirs(GHS_DATA)
    .filter(d => existsSync(join(GHS_DATA, d, 'base.json')));

  console.log(`Found ${editionDirs.length} editions: ${editionDirs.join(', ')}\n`);

  // Import all editions in a single transaction for speed
  const importAll = db.transaction(() => {
    for (const edition of editionDirs) {
      const isMajor = MAJOR_EDITIONS.includes(edition);
      const before = { ...counters };

      importEdition(db, edition, counters);

      if (isMajor) {
        console.log(`  ${edition}: ${counters.characters - before.characters} chars, ` +
          `${counters.monsters - before.monsters} monsters, ` +
          `${counters.abilityDecks - before.abilityDecks} decks, ` +
          `${counters.scenarios - before.scenarios} scenarios, ` +
          `${counters.sections - before.sections} sections, ` +
          `${counters.items - before.items} items, ` +
          `${counters.labels - before.labels} labels`);
      } else {
        console.log(`  ${edition}: imported`);
      }
    }

    // Import assets
    console.log('\nImporting GHS client assets...');
    importGhsAssets(db, counters);
    console.log(`  ${counters.assets} GHS assets`);

    const ghsAssetCount = counters.assets;
    console.log('Importing Worldhaven assets...');
    importWorldhavenAssets(db, counters);
    console.log(`  ${counters.assets - ghsAssetCount} Worldhaven assets`);
  });

  importAll();

  // Final stats
  console.log('\n=== Import Complete ===');
  console.log(`  Labels:          ${counters.labels}`);
  console.log(`  Editions:        ${counters.editions}`);
  console.log(`  Characters:      ${counters.characters}`);
  console.log(`  Monsters:        ${counters.monsters}`);
  console.log(`  Monster stats:   ${counters.monsterStats}`);
  console.log(`  Ability decks:   ${counters.abilityDecks}`);
  console.log(`  Ability cards:   ${counters.abilityCards}`);
  console.log(`  Scenarios:       ${counters.scenarios}`);
  console.log(`  Rooms:           ${counters.rooms}`);
  console.log(`  Spawns:          ${counters.spawns}`);
  console.log(`  Sections:        ${counters.sections}`);
  console.log(`  Items:           ${counters.items}`);
  console.log(`  Battle goals:    ${counters.battleGoals}`);
  console.log(`  Events:          ${counters.events}`);
  console.log(`  Personal quests: ${counters.personalQuests}`);
  console.log(`  Buildings:       ${counters.buildings}`);
  console.log(`  Treasures:       ${counters.treasures}`);
  console.log(`  Campaign data:   ${counters.campaignData}`);
  console.log(`  Assets:          ${counters.assets}`);

  const totalRows = Object.values(counters).reduce((a, b) => a + b, 0);
  console.log(`  ─────────────────────`);
  console.log(`  Total rows:      ${totalRows}`);

  // Database file size
  db.close();
  const dbSize = statSync(DB_PATH).size;
  console.log(`\n  Database size: ${(dbSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Path: ${DB_PATH}`);
}

main();
