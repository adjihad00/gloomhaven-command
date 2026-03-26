// DataManager — loads GHS edition files and provides typed lookup functions
import type { DataLoader } from './loader.js';
import type {
  EditionData,
  CharacterData,
  MonsterData,
  MonsterAbilityDeckData,
  ScenarioData,
  MonsterLevelStats,
  ResolvedSpawn,
} from './types.js';

function scenarioKeyOf(edition: string, index: string, group?: string): string {
  return group ? `${edition}:${group}:${index}` : `${edition}:${index}`;
}

export class DataManager {
  private loader: DataLoader;
  private loadedEditions: Set<string> = new Set();

  private editions: Map<string, EditionData> = new Map();
  private characters: Map<string, CharacterData> = new Map();          // "edition:name"
  private monsters: Map<string, MonsterData> = new Map();              // "edition:name"
  private monsterDecks: Map<string, MonsterAbilityDeckData> = new Map(); // "edition:deckName"
  private scenarios: Map<string, ScenarioData> = new Map();            // "edition:index"

  constructor(loader: DataLoader) {
    this.loader = loader;
  }

  // ── Edition loading ─────────────────────────────────────────────────────

  async loadEdition(edition: string): Promise<void> {
    if (this.loadedEditions.has(edition)) return;

    // 1. Load base.json
    const base = await this.loader.loadJson<EditionData>(`${edition}/base.json`);
    base.edition = edition;
    this.editions.set(edition, base);

    // 2. Load characters
    const charFiles = await this.loader.listFiles(`${edition}/character/`);
    for (const file of charFiles) {
      const data = await this.loader.loadJson<CharacterData>(`${edition}/character/${file}`);
      data.edition = edition;
      this.characters.set(`${edition}:${data.name}`, data);
    }

    // 3. Load monsters
    const monsterFiles = await this.loader.listFiles(`${edition}/monster/`);
    for (const file of monsterFiles) {
      const data = await this.loader.loadJson<MonsterData>(`${edition}/monster/${file}`);
      data.edition = edition;
      this.monsters.set(`${edition}:${data.name}`, data);
    }

    // 4. Load monster ability decks
    if (await this.loader.exists(`${edition}/monster/deck`)) {
      const deckFiles = await this.loader.listFiles(`${edition}/monster/deck/`);
      for (const file of deckFiles) {
        const data = await this.loader.loadJson<MonsterAbilityDeckData>(
          `${edition}/monster/deck/${file}`,
        );
        data.edition = edition;
        this.monsterDecks.set(`${edition}:${data.name}`, data);
      }
    }

    // 5. Load scenarios
    if (await this.loader.exists(`${edition}/scenarios`)) {
      const scenarioFiles = await this.loader.listFiles(`${edition}/scenarios/`);
      for (const file of scenarioFiles) {
        const data = await this.loader.loadJson<ScenarioData>(`${edition}/scenarios/${file}`);
        data.edition = edition;
        this.scenarios.set(scenarioKeyOf(edition, data.index, data.group), data);
      }
    }

    this.loadedEditions.add(edition);
  }

  getLoadedEditions(): string[] {
    return [...this.loadedEditions];
  }

  // ── Character lookups ─────────────────────────────────────────────────

  getCharacterList(edition?: string): CharacterData[] {
    const results: CharacterData[] = [];
    for (const [key, data] of this.characters) {
      if (!edition || key.startsWith(`${edition}:`)) {
        results.push(data);
      }
    }
    return results;
  }

  getCharacter(edition: string, name: string): CharacterData | null {
    return this.characters.get(`${edition}:${name}`) ?? null;
  }

  getCharacterMaxHealth(edition: string, name: string, level: number): number {
    const char = this.characters.get(`${edition}:${name}`);
    if (!char) return 0;
    const stat = char.stats.find((s) => s.level === level);
    return stat?.health ?? 0;
  }

