import { useContext, useMemo } from 'preact/hooks';
import { AppContext } from '../shared/context';
import type { Character, Monster, AppMode } from '@gloomhaven-command/shared';

export function useGameState() {
  const { state } = useContext(AppContext);

  return useMemo(() => ({
    state,
    characters: state?.characters ?? [],
    monsters: state?.monsters ?? [],
    elementBoard: state?.elementBoard ?? [],
    round: state?.round ?? 0,
    phase: state?.state ?? 'draw',
    level: state?.level ?? 1,
    figures: state?.figures ?? [],
    scenario: state?.scenario ?? null,
    edition: state?.edition ?? 'gh',
    revision: state?.revision ?? 0,
    lootDeck: state?.lootDeck ?? null,
    party: state?.party ?? null,
    mode: (state?.mode ?? 'scenario') as AppMode,

    getCharacter: (name: string): Character | null =>
      state?.characters.find(c => c.name === name) ?? null,

    getMonster: (name: string): Monster | null =>
      state?.monsters.find(m => m.name === name) ?? null,

    // Player count (non-absent, non-exhausted)
    playerCount: (state?.characters ?? [])
      .filter(c => !c.absent && !c.exhausted).length,
  }), [state]);
}
