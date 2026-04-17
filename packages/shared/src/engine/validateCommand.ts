// Command validation — validates a command CAN be applied to the current state
import type { GameState, Character, Monster } from '../types/gameState.js';
import type { Command, CommandTarget } from '../types/commands.js';
import { canAdvancePhase } from './turnOrder.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const OK: ValidationResult = { valid: true };

function fail(error: string): ValidationResult {
  return { valid: false, error };
}

// ── Target resolution helpers ───────────────────────────────────────────────

function findCharacter(state: GameState, name: string, edition: string): Character | undefined {
  return state.characters.find((c) => c.name === name && c.edition === edition);
}

function findMonster(state: GameState, name: string, edition: string): Monster | undefined {
  return state.monsters.find((m) => m.name === name && m.edition === edition);
}

function validateTarget(state: GameState, target: CommandTarget): ValidationResult {
  switch (target.type) {
    case 'character': {
      const char = findCharacter(state, target.name, target.edition);
      if (!char) return fail(`Character "${target.name}" not found`);
      return OK;
    }
    case 'monster': {
      const mon = findMonster(state, target.name, target.edition);
      if (!mon) return fail(`Monster "${target.name}" not found`);
      const entity = mon.entities.find((e) => e.number === target.entityNumber);
      if (!entity) return fail(`Monster entity #${target.entityNumber} not found`);
      return OK;
    }
    case 'summon': {
      const char = findCharacter(state, target.characterName, target.characterEdition);
      if (!char) return fail(`Character "${target.characterName}" not found`);
      const summon = char.summons.find((s) => s.uuid === target.summonUuid);
      if (!summon) return fail(`Summon "${target.summonUuid}" not found`);
      return OK;
    }
    case 'objective': {
      const obj = state.objectiveContainers.find((o) => o.uuid === target.uuid);
      if (!obj) return fail(`Objective "${target.uuid}" not found`);
      const entity = obj.entities.find((e) => e.number === target.entityNumber);
      if (!entity) return fail(`Objective entity #${target.entityNumber} not found`);
      return OK;
    }
  }
}

function validateTargetAlive(state: GameState, target: CommandTarget): ValidationResult {
  const exists = validateTarget(state, target);
  if (!exists.valid) return exists;

  switch (target.type) {
    case 'character': {
      const char = findCharacter(state, target.name, target.edition)!;
      if (char.exhausted) return fail('Character is exhausted');
      return OK;
    }
    case 'monster': {
      const mon = findMonster(state, target.name, target.edition)!;
      const entity = mon.entities.find((e) => e.number === target.entityNumber)!;
      if (entity.dead) return fail('Monster entity is dead');
      return OK;
    }
    case 'summon': {
      const char = findCharacter(state, target.characterName, target.characterEdition)!;
      const summon = char.summons.find((s) => s.uuid === target.summonUuid)!;
      if (summon.dead) return fail('Summon is dead');
      return OK;
    }
    case 'objective': {
      const obj = state.objectiveContainers.find((o) => o.uuid === target.uuid)!;
      const entity = obj.entities.find((e) => e.number === target.entityNumber)!;
      if (entity.dead) return fail('Objective entity is dead');
      return OK;
    }
  }
}

// ── Modifier deck resolution ────────────────────────────────────────────────

function validateModifierDeck(
  state: GameState,
  deck: 'monster' | 'ally' | { character: string; edition: string },
): ValidationResult {
  if (deck === 'monster' || deck === 'ally') return OK;
  const char = findCharacter(state, deck.character, deck.edition);
  if (!char) return fail(`Character "${deck.character}" not found for modifier deck`);
  return OK;
}

// ── Main validator ──────────────────────────────────────────────────────────

