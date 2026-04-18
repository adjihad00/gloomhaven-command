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
  | 'completeTownPhase'
  | 'dealBattleGoals'
  | 'returnBattleGoals'
  | 'setBattleGoalComplete'
  | 'claimTreasure'
  | 'dismissRewards'
  | 'setCharacterProgress'
  | 'addPartyAchievement'
  | 'removePartyAchievement'
  | 'addGlobalAchievement'
  | 'removeGlobalAchievement'
  | 'abortScenario';

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

export interface DealBattleGoalsCommand {
  action: 'dealBattleGoals';
  payload: { edition: string; count: number };
}

export interface ReturnBattleGoalsCommand {
  action: 'returnBattleGoals';
  payload: { cardIds: string[] };
}

// ── Scenario end rewards (Phase T1) ────────────────────────────────────────

export interface SetBattleGoalCompleteCommand {
  action: 'setBattleGoalComplete';
  payload: {
    characterName: string;
    edition: string;
    /** 0..3 checks earned this scenario; clamped server-side. */
    checks: number;
  };
}

export interface ClaimTreasureCommand {
  action: 'claimTreasure';
  payload: {
    characterName: string;
    edition: string;
    treasureId: string;
  };
}

export interface DismissRewardsCommand {
  action: 'dismissRewards';
  payload: { characterName: string; edition: string };
}

// ── Player Sheet (Phase T0a) ──────────────────────────────────────────────

/**
 * Character-scoped progress field mutation. Restricted to a whitelist of
 * safe fields; unknown fields are rejected by validateCommand.
 *
 * - `sheetIntroSeen` (boolean): one-time Player Sheet intro animation flag.
 * - `notes` (string): freeform per-character journal (T0d surface).
 */
export type SetCharacterProgressField = 'sheetIntroSeen' | 'notes';

export interface SetCharacterProgressCommand {
  action: 'setCharacterProgress';
  payload: {
    characterName: string;
    edition: string;
    field: SetCharacterProgressField;
    value: boolean | string;
  };
}

// ── Party Sheet (Phase T0b) ───────────────────────────────────────────────

/**
 * Array-field mutations for `state.party.achievementsList`. `updateCampaign`
 * is a scalar setter and can't cleanly mutate arrays (it would replace the
 * whole array, losing ordering / dedup on undo). These structured commands
 * preserve ordering and deduplicate.
 *
 * GM-only — NOT on the phone whitelist. Party management is a GM concern.
 */
export interface AddPartyAchievementCommand {
  action: 'addPartyAchievement';
  payload: { achievement: string };
}

export interface RemovePartyAchievementCommand {
  action: 'removePartyAchievement';
  payload: { achievement: string };
}

// ── Campaign Sheet (Phase T0c) ────────────────────────────────────────────

/**
 * Array-field mutations for `state.party.globalAchievementsList`. Parallel
 * to the party-achievement pattern: `updateCampaign` is a scalar setter and
 * can't cleanly mutate arrays. GM-only — NOT on the phone whitelist.
 */
export interface AddGlobalAchievementCommand {
  action: 'addGlobalAchievement';
  payload: { achievement: string };
}

export interface RemoveGlobalAchievementCommand {
  action: 'removeGlobalAchievement';
  payload: { achievement: string };
}

/**
 * Phase T0b: abort the current scenario mid-play and return to lobby.
 *
 * Clears scenario combat state (monsters, objectives, character HP /
 * conditions / initiative / summons / in-scenario counters) but does NOT
 * transfer rewards and does NOT record the scenario in `party.scenarios`.
 * Transitions `state.mode = 'lobby'` directly (skips town phase).
 *
 * GM-only — NOT on phone whitelist. Validator rejects when
 * `state.mode !== 'scenario'`.
 */
export interface AbortScenarioCommand {
  action: 'abortScenario';
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
  | CompleteTownPhaseCommand
  | DealBattleGoalsCommand
  | ReturnBattleGoalsCommand
  | SetBattleGoalCompleteCommand
  | ClaimTreasureCommand
  | DismissRewardsCommand
  | SetCharacterProgressCommand
  | AddPartyAchievementCommand
  | RemovePartyAchievementCommand
  | AddGlobalAchievementCommand
  | RemoveGlobalAchievementCommand
  | AbortScenarioCommand;

// ── Helper type to extract payload by action ────────────────────────────────

export type CommandPayload<A extends CommandAction> = Extract<Command, { action: A }>['payload'];
