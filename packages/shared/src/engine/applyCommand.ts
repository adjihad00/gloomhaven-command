// Command application engine — pure state mutations
import type {
  GameState,
  Character,
  MonsterEntity,
  Summon,
  ObjectiveEntity,
  Monster,
  ObjectiveContainer,
  AttackModifierDeckModel,
  EntityCondition,
  CharacterProgress,
  ScenarioStats,
  SummonScenarioStats,
} from '../types/gameState.js';
import type { Command, CommandTarget } from '../types/commands.js';
import type { StateChange } from '../types/protocol.js';
import { deepClone } from './turnOrder.js';
import { canAdvancePhase, startRound, endRound } from './turnOrder.js';
import { toggleCondition, processConditionEndOfTurn } from '../utils/conditions.js';
import { diffStates } from './diffStates.js';
import { importGhsState as importGhs } from '../utils/ghsCompat.js';

export interface ApplyResult {
  state: GameState;
  changes: StateChange[];
}

const UNDO_LIMIT = 50;

// ── Main entry point ────────────────────────────────────────────────────────

export function applyCommand(state: GameState, command: Command): ApplyResult {
  const before = deepClone(state);
  let after = deepClone(state);

  switch (command.action) {
    case 'changeHealth':
      handleChangeHealth(after, command.payload);
      break;
    case 'changeMaxHealth':
      handleChangeMaxHealth(after, command.payload);
      break;
    case 'toggleCondition':
      handleToggleCondition(after, command.payload);
      break;
    case 'setInitiative':
      handleSetInitiative(after, command.payload);
      break;
    case 'advancePhase':
      after = handleAdvancePhase(after);
      break;
    case 'toggleTurn':
      handleToggleTurn(after, command.payload);
      break;
    case 'moveElement':
      handleMoveElement(after, command.payload);
      break;
    case 'addEntity':
      handleAddEntity(after, command.payload);
      break;
    case 'removeEntity':
      handleRemoveEntity(after, command.payload);
      break;
    case 'addCharacter':
      handleAddCharacter(after, command.payload);
      break;
    case 'removeCharacter':
      handleRemoveCharacter(after, command.payload);
      break;
    case 'addSummon':
      handleAddSummon(after, command.payload);
      break;
    case 'removeSummon':
      handleRemoveSummon(after, command.payload);
      break;
    case 'addMonsterGroup':
      handleAddMonsterGroup(after, command.payload);
      break;
    case 'removeMonsterGroup':
      handleRemoveMonsterGroup(after, command.payload);
      break;
    case 'toggleExhausted':
      handleToggleExhausted(after, command.payload);
      break;
    case 'toggleAbsent':
      handleToggleAbsent(after, command.payload);
      break;
    case 'drawLootCard':
      handleDrawLootCard(after);
      break;
    case 'assignLoot':
      handleAssignLoot(after, command.payload);
      break;
    case 'drawMonsterAbility':
      handleDrawMonsterAbility(after, command.payload);
      break;
    case 'shuffleMonsterAbilities':
      handleShuffleMonsterAbilities(after, command.payload);
      break;
    case 'shuffleModifierDeck':
      handleShuffleModifierDeck(after, command.payload);
      break;
    case 'drawModifierCard':
      handleDrawModifierCard(after, command.payload);
      break;
    case 'setScenario':
      handleSetScenario(after, command.payload);
      break;
    case 'revealRoom':
      handleRevealRoom(after, command.payload);
      break;
    case 'setLevel':
      handleSetLevel(after, command.payload);
      break;
    case 'setMonsterLevel':
      handleSetMonsterLevel(after, command.payload);
      break;
    case 'setExperience':
      handleSetExperience(after, command.payload);
      break;
    case 'setLoot':
      handleSetLoot(after, command.payload);
      break;
    case 'setRound':
      handleSetRound(after, command.payload);
      break;
    case 'undoAction':
      return handleUndoAction(before, after);
    case 'importGhsState':
      after = handleImportGhsState(after, command.payload);
      break;
    case 'updateCampaign':
      handleUpdateCampaign(after, command.payload);
      break;
    default: {
      const _exhaustive: never = command;
      throw new Error(`Unknown command action: ${(_exhaustive as Command).action}`);
    }
  }

  // Increment revision
  after.revision += 1;

  // Push undo entry (capped at limit)
  after.undoStack.push({
    revision: before.revision,
    action: command.action,
    stateBefore: JSON.stringify(before),
    timestamp: Date.now(),
  });
  if (after.undoStack.length > UNDO_LIMIT) {
    after.undoStack = after.undoStack.slice(after.undoStack.length - UNDO_LIMIT);
  }

  const changes = diffStates(before, after);
  return { state: after, changes };
}

