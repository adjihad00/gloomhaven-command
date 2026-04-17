// Game state types — derived from GHS TypeScript source and real SQLite dump

// ── Enums as string literal unions ──────────────────────────────────────────

/** GHS has only two phases: "draw" (card selection) and "next" (playing turns) */
export type GamePhase = 'draw' | 'next';

export type ConditionName =
  | 'stun' | 'immobilize' | 'disarm' | 'wound' | 'muddle'
  | 'poison' | 'strengthen' | 'invisible' | 'curse' | 'bless'
  | 'regenerate' | 'ward' | 'bane' | 'brittle' | 'impair'
  | 'chill' | 'infect' | 'rupture' | 'dodge' | 'empower'
  | 'enfeeble' | 'poison_x' | 'wound_x' | 'heal' | 'shield'
  | 'retaliate' | 'safeguard' | 'plague' | 'invalid';

export type EntityConditionState =
  | 'new' | 'normal' | 'expire' | 'roundExpire' | 'removed' | 'turn';

export type ElementType = 'fire' | 'ice' | 'air' | 'earth' | 'light' | 'dark';

/** Wild only used in consume/infuse actions, not on the board */
export type ElementTypeWithWild = ElementType | 'wild';

export type ElementState =
  | 'strong' | 'waning' | 'inert' | 'new' | 'consumed' | 'partlyConsumed' | 'always';

export type SummonState = 'new' | 'true' | 'false';

export type SummonColor =
  | 'blue' | 'green' | 'yellow' | 'orange' | 'white'
  | 'purple' | 'pink' | 'red' | 'custom' | 'fh';

export type MonsterType = 'normal' | 'elite' | 'boss' | 'bb';

export type AttackModifierType =
  | 'plus' | 'plus0' | 'plus1' | 'plus2' | 'plus3' | 'plus4' | 'plusX'
  | 'minus' | 'minus1' | 'minus2'
  | 'null' | 'double' | 'bless' | 'curse' | 'minus1extra'
  | 'empower' | 'enfeeble' | 'invalid'
  | 'townguard' | 'wreck' | 'success' | 'imbue' | 'advancedImbue';

export type AttackModifierValueType = 'default' | 'plus' | 'minus' | 'multiply';

export type LootType =
  | 'money' | 'lumber' | 'metal' | 'hide'
  | 'arrowvine' | 'axenut' | 'corpsecap' | 'flamefruit' | 'rockroot' | 'snowthistle'
  | 'random_item' | 'special1' | 'special2';

// ── Small shared types ──────────────────────────────────────────────────────

export interface Identifier {
  name: string;
  edition: string;
}

export interface CountIdentifier extends Identifier {
  count: number;
}

export interface EntityCounter {
  identifier: Identifier & { type?: string; number?: number };
  total: number;
  killed: number;
}

// ── Entity condition ────────────────────────────────────────────────────────

export interface EntityCondition {
  name: ConditionName;
  value: number;
  state: EntityConditionState;
  lastState: EntityConditionState;
  permanent: boolean;
  expired: boolean;
  highlight: boolean;
}

// ── Elements ────────────────────────────────────────────────────────────────

export interface ElementModel {
  type: ElementType;
  state: ElementState;
}

// ── Attack modifier deck (serialized model) ─────────────────────────────────

export interface AttackModifierDeckModel {
  current: number;
  cards: string[];
  discarded: number[];
  active: boolean;
  lastVisible: number;
  /** Card ID of the last drawn card (for UI display, especially after bless/curse removal) */
  lastDrawn?: string;
  state?: 'advantage' | 'disadvantage';
  bb: boolean;
  /** Migration field — GHS typo preserved for compat */
  disgarded?: number[];
}

// ── Loot ────────────────────────────────────────────────────────────────────

export interface LootCard {
  type: LootType;
  cardId: number;
  value4P: number;
  value3P: number;
  value2P: number;
  enhancements: number;
  /** Deprecated migration field */
  value?: string;
}

