// TODO: All 17 command payloads

export interface ChangeHealthPayload {
  target: { type: 'character' | 'monster'; name: string; entityNumber?: number };
  delta: number;
}

export interface ToggleConditionPayload {
  target: { type: 'character' | 'monster'; name: string; entityNumber?: number };
  condition: string;
}

export interface SetInitiativePayload {
  characterName: string;
  value: number;
}

export interface AdvancePhasePayload {}

export interface ToggleTurnPayload {
  figureName: string;
}

export interface AddEntityPayload {
  monsterName: string;
  entityData: { number: number; elite: boolean };
}

export interface RemoveEntityPayload {
  monsterName: string;
  entityNumber: number;
}

export interface MoveElementPayload {
  element: string;
  newState: string;
}

export interface DrawLootCardPayload {}

export interface AssignLootPayload {
  cardIndex: number;
  characterName: string;
}

export interface DrawMonsterAbilityPayload {
  monsterName: string;
}

export interface ShuffleModifierDeckPayload {
  deck: string;
}

export interface RevealRoomPayload {
  roomId: string;
}

export interface UndoActionPayload {}

export interface SetScenarioPayload {
  scenarioNumber: number;
  edition: string;
}

export interface AddCharacterPayload {
  name: string;
  edition: string;
  player?: string;
}

export interface RemoveCharacterPayload {
  name: string;
}

export type CommandPayload =
  | { action: 'changeHealth'; payload: ChangeHealthPayload }
  | { action: 'toggleCondition'; payload: ToggleConditionPayload }
  | { action: 'setInitiative'; payload: SetInitiativePayload }
  | { action: 'advancePhase'; payload: AdvancePhasePayload }
  | { action: 'toggleTurn'; payload: ToggleTurnPayload }
  | { action: 'addEntity'; payload: AddEntityPayload }
  | { action: 'removeEntity'; payload: RemoveEntityPayload }
  | { action: 'moveElement'; payload: MoveElementPayload }
  | { action: 'drawLootCard'; payload: DrawLootCardPayload }
  | { action: 'assignLoot'; payload: AssignLootPayload }
  | { action: 'drawMonsterAbility'; payload: DrawMonsterAbilityPayload }
  | { action: 'shuffleModifierDeck'; payload: ShuffleModifierDeckPayload }
  | { action: 'revealRoom'; payload: RevealRoomPayload }
  | { action: 'undoAction'; payload: UndoActionPayload }
  | { action: 'setScenario'; payload: SetScenarioPayload }
  | { action: 'addCharacter'; payload: AddCharacterPayload }
  | { action: 'removeCharacter'; payload: RemoveCharacterPayload };
