import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import type { GameState } from '@gloomhaven-command/shared';
import { deriveLevelValues, getPlayerCount } from '@gloomhaven-command/shared';
import { OverlayBackdrop } from './OverlayBackdrop';
import { formatName } from '../../shared/formatName';

interface ScenarioSummaryOverlayProps {
  state: GameState;
  outcome: 'victory' | 'defeat';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ScenarioSummaryOverlay({ state, outcome, onConfirm, onCancel }: ScenarioSummaryOverlayProps) {
  const isVictory = outcome === 'victory';
  const level = state.level ?? 0;
  const levelValues = deriveLevelValues(level);
  const bonusXP = isVictory ? levelValues.bonusXP : 0;
  const playerCount = getPlayerCount(state.characters);

  const rewards = useMemo(() => {
    return state.characters.filter(c => !c.absent && !c.exhausted).map(char => {
      const scenarioXP = char.experience || 0;
      const totalNewXP = scenarioXP + bonusXP;

      // Gold calculation
      let totalCoins = 0;
      if (char.lootCards?.length > 0 && state.lootDeck?.cards?.length > 0) {
        for (const idx of char.lootCards) {
          const card = state.lootDeck.cards[idx];
          if (!card) continue;
          if (card.type === 'money') {
            const val = playerCount <= 2 ? card.value2P
              : playerCount === 3 ? card.value3P : card.value4P;
            totalCoins += val;
          }
        }
      } else {
        totalCoins = char.loot || 0;
      }
      const goldGained = totalCoins * levelValues.goldConversion;

      // Resources (FH)
      const resources: Record<string, number> = {};
      if (char.lootCards?.length > 0 && state.lootDeck?.cards?.length > 0) {
        for (const idx of char.lootCards) {
          const card = state.lootDeck.cards[idx];
          if (card && card.type !== 'money') {
            resources[card.type] = (resources[card.type] || 0) + 1;
          }
        }
      }

      return {
        name: char.title || formatName(char.name),
        scenarioXP,
        bonusXP,
        totalNewXP,
        totalCoins,
        goldConversion: levelValues.goldConversion,
        goldGained,
        resources,
        currentTotalXP: (char.progress as any)?.experience ?? 0,
        newTotalXP: ((char.progress as any)?.experience ?? 0) + totalNewXP,
        currentGold: (char.progress as any)?.gold ?? 0,
        newGold: ((char.progress as any)?.gold ?? 0) + goldGained,
      };
    });
  }, [state, bonusXP, playerCount, levelValues]);

  return (
    <OverlayBackdrop onClose={onCancel}>
      <div class="overlay-panel scenario-summary">
        <h2 class="scenario-summary__title">
          Scenario {isVictory ? 'Complete!' : 'Failed'}
        </h2>
        {state.scenario && (
          <p class="scenario-summary__scenario">
            #{state.scenario.index} — Level {level}
          </p>
        )}

        <div class="scenario-summary__table">
          {rewards.map((r, i) => (
            <div key={i} class="scenario-summary__row">
              <span class="scenario-summary__char-name">{r.name}</span>
              <div class="scenario-summary__details">
                <span class="scenario-summary__detail">
                  XP: {r.scenarioXP}{bonusXP > 0 ? ` + ${bonusXP} bonus` : ''} = {r.totalNewXP}
                </span>
                <span class="scenario-summary__detail scenario-summary__detail--sub">
                  Total: {r.currentTotalXP} → {r.newTotalXP}
                </span>
                <span class="scenario-summary__detail">
                  Coins: {r.totalCoins} × {r.goldConversion} = {r.goldGained} gold
                </span>
                <span class="scenario-summary__detail scenario-summary__detail--sub">
                  Total gold: {r.currentGold} → {r.newGold}
                </span>
                {Object.keys(r.resources).length > 0 && (
                  <span class="scenario-summary__detail">
                    Resources: {Object.entries(r.resources).map(([t, n]) => `${t} ×${n}`).join(', ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div class="scenario-summary__actions">
          <button class="btn" onClick={onCancel}>Cancel</button>
          <button class={`btn btn-primary ${isVictory ? 'btn-victory' : 'btn-defeat'}`}
            onClick={onConfirm}>
            {isVictory ? 'Claim Rewards' : 'Accept Defeat'}
          </button>
        </div>
      </div>
    </OverlayBackdrop>
  );
}
