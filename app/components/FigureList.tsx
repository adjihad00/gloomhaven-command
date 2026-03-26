import { h } from 'preact';
import type { GameState, MonsterLevelStats, MonsterAbilityCard } from '@gloomhaven-command/shared';
import { getInitiativeOrder } from '@gloomhaven-command/shared';
import { CharacterBar } from './CharacterBar';
import { SummonCard } from './SummonCard';
import { MonsterGroup } from './MonsterGroup';

interface FigureListProps {
  state: GameState;
  monsterStats: Map<string, { normal: MonsterLevelStats | null; elite: MonsterLevelStats | null }>;
  monsterAbilities: Map<string, MonsterAbilityCard | null>;
  isDrawPhase: boolean;
  readonly?: boolean;
  onCharacterDetail?: (name: string) => void;
}

export function FigureList({ state, monsterStats, monsterAbilities, isDrawPhase, readonly, onCharacterDetail }: FigureListProps) {
  const figures = getInitiativeOrder(state);

  return (
    <div class="figure-list">
      {figures.map(fig => {
        if (fig.type === 'character') {
          const character = state.characters.find(c => c.name === fig.name && c.edition === fig.edition);
          if (!character) return null;

          return (
            <div key={`char-${fig.edition}-${fig.name}`} class="figure-list__entry">
              <CharacterBar
                character={character}
                edition={fig.edition}
                isActive={fig.active}
                isDone={fig.off}
                isDrawPhase={isDrawPhase}
                readonly={readonly}
                onOpenDetail={onCharacterDetail ? () => onCharacterDetail(character.name) : undefined}
              />
              {character.summons.filter(s => !s.dead).map(summon => (
                <SummonCard
                  key={summon.uuid}
                  summon={summon}
                  characterName={character.name}
                  characterEdition={character.edition}
                  readonly={readonly}
                />
              ))}
            </div>
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
