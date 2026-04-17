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
  LootCard,
  LootDeck,
  LootType,
  ScenarioFinishData,
  ScenarioFinishCharacterReward,
} from '../types/gameState.js';
import type { Command, CommandTarget } from '../types/commands.js';
import type { StateChange } from '../types/protocol.js';
import type { ScenarioData, MonsterData, MonsterLevelStats, MonsterAbilityDeckData, MonsterAbilityAction, ResolvedSpawn } from '../data/types.js';
import { deepClone } from './turnOrder.js';
import { canAdvancePhase, startRound, endRound, getInitiativeOrder } from './turnOrder.js';
import { toggleCondition, processConditionEndOfTurn } from '../utils/conditions.js';
import { diffStates } from './diffStates.js';
import { importGhsState as importGhs, buildStandardModifierDeck } from '../utils/ghsCompat.js';
import { getPlayerCount, calculateScenarioLevel, getMinXPForLevel, deriveLevelValues } from '../data/levelCalculation.js';

export interface ApplyResult {
  state: GameState;
  changes: StateChange[];
}

/** Optional data context for data-driven automation (injected by server) */
export interface DataContext {
  getCharacterMaxHealth(edition: string, name: string, level: number): number;
  getMonsterMaxHealth(edition: string, name: string, level: number, type: string): number;
  getMonsterStats(edition: string, name: string, level: number, type: string): MonsterLevelStats | null;
  getScenario(edition: string, index: string): ScenarioData | null;
  resolveRoomSpawns(scenario: ScenarioData, roomNumber: number, playerCount: number): ResolvedSpawn[];
  getMonsterDeckForMonster(edition: string, monsterName: string): MonsterAbilityDeckData | null;
  getMonsterDeck(edition: string, deckName: string): MonsterAbilityDeckData | null;
  getMonster(edition: string, name: string): MonsterData | null;
  getBattleGoals?(edition: string): Array<{ cardId: string; name: string; checks: number }> | null;
  getCampaignData?(edition: string, key: string): unknown | null;
  getTreasure?(edition: string, treasureIndex: string): { treasure_index: number; reward: string } | null;
}

const UNDO_LIMIT = 50;

// ── Main entry point ────────────────────────────────────────────────────────

export function applyCommand(state: GameState, command: Command, dataContext?: DataContext): ApplyResult {
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
      after = handleAdvancePhase(after, dataContext);
      break;
    case 'toggleTurn':
      handleToggleTurn(after, command.payload, dataContext);
      break;
    case 'moveElement':
      handleMoveElement(after, command.payload);
      break;
    case 'addEntity':
      handleAddEntity(after, command.payload, dataContext);
      break;
    case 'removeEntity':
      handleRemoveEntity(after, command.payload);
      break;
    case 'addCharacter':
      handleAddCharacter(after, command.payload, dataContext);
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
    case 'toggleLongRest':
      handleToggleLongRest(after, command.payload);
      break;
    case 'renameCharacter':
      handleRenameCharacter(after, command.payload);
      break;
    case 'setLevelAdjustment':
      handleSetLevelAdjustment(after, command.payload);
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
    case 'addModifierCard':
      handleAddModifierCard(after, command.payload);
      break;
    case 'removeModifierCard':
      handleRemoveModifierCard(after, command.payload);
      break;
    case 'setScenario':
      handleSetScenario(after, command.payload, dataContext);
      break;
    case 'revealRoom':
      handleRevealRoom(after, command.payload, dataContext);
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
    case 'prepareScenarioEnd':
      after.finish = `pending:${command.payload.outcome}` as any;
      after.finishData = buildScenarioFinishData(after, command.payload.outcome, dataContext);
      break;
    case 'cancelScenarioEnd':
      after.finish = undefined;
      after.finishData = undefined;
      break;
    case 'completeScenario':
      handleCompleteScenario(after, command.payload);
      break;
    case 'startScenario':
      handleSetScenario(after, command.payload, dataContext);
      after.edition = command.payload.edition;
      after.mode = 'scenario';
      after.setupPhase = undefined;
      after.setupData = undefined;
      after.finishData = undefined;
      break;
    case 'prepareScenarioSetup':
      after.edition = command.payload.edition;
      after.mode = 'lobby';
      after.setupPhase = 'chores';
      after.setupData = {
        scenarioIndex: command.payload.scenarioIndex,
        edition: command.payload.edition,
        group: command.payload.group,
        chores: command.payload.chores,
        choreConfirmations: {},
      };
      break;
    case 'confirmChore':
      if (after.setupData) {
        after.setupData = { ...after.setupData };
        after.setupData.choreConfirmations = {
          ...after.setupData.choreConfirmations,
          [command.payload.characterName]: true,
        };
      }
      break;
    case 'proceedToRules':
      if (after.setupPhase === 'chores') after.setupPhase = 'rules';
      break;
    case 'proceedToBattleGoals':
      if (after.setupPhase === 'rules') after.setupPhase = 'goals';
      break;
    case 'cancelScenarioSetup':
      after.setupPhase = undefined;
      after.setupData = undefined;
      break;
    case 'completeTownPhase':
      after.mode = 'lobby';
      after.finish = undefined;
      after.finishData = undefined;
      break;
    case 'dealBattleGoals':
      handleDealBattleGoals(after, command.payload, dataContext);
      break;
    case 'returnBattleGoals':
      handleReturnBattleGoals(after, command.payload);
      break;
    case 'setBattleGoalComplete':
      handleSetBattleGoalComplete(after, command.payload);
      break;
    case 'claimTreasure':
      handleClaimTreasure(after, command.payload, dataContext);
      break;
    case 'dismissRewards':
      handleDismissRewards(after, command.payload);
      break;
    case 'setCharacterProgress':
      handleSetCharacterProgress(after, command.payload);
      break;
    default: {
      const _exhaustive: never = command;
      throw new Error(`Unknown command action: ${(_exhaustive as Command).action}`);
    }
  }

  // Increment revision
  after.revision += 1;

  // Push undo entry (capped at limit)
  // Strip undoStack from snapshot to prevent exponential state growth
  const { undoStack: _omit, ...beforeWithoutUndo } = before;
  after.undoStack.push({
    revision: before.revision,
    action: command.action,
    stateBefore: JSON.stringify(beforeWithoutUndo),
    timestamp: Date.now(),
  });
  if (after.undoStack.length > UNDO_LIMIT) {
    after.undoStack = after.undoStack.slice(after.undoStack.length - UNDO_LIMIT);
  }

  const changes = diffStates(before, after);
  return { state: after, changes };
}

// ── Level recalculation ─────────────────────────────────────────────────────

function recalculateLevel(state: GameState): void {
  if (!state.levelCalculation) return; // respect manual override
  const charLevels = state.characters
    .filter(c => !c.absent && !c.exhausted)
    .map(c => c.level);
  if (charLevels.length === 0) return;
  state.level = calculateScenarioLevel(charLevels, state.levelAdjustment, state.solo);
}