// ── Target resolution ───────────────────────────────────────────────────────

interface ResolvedTarget {
  entity: Character | MonsterEntity | Summon | ObjectiveEntity;
  parent?: Monster | Character | ObjectiveContainer;
}

function resolveTarget(state: GameState, target: CommandTarget): ResolvedTarget | null {
  switch (target.type) {
    case 'character': {
      const char = state.characters.find((c) => c.name === target.name && c.edition === target.edition);
      return char ? { entity: char } : null;
    }
    case 'monster': {
      const mon = state.monsters.find((m) => m.name === target.name && m.edition === target.edition);
      if (!mon) return null;
      const entity = mon.entities.find((e) => e.number === target.entityNumber);
      return entity ? { entity, parent: mon } : null;
    }
    case 'summon': {
      const char = state.characters.find(
        (c) => c.name === target.characterName && c.edition === target.characterEdition,
      );
      if (!char) return null;
      const summon = char.summons.find((s) => s.uuid === target.summonUuid);
      return summon ? { entity: summon, parent: char } : null;
    }
    case 'objective': {
      const obj = state.objectiveContainers.find((o) => o.uuid === target.uuid);
      if (!obj) return null;
      const entity = obj.entities.find((e) => e.number === target.entityNumber);
      return entity ? { entity, parent: obj } : null;
    }
  }
}

// ── Fisher-Yates shuffle ────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Command handlers ────────────────────────────────────────────────────────

function handleChangeHealth(
  state: GameState,
  payload: { target: CommandTarget; delta: number },
): void {
  const resolved = resolveTarget(state, payload.target);
  if (!resolved) return;
  const { entity } = resolved;

  entity.health = Math.max(0, Math.min(entity.maxHealth, entity.health + payload.delta));

  // Auto-kill monster entities at 0 hp, auto-revive when healed above 0
  if (payload.target.type === 'monster') {
    if (entity.health === 0) {
      (entity as MonsterEntity).dead = true;
    } else if ((entity as MonsterEntity).dead) {
      (entity as MonsterEntity).dead = false;
    }
  }
}

function handleChangeMaxHealth(
  state: GameState,
  payload: { target: CommandTarget; delta: number },
): void {
  const resolved = resolveTarget(state, payload.target);
  if (!resolved) return;
  const { entity } = resolved;

  entity.maxHealth = Math.max(0, entity.maxHealth + payload.delta);
  // Clamp current health to new max
  if (entity.health > entity.maxHealth) {
    entity.health = entity.maxHealth;
  }
}

function handleToggleCondition(
  state: GameState,
  payload: { target: CommandTarget; condition: string; value?: number },
): void {
  const resolved = resolveTarget(state, payload.target);
  if (!resolved) return;
  const { entity } = resolved;

  entity.entityConditions = toggleCondition(
    entity.entityConditions,
    payload.condition as EntityCondition['name'],
    payload.value,
  );
}

function handleSetInitiative(
  state: GameState,
  payload: { characterName: string; edition: string; value: number },
): void {
  const char = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (char) {
    char.initiative = payload.value;
  }
}

