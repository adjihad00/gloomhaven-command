import { useContext, useMemo } from 'preact/hooks';
import { AppContext } from '../shared/context';
import type { ScenarioFinishCharacterReward } from '@gloomhaven-command/shared';

/**
 * Reads the Phase T1 scenario-finish rewards snapshot + derived flags.
 * Returns `finishData`, the current `finish` value, boolean phase flags,
 * and a convenience per-character selector.
 */
export function useFinishData() {
  const { state } = useContext(AppContext);

  return useMemo(() => {
    const finishData = state?.finishData;
    const finish = state?.finish;
    const isPending = typeof finish === 'string' && finish.startsWith('pending:');
    const isFinal = finish === 'success' || finish === 'failure';
    const isVictory = finish === 'pending:victory' || finish === 'success';
    const isDefeat = finish === 'pending:failure' || finish === 'failure';

    const getCharRow = (name: string, edition?: string): ScenarioFinishCharacterReward | null => {
      if (!finishData) return null;
      return finishData.characters.find(
        (r) => r.name === name && (!edition || r.edition === edition),
      ) ?? null;
    };

    return { finishData, finish, isPending, isFinal, isVictory, isDefeat, getCharRow };
  }, [state?.finishData, state?.finish]);
}