export function validateCommand(state: GameState, command: Command): ValidationResult {
  switch (command.action) {
    // ── Core gameplay ─────────────────────────────────────────────────────
    case 'changeHealth':
      return validateTargetAlive(state, command.payload.target);

    case 'changeMaxHealth':
      return validateTarget(state, command.payload.target);

    case 'toggleCondition':
      return validateTargetAlive(state, command.payload.target);

    case 'setInitiative': {
      const char = findCharacter(state, command.payload.characterName, command.payload.edition);
      if (!char) return fail(`Character "${command.payload.characterName}" not found`);
      if (char.absent) return fail('Character is absent');
      if (command.payload.value < 0 || command.payload.value > 99) return fail('Initiative must be 0-99');
      if (state.state !== 'draw') return fail('Can only set initiative during draw phase');
      return OK;
    }

    case 'advancePhase':
      return canAdvancePhase(state) ? OK : fail('Cannot advance phase');

    case 'toggleTurn': {
      const fig = command.payload.figure;
      const figStr = `${fig.edition}-${fig.name}`;
      if (!state.figures.includes(figStr)) return fail(`Figure "${fig.name}" not found`);
      if (state.state === 'draw') return fail('Cannot toggle turns during draw phase');
      return OK;
    }

    // ── Element ───────────────────────────────────────────────────────────
    case 'moveElement': {
      const el = state.elementBoard.find((e) => e.type === command.payload.element);
      if (!el) return fail(`Element "${command.payload.element}" not found on board`);
      return OK;
    }

    // ── Entity management ─────────────────────────────────────────────────
    case 'addEntity': {
      const mon = findMonster(state, command.payload.monsterName, command.payload.edition);
      if (!mon) return fail(`Monster "${command.payload.monsterName}" not found`);
      const existing = mon.entities.find((e) => e.number === command.payload.entityNumber);
      if (existing) return fail(`Entity #${command.payload.entityNumber} already exists`);
      return OK;
    }

    case 'removeEntity': {
      const mon = findMonster(state, command.payload.monsterName, command.payload.edition);
      if (!mon) return fail(`Monster "${command.payload.monsterName}" not found`);
      const entity = mon.entities.find(
        (e) => e.number === command.payload.entityNumber && e.type === command.payload.type,
      );
      if (!entity) return fail(`Entity #${command.payload.entityNumber} not found`);
      return OK;
    }

    case 'addCharacter': {
      const existing = findCharacter(state, command.payload.name, command.payload.edition);
      if (existing) return fail(`Character "${command.payload.name}" already exists`);
      return OK;
    }

    case 'removeCharacter': {
      const char = findCharacter(state, command.payload.name, command.payload.edition);
      if (!char) return fail(`Character "${command.payload.name}" not found`);
      return OK;
    }

    case 'addSummon': {
      const char = findCharacter(state, command.payload.characterName, command.payload.edition);
      if (!char) return fail(`Character "${command.payload.characterName}" not found`);
      return OK;
    }

    case 'removeSummon': {
      const char = findCharacter(state, command.payload.characterName, command.payload.edition);
      if (!char) return fail(`Character "${command.payload.characterName}" not found`);
      const summon = char.summons.find((s) => s.uuid === command.payload.summonUuid);
      if (!summon) return fail(`Summon "${command.payload.summonUuid}" not found`);
      return OK;
    }

    case 'addMonsterGroup': {
      const existing = findMonster(state, command.payload.name, command.payload.edition);
      if (existing) return fail(`Monster group "${command.payload.name}" already exists`);
      return OK;
    }

    case 'removeMonsterGroup': {
      const mon = findMonster(state, command.payload.name, command.payload.edition);
      if (!mon) return fail(`Monster group "${command.payload.name}" not found`);
      return OK;
    }

    case 'toggleExhausted': {
      const char = findCharacter(state, command.payload.characterName, command.payload.edition);
      if (!char) return fail(`Character "${command.payload.characterName}" not found`);
      return OK;
    }

    case 'toggleAbsent': {
      const char = findCharacter(state, command.payload.characterName, command.payload.edition);
      if (!char) return fail(`Character "${command.payload.characterName}" not found`);
      return OK;
    }

    case 'toggleLongRest': {
      const char = findCharacter(state, command.payload.characterName, command.payload.edition);
      if (!char) return fail(`Character "${command.payload.characterName}" not found`);
      return OK;
    }

    case 'renameCharacter': {
      const char = findCharacter(state, command.payload.characterName, command.payload.edition);
      if (!char) return fail(`Character "${command.payload.characterName}" not found`);
      return OK;
    }

    case 'setLevelAdjustment':
      return OK;

    // ── Deck commands ─────────────────────────────────────────────────────
    case 'drawLootCard':
      if (state.lootDeck.current >= state.lootDeck.cards.length) {
        return fail('No loot cards remaining');
      }
      return OK;

    case 'assignLoot': {
      if (command.payload.cardIndex < 0 || command.payload.cardIndex >= state.lootDeck.cards.length) {
        return fail('Invalid card index');
      }
      const char = findCharacter(state, command.payload.characterName, command.payload.edition);
      if (!char) return fail(`Character "${command.payload.characterName}" not found`);
      return OK;
    }

    case 'drawMonsterAbility': {
      const mon = findMonster(state, command.payload.monsterName, command.payload.edition);
      if (!mon) return fail(`Monster "${command.payload.monsterName}" not found`);
      if (!mon.abilities || mon.abilities.length === 0) return fail('Monster has no abilities');
      return OK;
    }

    case 'shuffleMonsterAbilities': {
      const mon = findMonster(state, command.payload.monsterName, command.payload.edition);
      if (!mon) return fail(`Monster "${command.payload.monsterName}" not found`);
      return OK;
    }

    case 'shuffleModifierDeck':
      return validateModifierDeck(state, command.payload.deck);

    case 'drawModifierCard': {
      const deckValid = validateModifierDeck(state, command.payload.deck);
      if (!deckValid.valid) return deckValid;
      const deck = resolveModifierDeck(state, command.payload.deck);
      if (deck && deck.current >= deck.cards.length) return fail('No modifier cards remaining');
      return OK;
    }

    case 'addModifierCard':
      return validateModifierDeck(state, command.payload.deck);

    case 'removeModifierCard': {
      const valid = validateModifierDeck(state, command.payload.deck);
      if (!valid.valid) return valid;
      const d = resolveModifierDeck(state, command.payload.deck);
      if (!d) return fail('Deck not found');
      const hasCard = d.cards.slice(d.current).some(c => c === command.payload.cardType);
      if (!hasCard) return fail(`No ${command.payload.cardType} card to remove`);
      return OK;
    }

    // ── Scenario/campaign ─────────────────────────────────────────────────
    case 'setScenario':
      return OK;

    case 'revealRoom': {
      if (!state.scenario) return fail('No scenario set');
      if (state.scenario.revealedRooms?.includes(command.payload.roomId)) {
        return fail('Room already revealed');
      }
      return OK;
    }

    case 'setLevel':
      if (command.payload.level < 0 || command.payload.level > 7) return fail('Level must be 0-7');
      return OK;

    case 'setMonsterLevel': {
      const mon = findMonster(state, command.payload.name, command.payload.edition);
      if (!mon) return fail(`Monster "${command.payload.name}" not found`);
      if (command.payload.level < 0 || command.payload.level > 7) return fail('Level must be 0-7');
      return OK;
    }

    case 'setExperience': {
      const char = findCharacter(state, command.payload.characterName, command.payload.edition);
      if (!char) return fail(`Character "${command.payload.characterName}" not found`);
      return OK;
    }

    case 'setLoot': {
      const char = findCharacter(state, command.payload.characterName, command.payload.edition);
      if (!char) return fail(`Character "${command.payload.characterName}" not found`);
      return OK;
    }

    case 'setRound':
      if (command.payload.round < 0) return fail('Round must be >= 0');
      return OK;

    case 'undoAction':
      if (state.undoStack.length === 0) return fail('Nothing to undo');
      return OK;

    case 'importGhsState':
      return OK;

    case 'updateCampaign':
      return OK;

    case 'prepareScenarioEnd': {
      const p = command.payload as any;
      if (!p.outcome || (p.outcome !== 'victory' && p.outcome !== 'defeat')) {
        return fail('prepareScenarioEnd requires outcome: victory|defeat');
      }
      return OK;
    }

    case 'cancelScenarioEnd':
      return OK;

    case 'completeScenario': {
      const p = command.payload as any;
      if (!p.outcome || (p.outcome !== 'victory' && p.outcome !== 'defeat')) {
        return fail('completeScenario requires outcome: victory|defeat');
      }
      if (!state.scenario) {
        return fail('No active scenario to complete');
      }
      return OK;
    }

    case 'startScenario':
      return OK;

    // ── Scenario setup workflow ──────────────────────────────────────────
    case 'prepareScenarioSetup': {
      const p = command.payload as any;
      if (!p.scenarioIndex || !p.edition) {
        return fail('prepareScenarioSetup requires scenarioIndex and edition');
      }
      return OK;
    }

    case 'confirmChore': {
      if (state.setupPhase !== 'chores') return fail('Not in chore assignment phase');
      const char = findCharacter(state, command.payload.characterName, command.payload.edition);
      if (!char) return fail(`Character "${command.payload.characterName}" not found`);
      return OK;
    }

    case 'proceedToRules':
      if (state.setupPhase !== 'chores') return fail('Not in chore phase');
      return OK;

    case 'proceedToBattleGoals':
      if (state.setupPhase !== 'rules') return fail('Not in rules phase');
      return OK;

    case 'cancelScenarioSetup':
      if (!state.setupPhase) return fail('No setup in progress');
      return OK;

    case 'completeTownPhase':
      return OK;

    case 'dealBattleGoals':
      return OK;

    case 'returnBattleGoals':
      return OK;

    // ── Phase T1: scenario end rewards ──────────────────────────────────
    case 'setBattleGoalComplete': {
      if (!state.finishData) return fail('No active scenario end');
      const isPending = typeof state.finish === 'string' && state.finish.startsWith('pending:');
      if (!isPending) return fail('Scenario end not pending');
      if (state.finishData.outcome !== 'victory') {
        return fail('Battle goal checks only award on victory');
      }
      const row = state.finishData.characters.find(
        (r) => r.name === command.payload.characterName && r.edition === command.payload.edition,
      );
      if (!row) return fail(`Character "${command.payload.characterName}" not in rewards snapshot`);
      if (!Number.isFinite(command.payload.checks)) return fail('checks must be a number');
      return OK;
    }

    case 'claimTreasure': {
      if (!state.finishData) return fail('No active scenario end');
      const isPending = typeof state.finish === 'string' && state.finish.startsWith('pending:');
      if (!isPending) return fail('Scenario end not pending');
      const row = state.finishData.characters.find(
        (r) => r.name === command.payload.characterName && r.edition === command.payload.edition,
      );
      if (!row) return fail(`Character "${command.payload.characterName}" not in rewards snapshot`);
      if (!row.treasuresPending.includes(command.payload.treasureId)) {
        return fail(`Treasure "${command.payload.treasureId}" not pending for character`);
      }
      return OK;
    }

    case 'dismissRewards': {
      if (!state.finishData) return fail('No active scenario end');
      const row = state.finishData.characters.find(
        (r) => r.name === command.payload.characterName && r.edition === command.payload.edition,
      );
      if (!row) return fail(`Character "${command.payload.characterName}" not in rewards snapshot`);
      return OK;
    }

    default: {
      const _exhaustive: never = command;
      return fail(`Unknown command action: ${(_exhaustive as Command).action}`);
    }
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

function resolveModifierDeck(
  state: GameState,
  deck: 'monster' | 'ally' | { character: string; edition: string },
) {
  if (deck === 'monster') return state.monsterAttackModifierDeck;
  if (deck === 'ally') return state.allyAttackModifierDeck;
  const char = findCharacter(state, deck.character, deck.edition);
  return char?.attackModifierDeck;
}
