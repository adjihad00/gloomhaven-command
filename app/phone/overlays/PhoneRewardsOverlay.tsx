import { h } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { useGameState } from '../../hooks/useGameState';
import { XPIcon, GoldIcon } from '../../components/Icons';
import { formatName } from '../../shared/formatName';
import { deriveLevelValues, getPlayerCount } from '@gloomhaven-command/shared';

interface PhoneRewardsOverlayProps {
  selectedCharacter: string;
}

export function PhoneRewardsOverlay({ selectedCharacter }: PhoneRewardsOverlayProps) {
  const { state } = useGameState();
  const [visible, setVisible] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const prevFinish = useRef<string | undefined>(undefined);

  const finish = state?.finish as string | undefined;
  const isPending = finish?.startsWith('pending:');
  const isFinal = finish === 'success' || finish === 'failure';

  // Show overlay when pending arrives, update to "claimed" when final arrives
  useEffect(() => {
    if (isPending && !prevFinish.current?.startsWith('pending:')) {
      setVisible(true);
      setClaimed(false);
    }
    if (isFinal && prevFinish.current?.startsWith('pending:')) {
      setClaimed(true);
    }
    // Cancel — finish cleared back to undefined
    if (!finish && prevFinish.current?.startsWith('pending:')) {
      setVisible(false);
    }
    prevFinish.current = finish;
  }, [finish, isPending, isFinal]);

  // Compute rewards from current (pre-completion) state while pending
  const rewards = useMemo(() => {
    if (!state || !visible) return null;

    const char = state.characters?.find(c => c.name === selectedCharacter);
    if (!char) return null;

    const outcome = isPending
      ? (finish?.replace('pending:', '') as 'victory' | 'defeat')
      : (finish as 'victory' | 'defeat' | undefined);
    const isVictory = outcome === 'victory' || outcome === 'success';
    const level = state.level ?? 0;
    const levelValues = deriveLevelValues(level);
    const bonusXP = isVictory ? levelValues.bonusXP : 0;
    const playerCount = getPlayerCount(state.characters);

    // If claimed, values have already been transferred — show from progress
    if (claimed) {
      return {
        isVictory,
        name: char.title || formatName(char.name),
        scenarioXP: 0,
        bonusXP: 0,
        totalXP: 0,
        totalCoins: 0,
        goldConversion: levelValues.goldConversion,
        goldGained: 0,
        careerXP: char.progress?.experience ?? 0,
        careerGold: (char.progress as any)?.gold ?? 0,
        resources: {} as Record<string, number>,
        level,
        claimed: true,
      };
    }

    // Pre-completion — compute from live state
    const scenarioXP = char.experience || 0;
    let totalCoins = 0;
    const resources: Record<string, number> = {};

    if (char.lootCards?.length > 0 && state.lootDeck?.cards?.length > 0) {
      for (const idx of char.lootCards) {
        const card = state.lootDeck.cards[idx];
        if (!card) continue;
        if (card.type === 'money') {
          const val = playerCount <= 2 ? card.value2P
            : playerCount === 3 ? card.value3P : card.value4P;
          totalCoins += val;
        } else {
          resources[card.type] = (resources[card.type] || 0) + 1;
        }
      }
    } else {
      totalCoins = char.loot || 0;
    }

    return {
      isVictory,
      name: char.title || formatName(char.name),
      scenarioXP,
      bonusXP,
      totalXP: scenarioXP + bonusXP,
      totalCoins,
      goldConversion: levelValues.goldConversion,
      goldGained: totalCoins * levelValues.goldConversion,
      careerXP: (char.progress?.experience ?? 0),
      careerGold: ((char.progress as any)?.gold ?? 0),
      resources,
      level,
      claimed: false,
    };
  }, [state, visible, selectedCharacter, claimed, finish]);

  if (!visible || !rewards) return null;

  const r = rewards;
  const resourceEntries = Object.entries(r.resources);

  return (
    <div class="phone-rewards" role="dialog" aria-modal="true">
      <div class="phone-rewards__overlay" />
      <div class="phone-rewards__content">
        <h2 class={`phone-rewards__title ${r.isVictory ? 'phone-rewards__title--victory' : 'phone-rewards__title--defeat'}`}>
          {r.isVictory ? 'Victory!' : 'Scenario Failed'}
        </h2>

        <div class="phone-rewards__name">{r.name}</div>

        {claimed ? (
          <div class="phone-rewards__claimed-msg">
            Rewards have been claimed. Check your character sheet for updated totals.
          </div>
        ) : (
          <>
            {/* XP Section */}
            <div class="phone-rewards__section">
              <div class="phone-rewards__section-header">
                <XPIcon size={18} />
                <span>Experience</span>
              </div>
              <div class="phone-rewards__row">
                <span class="phone-rewards__label">Scenario XP</span>
                <span class="phone-rewards__value">{r.scenarioXP}</span>
              </div>
              {r.bonusXP > 0 && (
                <div class="phone-rewards__row">
                  <span class="phone-rewards__label">Bonus XP (Level {r.level})</span>
                  <span class="phone-rewards__value phone-rewards__value--bonus">+{r.bonusXP}</span>
                </div>
              )}
              <div class="phone-rewards__row phone-rewards__row--total">
                <span class="phone-rewards__label">Total Gained</span>
                <span class="phone-rewards__value phone-rewards__value--total">{r.totalXP}</span>
              </div>
              <div class="phone-rewards__row phone-rewards__row--career">
                <span class="phone-rewards__label">Career XP</span>
                <span class="phone-rewards__value">{r.careerXP} → {r.careerXP + r.totalXP}</span>
              </div>
            </div>

            {/* Gold Section */}
            <div class="phone-rewards__section">
              <div class="phone-rewards__section-header">
                <GoldIcon size={18} />
                <span>Gold</span>
              </div>
              <div class="phone-rewards__row">
                <span class="phone-rewards__label">Coins collected</span>
                <span class="phone-rewards__value">{r.totalCoins}</span>
              </div>
              <div class="phone-rewards__row">
                <span class="phone-rewards__label">× {r.goldConversion} (Level {r.level})</span>
                <span class="phone-rewards__value phone-rewards__value--total">{r.goldGained} gold</span>
              </div>
              <div class="phone-rewards__row phone-rewards__row--career">
                <span class="phone-rewards__label">Total Gold</span>
                <span class="phone-rewards__value">{r.careerGold} → {r.careerGold + r.goldGained}</span>
              </div>
            </div>

            {/* Resources (FH) */}
            {resourceEntries.length > 0 && (
              <div class="phone-rewards__section">
                <div class="phone-rewards__section-header">
                  <span>Resources</span>
                </div>
                <div class="phone-rewards__resources">
                  {resourceEntries.map(([type, count]) => (
                    <div key={type} class="phone-rewards__resource">
                      <span class="phone-rewards__resource-count">×{count}</span>
                      <span class="phone-rewards__resource-name">{formatName(type)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div class="phone-rewards__waiting">
              Waiting for GM to confirm...
            </div>
          </>
        )}

        {claimed && (
          <button class="phone-rewards__dismiss" onClick={() => setVisible(false)}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