function handleAdvancePhase(state: GameState): GameState {
  if (!canAdvancePhase(state)) return state;

  if (state.state === 'draw') {
    return startRound(state);
  }
  // state === 'next', round is complete
  return endRound(state);
}

function handleToggleTurn(
  state: GameState,
  payload: { figure: { type: string; name: string; edition: string } },
): void {
  const { figure: figId } = payload;

  // Find the figure in its collection
  type FigureRef = Character | Monster | ObjectiveContainer;
  let targetFigure: FigureRef | undefined;
  let targetType: 'character' | 'monster' | 'objectiveContainer' = 'character';

  const char = state.characters.find((c) => c.name === figId.name && c.edition === figId.edition);
  if (char) {
    targetFigure = char;
    targetType = 'character';
  }

  if (!targetFigure) {
    const mon = state.monsters.find((m) => m.name === figId.name && m.edition === figId.edition);
    if (mon) {
      targetFigure = mon;
      targetType = 'monster';
    }
  }

  if (!targetFigure) {
    const obj = state.objectiveContainers.find(
      (o) => o.name === figId.name && o.edition === figId.edition,
    );
    if (obj) {
      targetFigure = obj;
      targetType = 'objectiveContainer';
    }
  }

  if (!targetFigure) return;

  if (targetFigure.active) {
    // Deactivate: set active=false, off=true, process end-of-turn
    targetFigure.active = false;
    targetFigure.off = true;

    if (targetType === 'character') {
      const c = targetFigure as Character;
      const result = processConditionEndOfTurn(c.entityConditions);
      c.entityConditions = result.conditions;
      if (result.woundDamage > 0) {
        c.health = Math.max(0, c.health - result.woundDamage);
      }
      for (const summon of c.summons) {
        summon.active = false;
        summon.off = true;
      }
    } else if (targetType === 'monster') {
      const m = targetFigure as Monster;
      for (const entity of m.entities) {
        entity.active = false;
        entity.off = true;
        const result = processConditionEndOfTurn(entity.entityConditions);
        entity.entityConditions = result.conditions;
        if (result.woundDamage > 0) {
          entity.health = Math.max(0, entity.health - result.woundDamage);
          if (entity.health === 0) entity.dead = true;
        }
      }
    }
  } else {
    // Activate: deactivate any currently active figure first
    for (const c of state.characters) {
      if (c.active) {
        c.active = false;
        c.off = true;
        for (const s of c.summons) {
          s.active = false;
          s.off = true;
        }
      }
    }
    for (const m of state.monsters) {
      if (m.active) {
        m.active = false;
        m.off = true;
        for (const e of m.entities) {
          e.active = false;
          e.off = true;
        }
      }
    }
    for (const o of state.objectiveContainers) {
      if (o.active) {
        o.active = false;
        o.off = true;
      }
    }

    // Now activate the target
    targetFigure.active = true;
    targetFigure.off = false;

    if (targetType === 'character') {
      const c = targetFigure as Character;
      for (const summon of c.summons) {
        if (!summon.dead) {
          summon.active = true;
          summon.off = false;
        }
      }
    } else if (targetType === 'monster') {
      const m = targetFigure as Monster;
      for (const entity of m.entities) {
        if (!entity.dead) {
          entity.active = true;
          entity.off = false;
        }
      }
    }
  }
}

function handleMoveElement(
  state: GameState,
  payload: { element: string; newState: string },
): void {
  const el = state.elementBoard.find((e) => e.type === payload.element);
  if (el) {
    el.state = payload.newState as typeof el.state;
  }
}

