import { h } from 'preact';
import { useEffect, useState, useRef } from 'preact/hooks';
import { useFinishData } from '../../hooks/useFinishData';
import { useCommands } from '../../hooks/useCommands';
import { XPIcon, GoldIcon } from '../../components/Icons';
import { formatName } from '../../shared/formatName';
import { resourceIcon } from '../../shared/assets';

interface PhoneRewardsOverlayProps {
  selectedCharacter: string;
}

interface TreasureInfo {
  id: string;
  reward: string;
}

/**
 * Phone-side rewards overlay (Phase T1).
 *
 * Reads from `state.finishData` snapshot (populated at prepareScenarioEnd,
 * mutated during the pending window, persisted through completeScenario).
 * Visible any time `finishData` exists; hides locally when the player taps
 * Continue (which fires `dismissRewards`) or when the snapshot is cleared.
 */
export function PhoneRewardsOverlay({ selectedCharacter }: PhoneRewardsOverlayProps) {
  const { finishData, isPending, isFinal, isVictory, isDefeat, getCharRow } = useFinishData();
  const commands = useCommands();
  const [locallyDismissed, setLocallyDismissed] = useState(false);
  const [treasureDetails, setTreasureDetails] = useState<Record<string, TreasureInfo>>({});
  const lastFinishRef = useRef<boolean>(false);

  // Reset local dismissal when a new scenario end begins
  useEffect(() => {
    if (finishData && !lastFinishRef.current) setLocallyDismissed(false);
    lastFinishRef.current = !!finishData;
  }, [!!finishData]);

  const row = finishData ? getCharRow(selectedCharacter) : null;

  // Fetch treasure narratives lazily for any pending ids
  useEffect(() => {
    if (!row || !row.treasuresPending.length) return;
    const missing = row.treasuresPending.filter((id) => !treasureDetails[id]);
    if (missing.length === 0) return;
    const edition = row.edition;
    Promise.all(
      missing.map((id) =>
        fetch(`/api/ref/treasure/${edition}/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { treasure_index: number; reward: string } | null) => {
            if (!data) return null;
            return { id, reward: data.reward };
          })
          .catch(() => null),
      ),
    ).then((results) => {
      setTreasureDetails((prev) => {
        const next = { ...prev };
        for (const r of results) if (r) next[r.id] = r;
        return next;
      });
    });
  }, [row?.treasuresPending.join(','), row?.edition]);

  if (!finishData || !row || locallyDismissed) return null;

  const resourceEntries = Object.entries(row.resources).filter(([, n]) => !!n);
  const canToggleGoals = isPending && isVictory;
  const threshold = row.xpThresholds.nextThreshold;
  const floor = row.xpThresholds.currentFloor;
  const progressPct = threshold !== null
    ? Math.min(100, Math.max(0, ((row.careerXPAfter - floor) / (threshold - floor)) * 100))
    : 100;
  const leveledUp = threshold !== null && row.careerXPAfter >= threshold;

  return (
    <div class="phone-rewards" role="dialog" aria-modal="true" aria-labelledby="phone-rewards-title">
      <div class="phone-rewards__overlay" />
      <div class="phone-rewards__content">
        <h2
          id="phone-rewards-title"
          class={`phone-rewards__title ${isVictory ? 'phone-rewards__title--victory' : 'phone-rewards__title--defeat'}`}
        >
          {isVictory ? 'Victory!' : 'Scenario Failed'}
        </h2>

        <div class="phone-rewards__name">{row.title || formatName(row.name)}</div>

        {/* XP */}
        <section class="phone-rewards__section" aria-label="Experience rewards">
          <div class="phone-rewards__section-header">
            <XPIcon size={18} />
            <span>Experience</span>
          </div>
          <div class="phone-rewards__row">
            <span class="phone-rewards__label">Scenario XP</span>
            <span class="phone-rewards__value">{row.scenarioXP}</span>
          </div>
          {row.bonusXP > 0 && (
            <div class="phone-rewards__row">
              <span class="phone-rewards__label">Bonus XP (Level {row.scenarioLevel})</span>
              <span class="phone-rewards__value phone-rewards__value--bonus">+{row.bonusXP}</span>
            </div>
          )}
          <div class="phone-rewards__row phone-rewards__row--total">
            <span class="phone-rewards__label">Total Gained</span>
            <span class="phone-rewards__value phone-rewards__value--total">{row.totalXPGained}</span>
          </div>
          <div class="phone-rewards__row phone-rewards__row--career">
            <span class="phone-rewards__label">Career XP</span>
            <span class="phone-rewards__value">
              {row.careerXPBefore} → {row.careerXPAfter}
            </span>
          </div>
          {threshold !== null && (
            <div class="phone-rewards__threshold">
              <div class="phone-rewards__threshold-bar" role="progressbar"
                   aria-valuemin={floor} aria-valuemax={threshold} aria-valuenow={row.careerXPAfter}>
                <div class="phone-rewards__threshold-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div class="phone-rewards__threshold-label">
                {leveledUp
                  ? 'Level Up available in town!'
                  : `${threshold - row.careerXPAfter} XP to level ${row.xpThresholds.currentLevel + 1}`}
              </div>
            </div>
          )}
        </section>

        {/* Gold */}
        <section class="phone-rewards__section" aria-label="Gold rewards">
          <div class="phone-rewards__section-header">
            <GoldIcon size={18} />
            <span>Gold</span>
          </div>
          <div class="phone-rewards__row">
            <span class="phone-rewards__label">Coins collected</span>
            <span class="phone-rewards__value">{row.totalCoins}</span>
          </div>
          <div class="phone-rewards__row">
            <span class="phone-rewards__label">× {row.goldConversion} (Level {row.scenarioLevel})</span>
            <span class="phone-rewards__value phone-rewards__value--total">{row.goldGained} gold</span>
          </div>
          <div class="phone-rewards__row phone-rewards__row--career">
            <span class="phone-rewards__label">Career Gold</span>
            <span class="phone-rewards__value">
              {row.careerGoldBefore} → {row.careerGoldAfter}
            </span>
          </div>
        </section>

        {/* Resources (FH) */}
        {resourceEntries.length > 0 && (
          <section class="phone-rewards__section" aria-label="Resources">
            <div class="phone-rewards__section-header">
              <span>Resources</span>
            </div>
            <div class="phone-rewards__resources">
              {resourceEntries.map(([type, count]) => (
                <div key={type} class="phone-rewards__resource">
                  <img
                    src={resourceIcon(type)}
                    alt=""
                    class="phone-rewards__resource-icon"
                    aria-hidden="true"
                  />
                  <span class="phone-rewards__resource-count" aria-label={`${count} ${formatName(type)}`}>
                    ×{count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Battle goal checks */}
        <section class="phone-rewards__section" aria-label="Battle goal">
          <div class="phone-rewards__section-header">
            <span>Battle Goal</span>
          </div>
          <div class="phone-rewards__battle-goal">
            <span class="phone-rewards__label">
              {isDefeat
                ? 'Defeat — no battle goal rewards'
                : canToggleGoals
                  ? 'How many checks did you earn?'
                  : `Earned: +${row.battleGoalChecks} check${row.battleGoalChecks === 1 ? '' : 's'}`}
            </span>
            {canToggleGoals && (
              <div class="phone-rewards__stepper" role="radiogroup" aria-label="Battle goal checks">
                {[0, 1, 2, 3].map((n) => {
                  const active = row.battleGoalChecks === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      class={`phone-rewards__stepper-btn${active ? ' phone-rewards__stepper-btn--active' : ''}`}
                      onClick={() => commands.setBattleGoalComplete(row.name, row.edition, n)}
                      aria-pressed={active}
                      aria-label={`${n} check${n === 1 ? '' : 's'}`}
                    >
                      {n === 0 ? '0' : `+${n}`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Treasures */}
        {(row.treasuresPending.length > 0 || row.treasuresClaimed.length > 0) && (
          <section class="phone-rewards__section" aria-label="Treasures">
            <div class="phone-rewards__section-header">
              <span>Treasures</span>
            </div>
            <div class="phone-rewards__treasures">
              {row.treasuresPending.map((id) => (
                <div key={id} class="phone-rewards__treasure phone-rewards__treasure--pending">
                  <div class="phone-rewards__treasure-id">#{id}</div>
                  <div class="phone-rewards__treasure-narrative">
                    {treasureDetails[id]?.reward ?? '…'}
                  </div>
                  {isPending && (
                    <button
                      type="button"
                      class="phone-rewards__treasure-claim"
                      onClick={() => commands.claimTreasure(row.name, row.edition, id)}
                      aria-label={`Claim treasure ${id}`}
                    >
                      Claim
                    </button>
                  )}
                </div>
              ))}
              {row.treasuresClaimed.map((id) => (
                <div key={`c-${id}`} class="phone-rewards__treasure phone-rewards__treasure--claimed">
                  <div class="phone-rewards__treasure-id">#{id}</div>
                  <div class="phone-rewards__treasure-narrative">
                    {row.treasuresResolved?.[id] ?? treasureDetails[id]?.reward ?? ''}
                  </div>
                  <div class="phone-rewards__treasure-pill">Claimed</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Inspiration (FH victory) */}
        {finishData.inspirationGained != null && finishData.inspirationGained > 0 && (
          <section class="phone-rewards__section" aria-label="Inspiration">
            <div class="phone-rewards__inspiration">
              <span>Party gains</span>
              <span class="phone-rewards__inspiration-value">
                +{finishData.inspirationGained} inspiration
              </span>
            </div>
          </section>
        )}

        {isPending ? (
          <div class="phone-rewards__waiting">Waiting for GM to confirm…</div>
        ) : isFinal ? (
          <button
            type="button"
            class="phone-rewards__dismiss"
            onClick={() => {
              commands.dismissRewards(row.name, row.edition);
              setLocallyDismissed(true);
            }}
          >
            Continue
          </button>
        ) : null}
      </div>
    </div>
  );
}