export interface LootDeck {
  current: number;
  cards: LootCard[];
  active: boolean;
}

// ── Battle goal deck ────────────────────────────────────────────────────────

export interface BattleGoalDeck {
  /** Card IDs in deck order (shuffled once, then persistent) */
  cards: string[];
  /** Index of the next card to deal */
  current: number;
}

// ── Challenge deck ──────────────────────────────────────────────────────────

export interface ChallengeCard {
  name: string;
  edition: string;
}

export interface ChallengeDeck {
  current: number;
  finished: number;
  keep: ChallengeCard[];
  cards: ChallengeCard[];
  active: boolean;
}

// ── Summon ──────────────────────────────────────────────────────────────────

export interface Summon {
  uuid: string;
  name: string;
  title: string;
  cardId: string;
  number: number;
  color: SummonColor;
  attack: string;
  movement: number;
  range: number;
  flying: boolean;
  dead: boolean;
  state: SummonState;
  level: number;
  health: number;
  maxHealth: number;
  entityConditions: EntityCondition[];
  immunities: ConditionName[];
  markers: string[];
  tags: string[];
  action?: string;
  additionalAction?: string;
  active: boolean;
  off: boolean;
  dormant: boolean;
  passive: boolean;
  thumbnail?: string;
  thumbnailUrl?: string;
  noThumbnail: boolean;
  shield: string;
  shieldPersistent: string;
  retaliate: string[];
  retaliatePersistent: string[];
}

// ── Scenario stats (per-scenario performance) ───────────────────────────────

export interface ScenarioStats {
  success: boolean;
  level: number;
  gold: number;
  xp: number;
  treasures: number;
  summons: SummonScenarioStats;
  dealtDamage: number;
  monsterDamage: number;
  otherDamage: number;
  healedDamage: number;
  heals: number;
  normalKills: number;
  eliteKills: number;
  bossKills: number;
  exhausts: number;
  maxDealtDamage: number;
  maxDamage: number;
}

export interface SummonScenarioStats {
  dealtDamage: number;
  monsterDamage: number;
  otherDamage: number;
  healedDamage: number;
  heals: number;
  normalKills: number;
  eliteKills: number;
  bossKills: number;
  exhausts: number;
  maxDealtDamage: number;
  maxDamage: number;
}

// ── Character progress (campaign persistence) ───────────────────────────────

export interface CharacterItemModel {
  name: string;
  edition: string;
  id?: number;
}

export interface CharacterProgress {
  experience: number;
  gold: number;
  loot: Partial<Record<LootType, number>>;
  itemNotes: string;
  items: CharacterItemModel[];
  equippedItems: CharacterItemModel[];
  personalQuest: string;
  personalQuestProgress: number[];
  battleGoals: number;
  notes: string;
  retired: boolean;
  retirements: number;
  extraPerks: number;
  perks: number[];
  masteries: number[];
  donations: number;
  scenarioStats: ScenarioStats[];
  deck: string[];
  enhancements: unknown[];
  /** One-time Player Sheet intro animation shown flag. Persists per character
   *  so the intro only plays once per character per campaign. Optional because
   *  pre-T0a saves and GHS imports don't have it (undefined reads as falsy). */
  sheetIntroSeen?: boolean;
}

// ── Character ───────────────────────────────────────────────────────────────

export interface Character {
  name: string;
  edition: string;
  marker: boolean;
  title: string;
  initiative: number;
  experience: number;
  loot: number;
  lootCards: number[];
  treasures: string[];
  exhausted: boolean;
  level: number;
  off: boolean;
  active: boolean;
  health: number;
  maxHealth: number;
  entityConditions: EntityCondition[];
  immunities: ConditionName[];
  markers: string[];
  tags: string[];
  identity: number;
  summons: Summon[];
  progress: CharacterProgress;
  scenarioStats: ScenarioStats;
  number: number;
  attackModifierDeck: AttackModifierDeckModel;
  donations: number;
  token: number;
  tokenValues: number[];
  absent: boolean;
  longRest: boolean;
  battleGoals: Identifier[];
  battleGoal: boolean;
  /** Serialized Action JSON */
  shield: string;
  /** Serialized Action JSON */
  shieldPersistent: string;
  retaliate: string[];
  retaliatePersistent: string[];
}