// ── Auto-spawn helpers ──────────────────────────────────────────────────────

function getNextStandeeNumber(group: Monster): number {
  const used = new Set(group.entities.map((e) => e.number));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

function spawnRoomMonsters(
  state: GameState,
  edition: string,
  scenario: ScenarioData,
  roomNumber: number,
  playerCount: number,
  dataContext: DataContext,
): void {
  const spawns = dataContext.resolveRoomSpawns(scenario, roomNumber, playerCount);

  for (const spawn of spawns) {
    // Find or create monster group
    let group = state.monsters.find((m) => m.name === spawn.monsterName && m.edition === edition);
    if (!group) {
      group = {
        name: spawn.monsterName,
        edition,
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
      state.monsters.push(group);
      state.figures.push(`${edition}-${spawn.monsterName}`);
    }

    // Resolve HP from data
    let maxHealth = 0;
    if (spawn.type !== 'boss') {
      maxHealth = dataContext.getMonsterMaxHealth(edition, spawn.monsterName, state.level, spawn.type);
    }

    const nextNumber = getNextStandeeNumber(group);
    group.entities.push({
      number: nextNumber,
      marker: '',
      type: spawn.type as MonsterEntity['type'],
      dead: false,
      summon: 'false',
      active: false,
      off: false,
      revealed: false,
      dormant: false,
      health: maxHealth,
      maxHealth,
      entityConditions: [],
      immunities: [],
      markers: [],
      tags: [],
      shield: '',
      shieldPersistent: '',
      retaliate: [],
      retaliatePersistent: [],
    });
  }
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

  let delta = payload.delta;

  // NOTE: Poison +1 is NOT auto-applied here. Per game rules, poison adds +1 per
  // damage SOURCE (attack), not per HP tap. The UI shows a visual reminder; the user
  // manually accounts for poison. Automated sources (wound at turn start) handle
  // poison +1 in applyTurnStartConditions().

  // Any heal clears wound and poison instead of healing HP
  if (delta > 0) {
    const hasWoundOrPoison = entity.entityConditions?.some(
      (c) => (c.name === 'wound' || c.name === 'wound_x' || c.name === 'poison' || c.name === 'poison_x')
        && !c.expired && c.state !== 'expire' && c.state !== 'removed',
    );
    if (hasWoundOrPoison) {
      entity.entityConditions = entity.entityConditions.filter(
        (c) => c.name !== 'wound' && c.name !== 'wound_x' && c.name !== 'poison' && c.name !== 'poison_x',
      );
      delta = 0; // Heal consumed by clearing conditions
    }
  }

  entity.health = Math.max(0, Math.min(entity.maxHealth, entity.health + delta));

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

function handleAdvancePhase(state: GameState, dataContext?: DataContext): GameState {
  if (!canAdvancePhase(state)) return state;

  if (state.state === 'draw') {
    // Set long-rest characters to initiative 99 before drawing
    for (const char of state.characters) {
      if (char.longRest) {
        char.initiative = 99;
      }
    }

    // Auto-draw monster ability cards (sets monster.initiative)
    if (dataContext) {
      drawMonsterAbilities(state, dataContext);
    }

    // startRound sorts figures by initiative and activates first (just sets active=true)
    const roundState = startRound(state);

    // Apply turn-start conditions (wound, regenerate) on the first activated figure
    applyTurnStartToActiveFigure(roundState);

    return roundState;
  }

  // state === 'next', round is complete
  // Check for shuffle-on-draw flags before resetting
  if (dataContext) {
    handleEndOfRoundShuffle(state, dataContext);
  }

  // End of round: remove dead monster entities (skulls persist during the round
  // for loot token tracking, then clean up before the new round starts)
  for (const monster of state.monsters) {
    monster.entities = monster.entities.filter((e) => !e.dead);
  }
  // Remove monster groups with no living entities
  state.monsters = state.monsters.filter((m) => m.entities.length > 0);
  // Clean figures array to match
  state.figures = state.figures.filter((figStr) => {
    if (state.characters.some((c) => `${c.edition}-${c.name}` === figStr)) return true;
    if (state.objectiveContainers.some((o) => `${o.edition}-${o.name}` === figStr)) return true;
    return state.monsters.some((m) => `${m.edition}-${m.name}` === figStr);
  });

  return endRound(state);
}

// ── Auto-draw monster ability cards ─────────────────────────────────────────

/** Group monsters by shared ability deck name. */
/** Resolve the ability deck name for a monster, checking scenario override first */
function getMonsterDeckName(monster: Monster, dataContext: DataContext): string {
  if (monster.overrideDeck) return monster.overrideDeck;
  const monsterData = dataContext.getMonster(monster.edition, monster.name);
  return monsterData?.deck || monster.name;
}

function groupMonstersByDeck(monsters: Monster[], dataContext: DataContext): Map<string, Monster[]> {
  const deckGroups = new Map<string, Monster[]>();
  for (const monster of monsters) {
    if (!monster.entities.some((e) => !e.dead)) continue;
    const deckName = getMonsterDeckName(monster, dataContext);
    const key = `${monster.edition}:${deckName}`;
    if (!deckGroups.has(key)) {
      deckGroups.set(key, []);
    }
    deckGroups.get(key)!.push(monster);
  }
  return deckGroups;
}

/** Draw one ability card for a group of monsters sharing a deck. Sets ability + initiative on all. */
function drawAbilityForDeckGroup(monsters: Monster[], dataContext: DataContext): void {
  const master = monsters[0];
  // Check for scenario-specific deck override first
  let deckData = master.overrideDeck
    ? dataContext.getMonsterDeck(master.edition, master.overrideDeck)
    : null;
  if (!deckData) {
    deckData = dataContext.getMonsterDeckForMonster(master.edition, master.name);
  }
  if (!deckData || deckData.abilities.length === 0) return;

  // Initialize abilities array if empty (first draw ever)
  if (master.abilities.length === 0) {
    master.abilities = deckData.abilities.map((_, i) => i);
    shuffleArray(master.abilities);
  }

  // Draw next card
  master.lastDraw += 1;
  if (master.lastDraw >= master.abilities.length) {
    shuffleArray(master.abilities);
    master.lastDraw = 0;
  }

  const cardIndex = master.abilities[master.lastDraw];
  const drawnCard = deckData.abilities[cardIndex];
  if (!drawnCard) return;

  // Apply to all monsters sharing this deck
  for (const monster of monsters) {
    monster.ability = cardIndex;
    monster.lastDraw = master.lastDraw;
    monster.abilities = [...master.abilities];
    monster.initiative = drawnCard.initiative;
  }
}

function drawMonsterAbilities(state: GameState, dataContext: DataContext): void {
  const deckGroups = groupMonstersByDeck(state.monsters, dataContext);
  for (const [, monsters] of deckGroups) {
    drawAbilityForDeckGroup(monsters, dataContext);
  }
}

/** Draw ability cards for newly spawned monster groups during a room reveal in play phase. */
function drawAbilitiesForNewMonsters(
  state: GameState,
  newGroupNames: Set<string>,
  dataContext: DataContext,
): void {
  // Only new groups need ability cards drawn. Existing groups that gained new
  // entities already have their ability card for this round.
  const newMonsters = state.monsters.filter(
    (m) => newGroupNames.has(`${m.edition}-${m.name}`),
  );
  if (newMonsters.length === 0) return;

  const deckGroups = groupMonstersByDeck(newMonsters, dataContext);
  for (const [deckKey, monsters] of deckGroups) {
    // If another monster already sharing this deck has drawn this round, copy its card
    const existingDraw = state.monsters.find(
      (m) => !newGroupNames.has(`${m.edition}-${m.name}`) && m.ability >= 0
        && (() => {
          const md = dataContext.getMonster(m.edition, m.name);
          return `${m.edition}:${md?.deck || m.name}` === deckKey;
        })(),
    );

    if (existingDraw) {
      // Shared deck already drawn this round — copy card to new monsters
      for (const monster of monsters) {
        monster.ability = existingDraw.ability;
        monster.lastDraw = existingDraw.lastDraw;
        monster.abilities = [...existingDraw.abilities];
        monster.initiative = existingDraw.initiative;
      }
    } else {
      drawAbilityForDeckGroup(monsters, dataContext);
    }
  }

  // Re-sort figures by initiative so new monsters appear in correct turn order
  const initiativeMap = new Map<string, { initiative: number; typeOrder: number }>();
  for (const char of state.characters) {
    initiativeMap.set(`${char.edition}-${char.name}`, { initiative: char.initiative, typeOrder: 0 });
  }
  for (const mon of state.monsters) {
    initiativeMap.set(`${mon.edition}-${mon.name}`, { initiative: mon.initiative, typeOrder: 1 });
  }
  for (const obj of state.objectiveContainers) {
    initiativeMap.set(`${obj.edition}-${obj.name}`, { initiative: obj.initiative, typeOrder: 2 });
  }
  state.figures.sort((a, b) => {
    const aInit = initiativeMap.get(a)?.initiative ?? 0;
    const bInit = initiativeMap.get(b)?.initiative ?? 0;
    if (aInit !== bInit) return aInit - bInit;
    return (initiativeMap.get(a)?.typeOrder ?? 3) - (initiativeMap.get(b)?.typeOrder ?? 3);
  });
}

// ── Monster ability action processing (infuse, consume, summon) ─────────────

/** Collect all actions of given types from a card, including nested subActions. */
function collectActions(actions: MonsterAbilityAction[], types: Set<string>): MonsterAbilityAction[] {
  const result: MonsterAbilityAction[] = [];
  for (const action of actions) {
    if (types.has(action.type)) {
      result.push(action);
    }
    if (action.subActions) {
      result.push(...collectActions(action.subActions, types));
    }
  }
  return result;
}

/**
 * Process monster ability card special actions on activation or deactivation.
 *
 * Per rules §6: Monster consume fires at activation (start of monster turn),
 * monster infuse fires at deactivation (end of monster turn).
 * Summons are created at activation.
 */
function processMonsterAbilityActions(
  state: GameState,
  monster: Monster,
  phase: 'activate' | 'deactivate',
  dataContext?: DataContext,
): void {
  if (!dataContext || monster.ability < 0) return;

  let deckData = monster.overrideDeck
    ? dataContext.getMonsterDeck(monster.edition, monster.overrideDeck)
    : null;
  if (!deckData) {
    deckData = dataContext.getMonsterDeckForMonster(monster.edition, monster.name);
  }
  if (!deckData) return;

  const card = deckData.abilities[monster.ability];
  if (!card || !card.actions) return;

  if (phase === 'activate') {
    // Consume elements (elementHalf actions — first part of value is the consumed element)
    const consumeActions = collectActions(card.actions, new Set(['elementHalf']));
    for (const action of consumeActions) {
      const parts = String(action.value).split(':');
      if (parts.length >= 1) {
        const elementName = parts[0];
        const el = state.elementBoard.find((e) => e.type === elementName);
        if (el && (el.state === 'strong' || el.state === 'waning')) {
          el.state = 'inert';
        }
      }
    }

    // Process summon actions
    const summonActions = collectActions(card.actions, new Set(['summon']));
    for (const action of summonActions) {
      if (!action.valueObject || action.valueObject.length === 0) continue;
      for (const summonDef of action.valueObject) {
        if (!summonDef.monster) continue;
        const summonName = summonDef.monster.name;
        const summonType = (summonDef.monster.type || 'normal') as MonsterEntity['type'];

        // Resolve HP: explicit override from action, or data lookup
        let maxHealth = summonDef.monster.health ? Number(summonDef.monster.health) : 0;
        if (!maxHealth) {
          maxHealth = dataContext.getMonsterMaxHealth(monster.edition, summonName, monster.level, summonType);
        }

        // Find or create the monster group for the summon
        let group = state.monsters.find((m) => m.name === summonName && m.edition === monster.edition);
        if (!group) {
          group = {
            name: summonName,
            edition: monster.edition,
            level: monster.level,
            initiative: 0,
            off: true,
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
          state.monsters.push(group);
          state.figures.push(`${monster.edition}-${summonName}`);
        }

        const nextNumber = getNextStandeeNumber(group);
        group.entities.push({
          number: nextNumber,
          marker: '',
          type: summonType,
          dead: false,
          summon: 'true',
          active: false,
          off: true,  // Summons don't act the round they are summoned (rules §8)
          revealed: false,
          dormant: false,
          health: maxHealth,
          maxHealth,
          entityConditions: [],
          immunities: [],
          markers: [],
          tags: [],
          shield: '',
          shieldPersistent: '',
          retaliate: [],
          retaliatePersistent: [],
        });
      }
    }
  } else {
    // phase === 'deactivate': Infuse elements
    const infuseActions = collectActions(card.actions, new Set(['element']));
    for (const action of infuseActions) {
      const elementName = String(action.value);
      if (elementName === 'wild') continue; // Wild is not a board element
      const el = state.elementBoard.find((e) => e.type === elementName);
      if (el) {
        el.state = 'strong';
      }
    }
  }
}

// ── End-of-round shuffle tracking ───────────────────────────────────────────

function handleEndOfRoundShuffle(state: GameState, dataContext: DataContext): void {
  // Track which decks need shuffling (by edition:deckName)
  const shuffledDecks = new Set<string>();

  for (const monster of state.monsters) {
    if (monster.ability < 0) continue;

    let deckData = monster.overrideDeck
      ? dataContext.getMonsterDeck(monster.edition, monster.overrideDeck)
      : null;
    if (!deckData) deckData = dataContext.getMonsterDeckForMonster(monster.edition, monster.name);
    if (!deckData) continue;

    const drawnCard = deckData.abilities[monster.ability];
    if (drawnCard?.shuffle) {
      const deckName = getMonsterDeckName(monster, dataContext);
      shuffledDecks.add(`${monster.edition}:${deckName}`);
    }
  }

  // Reshuffle decks that had a shuffle card drawn
  if (shuffledDecks.size > 0) {
    for (const monster of state.monsters) {
      const deckName = getMonsterDeckName(monster, dataContext);
      if (shuffledDecks.has(`${monster.edition}:${deckName}`)) {
        shuffleArray(monster.abilities);
        monster.lastDraw = -1;
      }
    }
  }

  // Reset all monster ability tracking for new round
  for (const monster of state.monsters) {
    monster.ability = -1;
  }
}

function handleToggleTurn(
  state: GameState,
  payload: { figure: { type: string; name: string; edition: string } },
  dataContext?: DataContext,
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
    // Deactivate: set active=false, off=true, process end-of-turn conditions
    targetFigure.active = false;
    targetFigure.off = true;

    if (targetType === 'character') {
      const c = targetFigure as Character;
      // End-of-turn: condition state transitions + bane damage
      const result = processConditionEndOfTurn(c.entityConditions);
      c.entityConditions = result.conditions;
      if (result.baneDamage > 0) {
        c.health = Math.max(0, c.health - result.baneDamage);
      }
      for (const summon of c.summons) {
        summon.active = false;
        summon.off = true;
        const summonResult = processConditionEndOfTurn(summon.entityConditions);
        summon.entityConditions = summonResult.conditions;
        if (summonResult.baneDamage > 0) {
          summon.health = Math.max(0, summon.health - summonResult.baneDamage);
          if (summon.health <= 0) summon.dead = true;
        }
      }
    } else if (targetType === 'monster') {
      const m = targetFigure as Monster;
      for (const entity of m.entities) {
        entity.active = false;
        entity.off = true;
        // End-of-turn: condition state transitions + bane damage
        const result = processConditionEndOfTurn(entity.entityConditions);
        entity.entityConditions = result.conditions;
        if (result.baneDamage > 0) {
          entity.health = Math.max(0, entity.health - result.baneDamage);
          if (entity.health <= 0) entity.dead = true;
        }
      }
      // Monster infuse: set elements to strong at end of monster turn (rules §6)
      processMonsterAbilityActions(state, m, 'deactivate', dataContext);
    }

    // Auto-advance: activate the next non-off, non-absent figure
    activateNextInOrder(state, dataContext);
  } else {
    // Activate: deactivate any currently active figure first
    deactivateAllFigures(state);

    // Now activate the target
    activateFigure(state, targetFigure, targetType, dataContext);
  }
}

/** Deactivate all currently active figures (without end-of-turn processing). */
function deactivateAllFigures(state: GameState): void {
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
}

/** Activate a figure and process turn-start effects (wound, regenerate). */
function activateFigure(
  state: GameState,
  figure: Character | Monster | ObjectiveContainer,
  type: 'character' | 'monster' | 'objectiveContainer',
  dataContext?: DataContext,
): void {
  figure.active = true;
  figure.off = false;

  if (type === 'character') {
    const c = figure as Character;

    // Long rest: Heal 2, self (per rules §3) — fires BEFORE wound/regenerate
    if (c.longRest) {
      const healBlockerNames = ['wound', 'wound_x', 'poison', 'poison_x', 'bane', 'brittle'];
      const hasHealBlocker = c.entityConditions.some(
        (cond) => healBlockerNames.includes(cond.name)
          && !cond.expired && cond.state !== 'expire' && cond.state !== 'removed',
      );
      if (hasHealBlocker) {
        // Heal consumed by removing conditions — no HP gained
        c.entityConditions = c.entityConditions.filter(
          (cond) => !(healBlockerNames.includes(cond.name)
            && !cond.expired && cond.state !== 'expire' && cond.state !== 'removed'),
        );
      } else {
        c.health = Math.min(c.maxHealth, c.health + 2);
      }
      c.longRest = false;
    }

    // Turn start: wound/regenerate processing
    applyTurnStartConditions(c);
    for (const summon of c.summons) {
      if (!summon.dead) {
        summon.active = true;
        summon.off = false;
        applyTurnStartConditions(summon);
      }
    }
  } else if (type === 'monster') {
    const m = figure as Monster;
    // Monster consume + summon: fires at activation (rules §6 — consume at first monster's turn)
    processMonsterAbilityActions(state, m, 'activate', dataContext);

    for (const entity of m.entities) {
      if (!entity.dead) {
        entity.active = true;
        entity.off = false;
        applyTurnStartConditions(entity);
        if (entity.health <= 0) entity.dead = true;
      }
    }
  }
}

/** Apply wound damage and regenerate healing at the start of a figure's turn.
 *  Order: Regenerate first (can clear wound/poison), then wound damage.
 *  Any heal removes wound and poison INSTEAD of healing HP. */
function applyTurnStartConditions(entity: { health: number; maxHealth: number; entityConditions: EntityCondition[] }): void {
  const hasRegen = entity.entityConditions.some(
    (c) => c.name === 'regenerate' && !c.expired && c.state !== 'expire' && c.state !== 'removed',
  );
  const hasWound = entity.entityConditions.some(
    (c) => (c.name === 'wound' || c.name === 'wound_x') && !c.expired && c.state !== 'expire' && c.state !== 'removed',
  );
  const hasPoison = entity.entityConditions.some(
    (c) => (c.name === 'poison' || c.name === 'poison_x') && !c.expired && c.state !== 'expire' && c.state !== 'removed',
  );

  // Regenerate: heal 1 at turn start — but any heal clears wound/poison INSTEAD of healing
  if (hasRegen) {
    if (hasWound || hasPoison) {
      // Heal consumed by removing wound/poison — no HP gained
      entity.entityConditions = entity.entityConditions.filter(
        (c) => c.name !== 'wound' && c.name !== 'wound_x' && c.name !== 'poison' && c.name !== 'poison_x',
      );
    } else {
      // No wound/poison — heal 1 HP
      entity.health = Math.min(entity.maxHealth, entity.health + 1);
    }
  }

  // Wound: suffer damage at turn start (only if wound still present — not cleared by regenerate)
  const stillHasPoison = entity.entityConditions.some(
    (c) => (c.name === 'poison' || c.name === 'poison_x') && !c.expired && c.state !== 'expire' && c.state !== 'removed',
  );
  for (const cond of entity.entityConditions) {
    if ((cond.name === 'wound' || cond.name === 'wound_x') && !cond.expired && cond.state !== 'expire' && cond.state !== 'removed') {
      let dmg = cond.value;
      if (stillHasPoison) dmg += 1; // Poison adds +1 to all damage
      entity.health = Math.max(0, entity.health - dmg);
    }
  }
}

/** Apply turn-start conditions to whichever figure is currently active (used after startRound). */
function applyTurnStartToActiveFigure(state: GameState): void {
  const activeChar = state.characters.find((c) => c.active);
  if (activeChar) {
    applyTurnStartConditions(activeChar);
    for (const summon of activeChar.summons) {
      if (!summon.dead) {
        summon.active = true;
        summon.off = false;
        applyTurnStartConditions(summon);
      }
    }
    return;
  }

  const activeMon = state.monsters.find((m) => m.active);
  if (activeMon) {
    for (const entity of activeMon.entities) {
      if (!entity.dead) {
        entity.active = true;
        entity.off = false;
        applyTurnStartConditions(entity);
        if (entity.health <= 0) entity.dead = true;
      }
    }
    return;
  }
}

/** Find the next non-off, non-absent figure in initiative order and activate it. */
function activateNextInOrder(state: GameState, dataContext?: DataContext): void {
  const order = getInitiativeOrder(state);
  const next = order.find((f) => !f.off && !f.absent);
  if (!next) return;

  // Find the actual figure and activate it
  const char = state.characters.find((c) => c.name === next.name && c.edition === next.edition);
  if (char) {
    activateFigure(state, char, 'character', dataContext);
    return;
  }

  const mon = state.monsters.find((m) => m.name === next.name && m.edition === next.edition);
  if (mon) {
    activateFigure(state, mon, 'monster', dataContext);
    return;
  }

  const obj = state.objectiveContainers.find((o) => o.name === next.name && o.edition === next.edition);
  if (obj) {
    activateFigure(state, obj, 'objectiveContainer', dataContext);
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
  payload: { monsterName: string; edition: string; entityNumber: number; type: string; maxHealth?: number },
  dataContext?: DataContext,
): void {
  const mon = state.monsters.find(
    (m) => m.name === payload.monsterName && m.edition === payload.edition,
  );
  if (!mon) return;

  // Resolve maxHealth: payload override > data lookup > 0
  let maxHealth = payload.maxHealth ?? 0;
  if (!maxHealth && dataContext) {
    maxHealth = dataContext.getMonsterMaxHealth(payload.edition, payload.monsterName, mon.level, payload.type);
  }

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
    health: maxHealth,
    maxHealth,
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
  dataContext?: DataContext,
): void {
  // Resolve maxHealth: data lookup > fallback 10
  let maxHealth = 10;
  if (dataContext) {
    const dataHP = dataContext.getCharacterMaxHealth(payload.edition, payload.name, payload.level);
    if (dataHP > 0) maxHealth = dataHP;
  }

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
    progress: (() => {
      const p = createEmptyProgress();
      if (payload.level > 1) p.experience = getMinXPForLevel(payload.level);
      return p;
    })(),
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

  recalculateLevel(state);
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

  recalculateLevel(state);
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

  recalculateLevel(state);
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

  recalculateLevel(state);
}

function handleToggleLongRest(
  state: GameState,
  payload: { characterName: string; edition: string },
): void {
  const char = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (!char) return;

  char.longRest = !char.longRest;
  if (char.longRest) {
    char.initiative = 99;
  }
}

function handleRenameCharacter(
  state: GameState,
  payload: { characterName: string; edition: string; title: string },
): void {
  const char = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (char) {
    char.title = payload.title;
  }
}

function handleSetLevelAdjustment(
  state: GameState,
  payload: { adjustment: number },
): void {
  state.levelAdjustment = Math.max(-2, Math.min(4, payload.adjustment));
  recalculateLevel(state);
}

function handleDrawLootCard(state: GameState): void {
  if (state.lootDeck.current >= state.lootDeck.cards.length) return;

  const drawnIndex = state.lootDeck.current;
  state.lootDeck.current += 1;

  // Auto-assign to active character if one exists
  const activeChar = state.characters.find(c => c.active && !c.exhausted && !c.absent);
  if (activeChar) {
    handleAssignLoot(state, {
      cardIndex: drawnIndex,
      characterName: activeChar.name,
      edition: activeChar.edition,
    });
  }
}

function handleAssignLoot(
  state: GameState,
  payload: { cardIndex: number; characterName: string; edition: string },
): void {
  const newChar = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (!newChar) return;

  // Check if this card is already assigned to another character — re-assignment
  for (const c of state.characters) {
    const idx = c.lootCards.indexOf(payload.cardIndex);
    if (idx !== -1) {
      c.lootCards.splice(idx, 1);
      c.loot = Math.max(0, c.loot - 1); // decrement loot action count
      break;
    }
  }

  // Skip if already assigned to same character
  if (newChar.lootCards.includes(payload.cardIndex)) return;

  // Assign card and increment loot action count
  newChar.lootCards.push(payload.cardIndex);
  newChar.loot += 1;
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

  const drawnCard = deck.cards[deck.current];
  deck.lastDrawn = drawnCard;

  if (drawnCard === 'bless' || drawnCard === 'curse') {
    // Bless/curse: remove from deck (returned to supply per rules §5)
    deck.cards.splice(deck.current, 1);
    // deck.current unchanged — next card shifted into this position
  } else {
    // Normal card: advance past it
    deck.current += 1;
  }
  deck.lastVisible = deck.current - 1;
}

// ── Battle Goal Deck ─────────────────────────────────────────────────────────

/**
 * Deal battle goals from the persistent deck. If no deck exists yet,
 * initializes it by fetching all goals for the edition and shuffling.
 * Returns dealt card IDs via state.battleGoalDeck.
 */
function handleDealBattleGoals(
  state: GameState,
  payload: { edition: string; count: number },
  dataContext?: DataContext,
): void {
  // Initialize deck if it doesn't exist yet (first scenario of campaign)
  if (!state.battleGoalDeck || state.battleGoalDeck.cards.length === 0) {
    const goals = dataContext?.getBattleGoals?.(payload.edition);
    if (!goals || goals.length === 0) return;
    const cardIds = goals.map(g => g.cardId);
    shuffleArray(cardIds);
    state.battleGoalDeck = { cards: cardIds, current: 0 };
  }

  const deck = state.battleGoalDeck;
  // If we're near the end of the deck, wrap around (all cards have been dealt at least once)
  if (deck.current + payload.count > deck.cards.length) {
    deck.current = 0;
  }
  // Advance the pointer — the phone reads cards[current..current+count] for its dealt hand
  deck.current += payload.count;
}

/**
 * Return unused battle goal cards to the bottom of the deck.
 * Per rules: unkept cards go to the bottom (not reshuffled).
 */
function handleReturnBattleGoals(
  state: GameState,
  payload: { cardIds: string[] },
): void {
  if (!state.battleGoalDeck) return;
  const deck = state.battleGoalDeck;

  // Remove returned cards from their current position and push to end
  for (const cardId of payload.cardIds) {
    const idx = deck.cards.indexOf(cardId);
    if (idx >= 0) {
      deck.cards.splice(idx, 1);
      deck.cards.push(cardId);
      // Adjust current pointer if we removed a card before it
      if (idx < deck.current) deck.current--;
    }
  }
}

/**
 * Parse scenario rules and apply deck overrides to spawned monsters.
 * E.g., FH scenario 0: hounds use "hound-scenario-0" deck instead of "hound".
 */
function applyScenarioRuleDeckOverrides(state: GameState, scenario: ScenarioData): void {
  if (!scenario.rules || !Array.isArray(scenario.rules)) return;

  for (const rule of scenario.rules as any[]) {
    if (!rule.statEffects || !Array.isArray(rule.statEffects)) continue;
    for (const effect of rule.statEffects) {
      const ident = effect.identifier;
      const deckOverride = effect.statEffect?.deck;
      if (!ident || !deckOverride || ident.type !== 'monster') continue;

      // Find matching monster groups and apply the deck override
      for (const monster of state.monsters) {
        if (monster.name === ident.name && monster.edition === (ident.edition || state.scenario?.edition)) {
          monster.overrideDeck = deckOverride;
        }
      }
    }
  }
}

function handleSetScenario(
  state: GameState,
  payload: { scenarioIndex: string; edition: string; group?: string },
  dataContext?: DataContext,
): void {
  state.scenario = {
    index: payload.scenarioIndex,
    edition: payload.edition,
    group: payload.group,
    isCustom: false,
    custom: '',
    revealedRooms: [],
  };
  state.round = 1;
  state.state = 'draw';
  state.monsters = [];
  state.objectiveContainers = [];
  // Remove monster/objective figures but keep character figures
  state.figures = state.figures.filter((figStr) => {
    return state.characters.some((c) => `${c.edition}-${c.name}` === figStr);
  });

  // Reset character scenario-specific state (preserve XP, gold, level, title)
  for (const char of state.characters) {
    char.initiative = 0;
    char.health = char.maxHealth;
    char.exhausted = false;
    char.longRest = false;
    char.entityConditions = [];
    char.summons = [];
    char.active = false;
    char.off = false;
    char.absent = false;
    // Reset in-scenario counters
    char.experience = 0;
    char.loot = 0;
    char.lootCards = [];
    char.treasures = [];
  }

  // Clear any previous scenario finish state
  state.finish = undefined as any;

  // Enable auto-level calc for new scenarios and recalculate
  state.levelCalculation = true;
  recalculateLevel(state);

  // Populate standard 20-card attack modifier decks
  state.monsterAttackModifierDeck = buildStandardModifierDeck();
  state.allyAttackModifierDeck = buildStandardModifierDeck();

  // Auto-spawn Room 1 monsters if data context available
  if (dataContext) {
    const scenario = dataContext.getScenario(payload.edition, payload.scenarioIndex);
    if (scenario) {
      const playerCount = getPlayerCount(state.characters);
      const initialRoom = scenario.rooms.find((r) => r.initial);
      if (initialRoom) {
        spawnRoomMonsters(state, payload.edition, scenario, initialRoom.roomNumber, playerCount, dataContext);
        state.scenario.revealedRooms!.push(initialRoom.roomNumber);
      }

      // Apply scenario rule stat effects (e.g., deck overrides)
      applyScenarioRuleDeckOverrides(state, scenario);

      // Build loot deck from scenario config (FH)
      if (scenario.lootDeckConfig && Object.keys(scenario.lootDeckConfig).length > 0) {
        state.lootDeck = buildLootDeck(scenario.lootDeckConfig);
      } else {
        state.lootDeck = { current: 0, cards: [], active: false };
      }
    }
  }
}

function handleRevealRoom(
  state: GameState,
  payload: { roomId: number },
  dataContext?: DataContext,
): void {
  if (!state.scenario) return;
  if (!state.scenario.revealedRooms) {
    state.scenario.revealedRooms = [];
  }
  if (state.scenario.revealedRooms.includes(payload.roomId)) return;

  state.scenario.revealedRooms.push(payload.roomId);

  // Auto-spawn monsters for the revealed room
  if (dataContext) {
    const scenario = dataContext.getScenario(state.scenario.edition, state.scenario.index);
    if (scenario) {
      // Track existing monster group names before spawning
      const existingGroups = new Set(
        state.monsters.map((m) => `${m.edition}-${m.name}`),
      );

      const playerCount = getPlayerCount(state.characters);
      spawnRoomMonsters(state, state.scenario.edition, scenario, payload.roomId, playerCount, dataContext);

      // During play phase, draw ability cards for newly spawned monster groups
      // so they can act this round (per rules §7: revealed monsters act during
      // the round they appear)
      if (state.state === 'next') {
        const newGroupNames = new Set(
          state.monsters
            .filter((m) => !existingGroups.has(`${m.edition}-${m.name}`))
            .map((m) => `${m.edition}-${m.name}`),
        );
        if (newGroupNames.size > 0) {
          drawAbilitiesForNewMonsters(state, newGroupNames, dataContext);
        }
      }
    }
  }
}

function handleSetLevel(
  state: GameState,
  payload: { level: number },
): void {
  state.level = payload.level;
  state.levelCalculation = false; // manual override disables auto-calc
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

  // Restore undoStack from current state (snapshot has it stripped to prevent bloat)
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

// ── Player Sheet (Phase T0a) ───────────────────────────────────────────────

/**
 * Allowed character-progress fields for `setCharacterProgress`. Expand
 * deliberately — every field here is phone-writable. validateCommand mirrors
 * this list and type-checks the value shape.
 */
const SET_CHARACTER_PROGRESS_FIELDS = {
  sheetIntroSeen: 'boolean',
  notes: 'string',
} as const;

export function isSetCharacterProgressField(
  field: string,
): field is keyof typeof SET_CHARACTER_PROGRESS_FIELDS {
  return field in SET_CHARACTER_PROGRESS_FIELDS;
}

export function setCharacterProgressFieldExpectsType(
  field: keyof typeof SET_CHARACTER_PROGRESS_FIELDS,
): 'boolean' | 'string' {
  return SET_CHARACTER_PROGRESS_FIELDS[field];
}

function handleSetCharacterProgress(
  state: GameState,
  payload: {
    characterName: string;
    edition: string;
    field: 'sheetIntroSeen' | 'notes';
    value: boolean | string;
  },
): void {
  const char = state.characters.find(
    (c) => c.name === payload.characterName && c.edition === payload.edition,
  );
  if (!char) return;
  // Field allow-list already enforced by validateCommand; this is defence-in-depth.
  if (!isSetCharacterProgressField(payload.field)) return;
  (char.progress as unknown as Record<string, unknown>)[payload.field] = payload.value;
}

function buildLootDeck(config: Record<string, number>): LootDeck {
  const cards: LootCard[] = [];
  let cardId = 1;

  for (const [type, count] of Object.entries(config)) {
    if (count <= 0) continue;
    const lootType = type as LootType;
    const isMoney = lootType === 'money';

    for (let i = 0; i < count; i++) {
      const coinValue = isMoney ? (i % 3) + 1 : 0;
      cards.push({
        type: lootType,
        cardId: cardId++,
        value4P: isMoney ? coinValue : 1,
        value3P: isMoney ? coinValue : 1,
        value2P: isMoney ? Math.max(1, coinValue - 1) : 1,
        enhancements: 0,
      });
    }
  }

  // Fisher-Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return { current: 0, cards, active: true };
}

// ── Phase T1: scenario end rewards snapshot ────────────────────────────────

/**
 * Check whether a state has Frosthaven-style loot/resources.
 * FH uses the loot-deck card system; GH uses a flat `char.loot` counter.
 */
function isFHLootContext(state: GameState): boolean {
  return (state.edition === 'fh' || state.party?.edition === 'fh');
}

/**
 * Build the ScenarioFinishData snapshot at `prepareScenarioEnd` time.
 * Reads live state + DataContext; never mutates.
 *
 * See docs/GAME_RULES_REFERENCE.md §11 (rewards) and §12 (XP thresholds).
 */
function buildScenarioFinishData(
  state: GameState,
  outcome: 'victory' | 'defeat',
  _dataContext?: DataContext,
): ScenarioFinishData {
  const isVictory = outcome === 'victory';
  const level = state.level ?? 0;
  const { bonusXP: bonusXPFull, goldConversion } = deriveLevelValues(level);
  const bonusXP = isVictory ? bonusXPFull : 0;
  const playerCount = getPlayerCount(state.characters);

  const characters: ScenarioFinishCharacterReward[] = state.characters.map((char) => {
    const scenarioXP = char.experience || 0;
    const totalXPGained = scenarioXP + bonusXP;
    const careerXPBefore = char.progress?.experience ?? 0;
    const careerGoldBefore = char.progress?.gold ?? 0;

    // Gold + resources (FH via loot cards, GH via flat counter)
    let totalCoins = 0;
    const resources: Partial<Record<LootType, number>> = {};
    const lootCardIndexes = char.lootCards ? [...char.lootCards] : [];
    if (lootCardIndexes.length > 0 && state.lootDeck?.cards?.length > 0) {
      for (const idx of lootCardIndexes) {
        const card = state.lootDeck.cards[idx];
        if (!card) continue;
        if (card.type === 'money') {
          totalCoins += playerCount <= 2 ? card.value2P
            : playerCount === 3 ? card.value3P
            : card.value4P;
        } else {
          resources[card.type] = (resources[card.type] ?? 0) + 1;
        }
      }
    } else {
      totalCoins = char.loot || 0;
    }
    const goldGained = totalCoins * goldConversion;

    // XP thresholds — rules §12
    const currentLevel = char.level ?? 1;
    const currentFloor = getMinXPForLevel(currentLevel);
    const nextThreshold = currentLevel >= 9 ? null : getMinXPForLevel(currentLevel + 1);

    return {
      name: char.name,
      edition: char.edition,
      title: char.title || char.name,
      scenarioXP,
      bonusXP,
      totalXPGained,
      careerXPBefore,
      careerXPAfter: careerXPBefore + totalXPGained,
      scenarioLevel: level,
      goldConversion,
      totalCoins,
      goldGained,
      careerGoldBefore,
      careerGoldAfter: careerGoldBefore + goldGained,
      resources,
      lootCardIndexes,
      treasuresPending: char.treasures ? [...char.treasures] : [],
      treasuresClaimed: [],
      xpThresholds: { currentLevel, currentFloor, nextThreshold },
      battleGoalChecks: 0,
      dismissed: false,
    };
  });

  const isFH = isFHLootContext(state);
  const inspirationGained = (isFH && isVictory)
    ? Math.max(0, 4 - Math.max(playerCount, 1))
    : undefined;

  return {
    outcome,
    scenarioIndex: state.scenario?.index ?? '',
    scenarioEdition: state.scenario?.edition ?? state.edition ?? '',
    scenarioLevel: level,
    characters,
    ...(inspirationGained !== undefined ? { inspirationGained } : {}),
    createdAtRevision: state.revision,
  };
}

/**
 * Parse a treasure reward string from the reference DB and apply the MVP
 * reward types to character progress. Grammar is pipe-separated entries of
 * `key:value` (e.g. `goldFh:15|experience:5`).
 *
 * Returns a human-readable summary of what was applied for UI display.
 */
function applyTreasureReward(char: Character, rewardText: string): string {
  const notes: string[] = [];
  const entries = rewardText.split('|').map((s) => s.trim()).filter(Boolean);

  for (const entry of entries) {
    const colonIdx = entry.indexOf(':');
    const key = colonIdx >= 0 ? entry.slice(0, colonIdx) : entry;
    const value = colonIdx >= 0 ? entry.slice(colonIdx + 1) : '';

    switch (key) {
      case 'gold':
      case 'goldFh':
      case 'goldGh': {
        const n = parseInt(value, 10);
        if (Number.isFinite(n)) {
          char.progress.gold = (char.progress.gold ?? 0) + n;
          notes.push(`+${n} gold`);
        }
        break;
      }
      case 'experience': {
        const n = parseInt(value, 10);
        if (Number.isFinite(n)) {
          char.progress.experience = (char.progress.experience ?? 0) + n;
          notes.push(`+${n} XP`);
        }
        break;
      }
      case 'item':
      case 'itemFh':
      case 'itemGh':
      case 'itemBlueprint': {
        if (value) {
          if (!char.progress.items) char.progress.items = [];
          char.progress.items.push({ name: value, edition: char.edition });
          notes.push(`Item ${value}`);
        }
        break;
      }
      case 'resource': {
        // format: "<type>-N" e.g. "lumber-3"
        const dashIdx = value.lastIndexOf('-');
        if (dashIdx > 0) {
          const resType = value.slice(0, dashIdx) as LootType;
          const n = parseInt(value.slice(dashIdx + 1), 10);
          if (Number.isFinite(n)) {
            if (!char.progress.loot) char.progress.loot = {};
            char.progress.loot[resType] = (char.progress.loot[resType] ?? 0) + n;
            notes.push(`+${n} ${resType}`);
          }
        }
        break;
      }
      case 'battleGoal': {
        const n = parseInt(value, 10);
        if (Number.isFinite(n)) {
          char.progress.battleGoals = (char.progress.battleGoals ?? 0) + n;
          notes.push(`+${n} battle goal check${n === 1 ? '' : 's'}`);
        }
        break;
      }
      default:
        // lootCards / randomItemBlueprint / randomScenarioFh / custom / condition / damage
        // surface as-is for manual resolution by the table.
        notes.push(entry);
    }
  }
  return notes.join(' · ');
}

function handleCompleteScenario(
  state: GameState,
  payload: { outcome: 'victory' | 'defeat' },
): void {
  const isVictory = payload.outcome === 'victory';
  const snapshot = state.finishData;
  const level = state.level ?? 0;
  const { bonusXP: bonusXPFull, goldConversion } = deriveLevelValues(level);
  const bonusXP = isVictory ? bonusXPFull : 0;
  const playerCount = getPlayerCount(state.characters);

  for (const char of state.characters) {
    if (!char.progress.loot) char.progress.loot = {};

    if (snapshot) {
      // T1: read pre-computed totals from the snapshot so GM/phone mutations
      // during the pending window (e.g. battle-goal checks) are reflected.
      const row = snapshot.characters.find(
        (r) => r.name === char.name && r.edition === char.edition,
      );
      if (row) {
        char.progress.experience += row.totalXPGained;
        char.progress.gold += row.goldGained;
        for (const [type, n] of Object.entries(row.resources)) {
          if (!n) continue;
          char.progress.loot[type as LootType] =
            (char.progress.loot[type as LootType] ?? 0) + n;
        }
        if (isVictory) {
          char.progress.battleGoals =
            (char.progress.battleGoals ?? 0) + (row.battleGoalChecks ?? 0);
          // Apply claimed treasures (once — see validateCommand guard)
          if (row.treasuresClaimed?.length) {
            for (const tid of row.treasuresClaimed) {
              const resolved = row.treasuresResolved?.[tid] ?? '';
              if (resolved) applyTreasureReward(char, resolved);
            }
          }
        }
      }
    } else {
      // Fallback (pre-T1 save with no snapshot): derive live.
      const scenarioXP = char.experience || 0;
      char.progress.experience += scenarioXP + bonusXP;

      let totalCoins = 0;
      if (char.lootCards && char.lootCards.length > 0 && state.lootDeck?.cards?.length > 0) {
        for (const cardIndex of char.lootCards) {
          const card = state.lootDeck.cards[cardIndex];
          if (!card) continue;
          if (card.type === 'money') {
            const coinValue = playerCount <= 2 ? card.value2P
              : playerCount === 3 ? card.value3P
              : card.value4P;
            totalCoins += coinValue;
          } else {
            char.progress.loot[card.type] = (char.progress.loot[card.type] || 0) + 1;
          }
        }
      } else {
        totalCoins = char.loot || 0;
      }
      char.progress.gold += totalCoins * goldConversion;
    }

    // Reset in-scenario counters
    char.experience = 0;
    char.loot = 0;
    char.lootCards = [];
    char.treasures = [];
  }

  // FH inspiration (rules §11) — victory only
  if (snapshot && snapshot.inspirationGained && snapshot.inspirationGained > 0) {
    if (!state.party) state.party = {} as any;
    state.party.inspiration = (state.party.inspiration ?? 0) + snapshot.inspirationGained;
  }

  // Record scenario completion in party data
  if (isVictory && state.scenario) {
    if (!state.party) state.party = {} as any;
    if (!state.party.scenarios) state.party.scenarios = [];
    const alreadyComplete = state.party.scenarios.some(
      (s: any) => s.index === state.scenario!.index && s.edition === state.scenario!.edition,
    );
    if (!alreadyComplete) {
      state.party.scenarios.push({
        index: state.scenario.index,
        edition: state.scenario.edition,
        isCustom: false,
        custom: '',
      } as any);
    }
  }

  // Clear scenario state — monsters, objectives, figures list
  state.monsters = [];
  state.objectiveContainers = [];
  state.figures = state.figures.filter((figStr) =>
    state.characters.some((c) => `${c.edition}-${c.name}` === figStr),
  );

  // Reset character combat state (preserve campaign progress)
  for (const char of state.characters) {
    char.initiative = 0;
    char.health = char.maxHealth;
    char.exhausted = false;
    char.longRest = false;
    char.entityConditions = [];
    char.summons = [];
    char.active = false;
    char.off = false;
  }

  // Reset round and phase
  state.state = 'draw';
  state.round = 0;

  // Clear element board
  if (state.elementBoard) {
    for (const el of state.elementBoard) {
      el.state = 'inert';
    }
  }

  // Store finish state and transition to town phase.
  // NOTE: finishData is intentionally preserved through the town transition
  // so rewards overlays stay visible until completeTownPhase fires.
  state.finish = isVictory ? 'success' : 'failure';
  state.mode = 'town';
}

// ── Phase T1 command handlers ─────────────────────────────────────────────

function handleSetBattleGoalComplete(
  state: GameState,
  payload: { characterName: string; edition: string; checks: number },
): void {
  if (!state.finishData) return;
  const row = state.finishData.characters.find(
    (r) => r.name === payload.characterName && r.edition === payload.edition,
  );
  if (!row) return;
  const clamped = Math.max(0, Math.min(3, Math.floor(payload.checks)));
  row.battleGoalChecks = clamped;
}

function handleClaimTreasure(
  state: GameState,
  payload: { characterName: string; edition: string; treasureId: string },
  dataContext?: DataContext,
): void {
  if (!state.finishData) return;
  const row = state.finishData.characters.find(
    (r) => r.name === payload.characterName && r.edition === payload.edition,
  );
  if (!row) return;
  const idx = row.treasuresPending.indexOf(payload.treasureId);
  if (idx < 0) return;
  row.treasuresPending.splice(idx, 1);
  if (!row.treasuresClaimed.includes(payload.treasureId)) {
    row.treasuresClaimed.push(payload.treasureId);
  }
  const treasure = dataContext?.getTreasure?.(row.edition, payload.treasureId);
  if (treasure?.reward) {
    if (!row.treasuresResolved) row.treasuresResolved = {};
    row.treasuresResolved[payload.treasureId] = treasure.reward;
  }
}

function handleDismissRewards(
  state: GameState,
  payload: { characterName: string; edition: string },
): void {
  if (!state.finishData) return;
  const row = state.finishData.characters.find(
    (r) => r.name === payload.characterName && r.edition === payload.edition,
  );
  if (!row) return;
  row.dismissed = true;
}

function handleAddModifierCard(
  state: GameState,
  payload: { deck: 'monster' | 'ally' | { character: string; edition: string }; cardType: 'bless' | 'curse' },
): void {
  const deck = resolveModifierDeck(state, payload.deck);
  if (!deck) return;
  // Insert the bless/curse card at a random position in the undrawn portion
  const insertPos = deck.current + Math.floor(Math.random() * (deck.cards.length - deck.current + 1));
  deck.cards.splice(insertPos, 0, payload.cardType);
}

function handleRemoveModifierCard(
  state: GameState,
  payload: { deck: 'monster' | 'ally' | { character: string; edition: string }; cardType: 'bless' | 'curse' },
): void {
  const deck = resolveModifierDeck(state, payload.deck);
  if (!deck) return;
  // Remove one instance of the card type from the undrawn portion (after current)
  for (let i = deck.current; i < deck.cards.length; i++) {
    if (deck.cards[i] === payload.cardType) {
      deck.cards.splice(i, 1);
      return;
    }
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
