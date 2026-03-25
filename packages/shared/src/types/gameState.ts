// TODO: Map from GHS JSON structure — character stats, monster data, scenario state

export interface EntityCondition {
  name: string;
  value: number;
}

export interface Figure {
  name: string;
  health: number;
  maxHealth: number;
  entityConditions: EntityCondition[];
  turnState: 'waiting' | 'active' | 'done';
}

export interface Character extends Figure {
  edition: string;
  initiative: number | null;
  experience: number;
  gold: number;
  loot: number[];
  player?: string;
}

export interface MonsterEntity extends Figure {
  number: number;
  elite: boolean;
}

export interface MonsterGroup {
  name: string;
  edition: string;
  entities: MonsterEntity[];
  abilityCardIndex: number | null;
}

export type ElementState = 'inert' | 'strong' | 'waning';

export interface ElementBoard {
  fire: ElementState;
  ice: ElementState;
  air: ElementState;
  earth: ElementState;
  light: ElementState;
  dark: ElementState;
}

export type GamePhase = 'setup' | 'cardSelection' | 'initiative' | 'turns' | 'roundEnd';

export interface GameState {
  gameCode: string;
  revision: number;
  phase: GamePhase;
  round: number;
  scenarioNumber: number | null;
  edition: string;
  characters: Character[];
  monsterGroups: MonsterGroup[];
  elementBoard: ElementBoard;
  lootDeck: number[];
  drawnLoot: number[];
  undoStack: unknown[];
}
