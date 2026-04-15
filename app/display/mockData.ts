// Mock data for display client prototyping — design exploration
// Realistic game state for visual design exploration

import type {
  GameState, Character, Monster, MonsterEntity,
  ElementModel, EntityCondition, ScenarioModel,
  AttackModifierDeckModel, Party, LootDeck,
} from '@gloomhaven-command/shared';

// ── Helpers ──────────────────────────────────────────────────────────────────

function cond(name: string, state: string = 'normal'): EntityCondition {
  return {
    name: name as any,
    value: 1,
    state: state as any,
    lastState: 'new' as any,
    permanent: false,
    expired: false,
    highlight: false,
  };
}

function standee(num: number, type: 'normal' | 'elite', hp: number, maxHp: number, conditions: EntityCondition[] = []): MonsterEntity {
  return {
    number: num,
    marker: '',
    type,
    dead: hp <= 0,
    summon: 'false' as any,
    active: false,
    off: false,
    revealed: true,
    dormant: false,
    health: hp,
    maxHealth: maxHp,
    entityConditions: conditions,
    immunities: [],
    markers: [],
    tags: [],
    shield: '',
    shieldPersistent: '',
    retaliate: [],
    retaliatePersistent: [],
  };
}

const emptyAMD: AttackModifierDeckModel = {
  current: 0, cards: [], discarded: [], active: false,
  lastVisible: -1, bb: false,
};

const emptyProgress = {
  experience: 0, gold: 0, loot: {}, itemNotes: '', items: [], equippedItems: [],
  personalQuest: '', personalQuestProgress: [], battleGoals: 0, notes: '',
  retired: false, retirements: 0, extraPerks: 0, perks: [], masteries: [],
  donations: 0, scenarioStats: [], deck: [], enhancements: [],
};

const emptyScenarioStats = {
  success: false, level: 0, gold: 0, xp: 0, treasures: 0,
  summons: {
    dealtDamage: 0, monsterDamage: 0, otherDamage: 0, healedDamage: 0, heals: 0,
    normalKills: 0, eliteKills: 0, bossKills: 0, exhausts: 0, maxDealtDamage: 0, maxDamage: 0,
  },
  dealtDamage: 0, monsterDamage: 0, otherDamage: 0, healedDamage: 0, heals: 0,
  normalKills: 0, eliteKills: 0, bossKills: 0, exhausts: 0, maxDealtDamage: 0, maxDamage: 0,
};

function charBase(overrides: Partial<Character> & { name: string; edition: string }): Character {
  return {
    marker: false, title: '', initiative: 0, experience: 0, loot: 0, lootCards: [],
    treasures: [], exhausted: false, level: 1, off: false, active: false,
    health: 10, maxHealth: 10, entityConditions: [], immunities: [], markers: [],
    tags: [], identity: 0, summons: [], progress: { ...emptyProgress },
    scenarioStats: { ...emptyScenarioStats }, number: 0,
    attackModifierDeck: { ...emptyAMD }, donations: 0, token: 0, tokenValues: [],
    absent: false, longRest: false, battleGoals: [], battleGoal: false,
    shield: '', shieldPersistent: '', retaliate: [], retaliatePersistent: [],
    ...overrides,
  };
}

// ── Characters ───────────────────────────────────────────────────────────────

export const mockCharacters: Character[] = [
  charBase({
    name: 'blinkblade', edition: 'fh', level: 3, initiative: 15,
    health: 10, maxHealth: 10, experience: 4, loot: 2,
    active: false, off: false,
    entityConditions: [cond('strengthen')],
  }),
  charBase({
    name: 'drifter', edition: 'fh', level: 5, initiative: 22,
    health: 8, maxHealth: 12, experience: 7, loot: 3,
    active: true, off: false,
    entityConditions: [cond('wound'), cond('poison')],
  }),
  charBase({
    name: 'banner-spear', edition: 'fh', level: 4, initiative: 0,
    health: 0, maxHealth: 10, experience: 2, loot: 1,
    exhausted: true, off: true, active: false,
  }),
  charBase({
    name: 'boneshaper', edition: 'fh', level: 4, initiative: 45,
    health: 6, maxHealth: 10, experience: 5, loot: 1,
    active: false, off: true,
    entityConditions: [cond('regenerate')],
  }),
];

