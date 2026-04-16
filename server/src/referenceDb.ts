/**
 * ReferenceDB — immutable SQLite database for game reference data.
 * Populated by scripts/import-data.ts from .staging/ source files.
 * Never written during gameplay. Read-only queries only.
 */
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export class ReferenceDb {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath, { readonly: false });
    this.db.pragma('journal_mode = WAL');
  }

  /** Open in read-only mode (for server runtime) */
  static openReadonly(dbPath: string): ReferenceDb | null {
    if (!existsSync(dbPath)) return null;
    const instance = new ReferenceDb(dbPath);
    return instance;
  }

  /** Create all tables (used by import script) */
  createSchema(): void {
    this.db.exec(SCHEMA_SQL);
  }

  /** Drop and recreate all tables (used by import script) */
  resetSchema(): void {
    this.db.exec(DROP_SQL);
    this.db.exec(SCHEMA_SQL);
  }

  // ── Insert helpers (used by import script) ──────────────────────────────

  insertLabel(edition: string, key: string, value: string, locale = 'en'): void {
    this.stmtCache('insertLabel',
      `INSERT OR REPLACE INTO labels (edition, key, locale, value) VALUES (?, ?, ?, ?)`,
    ).run(edition, key, locale, value);
  }

  insertEdition(edition: string, name: string, conditionsJson: string): void {
    this.stmtCache('insertEdition',
      `INSERT OR REPLACE INTO editions (edition, name, conditions_json) VALUES (?, ?, ?)`,
    ).run(edition, name, conditionsJson);
  }

  insertCharacter(
    edition: string, name: string, displayName: string | null,
    color: string | null, handSize: number | null, spoiler: number,
    statsJson: string, perksJson: string | null,
  ): void {
    this.stmtCache('insertCharacter',
      `INSERT OR REPLACE INTO characters
       (edition, name, display_name, color, hand_size, spoiler, stats_json, perks_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(edition, name, displayName, color, handSize, spoiler, statsJson, perksJson);
  }

  insertMonster(
    edition: string, name: string, displayName: string | null,
    deckName: string | null, standeeCount: number | null,
    isBoss: number, isFlying: number,
  ): void {
    this.stmtCache('insertMonster',
      `INSERT OR REPLACE INTO monsters
       (edition, name, display_name, deck_name, standee_count, is_boss, is_flying)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(edition, name, displayName, deckName, standeeCount, isBoss, isFlying);
  }

  insertMonsterStats(
    edition: string, monsterName: string, level: number, type: string,
    health: string, movement: number, attack: number, rangeVal: number | null,
    actionsJson: string | null, immunitiesJson: string | null,
  ): void {
    this.stmtCache('insertMonsterStats',
      `INSERT OR REPLACE INTO monster_stats
       (edition, monster_name, level, type, health, movement, attack, range_val, actions_json, immunities_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(edition, monsterName, level, type, health, movement, attack, rangeVal, actionsJson, immunitiesJson);
  }

  insertMonsterAbilityDeck(edition: string, deckName: string): void {
    this.stmtCache('insertDeck',
      `INSERT OR REPLACE INTO monster_ability_decks (edition, deck_name) VALUES (?, ?)`,
    ).run(edition, deckName);
  }

  insertMonsterAbilityCard(
    edition: string, deckName: string, cardId: number,
    name: string | null, initiative: number, shuffle: number, actionsJson: string,
  ): void {
    this.stmtCache('insertCard',
      `INSERT OR REPLACE INTO monster_ability_cards
       (edition, deck_name, card_id, name, initiative, shuffle, actions_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(edition, deckName, cardId, name, initiative, shuffle, actionsJson);
  }

  insertScenario(
    edition: string, scenarioIndex: string, groupName: string, name: string,
    complexity: number | null, isInitial: number,
    unlocksJson: string | null, linksJson: string | null,
    blocksJson: string | null, requiresJson: string | null,
    requirementsJson: string | null, rewardsJson: string | null,
    monstersJson: string | null, alliesJson: string | null,
    objectivesJson: string | null, lootDeckConfigJson: string | null,
    rulesJson: string | null, sectionsJson: string | null,
  ): void {
    this.stmtCache('insertScenario',
      `INSERT OR REPLACE INTO scenarios
       (edition, scenario_index, group_name, name, complexity, is_initial,
        unlocks_json, links_json, blocks_json, requires_json, requirements_json,
        rewards_json, monsters_json, allies_json, objectives_json,
        loot_deck_config_json, rules_json, sections_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      edition, scenarioIndex, groupName, name, complexity, isInitial,
      unlocksJson, linksJson, blocksJson, requiresJson, requirementsJson,
      rewardsJson, monstersJson, alliesJson, objectivesJson,
      lootDeckConfigJson, rulesJson, sectionsJson,
    );
  }

  insertScenarioRoom(
    edition: string, scenarioIndex: string, groupName: string,
    roomNumber: number, ref: string, isInitial: number,
    connectedRoomsJson: string | null, marker: string | null,
    treasuresJson: string | null, objectivesJson: string | null,
  ): void {
    this.stmtCache('insertRoom',
      `INSERT OR REPLACE INTO scenario_rooms
       (edition, scenario_index, group_name, room_number, ref, is_initial,
        connected_rooms_json, marker, treasures_json, objectives_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(edition, scenarioIndex, groupName, roomNumber, ref, isInitial,
      connectedRoomsJson, marker, treasuresJson, objectivesJson);
  }

  insertScenarioSpawn(
    edition: string, scenarioIndex: string, groupName: string,
    roomNumber: number, spawnIndex: number, monsterName: string,
    alwaysType: string | null, player2Type: string | null,
    player3Type: string | null, player4Type: string | null,
    marker: string | null,
  ): void {
    this.stmtCache('insertSpawn',
      `INSERT OR REPLACE INTO scenario_spawns
       (edition, scenario_index, group_name, room_number, spawn_index,
        monster_name, always_type, player2_type, player3_type, player4_type, marker)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(edition, scenarioIndex, groupName, roomNumber, spawnIndex,
      monsterName, alwaysType, player2Type, player3Type, player4Type, marker);
  }

  insertSection(
    edition: string, sectionId: string, parentScenario: string | null,
    name: string | null, conclusion: number,
    monstersJson: string | null, roomsJson: string | null,
    rewardsJson: string | null, rulesJson: string | null,
  ): void {
    this.stmtCache('insertSection',
      `INSERT OR REPLACE INTO sections
       (edition, section_id, parent_scenario, name, conclusion,
        monsters_json, rooms_json, rewards_json, rules_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(edition, sectionId, parentScenario, name, conclusion,
      monstersJson, roomsJson, rewardsJson, rulesJson);
  }

  insertItem(
    edition: string, itemId: number, name: string | null, cost: number | null,
    slot: string | null, count: number | null, spent: number, consumed: number,
    actionsJson: string | null, resourcesJson: string | null,
    unlockProsperity: number | null, requiredBuilding: string | null,
    requiredBuildingLevel: number | null,
  ): void {
    this.stmtCache('insertItem',
      `INSERT OR REPLACE INTO items
       (edition, item_id, name, cost, slot, count, spent, consumed,
        actions_json, resources_json, unlock_prosperity,
        required_building, required_building_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(edition, itemId, name, cost, slot, count, spent, consumed,
      actionsJson, resourcesJson, unlockProsperity, requiredBuilding, requiredBuildingLevel);
  }

  insertBattleGoal(edition: string, cardId: string, name: string | null, checks: number | null): void {
    this.stmtCache('insertBattleGoal',
      `INSERT OR REPLACE INTO battle_goals (edition, card_id, name, checks) VALUES (?, ?, ?, ?)`,
    ).run(edition, cardId, name, checks);
  }

  insertEvent(
    edition: string, eventType: string, eventId: string,
    narrative: string | null, optionsJson: string | null,
  ): void {
    this.stmtCache('insertEvent',
      `INSERT OR REPLACE INTO events (edition, event_type, event_id, narrative, options_json)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(edition, eventType, eventId, narrative, optionsJson);
  }

  insertPersonalQuest(
    edition: string, cardId: string, name: string | null,
    requirementsJson: string | null, unlockCharacter: string | null,
  ): void {
    this.stmtCache('insertPersonalQuest',
      `INSERT OR REPLACE INTO personal_quests
       (edition, card_id, name, requirements_json, unlock_character)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(edition, cardId, name, requirementsJson, unlockCharacter);
  }

  insertBuilding(
    edition: string, buildingId: string, name: string | null,
    costsJson: string | null, upgradesJson: string | null,
  ): void {
    this.stmtCache('insertBuilding',
      `INSERT OR REPLACE INTO buildings (edition, building_id, name, costs_json, upgrades_json)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(edition, buildingId, name, costsJson, upgradesJson);
  }

  insertTreasure(edition: string, treasureIndex: number, reward: string): void {
    this.stmtCache('insertTreasure',
      `INSERT OR REPLACE INTO treasures (edition, treasure_index, reward) VALUES (?, ?, ?)`,
    ).run(edition, treasureIndex, reward);
  }

  insertCampaignData(edition: string, key: string, valueJson: string): void {
    this.stmtCache('insertCampaignData',
      `INSERT OR REPLACE INTO campaign_data (edition, key, value_json) VALUES (?, ?, ?)`,
    ).run(edition, key, valueJson);
  }

  insertAsset(
    edition: string, category: string, name: string,
    source: string, path: string, variant: string | null,
  ): void {
    this.stmtCache('insertAsset',
      `INSERT OR REPLACE INTO asset_manifest
       (edition, category, name, source, path, variant)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(edition, category, name, source, path, variant);
  }

  // ── Query helpers (used by server API) ────────────────────────────────

  getLabel(edition: string, key: string, locale = 'en'): string | null {
    const row = this.stmtCache('getLabel',
      `SELECT value FROM labels WHERE edition = ? AND key = ? AND locale = ?`,
    ).get(edition, key, locale) as { value: string } | undefined;
    return row?.value ?? null;
  }

  getLabelsPrefix(edition: string, prefix: string, locale = 'en'): Record<string, string> {
    const rows = this.stmtCache('getLabelsPrefix',
      `SELECT key, value FROM labels WHERE edition = ? AND key LIKE ? AND locale = ?`,
    ).all(edition, prefix + '%', locale) as Array<{ key: string; value: string }>;
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  }

  getScenarioText(edition: string, scenarioIndex: string): {
    name: string | null;
    rules: unknown[] | null;
    rulesLabels: Record<string, string>;
  } {
    const scenario = this.stmtCache('getScenarioByIndex',
      `SELECT name, rules_json FROM scenarios WHERE edition = ? AND scenario_index = ?`,
    ).get(edition, scenarioIndex) as { name: string; rules_json: string | null } | undefined;

    if (!scenario) return { name: null, rules: null, rulesLabels: {} };

    const rulesLabels = this.getLabelsPrefix(edition, `scenario.rules.${edition}.${scenarioIndex}`);

    return {
      name: scenario.name,
      rules: scenario.rules_json ? JSON.parse(scenario.rules_json) : null,
      rulesLabels,
    };
  }

  getMonsterAbilityCards(edition: string, deckName: string): Array<{
    card_id: number;
    name: string | null;
    initiative: number;
    shuffle: number;
    actions_json: string;
  }> {
    return this.stmtCache('getAbilityCards',
      `SELECT card_id, name, initiative, shuffle, actions_json
       FROM monster_ability_cards WHERE edition = ? AND deck_name = ?
       ORDER BY card_id`,
    ).all(edition, deckName) as Array<{
      card_id: number;
      name: string | null;
      initiative: number;
      shuffle: number;
      actions_json: string;
    }>;
  }

  getSectionData(edition: string, sectionId: string): {
    section_id: string;
    parent_scenario: string | null;
    name: string | null;
    conclusion: number;
    monsters_json: string | null;
    rooms_json: string | null;
    rewards_json: string | null;
    rules_json: string | null;
  } | null {
    return this.stmtCache('getSection',
      `SELECT * FROM sections WHERE edition = ? AND section_id = ?`,
    ).get(edition, sectionId) as {
      section_id: string;
      parent_scenario: string | null;
      name: string | null;
      conclusion: number;
      monsters_json: string | null;
      rooms_json: string | null;
      rewards_json: string | null;
      rules_json: string | null;
    } | null;
  }

  getAssets(edition: string, category: string): Array<{
    name: string;
    source: string;
    path: string;
    variant: string | null;
  }> {
    return this.stmtCache('getAssets',
      `SELECT name, source, path, variant FROM asset_manifest
       WHERE edition = ? AND category = ? ORDER BY name`,
    ).all(edition, category) as Array<{
      name: string;
      source: string;
      path: string;
      variant: string | null;
    }>;
  }

  getAsset(edition: string, category: string, name: string): Array<{
    source: string;
    path: string;
    variant: string | null;
  }> {
    return this.stmtCache('getAsset',
      `SELECT source, path, variant FROM asset_manifest
       WHERE edition = ? AND category = ? AND name = ?`,
    ).all(edition, category, name) as Array<{
      source: string;
      path: string;
      variant: string | null;
    }>;
  }

  getItems(edition: string): Array<{
    item_id: number;
    name: string | null;
    cost: number | null;
    slot: string | null;
    count: number | null;
    actions_json: string | null;
    resources_json: string | null;
    unlock_prosperity: number | null;
  }> {
    return this.stmtCache('getItems',
      `SELECT item_id, name, cost, slot, count, actions_json, resources_json, unlock_prosperity
       FROM items WHERE edition = ? ORDER BY item_id`,
    ).all(edition) as Array<{
      item_id: number;
      name: string | null;
      cost: number | null;
      slot: string | null;
      count: number | null;
      actions_json: string | null;
      resources_json: string | null;
      unlock_prosperity: number | null;
    }>;
  }

  /** Transaction wrapper for batch inserts */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
  }

  // ── Prepared statement cache ──────────────────────────────────────────

  private stmts = new Map<string, Database.Statement>();

  private stmtCache(name: string, sql: string): Database.Statement {
    let stmt = this.stmts.get(name);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.stmts.set(name, stmt);
    }
    return stmt;
  }
}

// ── Schema DDL ────────────────────────────────────────────────────────────────

const DROP_SQL = `
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
`;

const SCHEMA_SQL = `
-- ═══════════════════════════════════════════════════════════════════
-- CORE TABLES
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS labels (
  edition TEXT NOT NULL,
  key TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  value TEXT NOT NULL,
  PRIMARY KEY (edition, key, locale)
);

CREATE TABLE IF NOT EXISTS monster_ability_decks (
  edition TEXT NOT NULL,
  deck_name TEXT NOT NULL,
  PRIMARY KEY (edition, deck_name)
);

CREATE TABLE IF NOT EXISTS monster_ability_cards (
  edition TEXT NOT NULL,
  deck_name TEXT NOT NULL,
  card_id INTEGER NOT NULL,
  name TEXT,
  initiative INTEGER NOT NULL,
  shuffle INTEGER NOT NULL DEFAULT 0,
  actions_json TEXT NOT NULL,
  PRIMARY KEY (edition, deck_name, card_id)
);

-- ═══════════════════════════════════════════════════════════════════
-- SCENARIO TABLES
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scenarios (
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

CREATE TABLE IF NOT EXISTS scenario_rooms (
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

CREATE TABLE IF NOT EXISTS scenario_spawns (
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

CREATE TABLE IF NOT EXISTS sections (
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

-- ═══════════════════════════════════════════════════════════════════
-- REFERENCE TABLES
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS editions (
  edition TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  conditions_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
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

CREATE TABLE IF NOT EXISTS monsters (
  edition TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT,
  deck_name TEXT,
  standee_count INTEGER,
  is_boss INTEGER DEFAULT 0,
  is_flying INTEGER DEFAULT 0,
  PRIMARY KEY (edition, name)
);

CREATE TABLE IF NOT EXISTS monster_stats (
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

-- ═══════════════════════════════════════════════════════════════════
-- CAMPAIGN TABLES
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS items (
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

CREATE TABLE IF NOT EXISTS battle_goals (
  edition TEXT NOT NULL,
  card_id TEXT NOT NULL,
  name TEXT,
  checks INTEGER,
  PRIMARY KEY (edition, card_id)
);

CREATE TABLE IF NOT EXISTS events (
  edition TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  narrative TEXT,
  options_json TEXT,
  PRIMARY KEY (edition, event_type, event_id)
);

CREATE TABLE IF NOT EXISTS personal_quests (
  edition TEXT NOT NULL,
  card_id TEXT NOT NULL,
  name TEXT,
  requirements_json TEXT,
  unlock_character TEXT,
  PRIMARY KEY (edition, card_id)
);

CREATE TABLE IF NOT EXISTS buildings (
  edition TEXT NOT NULL,
  building_id TEXT NOT NULL,
  name TEXT,
  costs_json TEXT,
  upgrades_json TEXT,
  PRIMARY KEY (edition, building_id)
);

CREATE TABLE IF NOT EXISTS campaign_data (
  edition TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  PRIMARY KEY (edition, key)
);

CREATE TABLE IF NOT EXISTS treasures (
  edition TEXT NOT NULL,
  treasure_index INTEGER NOT NULL,
  reward TEXT NOT NULL,
  PRIMARY KEY (edition, treasure_index)
);

-- ═══════════════════════════════════════════════════════════════════
-- ASSET MANIFEST
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS asset_manifest (
  edition TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  path TEXT NOT NULL,
  variant TEXT
);

-- ═══════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_labels_lookup ON labels(edition, key);
CREATE INDEX IF NOT EXISTS idx_ability_cards_deck ON monster_ability_cards(edition, deck_name);
CREATE INDEX IF NOT EXISTS idx_scenario_rooms ON scenario_rooms(edition, scenario_index);
CREATE INDEX IF NOT EXISTS idx_spawns_room ON scenario_spawns(edition, scenario_index, room_number);
CREATE INDEX IF NOT EXISTS idx_monster_stats ON monster_stats(edition, monster_name, level);
CREATE INDEX IF NOT EXISTS idx_sections_parent ON sections(edition, parent_scenario);
CREATE INDEX IF NOT EXISTS idx_items_edition ON items(edition);
CREATE INDEX IF NOT EXISTS idx_assets_category ON asset_manifest(edition, category);
CREATE INDEX IF NOT EXISTS idx_assets_source ON asset_manifest(source, category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_unique ON asset_manifest(edition, category, name, source, COALESCE(variant, ''));
`;
