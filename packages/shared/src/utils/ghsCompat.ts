// GHS import/export compatibility + empty state factory
import type {
  GameState,
  Party,
  AttackModifierDeckModel,
  LootDeck,
  ChallengeDeck,
} from '../types/gameState.js';
import { createDefaultElementBoard } from './elements.js';

const UNDO_LIMIT = 50;

// ── Empty state factory ─────────────────────────────────────────────────────

function createEmptyAttackModifierDeck(): AttackModifierDeckModel {
  return {
    current: 0,
    cards: [],
    discarded: [],
    active: false,
    lastVisible: -1,
    bb: false,
  };
}

function createEmptyLootDeck(): LootDeck {
  return {
    current: 0,
    cards: [],
    active: false,
  };
}

function createEmptyChallengeDeck(): ChallengeDeck {
  return {
    current: 0,
    finished: 0,
    keep: [],
    cards: [],
    active: false,
  };
}

function createEmptyParty(edition: string): Party {
  return {
    id: 0,
    name: '',
    edition,
    conditions: [],
    battleGoalEditions: [],
    filteredBattleGoals: [],
    location: '',
    notes: '',
    achievements: '',
    achievementsList: [],
    reputation: 0,
    prosperity: 0,
    scenarios: [],
    conclusions: [],
    casualScenarios: [],
    manualScenarios: [],
    campaignMode: false,
    globalAchievements: '',
    globalAchievementsList: [],
    treasures: [],
    donations: 0,
    players: [],
    characters: [],
    availableCharacters: [],
    retirements: [],
    unlockedItems: [],
    unlockedCharacters: [],
    level: 1,
    levelCalculation: true,
    levelAdjustment: 0,
    bonusAdjustment: 0,
    ge5Player: false,
    playerCount: 0,
    solo: false,
    envelopeB: false,
    eventCards: [],
    // Frosthaven
    weeks: 0,
    weekSections: {},
    loot: {},
    randomItemLooted: [],
    inspiration: 0,
    defense: 0,
    soldiers: 0,
    morale: 0,
    townGuardPerks: 0,
    townGuardPerkSections: [],
    campaignStickers: [],
    buildings: [],
    pets: [],
    lootDeckEnhancements: [],
    lootDeckFixed: [],
    lootDeckSections: [],
    trials: 0,
    // GH2E
    factionReputation: {},
    imbuement: 0,
  };
}

/**
 * Create a blank, valid GameState for starting a new game.
 */
export function createEmptyGameState(edition?: string): GameState {
  const ed = edition ?? 'gh';
  return {
    gameCode: '',
    undoStack: [],
    revision: 0,
    revisionOffset: 0,
    edition: ed,
    conditions: [],
    battleGoalEditions: [],
    filteredBattleGoals: [],
    figures: [],
    entitiesCounter: [],
    characters: [],
    monsters: [],
    objectiveContainers: [],
    state: 'draw',
    sections: [],
    scenarioRules: [],
    appliedScenarioRules: [],
    discardedScenarioRules: [],
    level: 1,
    levelCalculation: true,
    levelAdjustment: 0,
    bonusAdjustment: 0,
    ge5Player: false,
    playerCount: 0,
    round: 0,
    roundResets: [],
    roundResetsHidden: [],
    playSeconds: 0,
    totalSeconds: 0,
    monsterAttackModifierDeck: createEmptyAttackModifierDeck(),
    allyAttackModifierDeck: createEmptyAttackModifierDeck(),
    elementBoard: createDefaultElementBoard(),
    solo: false,
    party: createEmptyParty(ed),
    parties: [],
    lootDeck: createEmptyLootDeck(),
    lootDeckEnhancements: [],
    lootDeckFixed: [],
    lootDeckSections: [],
    unlockedCharacters: [],
    server: false,
    gameClock: [],
    challengeDeck: createEmptyChallengeDeck(),
    favors: [],
    favorPoints: [],
    keepFavors: false,
  };
}

// ── GHS Import ──────────────────────────────────────────────────────────────

/**
 * Import a GHS JSON save/backup into our GameState format.
 * GHS JSON is nearly 1:1 with our types. This function fills in our additions
 * and ensures all arrays exist (GHS may omit empty arrays as undefined).
 */
export function importGhsState(ghsJson: unknown): GameState {
  if (typeof ghsJson === 'string') {
    ghsJson = JSON.parse(ghsJson);
  }

  if (!ghsJson || typeof ghsJson !== 'object') {
    throw new Error('Invalid GHS state: expected an object');
  }

  const raw = ghsJson as Record<string, unknown>;
  const empty = createEmptyGameState((raw.edition as string) ?? 'gh');

  // Merge raw GHS data over empty defaults
  const state: GameState = { ...empty };

  for (const key of Object.keys(raw)) {
    if (key === 'undoStack') continue; // Don't import GHS undo data
    if (key in state) {
      (state as unknown as Record<string, unknown>)[key] = raw[key];
    }
  }

  // Ensure our additions are present
  state.undoStack = [];
  state.gameCode = state.gameCode || '';

  // Ensure all arrays exist (GHS may serialize empty arrays as undefined)
  state.characters ??= [];
  state.monsters ??= [];
  state.objectiveContainers ??= [];
  state.figures ??= [];
  state.sections ??= [];
  state.scenarioRules ??= [];
  state.appliedScenarioRules ??= [];
  state.discardedScenarioRules ??= [];
  state.entitiesCounter ??= [];
  state.conditions ??= [];
  state.battleGoalEditions ??= [];
  state.filteredBattleGoals ??= [];
  state.roundResets ??= [];
  state.roundResetsHidden ??= [];
  state.gameClock ??= [];
  state.lootDeckEnhancements ??= [];
  state.lootDeckFixed ??= [];
  state.lootDeckSections ??= [];
  state.unlockedCharacters ??= [];
  state.favors ??= [];
  state.favorPoints ??= [];
  state.parties ??= [];

  // Normalize element board
  if (!state.elementBoard || state.elementBoard.length === 0) {
    state.elementBoard = createDefaultElementBoard();
  }

  // Ensure decks exist
  if (!state.monsterAttackModifierDeck) {
    state.monsterAttackModifierDeck = createEmptyAttackModifierDeck();
  }
  if (!state.allyAttackModifierDeck) {
    state.allyAttackModifierDeck = createEmptyAttackModifierDeck();
  }
  if (!state.lootDeck) {
    state.lootDeck = createEmptyLootDeck();
  }
  if (!state.challengeDeck) {
    state.challengeDeck = createEmptyChallengeDeck();
  }

  return state;
}

// ── GHS Export ──────────────────────────────────────────────────────────────

/**
 * Export our GameState to a GHS-compatible JSON object.
 * Removes fields GHS doesn't understand.
 */
export function exportGhsState(state: GameState): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(state)) as unknown as Record<string, unknown>;

  // Remove our additions
  delete raw.undoStack;
  delete raw.gameCode;

  return raw;
}