// ── Monster entity (individual standee) ─────────────────────────────────────

export interface MonsterEntity {
  number: number;
  marker: string;
  type: MonsterType;
  dead: boolean;
  summon: SummonState;
  active: boolean;
  off: boolean;
  revealed: boolean;
  dormant: boolean;
  health: number;
  maxHealth: number;
  entityConditions: EntityCondition[];
  immunities: ConditionName[];
  markers: string[];
  tags: string[];
  shield: string;
  shieldPersistent: string;
  retaliate: string[];
  retaliatePersistent: string[];
}

// ── Monster group ───────────────────────────────────────────────────────────

export interface Monster {
  name: string;
  edition: string;
  level: number;
  initiative: number;
  off: boolean;
  active: boolean;
  drawExtra: boolean;
  lastDraw: number;
  ability: number;
  abilities: number[];
  entities: MonsterEntity[];
  isAlly: boolean;
  isAllied: boolean;
  tags: string[];
  /** Scenario-specific ability deck override (e.g., "hound-scenario-0") */
  overrideDeck?: string;
}

// ── Objective container ─────────────────────────────────────────────────────

export interface ObjectiveEntity {
  number: number;
  health: number;
  maxHealth: number;
  entityConditions: EntityCondition[];
  immunities: ConditionName[];
  markers: string[];
  tags: string[];
  active: boolean;
  dead: boolean;
}

export interface ObjectiveContainer {
  uuid: string;
  name: string;
  edition: string;
  objectiveId: number;
  additionalObjectiveId?: number;
  level: number;
  off: boolean;
  active: boolean;
  entities: ObjectiveEntity[];
  marker: boolean;
  title: string;
  escort: boolean;
  initiative: number;
  tags: string[];
}

// ── Scenario model ──────────────────────────────────────────────────────────

export interface ScenarioModel {
  index: string;
  edition: string;
  group?: string;
  isCustom: boolean;
  custom: string;
  revealedRooms?: number[];
  additionalSections?: string[];
}

export type ScenarioFinish = 'success' | 'failure' | string;

// ── Scenario rule identifier ────────────────────────────────────────────────

export interface ScenarioRuleIdentifier {
  edition: string;
  scenario: string;
  group: string;
  index: number;
  section: boolean;
}

// ── Building (Frosthaven) ───────────────────────────────────────────────────

export interface BuildingModel {
  name: string;
  level: number;
  state: string;
}

// ── Game clock ──────────────────────────────────────────────────────────────

export interface GameClockTimestamp {
  clockIn: number;
  clockOut?: number;
}

// ── Party / campaign state ──────────────────────────────────────────────────

