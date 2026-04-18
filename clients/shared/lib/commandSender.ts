// Typed convenience methods for all 31 command actions
import type { Connection } from './connection.js';
import type {
  Command, CommandTarget, ConditionName,
  ElementType, ElementState, MonsterType, SummonColor,
  FigureIdentifier, ChoreAssignment,
} from '@gloomhaven-command/shared';

type ModifierDeck = 'monster' | 'ally' | { character: string; edition: string };

export class CommandSender {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  // ── Health & Conditions ──

  changeHealth(target: CommandTarget, delta: number): void {
    this.send({ action: 'changeHealth', payload: { target, delta } });
  }

  changeMaxHealth(target: CommandTarget, delta: number): void {
    this.send({ action: 'changeMaxHealth', payload: { target, delta } });
  }

  toggleCondition(target: CommandTarget, condition: ConditionName, value?: number): void {
    this.send({ action: 'toggleCondition', payload: { target, condition, value } });
  }

  // ── Initiative & Turns ──

  setInitiative(characterName: string, edition: string, value: number): void {
    this.send({ action: 'setInitiative', payload: { characterName, edition, value } });
  }

  advancePhase(): void {
    this.send({ action: 'advancePhase', payload: {} as Record<string, never> });
  }

  toggleTurn(figure: FigureIdentifier): void {
    this.send({ action: 'toggleTurn', payload: { figure } });
  }

  // ── Monster Entities ──

  addEntity(monsterName: string, edition: string, entityNumber: number, type: MonsterType): void {
    this.send({ action: 'addEntity', payload: { monsterName, edition, entityNumber, type } });
  }

  removeEntity(monsterName: string, edition: string, entityNumber: number, type: MonsterType): void {
    this.send({ action: 'removeEntity', payload: { monsterName, edition, entityNumber, type } });
  }

  // ── Elements ──

  moveElement(element: ElementType, newState: ElementState): void {
    this.send({ action: 'moveElement', payload: { element, newState } });
  }

  // ── Loot ──

  drawLootCard(): void {
    this.send({ action: 'drawLootCard', payload: {} as Record<string, never> });
  }

  assignLoot(cardIndex: number, characterName: string, edition: string): void {
    this.send({ action: 'assignLoot', payload: { cardIndex, characterName, edition } });
  }

  // ── Monster Abilities ──

  drawMonsterAbility(monsterName: string, edition: string): void {
    this.send({ action: 'drawMonsterAbility', payload: { monsterName, edition } });
  }

  shuffleMonsterAbilities(monsterName: string, edition: string): void {
    this.send({ action: 'shuffleMonsterAbilities', payload: { monsterName, edition } });
  }

  // ── Modifier Decks ──

  shuffleModifierDeck(deck: ModifierDeck): void {
    this.send({ action: 'shuffleModifierDeck', payload: { deck } });
  }

  drawModifierCard(deck: ModifierDeck): void {
    this.send({ action: 'drawModifierCard', payload: { deck } });
  }

  addModifierCard(deck: ModifierDeck, cardType: 'bless' | 'curse'): void {
    this.send({ action: 'addModifierCard', payload: { deck, cardType } });
  }

  removeModifierCard(deck: ModifierDeck, cardType: 'bless' | 'curse'): void {
    this.send({ action: 'removeModifierCard', payload: { deck, cardType } });
  }

  // ── Scenario ──

  revealRoom(roomId: number): void {
    this.send({ action: 'revealRoom', payload: { roomId } });
  }

  setScenario(scenarioIndex: string, edition: string, group?: string): void {
    this.send({ action: 'setScenario', payload: { scenarioIndex, edition, ...(group ? { group } : {}) } });
  }

  setLevel(level: number): void {
    this.send({ action: 'setLevel', payload: { level } });
  }

  setRound(round: number): void {
    this.send({ action: 'setRound', payload: { round } });
  }

  // ── Characters ──

  addCharacter(name: string, edition: string, level: number, player?: string): void {
    this.send({ action: 'addCharacter', payload: { name, edition, level, ...(player ? { player } : {}) } });
  }

  removeCharacter(name: string, edition: string): void {
    this.send({ action: 'removeCharacter', payload: { name, edition } });
  }

  setExperience(characterName: string, edition: string, value: number): void {
    this.send({ action: 'setExperience', payload: { characterName, edition, value } });
  }

  setLoot(characterName: string, edition: string, value: number): void {
    this.send({ action: 'setLoot', payload: { characterName, edition, value } });
  }

  toggleExhausted(characterName: string, edition: string): void {
    this.send({ action: 'toggleExhausted', payload: { characterName, edition } });
  }

  toggleAbsent(characterName: string, edition: string): void {
    this.send({ action: 'toggleAbsent', payload: { characterName, edition } });
  }

  toggleLongRest(characterName: string, edition: string): void {
    this.send({ action: 'toggleLongRest', payload: { characterName, edition } });
  }

  renameCharacter(characterName: string, edition: string, title: string): void {
    this.send({ action: 'renameCharacter', payload: { characterName, edition, title } });
  }

  setLevelAdjustment(adjustment: number): void {
    this.send({ action: 'setLevelAdjustment', payload: { adjustment } });
  }

  // ── Summons ──

  addSummon(characterName: string, edition: string, summonName: string, cardId: string, number: number, color: SummonColor): void {
    this.send({ action: 'addSummon', payload: { characterName, edition, summonName, cardId, number, color } });
  }

  removeSummon(characterName: string, edition: string, summonUuid: string): void {
    this.send({ action: 'removeSummon', payload: { characterName, edition, summonUuid } });
  }

  // ── Monster Groups ──