// ── Monsters ─────────────────────────────────────────────────────────────────

export const mockMonsters: Monster[] = [
  {
    name: 'snow-imp', edition: 'fh', level: 2, initiative: 11,
    off: true, active: false, drawExtra: false, lastDraw: -1,
    ability: 0, abilities: [0, 1, 2, 3, 4, 5, 6, 7],
    isAlly: false, isAllied: false, tags: [],
    entities: [
      standee(1, 'normal', 3, 3),
      standee(2, 'normal', 1, 3, [cond('wound')]),
    ],
  },
  {
    name: 'algox-guard', edition: 'fh', level: 2, initiative: 34,
    off: false, active: true, drawExtra: false, lastDraw: -1,
    ability: 0, abilities: [0, 1, 2, 3, 4, 5, 6, 7],
    isAlly: false, isAllied: false, tags: [],
    entities: [
      standee(1, 'elite', 10, 12, [cond('stun')]),
      standee(2, 'normal', 7, 7),
      standee(3, 'normal', 5, 7),
      standee(4, 'normal', 0, 7), // dead
    ],
  },
  {
    name: 'ice-wraith', edition: 'fh', level: 2, initiative: 52,
    off: false, active: false, drawExtra: false, lastDraw: -1,
    ability: 0, abilities: [0, 1, 2, 3, 4, 5, 6, 7],
    isAlly: false, isAllied: false, tags: [],
    entities: [
      standee(1, 'elite', 8, 9),
      standee(2, 'normal', 5, 5),
      standee(3, 'normal', 5, 5),
    ],
  },
];

// ── Mock monster ability data (display-level, not engine types) ──────────────

export interface MockAbilityAction {
  type: string;   // 'move' | 'attack' | 'range' | 'shield' | 'heal' | 'special'
  value: number;
}

export interface MockMonsterAbility {
  monsterName: string;
  name?: string;
  initiative: number;
  actions: MockAbilityAction[];
  shuffle: boolean;
}

// ── Monster base stats (for totalized ability card values) ──────────────────

export interface MockMonsterBaseStats {
  normal: { health: number; move: number; attack: number; range?: number; shield?: number };
  elite: { health: number; move: number; attack: number; range?: number; shield?: number };
}

export const mockMonsterStats: Record<string, MockMonsterBaseStats> = {
  'snow-imp': {
    normal: { health: 3, move: 3, attack: 1, range: 3 },
    elite:  { health: 5, move: 3, attack: 2, range: 4 },
  },
  'algox-guard': {
    normal: { health: 7, move: 2, attack: 2 },
    elite:  { health: 12, move: 2, attack: 3, shield: 1 },
  },
  'ice-wraith': {
    normal: { health: 5, move: 3, attack: 2, range: 3 },
    elite:  { health: 9, move: 3, attack: 3, range: 4 },
  },
};

// ── Monster innate abilities (icons shown under name) ───────────────────────

export interface MockInnateAbility {
  type: string;   // 'fly', 'shield', 'retaliate', 'range', etc.
  value?: number;
}

export const mockMonsterInnates: Record<string, MockInnateAbility[]> = {
  'snow-imp': [
    { type: 'range', value: 3 },
  ],
  'algox-guard': [
    { type: 'shield', value: 1 },
  ],
  'ice-wraith': [
    { type: 'fly' },
    { type: 'range', value: 3 },
  ],
};

export const mockAbilities: Record<string, MockMonsterAbility> = {
  'snow-imp': {
    monsterName: 'snow-imp',
    name: 'Frost Bolts',
    initiative: 11,
    actions: [
      { type: 'move', value: 1 },
      { type: 'attack', value: 1 },
      { type: 'range', value: 3 },
    ],
    shuffle: false,
  },
  'algox-guard': {
    monsterName: 'algox-guard',
    name: 'Shield Wall',
    initiative: 34,
    actions: [
      { type: 'move', value: 1 },
      { type: 'attack', value: 2 },
      { type: 'shield', value: 1 },
    ],
    shuffle: false,
  },
  'ice-wraith': {
    monsterName: 'ice-wraith',
    name: 'Frozen Grasp',
    initiative: 52,
    actions: [
      { type: 'move', value: 2 },
      { type: 'attack', value: 3 },
      { type: 'range', value: 2 },
    ],
    shuffle: true,
  },
};