function handleAddEntity(
  state: GameState,
  payload: { monsterName: string; edition: string; entityNumber: number; type: string },
): void {
  const mon = state.monsters.find(
    (m) => m.name === payload.monsterName && m.edition === payload.edition,
  );
  if (!mon) return;

  const newEntity: MonsterEntity = {
    number: payload.entityNumber,
    marker: '',
    type: payload.type as MonsterEntity['type'],
    dead: false,
    summon: 'false',
    active: false,
    off: false,
    revealed: false,
    dormant: false,
    health: 0, // Caller should set appropriate health via changeMaxHealth or separate logic
    maxHealth: 0,
    entityConditions: [],
    immunities: [],
    markers: [],
    tags: [],
    shield: '',
    shieldPersistent: '',
    retaliate: [],
    retaliatePersistent: [],
  };

  mon.entities.push(newEntity);
}

function handleRemoveEntity(
  state: GameState,
  payload: { monsterName: string; edition: string; entityNumber: number; type: string },
): void {
  const mon = state.monsters.find(
    (m) => m.name === payload.monsterName && m.edition === payload.edition,
  );
  if (!mon) return;
  mon.entities = mon.entities.filter(
    (e) => !(e.number === payload.entityNumber && e.type === payload.type),
  );
}

function createEmptyScenarioStats(): ScenarioStats {
  const summons: SummonScenarioStats = {
    dealtDamage: 0, monsterDamage: 0, otherDamage: 0, healedDamage: 0,
    heals: 0, normalKills: 0, eliteKills: 0, bossKills: 0,
    exhausts: 0, maxDealtDamage: 0, maxDamage: 0,
  };
  return {
    success: false, level: 0, gold: 0, xp: 0, treasures: 0, summons,
    dealtDamage: 0, monsterDamage: 0, otherDamage: 0, healedDamage: 0,
    heals: 0, normalKills: 0, eliteKills: 0, bossKills: 0,
    exhausts: 0, maxDealtDamage: 0, maxDamage: 0,
  };
}

function createEmptyProgress(): CharacterProgress {
  return {
    experience: 0, gold: 0, loot: {}, itemNotes: '',
    items: [], equippedItems: [], personalQuest: '', personalQuestProgress: [],
    battleGoals: 0, notes: '', retired: false, retirements: 0,
    extraPerks: 0, perks: [], masteries: [], donations: 0,
    scenarioStats: [], deck: [], enhancements: [],
  };
}

function handleAddCharacter(
  state: GameState,
  payload: { name: string; edition: string; level: number; player?: string },
): void {
  const maxHealth = 10; // Default; real health is set by game data

  const char: Character = {
    name: payload.name,
    edition: payload.edition,
    marker: false,
    title: '',
    initiative: 0,
    experience: 0,
    loot: 0,
    lootCards: [],
    treasures: [],
    exhausted: false,
    level: payload.level,
    off: false,
    active: false,
    health: maxHealth,
    maxHealth,
    entityConditions: [],
    immunities: [],
    markers: [],
    tags: [],
    identity: 0,
    summons: [],
    progress: createEmptyProgress(),
    scenarioStats: createEmptyScenarioStats(),
    number: state.characters.length + 1,
    attackModifierDeck: {
      current: 0, cards: [], discarded: [], active: false,
      lastVisible: -1, bb: false,
    },
    donations: 0,
    token: 0,
    tokenValues: [],
    absent: false,
    longRest: false,
    battleGoals: [],
    battleGoal: false,
    shield: '',
    shieldPersistent: '',
    retaliate: [],
    retaliatePersistent: [],
  };

  state.characters.push(char);
  state.figures.push(`${payload.edition}-${payload.name}`);
}

function handleRemoveCharacter(
  state: GameState,
  payload: { name: string; edition: string },
): void {
  state.characters = state.characters.filter(
    (c) => !(c.name === payload.name && c.edition === payload.edition),
  );
  const figStr = `${payload.edition}-${payload.name}`;
  state.figures = state.figures.filter((f) => f !== figStr);
}

