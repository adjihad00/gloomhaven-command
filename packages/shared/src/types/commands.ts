// Command types — discriminated union covering all gameplay mutations
import type {
  ConditionName,
  ElementType,
  ElementState,
  MonsterType,
  SummonColor,
  FigureIdentifier,
  ChoreAssignment,
} from './gameState.js';

// ── Command target ──────────────────────────────────────────────────────────

export type CommandTarget =
  | { type: 'character'; name: string; edition: string }
  | { type: 'monster'; name: string; edition: string; entityNumber: number }
  | { type: 'summon'; characterName: string; characterEdition: string; summonUuid: string }
  | { type: 'objective'; uuid: string; entityNumber: number };

// ── Command action string literals ──────────────────────────────────────────

export type CommandAction =
  | 'changeHealth'
  | 'changeMaxHealth'
  | 'toggleCondition'
  | 'setInitiative'
  | 'advancePhase'
  | 'toggleTurn'
  | 'addEntity'
  | 'removeEntity'
  | 'moveElement'
  | 'drawLootCard'
  | 'assignLoot'
  | 'drawMonsterAbility'
  | 'shuffleMonsterAbilities'
  | 'shuffleModifierDeck'
  | 'drawModifierCard'
  | 'revealRoom'
  | 'undoAction'
  | 'setScenario'
  | 'addCharacter'
  | 'removeCharacter'
  | 'setLevel'
  | 'setExperience'
  | 'setLoot'
  | 'addSummon'
  | 'removeSummon'
  | 'addMonsterGroup'
  | 'removeMonsterGroup'
  | 'setMonsterLevel'
  | 'toggleExhausted'
  | 'toggleAbsent'
  | 'toggleLongRest'
  | 'renameCharacter'
  | 'setLevelAdjustment'
  | 'setRound'
  | 'addModifierCard'
  | 'removeModifierCard'
  | 'importGhsState'
  | 'updateCampaign'
  | 'prepareScenarioEnd'
  | 'cancelScenarioEnd'
  | 'completeScenario'
  | 'startScenario'
  | 'prepareScenarioSetup'
  | 'confirmChore'
  | 'proceedToRules'
  | 'proceedToBattleGoals'
  | 'cancelScenarioSetup'
  | 'completeTownPhase';

// ── Individual command payloads ─────────────────────────────────────────────

export interface ChangeHealthCommand {
  action: 'changeHealth';
  payload: { target: CommandTarget; delta: number };
}

export interface ChangeMaxHealthCommand {
  action: 'changeMaxHealth';
  payload: { target: CommandTarget; delta: number };
}

export interface ToggleConditionCommand {
  action: 'toggleCondition';
  payload: { target: CommandTarget; condition: ConditionName; value?: number };
}

export interface SetInitiativeCommand {
  action: 'setInitiative';
  payload: { characterName: string; edition: string; value: number };
}

export interface AdvancePhaseCommand {
  action: 'advancePhase';
  payload: Record<string, never>;
}

export interface ToggleTurnCommand {
  action: 'toggleTurn';
  payload: { figure: FigureIdentifier };
}

export interface AddEntityCommand {
  action: 'addEntity';
  payload: {
    monsterName: string;
    edition: string;
    entityNumber: number;
    type: MonsterType;
  };
}

export interface RemoveEntityCommand {
  action: 'removeEntity';
  payload: {
    monsterName: string;
    edition: string;
    entityNumber: number;
    type: MonsterType;
  };
}

export interface MoveElementCommand {
  action: 'moveElement';
  payload: { element: ElementType; newState: ElementState };
}

export interface DrawLootCardCommand {
  action: 'drawLootCard';
  payload: Record<string, never>;
}

export interface AssignLootCommand {
  action: 'assignLoot';
  payload: { cardIndex: number; characterName: string; edition: string };
}

export interface DrawMonsterAbilityCommand {
  action: 'drawMonsterAbility';
  payload: { monsterName: string; edition: string };
}

export interface ShuffleMonsterAbilitiesCommand {
  action: 'shuffleMonsterAbilities';
  payload: { monsterName: string; edition: string };
}

export interface ShuffleModifierDeckCommand {
  action: 'shuffleModifierDeck';
  payload: { deck: 'monster' | 'ally' | { character: string; edition: string } };
}

export interface DrawModifierCardCommand {
  action: 'drawModifierCard';
  payload: { deck: 'monster' | 'ally' | { character: string; edition: string } };
}

export interface RevealRoomCommand {
  action: 'revealRoom';
  payload: { roomId: number };
}

export interface UndoActionCommand {
  action: 'undoAction';
  payload: Record<string, never>;
}

export interface SetScenarioCommand {
  action: 'setScenario';
  payload: { scenarioIndex: string; edition: string; group?: string };
}

export interface AddCharacterCommand {
  action: 'addCharacter';
  payload: { name: string; edition: string; level: number; player?: string };
}

export interface RemoveCharacterCommand {
  action: 'removeCharacter';
  payload: { name: string; edition: string };
}

export interface SetLevelCommand {
  action: 'setLevel';
  payload: { level: number };
}

export interface SetExperienceCommand {
  action: 'setExperience';
  payload: { characterName: string; edition: string; value: number };
}

export interface SetLootCommand {
  action: 'setLoot';
  payload: { characterName: string; edition: string; value: number };
}