// ── Elements ─────────────────────────────────────────────────────────────────

export const mockElements: ElementModel[] = [
  { type: 'fire', state: 'strong' },
  { type: 'ice', state: 'waning' },
  { type: 'air', state: 'inert' },
  { type: 'earth', state: 'inert' },
  { type: 'light', state: 'inert' },
  { type: 'dark', state: 'inert' },
];

// ── Figures order (initiative sorted) ────────────────────────────────────────

// Sorted by initiative: Snow Imp 11, Blinkblade 15, Drifter 22 (active),
// Algox Guard 34 (active monster), Boneshaper 45 (done)
// Banner Spear is exhausted, not in order

export const mockFigures: string[] = [
  'fh-snow-imp',
  'fh-blinkblade',
  'fh-drifter',
  'fh-algox-guard',
  'fh-boneshaper',
  'fh-ice-wraith',
];

// ── Scenario ─────────────────────────────────────────────────────────────────

export const mockScenario: ScenarioModel = {
  index: '12',
  edition: 'fh',
  isCustom: false,
  custom: '',
  revealedRooms: [1, 2],
};

// ── Scenario rules (mock text for prototype) ────────────────────────────────

export const mockScenarioRules = {
  specialRules: 'All living Algox Guards have Shield 1. Doors are locked until all revealed enemies are dead.',
  winConditions: 'Kill all revealed enemies in all rooms.',
  lossConditions: 'All characters exhausted.',
};

// ── Full mock state ──────────────────────────────────────────────────────────

export const mockState: Partial<GameState> = {
  gameCode: 'PROTO',
  revision: 42,
  revisionOffset: 0,
  edition: 'fh',
  mode: 'scenario',
  state: 'next', // play phase
  round: 3,
  level: 2,
  levelCalculation: true,
  levelAdjustment: 0,
  bonusAdjustment: 0,
  ge5Player: false,
  playerCount: 3,
  solo: false,
  figures: mockFigures,
  characters: mockCharacters,
  monsters: mockMonsters,
  objectiveContainers: [],
  elementBoard: mockElements,
  scenario: mockScenario,
  conditions: [],
  battleGoalEditions: [],
  filteredBattleGoals: [],
  entitiesCounter: [],
  sections: [],
  scenarioRules: [],
  appliedScenarioRules: [],
  discardedScenarioRules: [],
  roundResets: [],
  roundResetsHidden: [],
  playSeconds: 0,
  totalSeconds: 0,
  monsterAttackModifierDeck: { ...emptyAMD },
  allyAttackModifierDeck: { ...emptyAMD },
  lootDeck: { current: 0, cards: [], active: false },
  lootDeckEnhancements: [],
  lootDeckFixed: [],
  lootDeckSections: [],
  unlockedCharacters: [],
  undoStack: [],
  server: false,
  gameClock: [],
  challengeDeck: { current: 0, finished: 0, keep: [], cards: [], active: false },
  favors: [],
  favorPoints: [],
  keepFavors: false,
  party: {
    id: 1, name: 'The Frozen Few', edition: 'fh',
    conditions: [], battleGoalEditions: [], filteredBattleGoals: [],
    location: '', notes: '', achievements: '', achievementsList: [],
    reputation: 3, prosperity: 2, scenarios: [], conclusions: [],
    casualScenarios: [], manualScenarios: [], campaignMode: true,
    globalAchievements: '', globalAchievementsList: [],
    treasures: [], donations: 0, players: [], characters: [],
    availableCharacters: [], retirements: [], unlockedItems: [],
    unlockedCharacters: [], level: 2, levelCalculation: true,
    levelAdjustment: 0, bonusAdjustment: 0, ge5Player: false,
    playerCount: 3, solo: false, envelopeB: false, eventCards: [],
    weeks: 5, weekSections: {}, loot: {}, randomItemLooted: [],
    inspiration: 0, defense: 2, soldiers: 3, morale: 4,
    townGuardPerks: 0, townGuardPerkSections: [], campaignStickers: [],
    buildings: [], pets: [], lootDeckEnhancements: [],
    lootDeckFixed: [], lootDeckSections: [], trials: 0,
    factionReputation: {}, imbuement: 0,
  },
};
