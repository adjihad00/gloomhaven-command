// Reactive state wrapper with subscriptions and derived getters
import type {
  GameState, GamePhase, Character, Monster,
  ElementModel, LootDeck, ScenarioModel,
} from '@gloomhaven-command/shared';
import { getInitiativeOrder, type OrderedFigure } from '@gloomhaven-command/shared';

export class StateStore {
  private state: GameState | null = null;
  private globalListeners: Set<(state: GameState) => void> = new Set();

  setState(newState: GameState): void {
    this.state = newState;
    for (const listener of this.globalListeners) {
      listener(newState);
    }
  }

  getState(): GameState | null {
    return this.state;
  }

  subscribe(callback: (state: GameState) => void): () => void {
    this.globalListeners.add(callback);
    return () => { this.globalListeners.delete(callback); };
  }

  select<T>(selector: (state: GameState) => T): T | undefined {
    if (!this.state) return undefined;
    return selector(this.state);
  }

  // Derived getters for UI convenience
  get characters(): Character[] { return this.state?.characters ?? []; }
  get monsters(): Monster[] { return this.state?.monsters ?? []; }
  get elementBoard(): ElementModel[] { return this.state?.elementBoard ?? []; }
  get round(): number { return this.state?.round ?? 0; }
  get phase(): GamePhase { return this.state?.state ?? 'draw'; }
  get level(): number { return this.state?.level ?? 0; }
  get figures(): string[] { return this.state?.figures ?? []; }
  get lootDeck(): LootDeck | null { return this.state ? this.state.lootDeck : null; }
  get scenario(): ScenarioModel | undefined { return this.state?.scenario; }

  getInitiativeOrder(): OrderedFigure[] {
    if (!this.state) return [];
    return getInitiativeOrder(this.state);
  }

  getCharacter(name: string): Character | null {
    return this.state?.characters.find(c => c.name === name) ?? null;
  }

  getMonster(name: string): Monster | null {
    return this.state?.monsters.find(m => m.name === name) ?? null;
  }
}