  getCharacterHandSize(edition: string, name: string): number {
    const char = this.characters.get(`${edition}:${name}`);
    return char?.handSize ?? 0;
  }

  // ── Monster lookups ───────────────────────────────────────────────────

  getMonsterList(edition?: string): MonsterData[] {
    const results: MonsterData[] = [];
    for (const [key, data] of this.monsters) {
      if (!edition || key.startsWith(`${edition}:`)) {
        results.push(data);
      }
    }
    return results;
  }

  getMonster(edition: string, name: string): MonsterData | null {
    return this.monsters.get(`${edition}:${name}`) ?? null;
  }

  getMonsterStats(
    edition: string,
    name: string,
    level: number,
    type: string,
  ): MonsterLevelStats | null {
    const monster = this.monsters.get(`${edition}:${name}`);
    if (!monster) return null;

    // For boss monsters, stats don't have a type field (they're all boss)
    if (monster.boss) {
      return monster.stats.find((s) => s.level === level) ?? null;
    }

    // Normal/elite: type is undefined for normal in the data
    if (type === 'normal') {
      return monster.stats.find((s) => s.level === level && !s.type) ?? null;
    }
    return monster.stats.find((s) => s.level === level && s.type === type) ?? null;
  }

  getMonsterMaxHealth(
    edition: string,
    name: string,
    level: number,
    type: string,
  ): number {
    const stats = this.getMonsterStats(edition, name, level, type);
    if (!stats) return 0;
    // Boss health can be "8xC" — return 0 for formula-based, caller resolves
    if (typeof stats.health === 'string') return 0;
    return stats.health;
  }

  // ── Monster ability deck lookups ──────────────────────────────────────

  getMonsterDeck(edition: string, deckName: string): MonsterAbilityDeckData | null {
    return this.monsterDecks.get(`${edition}:${deckName}`) ?? null;
  }

  getMonsterDeckForMonster(edition: string, monsterName: string): MonsterAbilityDeckData | null {
    const monster = this.monsters.get(`${edition}:${monsterName}`);
    if (!monster) return null;
    const deckName = monster.deck || monsterName;
    return this.monsterDecks.get(`${edition}:${deckName}`) ?? null;
  }

  // ── Scenario lookups ──────────────────────────────────────────────────

  getScenarioList(edition?: string): ScenarioData[] {
    const results: ScenarioData[] = [];
    for (const [key, data] of this.scenarios) {
      if (!edition || key.startsWith(`${edition}:`)) {
        results.push(data);
      }
    }
    return results;
  }

  getScenario(edition: string, index: string, group?: string): ScenarioData | null {
    return this.scenarios.get(scenarioKeyOf(edition, index, group)) ?? null;
  }

  // ── Spawn resolution ──────────────────────────────────────────────────

  resolveRoomSpawns(
    scenario: ScenarioData,
    roomNumber: number,
    playerCount: number,
  ): ResolvedSpawn[] {
    const room = scenario.rooms.find((r) => r.roomNumber === roomNumber);
    if (!room) return [];

    const spawns: ResolvedSpawn[] = [];

    for (const spawn of room.monster) {
      // Always-spawn entries (have a `type` field)
      if (spawn.type) {
        spawns.push({ monsterName: spawn.name, type: spawn.type as ResolvedSpawn['type'] });
      }

      // Player-count-dependent spawns
      if (spawn.player2 && playerCount >= 2) {
        spawns.push({ monsterName: spawn.name, type: spawn.player2 as ResolvedSpawn['type'] });
      }
      if (spawn.player3 && playerCount >= 3) {
        spawns.push({ monsterName: spawn.name, type: spawn.player3 as ResolvedSpawn['type'] });
      }
      if (spawn.player4 && playerCount >= 4) {
        spawns.push({ monsterName: spawn.name, type: spawn.player4 as ResolvedSpawn['type'] });
      }
    }

    return spawns;
  }
}

// Barrel exports
export * from './types.js';
export * from './loader.js';
export * from './levelCalculation.js';