function handleAddSummon(
  state: GameState,
  payload: {
    characterName: string; edition: string; summonName: string;
    cardId: string; number: number; color: string;
  },
): void {
  const char = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (!char) return;

  const summon: Summon = {
    uuid: crypto.randomUUID(),
    name: payload.summonName,
    title: '',
    cardId: payload.cardId,
    number: payload.number,
    color: payload.color as Summon['color'],
    attack: '',
    movement: 0,
    range: 0,
    flying: false,
    dead: false,
    state: 'new',
    level: char.level,
    health: 0,
    maxHealth: 0,
    entityConditions: [],
    immunities: [],
    markers: [],
    tags: [],
    active: false,
    off: false,
    dormant: false,
    passive: false,
    noThumbnail: false,
    shield: '',
    shieldPersistent: '',
    retaliate: [],
    retaliatePersistent: [],
  };

  char.summons.push(summon);
}

function handleRemoveSummon(
  state: GameState,
  payload: { characterName: string; edition: string; summonUuid: string },
): void {
  const char = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (!char) return;
  char.summons = char.summons.filter((s) => s.uuid !== payload.summonUuid);
}

function handleAddMonsterGroup(
  state: GameState,
  payload: { name: string; edition: string },
): void {
  const monster: Monster = {
    name: payload.name,
    edition: payload.edition,
    level: state.level,
    initiative: 0,
    off: false,
    active: false,
    drawExtra: false,
    lastDraw: -1,
    ability: -1,
    abilities: [],
    entities: [],
    isAlly: false,
    isAllied: false,
    tags: [],
  };

  state.monsters.push(monster);
  state.figures.push(`${payload.edition}-${payload.name}`);
}

function handleRemoveMonsterGroup(
  state: GameState,
  payload: { name: string; edition: string },
): void {
  state.monsters = state.monsters.filter(
    (m) => !(m.name === payload.name && m.edition === payload.edition),
  );
  const figStr = `${payload.edition}-${payload.name}`;
  state.figures = state.figures.filter((f) => f !== figStr);
}

function handleToggleExhausted(
  state: GameState,
  payload: { characterName: string; edition: string },
): void {
  const char = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (!char) return;

  char.exhausted = !char.exhausted;
  if (char.exhausted) {
    char.health = 0;
    char.active = false;
    char.off = true;
  }
}

function handleToggleAbsent(
  state: GameState,
  payload: { characterName: string; edition: string },
): void {
  const char = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (!char) return;

  char.absent = !char.absent;
  if (char.absent) {
    char.active = false;
    char.off = false;
    char.initiative = 0;
  }
}

function handleDrawLootCard(state: GameState): void {
  if (state.lootDeck.current < state.lootDeck.cards.length) {
    state.lootDeck.current += 1;
  }
}

function handleAssignLoot(
  state: GameState,
  payload: { cardIndex: number; characterName: string; edition: string },
): void {
  const char = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (!char) return;

  // Add card index to character's lootCards
  if (!char.lootCards.includes(payload.cardIndex)) {
    char.lootCards.push(payload.cardIndex);
  }
}

function handleDrawMonsterAbility(
  state: GameState,
  payload: { monsterName: string; edition: string },
): void {
  const mon = state.monsters.find(
    (m) => m.name === payload.monsterName && m.edition === payload.edition,
  );
  if (!mon || mon.abilities.length === 0) return;

  // Advance lastDraw, set ability to the drawn card
  mon.lastDraw += 1;
  if (mon.lastDraw >= mon.abilities.length) {
    // Need to reshuffle
    shuffleArray(mon.abilities);
    mon.lastDraw = 0;
  }
  mon.ability = mon.abilities[mon.lastDraw];
}

function handleShuffleMonsterAbilities(
  state: GameState,
  payload: { monsterName: string; edition: string },
): void {
  const mon = state.monsters.find(
    (m) => m.name === payload.monsterName && m.edition === payload.edition,
  );
  if (!mon) return;

  shuffleArray(mon.abilities);
  mon.lastDraw = -1;
  mon.ability = -1;
}