export interface Party {
  id: number;
  name: string;
  edition?: string;
  conditions: ConditionName[];
  battleGoalEditions: string[];
  filteredBattleGoals: Identifier[];
  location: string;
  notes: string;
  achievements: string;
  achievementsList: string[];
  reputation: number;
  prosperity: number;
  scenarios: ScenarioModel[];
  conclusions: ScenarioModel[];
  casualScenarios: ScenarioModel[];
  manualScenarios: ScenarioModel[];
  campaignMode: boolean;
  globalAchievements: string;
  globalAchievementsList: string[];
  treasures: Identifier[];
  donations: number;
  players: string[];
  characters: Character[];
  availableCharacters: Character[];
  retirements: Character[];
  unlockedItems: CountIdentifier[];
  unlockedCharacters: string[];
  level: number;
  levelCalculation: boolean;
  levelAdjustment: number;
  bonusAdjustment: number;
  ge5Player: boolean;
  playerCount: number;
  solo: boolean;
  envelopeB: boolean;
  eventCards: EventCardIdentifier[];
  // Frosthaven-specific
  weeks: number;
  weekSections: Record<string, string[]>;
  loot: Partial<Record<LootType, number>>;
  randomItemLooted: ScenarioModel[];
  inspiration: number;
  defense: number;
  soldiers: number;
  morale: number;
  townGuardPerks: number;
  townGuardPerkSections: string[];
  campaignStickers: string[];
  townGuardDeck?: AttackModifierDeckModel;
  buildings: BuildingModel[];
  pets: PetIdentifier[];
  lootDeckEnhancements: LootCard[];
  lootDeckFixed: LootType[];
  lootDeckSections: string[];
  trials: number;
  // GH2E-specific
  factionReputation: Record<string, number>;
  imbuement: number;
  // Phase T0b: one-time Party Sheet intro animation ("leather book opening"),
  // persisted via updateCampaign. Optional so pre-T0b saves default to unseen.
  sheetIntroSeen?: boolean;
}

export interface EventCardIdentifier {
  edition: string;
  type: string;
  cardId: string;
  attack: boolean;
}

export interface PetIdentifier {
  name: string;
  edition: string;
}

// ── Undo entry (our addition, not in GHS) ───────────────────────────────────

export interface UndoEntry {
  revision: number;
  action: string;
  stateBefore: string;
  timestamp: number;
}

// ── Figure identifier (for turn order) ──────────────────────────────────────

export interface FigureIdentifier {
  type: 'character' | 'monster' | 'objectiveContainer';
  name: string;
  edition: string;
}

// ── App mode ─────────────────────────────────────────────────────────────────

/** App-level mode: scenario play, town/outpost phase, or transitioning between */
export type AppMode = 'scenario' | 'town' | 'transition' | 'lobby';

// ── Scenario setup workflow ────────────────────────────────────────────────

export type SetupPhase = 'chores' | 'rules' | 'goals';

export interface ChoreItem {
  name: string;
  dataName?: string;
  count?: number;
  ref?: string;
  roomNumber?: number;
  imageUrl?: string;
  description?: string;
}

export interface ChoreAssignment {
  characterName: string;
  edition: string;
  choreType: 'monsters' | 'map' | 'overlays' | 'decks';
  items: ChoreItem[];
}

export interface SetupData {
  scenarioIndex: string;
  edition: string;
  group?: string;
  chores: ChoreAssignment[];
  choreConfirmations: Record<string, boolean>;
}

// ── Scenario finish rewards snapshot ───────────────────────────────────────

/**
 * Per-character reward snapshot captured at `prepareScenarioEnd` time.
 * Read by rewards overlays and mutated in place during the pending window
 * before `completeScenario` atomically applies it to character progress.
 */
