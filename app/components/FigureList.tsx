import { h } from 'preact';
import type { GameState, MonsterLevelStats, MonsterAbilityCard, ConditionName } from '@gloomhaven-command/shared';
import { getInitiativeOrder } from '@gloomhaven-command/shared';
import { CharacterBar } from './CharacterBar';
import { MonsterGroup } from './MonsterGroup';
import { characterThumbnail } from '../shared/assets';

interface FigureListProps {
  state: GameState;
  monsterStats: Map<string, { normal: MonsterLevelStats | null; elite: MonsterLevelStats | null }>;
  monsterAbilities: Map<string, MonsterAbilityCard | null>;
  availableConditions?: ConditionName[];
  isDrawPhase: boolean;
  readonly?: boolean;
  onCharacterDetail?: (name: string) => void;
  onOpenNumpad?: (characterName: string, edition: string) => void;
}

export function FigureList({ state, monsterStats, monsterAbilities, availableConditions, isDrawPhase, readonly, onCharacterDetail, onOpenNumpad }: FigureListProps) {
  const figures = getInitiativeOrder(state);

  return (
    <>
    <div class="figure-grid">
      {figures.filter(f => !f.absent).map(fig => {
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
              onOpenNumpad={onOpenNumpad ? () => onOpenNumpad(character.name, character.edition || state.party?.edition || '') : undefined}
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

    {(() => {
      const absentFigs = figures.filter(f => f.absent && f.type === 'character');
      if (absentFigs.length === 0) return null;
      return (
        <div class="bench-strip">
          <span class="bench-label">Bench</span>
          {absentFigs.map(fig => {
            const character = state.characters.find(
              c => c.name === fig.name && c.edition === fig.edition
            );
            if (!character) return null;
            return (
              <button
                key={`bench-${fig.edition}-${fig.name}`}
                class="bench-portrait"
                onClick={() => onCharacterDetail?.(character.name)}
                title={`${character.title || fig.name} (absent)`}
              >
                <img
                  src={characterThumbnail(fig.edition, fig.name)}
                  alt={fig.name}
                  class="bench-portrait-img"
                />
              </button>
            );
          })}
        </div>
      );
    })()}
  </>
  );
}