function handleShuffleModifierDeck(
  state: GameState,
  payload: { deck: 'monster' | 'ally' | { character: string; edition: string } },
): void {
  const deck = resolveModifierDeck(state, payload.deck);
  if (!deck) return;

  shuffleArray(deck.cards);
  deck.current = 0;
  deck.discarded = [];
}

function handleDrawModifierCard(
  state: GameState,
  payload: { deck: 'monster' | 'ally' | { character: string; edition: string } },
): void {
  const deck = resolveModifierDeck(state, payload.deck);
  if (!deck || deck.current >= deck.cards.length) return;

  // The drawn card is at cards[current], then advance
  deck.discarded.push(deck.current);
  deck.current += 1;
  deck.lastVisible = deck.current - 1;
}

function handleSetScenario(
  state: GameState,
  payload: { scenarioIndex: string; edition: string; group?: string },
): void {
  state.scenario = {
    index: payload.scenarioIndex,
    edition: payload.edition,
    group: payload.group,
    isCustom: false,
    custom: '',
    revealedRooms: [],
  };
  state.round = 0;
  state.state = 'draw';
  state.monsters = [];
  state.objectiveContainers = [];
  // Remove monster/objective figures but keep character figures
  state.figures = state.figures.filter((figStr) => {
    return state.characters.some((c) => `${c.edition}-${c.name}` === figStr);
  });
}

function handleRevealRoom(
  state: GameState,
  payload: { roomId: number },
): void {
  if (!state.scenario) return;
  if (!state.scenario.revealedRooms) {
    state.scenario.revealedRooms = [];
  }
  if (!state.scenario.revealedRooms.includes(payload.roomId)) {
    state.scenario.revealedRooms.push(payload.roomId);
  }
}

function handleSetLevel(
  state: GameState,
  payload: { level: number },
): void {
  state.level = payload.level;
}

function handleSetMonsterLevel(
  state: GameState,
  payload: { name: string; edition: string; level: number },
): void {
  const mon = state.monsters.find(
    (m) => m.name === payload.name && m.edition === payload.edition,
  );
  if (mon) {
    mon.level = payload.level;
  }
}

function handleSetExperience(
  state: GameState,
  payload: { characterName: string; edition: string; value: number },
): void {
  const char = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (char) {
    char.experience = Math.max(0, payload.value);
  }
}

function handleSetLoot(
  state: GameState,
  payload: { characterName: string; edition: string; value: number },
): void {
  const char = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (char) {
    char.loot = Math.max(0, payload.value);
  }
}

function handleSetRound(
  state: GameState,
  payload: { round: number },
): void {
  state.round = payload.round;
}

function handleUndoAction(before: GameState, after: GameState): ApplyResult {
  if (after.undoStack.length === 0) {
    return { state: after, changes: [] };
  }

  const entry = after.undoStack.pop()!;
  const restored: GameState = JSON.parse(entry.stateBefore);

  // Keep current undoStack (with popped entry removed) and increment revision
  restored.undoStack = after.undoStack;
  restored.revision = before.revision + 1;

  const changes = diffStates(before, restored);
  return { state: restored, changes };
}

function handleImportGhsState(state: GameState, payload: { ghsJson: string }): GameState {
  const imported = importGhs(payload.ghsJson);
  // Preserve our gameCode
  imported.gameCode = state.gameCode;
  return imported;
}

function handleUpdateCampaign(
  state: GameState,
  payload: { field: string; value: string | number | boolean },
): void {
  // Update a field on the party object
  if (payload.field in state.party) {
    (state.party as unknown as Record<string, unknown>)[payload.field] = payload.value;
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

function resolveModifierDeck(
  state: GameState,
  deck: 'monster' | 'ally' | { character: string; edition: string },
): AttackModifierDeckModel | undefined {
  if (deck === 'monster') return state.monsterAttackModifierDeck;
  if (deck === 'ally') return state.allyAttackModifierDeck;
  const char = state.characters.find(
    (c) => c.name === deck.character && c.edition === deck.edition,
  );
  return char?.attackModifierDeck;
}