export interface ScenarioFinishCharacterReward {
  /** Character identity — matches `Character.name` / `Character.edition`. */
  name: string;
  edition: string;
  /** Display label at time of snapshot. */
  title: string;
  /** XP scored on the initiative dial during the scenario. */
  scenarioXP: number;
  /** Scenario-level bonus XP (4 + 2 * level), zero on defeat. */
  bonusXP: number;
  /** Sum of scenarioXP + bonusXP — what gets added to career XP. */
  totalXPGained: number;
  /** Career XP before this scenario. */
  careerXPBefore: number;
  /** Career XP after applying totalXPGained. */
  careerXPAfter: number;
  /** Scenario level (for display of gold conversion). */
  scenarioLevel: number;
  /** Gold conversion rate at scenario level (e.g. 2/2/3/3/4/4/5/6). */
  goldConversion: number;
  /** Total coin value looted (FH from cards, GH from char.loot counter). */
  totalCoins: number;
  /** Gold gained = totalCoins * goldConversion. */
  goldGained: number;
  /** Career gold before/after. */
  careerGoldBefore: number;
  careerGoldAfter: number;
  /** FH resource counts drawn from loot cards (lumber, metal, hide, herbs). */
  resources: Partial<Record<LootType, number>>;
  /** Loot-deck indexes drawn by this character at snapshot time. */
  lootCardIndexes: number[];
  /** Treasure ids revealed by this character (moves to claimed on claim). */
  treasuresPending: string[];
  /** Treasure ids the character has already claimed this pending window. */
  treasuresClaimed: string[];
  /** Parsed narrative per resolved treasure id (populated at claim time). */
  treasuresResolved?: Record<string, string>;
  /** XP thresholds for progression display. */
  xpThresholds: {
    currentLevel: number;
    /** Minimum XP for current level. */
    currentFloor: number;
    /** Minimum XP for next level, or null at max level. */
    nextThreshold: number | null;
  };
  /**
   * Battle goal checks earned this scenario (0..3). Applied as
   * `char.progress.battleGoals += battleGoalChecks` on victory at
   * `completeScenario`. Persisted per-card dealt-goal tracking is
   * deferred; see docs/DESIGN_DECISIONS.md (Phase T1 entry).
   */
  battleGoalChecks: number;
  /** Whether this player has dismissed their phone rewards overlay. */
  dismissed: boolean;
}

export interface ScenarioFinishData {
  outcome: 'victory' | 'defeat';
  scenarioIndex: string;
  scenarioEdition: string;
  scenarioLevel: number;
  /** Per-character snapshot at `prepareScenarioEnd` time. */
  characters: ScenarioFinishCharacterReward[];
  /** FH inspiration reward (4 - playerCount) on victory only; omitted in GH. */
  inspirationGained?: number;
  /** Captured at pending; persisted through completeScenario. */
  createdAtRevision: number;
}

// ── Top-level game state ────────────────────────────────────────────────────

export interface GameState {
  // Our additions (not in GHS)
  gameCode: string;
  undoStack: UndoEntry[];
  mode?: AppMode;

  // GHS fields
  revision: number;
  revisionOffset: number;
  edition?: string;
  conditions: ConditionName[];
  battleGoalEditions: string[];
  filteredBattleGoals: Identifier[];
  /** Ordered figure references in "edition-name" format */
  figures: string[];
  entitiesCounter: EntityCounter[];
  characters: Character[];
  monsters: Monster[];
  objectiveContainers: ObjectiveContainer[];
  state: GamePhase;
  scenario?: ScenarioModel;
  sections: ScenarioModel[];
  scenarioRules: ScenarioRuleIdentifier[];
  appliedScenarioRules: ScenarioRuleIdentifier[];
  discardedScenarioRules: ScenarioRuleIdentifier[];
  level: number;
  levelCalculation: boolean;
  levelAdjustment: number;
  bonusAdjustment: number;
  ge5Player: boolean;
  playerCount: number;
  round: number;
  roundResets: number[];
  roundResetsHidden: number[];
  playSeconds: number;
  totalSeconds: number;
  monsterAttackModifierDeck: AttackModifierDeckModel;
  allyAttackModifierDeck: AttackModifierDeckModel;
  elementBoard: ElementModel[];
  solo: boolean;
  party: Party;
  parties: Party[];
  lootDeck: LootDeck;
  /** Persistent battle goal deck — shuffled once per campaign, unused cards returned to bottom */
  battleGoalDeck?: BattleGoalDeck;
  lootDeckEnhancements: LootCard[];
  lootDeckFixed: LootType[];
  lootDeckSections: string[];
  unlockedCharacters: string[];
  server: boolean;
  finish?: ScenarioFinish;
  /** Rewards snapshot populated during pending scenario end; cleared on cancel/complete-town/new-scenario */
  finishData?: ScenarioFinishData;
  setupPhase?: SetupPhase;
  setupData?: SetupData;
  gameClock: GameClockTimestamp[];
  challengeDeck: ChallengeDeck;
  favors: Identifier[];
  favorPoints: number[];
  keepFavors: boolean;
}
