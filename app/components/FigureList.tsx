import { h } from 'preact';
import type { GameState, MonsterLevelStats, MonsterAbilityCard, ConditionName } from '@gloomhaven-command/shared';
import { getInitiativeOrder } from '@gloomhaven-command/shared';
import { CharacterBar } from './CharacterBar';
import { MonsterGroup } from './MonsterGroup';

interface FigureListProps {
  state: GameState;
  monsterStats: Map<string, { normal: MonsterLevelStats | null; elite: MonsterLevelStats | null }>;
  monsterAbilities: Map<string, MonsterAbilityCard | null>;
  availableConditions?: ConditionName[];
  isDrawPhase: boolean;
  readonly?: boolean;
  onCharacterDetail?: (name: string) => void;
}

export function FigureList({ state, monsterStats, monsterAbilities, availableConditions, isDrawPhase, readonly, onCharacterDetail }: FigureListProps) {
  const figures = getInitiativeOrder(state);

  return (
    <div class="figure-grid">
      {figures.map(fig => {
        if (fig.type === 'character') {
          const character = state.characters.find(c => c.name === fig.name && c.edition === fig.edition);
          if (!character) return null;

          return (
            <CharacterBar
              key={`char-${fig.edition}-${fig.name}`}
              character={character}
              edition={fig.edition}
              isActive={fig.active}
              isDone={fig.off}
              isDrawPhase={isDrawPhase}
              availableConditions={availableConditions}
              readonly={readonly}
              onOpenDetail={onCharacterDetail ? () => onCharacterDetail(character.name) : undefined}
            />
          );
        }

        if (fig.type === 'monster') {
          const monster = state.monsters.find(m => m.name === fig.name && m.edition === fig.edition);
          if (!monster) return null;

          const statsKey = `${fig.edition}-${fig.name}`;
          return (
            <MonsterGroup
              key={`mon-${statsKey}`}
              monster={monster}
              monsterStats={monsterStats.get(statsKey) ?? undefined}
              abilityCard={monsterAbilities.get(statsKey) ?? undefined}
              isActive={fig.active}
              isDone={fig.off}
              readonly={readonly}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
