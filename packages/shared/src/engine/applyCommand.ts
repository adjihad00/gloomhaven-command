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
} from '../types/gameState.js';
import type { Command, CommandTarget } from '../types/commands.js';
import type { StateChange } from '../types/protocol.js';
import type { ScenarioData, MonsterData, MonsterLevelStats, MonsterAbilityDeckData, ResolvedSpawn } from '../data/types.js';
import { deepClone } from './turnOrder.js';
import { canAdvancePhase, startRound, endRound, getInitiativeOrder } from './turnOrder.js';
import { toggleCondition, processConditionEndOfTurn } from '../utils/conditions.js';
import { diffStates } from './diffStates.js';
import { importGhsState as importGhs, buildStandardModifierDeck } from '../utils/ghsCompat.js';
import { getPlayerCount, calculateScenarioLevel, getMinXPForLevel } from '../data/levelCalculation.js';

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
  getMonster(edition: string, name: string): MonsterData | null;
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
      handleToggleTurn(after, command.payload);
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
      break;
    case 'cancelScenarioEnd':
      after.finish = undefined;
      break;
    case 'completeScenario':
      handleCompleteScenario(after, command.payload);
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
  return endRound(state);
}

// ── Auto-draw monster ability cards ─────────────────────────────────────────

function drawMonsterAbilities(state: GameState, dataContext: DataContext): void {
  // Group monsters by their shared ability deck
  const deckGroups = new Map<string, Monster[]>();

  for (const monster of state.monsters) {
    // Only draw for monsters with living entities
    if (!monster.entities.some((e) => !e.dead)) continue;

    const monsterData = dataContext.getMonster(monster.edition, monster.name);
    const deckName = monsterData?.deck || monster.name;
    const key = `${monster.edition}:${deckName}`;

    if (!deckGroups.has(key)) {
      deckGroups.set(key, []);
    }
    deckGroups.get(key)!.push(monster);
  }

  // For each unique deck, draw one card and apply to all groups sharing it
  for (const [, monsters] of deckGroups) {
    const master = monsters[0];
    const deckData = dataContext.getMonsterDeckForMonster(master.edition, master.name);
    if (!deckData || deckData.abilities.length === 0) continue;

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
    if (!drawnCard) continue;

    // Apply to all monsters sharing this deck
    for (const monster of monsters) {
      monster.ability = cardIndex;
      monster.lastDraw = master.lastDraw;
      monster.abilities = [...master.abilities];
      monster.initiative = drawnCard.initiative;
    }
  }
}

// ── End-of-round shuffle tracking ───────────────────────────────────────────

function handleEndOfRoundShuffle(state: GameState, dataContext: DataContext): void {
  // Track which decks need shuffling (by edition:deckName)
  const shuffledDecks = new Set<string>();

  for (const monster of state.monsters) {
    if (monster.ability < 0) continue;

    const deckData = dataContext.getMonsterDeckForMonster(monster.edition, monster.name);
    if (!deckData) continue;

    const drawnCard = deckData.abilities[monster.ability];
    if (drawnCard?.shuffle) {
      const monsterData = dataContext.getMonster(monster.edition, monster.name);
      const deckName = monsterData?.deck || monster.name;
      shuffledDecks.add(`${monster.edition}:${deckName}`);
    }
  }

  // Reshuffle decks that had a shuffle card drawn
  if (shuffledDecks.size > 0) {
    for (const monster of state.monsters) {
      const monsterData = dataContext.getMonster(monster.edition, monster.name);
      const deckName = monsterData?.deck || monster.name;
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
    }

    // Auto-advance: activate the next non-off, non-absent figure
    activateNextInOrder(state);
  } else {
    // Activate: deactivate any currently active figure first
    deactivateAllFigures(state);

    // Now activate the target
    activateFigure(state, targetFigure, targetType);
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
function activateNextInOrder(state: GameState): void {
  const order = getInitiativeOrder(state);
  const next = order.find((f) => !f.off && !f.absent);
  if (!next) return;

  // Find the actual figure and activate it
  const char = state.characters.find((c) => c.name === next.name && c.edition === next.edition);
  if (char) {
    activateFigure(state, char, 'character');
    return;
  }

  const mon = state.monsters.find((m) => m.name === next.name && m.edition === next.edition);
  if (mon) {
    activateFigure(state, mon, 'monster');
    return;
  }

  const obj = state.objectiveContainers.find((o) => o.name === next.name && o.edition === next.edition);
  if (obj) {
    activateFigure(state, obj, 'objectiveContainer');
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
  state.round = 0;
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
      const playerCount = getPlayerCount(state.characters);
      spawnRoomMonsters(state, state.scenario.edition, scenario, payload.roomId, playerCount, dataContext);
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

function handleCompleteScenario(
  state: GameState,
  payload: { outcome: 'victory' | 'defeat' },
): void {
  const isVictory = payload.outcome === 'victory';
  const level = state.level ?? 0;
  const bonusXP = isVictory ? (4 + 2 * level) : 0;
  const goldConversion = [2, 2, 3, 3, 4, 4, 5, 6][level] ?? 2;

  const playerCount = getPlayerCount(state.characters);

  for (const char of state.characters) {
    // Transfer in-scenario XP → total XP (always, even on defeat per rules)
    const scenarioXP = char.experience || 0;
    char.progress.experience += scenarioXP + bonusXP;

    // Transfer loot → gold and resources
    let totalCoins = 0;
    if (!char.progress.loot) char.progress.loot = {};

    if (char.lootCards && char.lootCards.length > 0 && state.lootDeck?.cards?.length > 0) {
      // FH system: derive gold and resources from loot cards
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
      // GH system: char.loot is a simple coin count (each = 1 coin)
      totalCoins = char.loot || 0;
    }

    // Convert total coins to gold at scenario level rate
    char.progress.gold += totalCoins * goldConversion;

    // Reset in-scenario counters
    char.experience = 0;
    char.loot = 0;
    char.lootCards = [];
  }

  // Record scenario completion in party data
  if (isVictory && state.scenario) {
    if (!state.party) {
      state.party = {} as any;
    }
    if (!state.party.scenarios) {
      state.party.scenarios = [];
    }
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

  // Store finish state
  state.finish = isVictory ? 'success' : 'failure';
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