  addMonsterGroup(name: string, edition: string): void {
    this.send({ action: 'addMonsterGroup', payload: { name, edition } });
  }

  removeMonsterGroup(name: string, edition: string): void {
    this.send({ action: 'removeMonsterGroup', payload: { name, edition } });
  }

  setMonsterLevel(name: string, edition: string, level: number): void {
    this.send({ action: 'setMonsterLevel', payload: { name, edition, level } });
  }

  // ── Undo ──

  undoAction(): void {
    this.send({ action: 'undoAction', payload: {} as Record<string, never> });
  }

  // ── GHS Compat ──

  importGhsState(ghsJson: string): void {
    this.send({ action: 'importGhsState', payload: { ghsJson } });
  }

  // ── Campaign ──

  updateCampaign(field: string, value: string | number | boolean): void {
    this.send({ action: 'updateCampaign', payload: { field, value } });
  }

  // ── Scenario end ──

  prepareScenarioEnd(outcome: 'victory' | 'defeat'): void {
    this.send({ action: 'prepareScenarioEnd', payload: { outcome } });
  }

  cancelScenarioEnd(): void {
    this.send({ action: 'cancelScenarioEnd', payload: {} as Record<string, never> });
  }

  completeScenario(outcome: 'victory' | 'defeat'): void {
    this.send({ action: 'completeScenario', payload: { outcome } });
  }

  // ── Scenario setup workflow ──

  startScenario(scenarioIndex: string, edition: string, group?: string): void {
    this.send({ action: 'startScenario', payload: { scenarioIndex, edition, ...(group ? { group } : {}) } });
  }

  prepareScenarioSetup(scenarioIndex: string, edition: string, chores: ChoreAssignment[], group?: string): void {
    this.send({ action: 'prepareScenarioSetup', payload: { scenarioIndex, edition, chores, ...(group ? { group } : {}) } });
  }

  confirmChore(characterName: string, edition: string): void {
    this.send({ action: 'confirmChore', payload: { characterName, edition } });
  }

  proceedToRules(): void {
    this.send({ action: 'proceedToRules', payload: {} as Record<string, never> });
  }

  proceedToBattleGoals(): void {
    this.send({ action: 'proceedToBattleGoals', payload: {} as Record<string, never> });
  }

  cancelScenarioSetup(): void {
    this.send({ action: 'cancelScenarioSetup', payload: {} as Record<string, never> });
  }

  completeTownPhase(): void {
    this.send({ action: 'completeTownPhase', payload: {} as Record<string, never> });
  }

  // ── Scenario end rewards (Phase T1) ──

  setBattleGoalComplete(characterName: string, edition: string, checks: number): void {
    this.send({ action: 'setBattleGoalComplete', payload: { characterName, edition, checks } });
  }

  claimTreasure(characterName: string, edition: string, treasureId: string): void {
    this.send({ action: 'claimTreasure', payload: { characterName, edition, treasureId } });
  }

  dismissRewards(characterName: string, edition: string): void {
    this.send({ action: 'dismissRewards', payload: { characterName, edition } });
  }

  // ── Player Sheet (Phase T0a) ──

  /**
   * Set a whitelisted character-progress field. Current whitelist:
   * `sheetIntroSeen` (boolean) — one-time intro animation flag.
   * `notes` (string) — per-character journal (T0d).
   */
  setCharacterProgress(
    characterName: string,
    edition: string,
    field: 'sheetIntroSeen' | 'notes',
    value: boolean | string,
  ): void {
    this.send({
      action: 'setCharacterProgress',
      payload: { characterName, edition, field, value },
    });
  }

  // ── Player Sheet History (Phase T0d) ──

  /**
   * One-shot backfill of per-character history from `state.party.scenarios`.
   * Fired by the History tab on first open. Engine self-gates on
   * `progress.historyBackfilled` so repeat calls are idempotent no-ops.
   */
  backfillCharacterHistory(characterName: string, edition: string): void {
    this.send({
      action: 'backfillCharacterHistory',
      payload: { characterName, edition },
    });
  }

  // ── Party Sheet (Phase T0b) ──

  /**
   * Append a party achievement (GM-only). Empty/duplicate entries are no-ops.
   * `updateCampaign` can't cleanly mutate arrays, so this is a structured
   * command.
   */
  addPartyAchievement(achievement: string): void {
    this.send({ action: 'addPartyAchievement', payload: { achievement } });
  }

  /**
   * Remove a party achievement by exact match (GM-only).
   */
  removePartyAchievement(achievement: string): void {
    this.send({ action: 'removePartyAchievement', payload: { achievement } });
  }

  // ── Campaign Sheet (Phase T0c) ──

  /**
   * Append a global achievement (GM-only). Empty/duplicate entries are no-ops.
   * Parallel to `addPartyAchievement`; targets `state.party.globalAchievementsList`.
   */
  addGlobalAchievement(achievement: string): void {
    this.send({ action: 'addGlobalAchievement', payload: { achievement } });
  }

  /**
   * Remove a global achievement by exact match (GM-only).
   */
  removeGlobalAchievement(achievement: string): void {
    this.send({ action: 'removeGlobalAchievement', payload: { achievement } });
  }

  /**
   * Abort the current scenario mid-play and return to lobby (GM-only).
   * Clears scenario combat state; no rewards applied; does NOT record
   * the scenario in `party.scenarios`. Rejected server-side when no
   * scenario is in progress.
   */
  abortScenario(): void {
    this.send({ action: 'abortScenario', payload: {} as Record<string, never> });
  }

  // ── Internal ──

  private send(command: Command): void {
    this.connection.sendCommand(command);
  }
}
