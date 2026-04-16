// GHS edition data file type definitions
// Based on actual JSON structures in .staging/ghs-client/data/

// ── Edition metadata (base.json) ────────────────────────────────────────────

export interface EditionData {
  edition: string;
  conditions: string[];
  worldMap?: { width: number; height: number };
  logoUrl?: string;
}

// ── Character data ──────────────────────────────────────────────────────────

export interface CharacterData {
  name: string;
  edition: string;
  characterClass?: string;
  gender?: string;
  handSize: number;
  retireEvent?: string;
  color: string;
  stats: CharacterLevelStats[];
  perks: PerkDefinition[];
}

export interface CharacterLevelStats {
  level: number;
  health: number;
}

export interface PerkDefinition {
  type: string;         // "remove", "replace", "add"
  count: number;
  custom?: string;
  cards: PerkCard[];
}

export interface PerkCard {
  count: number;
  attackModifier: {
    type: string;       // "minus1", "plus1", "plus0", "plus3", etc.
    rolling?: boolean;
    effects?: PerkEffect[];
  };
}

export interface PerkEffect {
  type: string;         // "push", "pierce", "condition", "target", "shield", "specialTarget"
  value: string | number;
  effects?: PerkEffect[];
}

// ── Monster data ────────────────────────────────────────────────────────────

export interface MonsterData {
  name: string;
  edition: string;
  deck?: string;          // shared ability deck name (defaults to monster name)
  count: number;          // max standees
  boss?: boolean;
  flying?: boolean;
  baseStat?: MonsterBaseStat;
  stats: MonsterLevelStats[];
}

export interface MonsterBaseStat {
  type: string;           // "normal", "boss"
  immunities?: string[];
  special?: unknown[][];  // boss special actions
}

export interface MonsterLevelStats {
  level: number;
  type?: string;          // "elite", "boss" — undefined = normal
  health: number | string; // number for normal/elite, "8xC" for boss
  movement: number;
  attack: number;
  range?: number;
  actions?: MonsterStatAction[];
  immunities?: string[];
}

export interface MonsterStatAction {
  type: string;           // "shield", "retaliate", "condition", "heal", etc.
  value: string | number;
  subActions?: MonsterStatAction[];
}

// ── Monster ability deck ────────────────────────────────────────────────────

export interface MonsterAbilityDeckData {
  name: string;
  edition: string;
  abilities: MonsterAbilityCard[];
}

export interface MonsterAbilityCard {
  cardId: number;
  initiative: number;
  shuffle?: boolean;
  actions: MonsterAbilityAction[];
}

export interface MonsterAbilityAction {
  type: string;           // "move", "attack", "shield", "retaliate", "condition", "element", "elementHalf", "summon", etc.
  value: string | number;
  valueType?: string;     // "plus" = add to base stat; "minus" = subtract; absent = absolute
  small?: boolean;
  subActions?: MonsterAbilityAction[];
  valueObject?: MonsterSummonValue[];  // Used by "summon" actions
}

export interface MonsterSummonValue {
  monster?: {
    name: string;
    type?: string;    // "normal", "elite", "boss"
    health?: string | number;
  };
}

// ── Scenario data ───────────────────────────────────────────────────────────

export interface ScenarioData {
  index: string;
  name: string;
  edition: string;
  group?: string;         // "solo", etc. — scenarios in the same edition can share indices across groups
  flowChartGroup?: string;
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
    gridLocation?: string;
  };
  complexity?: number;    // FH
  eventType?: string;     // "road", etc.
  initial?: boolean;
  recaps?: unknown[];     // FH
  unlocks?: string[];
  links?: string[];
  rewards?: Record<string, unknown>;
  monsters?: string[];
  allies?: string[];      // FH
  rooms: ScenarioRoom[];
  lootDeckConfig?: Record<string, number>;  // FH
  rules?: unknown[];      // FH
  sections?: unknown[];   // FH
}

export interface ScenarioRoom {
  roomNumber: number;
  ref: string;
  initial?: boolean;
  rooms?: number[];       // connected room numbers
  marker?: string;
  treasures?: number[];
  monster: ScenarioMonsterSpawn[];
}

export interface ScenarioMonsterSpawn {
  name: string;
  type?: string;          // always-spawn type: "normal", "elite", "boss"
  player2?: string;       // spawn type at 2+ players
  player3?: string;       // spawn type at 3+ players
  player4?: string;       // spawn type at 4 players
  marker?: string;
}

// ── Resolved spawn result ───────────────────────────────────────────────────

export interface ResolvedSpawn {
  monsterName: string;
  type: 'normal' | 'elite' | 'boss';
}