export interface AddSummonCommand {
  action: 'addSummon';
  payload: {
    characterName: string;
    edition: string;
    summonName: string;
    cardId: string;
    number: number;
    color: SummonColor;
  };
}

export interface RemoveSummonCommand {
  action: 'removeSummon';
  payload: { characterName: string; edition: string; summonUuid: string };
}

export interface AddMonsterGroupCommand {
  action: 'addMonsterGroup';
  payload: { name: string; edition: string };
}

export interface RemoveMonsterGroupCommand {
  action: 'removeMonsterGroup';
  payload: { name: string; edition: string };
}

export interface SetMonsterLevelCommand {
  action: 'setMonsterLevel';
  payload: { name: string; edition: string; level: number };
}

export interface ToggleExhaustedCommand {
  action: 'toggleExhausted';
  payload: { characterName: string; edition: string };
}

export interface ToggleAbsentCommand {
  action: 'toggleAbsent';
  payload: { characterName: string; edition: string };
}

export interface ToggleLongRestCommand {
  action: 'toggleLongRest';
  payload: { characterName: string; edition: string };
}

export interface RenameCharacterCommand {
  action: 'renameCharacter';
  payload: { characterName: string; edition: string; title: string };
}

export interface SetLevelAdjustmentCommand {
  action: 'setLevelAdjustment';
  payload: { adjustment: number };
}

export interface SetRoundCommand {
  action: 'setRound';
  payload: { round: number };
}

export interface ImportGhsStateCommand {
  action: 'importGhsState';
  payload: { ghsJson: string };
}

export interface AddModifierCardCommand {
  action: 'addModifierCard';
  payload: {
    deck: 'monster' | 'ally' | { character: string; edition: string };
    cardType: 'bless' | 'curse';
  };
}

export interface RemoveModifierCardCommand {
  action: 'removeModifierCard';
  payload: {
    deck: 'monster' | 'ally' | { character: string; edition: string };
    cardType: 'bless' | 'curse';
  };
}

export interface UpdateCampaignCommand {
  action: 'updateCampaign';
  payload: { field: string; value: string | number | boolean };
}

export interface PrepareScenarioEndCommand {
  action: 'prepareScenarioEnd';
  payload: { outcome: 'victory' | 'defeat' };
}

export interface CancelScenarioEndCommand {
  action: 'cancelScenarioEnd';
  payload: Record<string, never>;
}

export interface CompleteScenarioCommand {
  action: 'completeScenario';
  payload: { outcome: 'victory' | 'defeat' };
}

export interface StartScenarioCommand {
  action: 'startScenario';
  payload: { scenarioIndex: string; edition: string; group?: string };
}

// ── Scenario setup workflow commands ───────────────────────────────────────

export interface PrepareScenarioSetupCommand {
  action: 'prepareScenarioSetup';
  payload: {
    scenarioIndex: string;
    edition: string;
    group?: string;
    chores: ChoreAssignment[];
  };
}

export interface ConfirmChoreCommand {
  action: 'confirmChore';
  payload: { characterName: string; edition: string };
}

export interface ProceedToRulesCommand {
  action: 'proceedToRules';
  payload: Record<string, never>;
}

export interface ProceedToBattleGoalsCommand {
  action: 'proceedToBattleGoals';
  payload: Record<string, never>;
}

export interface CancelScenarioSetupCommand {
  action: 'cancelScenarioSetup';
  payload: Record<string, never>;
}

export interface CompleteTownPhaseCommand {
  action: 'completeTownPhase';
  payload: Record<string, never>;
}

// ── Discriminated command union ─────────────────────────────────────────────

export type Command =
  | ChangeHealthCommand
  | ChangeMaxHealthCommand
  | ToggleConditionCommand
  | SetInitiativeCommand
  | AdvancePhaseCommand
  | ToggleTurnCommand
  | AddEntityCommand
  | RemoveEntityCommand
  | MoveElementCommand
  | DrawLootCardCommand
  | AssignLootCommand
  | DrawMonsterAbilityCommand
  | ShuffleMonsterAbilitiesCommand
  | ShuffleModifierDeckCommand
  | DrawModifierCardCommand
  | RevealRoomCommand
  | UndoActionCommand
  | SetScenarioCommand
  | AddCharacterCommand
  | RemoveCharacterCommand
  | SetLevelCommand
  | SetExperienceCommand
  | SetLootCommand
  | AddSummonCommand
  | RemoveSummonCommand
  | AddMonsterGroupCommand
  | RemoveMonsterGroupCommand
  | SetMonsterLevelCommand
  | ToggleExhaustedCommand
  | ToggleAbsentCommand
  | ToggleLongRestCommand
  | RenameCharacterCommand
  | SetLevelAdjustmentCommand
  | SetRoundCommand
  | AddModifierCardCommand
  | RemoveModifierCardCommand
  | ImportGhsStateCommand
  | UpdateCampaignCommand
  | PrepareScenarioEndCommand
  | CancelScenarioEndCommand
  | CompleteScenarioCommand
  | StartScenarioCommand
  | PrepareScenarioSetupCommand
  | ConfirmChoreCommand
  | ProceedToRulesCommand
  | ProceedToBattleGoalsCommand
  | CancelScenarioSetupCommand
  | CompleteTownPhaseCommand;

// ── Helper type to extract payload by action ────────────────────────────────

export type CommandPayload<A extends CommandAction> = Extract<Command, { action: A }>['payload'];
