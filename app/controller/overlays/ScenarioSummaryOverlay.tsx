import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { GameState, ScenarioFinishCharacterReward } from '@gloomhaven-command/shared';
import { OverlayBackdrop } from './OverlayBackdrop';
import { formatName } from '../../shared/formatName';
import { resourceIcon } from '../../shared/assets';
import { useCommands } from '../../hooks/useCommands';
import { useScenarioText } from '../../hooks/useScenarioText';

interface ScenarioSummaryOverlayProps {
  state: GameState;
  outcome: 'victory' | 'defeat';
  onConfirm: () => void;
  onCancel: () => void;
}

interface TreasureInfo {
  id: string;
  reward: string;
}

/**
 * GM-facing per-character rewards summary (Phase T1).
 *
 * Reads directly from `state.finishData` (populated by `prepareScenarioEnd`,
 * which fires when this overlay opens). Lets the GM toggle battle-goal checks
 * and claim treasures on behalf of any player. Confirm fires `completeScenario`;
 * Cancel fires `cancelScenarioEnd`.
 */
export function ScenarioSummaryOverlay({ state, outcome, onConfirm, onCancel }: ScenarioSummaryOverlayProps) {
  const commands = useCommands();
  const isVictory = outcome === 'victory';
  const finishData = state.finishData;
  const [treasureDetails, setTreasureDetails] = useState<Record<string, TreasureInfo>>({});
  const { name: refScenarioName } = useScenarioText(
    state.scenario?.edition ?? '',
    state.scenario?.index ?? '',
  );

  // Fetch treasure narratives lazily for all pending ids across the party
  useEffect(() => {
    if (!finishData) return;
    const pending: Array<{ edition: string; id: string }> = [];
    for (const row of finishData.characters) {
      for (const id of row.treasuresPending) {
        if (!treasureDetails[id]) pending.push({ edition: row.edition, id });
      }
    }
    if (pending.length === 0) return;
    Promise.all(
      pending.map(({ edition, id }) =>
        fetch(`/api/ref/treasure/${edition}/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { treasure_index: number; reward: string } | null) =>
            data ? { id, reward: data.reward } : null,
          )
          .catch(() => null),
      ),
    ).then((results) => {
      setTreasureDetails((prev) => {
        const next = { ...prev };
        for (const r of results) if (r) next[r.id] = r;
        return next;
      });
    });
  }, [finishData?.createdAtRevision]);

  // finishData should always be present when this overlay is open (prepareScenarioEnd
  // ran in the same tick). Fall through gracefully if not.
  if (!finishData) {
    return (
      <OverlayBackdrop onClose={onCancel}>
        <div class="overlay-panel scenario-summary">
          <h2 class="scenario-summary__title">
            Scenario {isVictory ? 'Complete!' : 'Failed'}
          </h2>
          <p>Preparing rewards…</p>
          <div class="scenario-summary__actions">
            <button class="btn" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </OverlayBackdrop>
    );
  }

  const level = finishData.scenarioLevel;

  return (
    <OverlayBackdrop onClose={onCancel}>
      <div class={`overlay-panel scenario-summary scenario-summary--${isVictory ? 'victory' : 'defeat'}`}>
        <h2 class="scenario-summary__title">
          Scenario {isVictory ? 'Complete!' : 'Failed'}
        </h2>
        {state.scenario && (
          <p class="scenario-summary__scenario">
            {refScenarioName
              ? <><strong>{refScenarioName}</strong> &nbsp;·&nbsp; #{state.scenario.index} — Level {level}</>
              : <>#{state.scenario.index} — Level {level}</>}
          </p>
        )}

        <div class="scenario-summary__grid">
          {finishData.characters.map((row) => (
            <SummaryCharacterCard
              key={`${row.edition}:${row.name}`}
              row={row}
              isVictory={isVictory}
              treasureDetails={treasureDetails}
              onSetChecks={(n) => commands.setBattleGoalComplete(row.name, row.edition, n)}
              onClaimTreasure={(id) => commands.claimTreasure(row.name, row.edition, id)}
            />
          ))}
        </div>

        {finishData.inspirationGained != null && finishData.inspirationGained > 0 && (
          <div class="scenario-summary__inspiration">
            Party will gain <strong>+{finishData.inspirationGained}</strong> inspiration.
          </div>
        )}

        <div class="scenario-summary__actions">
          <button class="btn" onClick={onCancel}>Cancel</button>
          <button
            class={`btn btn-primary ${isVictory ? 'btn-victory' : 'btn-defeat'}`}
            onClick={onConfirm}
          >
            {isVictory ? 'Claim Rewards' : 'Accept Defeat'}
          </button>
        </div>
      </div>
    </OverlayBackdrop>
  );
}

// ── Character card ─────────────────────────────────────────────────────────

interface SummaryCharacterCardProps {
  row: ScenarioFinishCharacterReward;
  isVictory: boolean;
  treasureDetails: Record<string, TreasureInfo>;
  onSetChecks: (n: number) => void;
  onClaimTreasure: (id: string) => void;
}

function SummaryCharacterCard({
  row, isVictory, treasureDetails, onSetChecks, onClaimTreasure,
}: SummaryCharacterCardProps) {
  const resourceEntries = Object.entries(row.resources).filter(([, n]) => !!n);
  const threshold = row.xpThresholds.nextThreshold;
  const floor = row.xpThresholds.currentFloor;
  const progressPct = threshold !== null
    ? Math.min(100, Math.max(0, ((row.careerXPAfter - floor) / (threshold - floor)) * 100))
    : 100;
  const leveledUp = threshold !== null && row.careerXPAfter >= threshold;

  return (
    <div class="scenario-summary__card">
      <div class="scenario-summary__char-title">{row.title || formatName(row.name)}</div>

      <div class="scenario-summary__card-section">
        <div class="scenario-summary__detail">
          XP: {row.scenarioXP}{row.bonusXP > 0 ? ` + ${row.bonusXP} bonus` : ''} = {row.totalXPGained}
        </div>
        <div class="scenario-summary__detail scenario-summary__detail--sub">
          Career: {row.careerXPBefore} → {row.careerXPAfter}
          {threshold !== null && ` / ${threshold}`}
        </div>
        {threshold !== null && (
          <div class="scenario-summary__threshold">
            <div class="scenario-summary__threshold-bar">
              <div class="scenario-summary__threshold-fill" style={{ width: `${progressPct}%` }} />
            </div>
            {leveledUp && <div class="scenario-summary__level-up">Level up in town</div>}
          </div>
        )}
      </div>

      <div class="scenario-summary__card-section">
        <div class="scenario-summary__detail">
          Gold: {row.totalCoins} × {row.goldConversion} = {row.goldGained}
        </div>
        <div class="scenario-summary__detail scenario-summary__detail--sub">
          Career: {row.careerGoldBefore} → {row.careerGoldAfter}
        </div>
      </div>

      {resourceEntries.length > 0 && (
        <div class="scenario-summary__card-section">
          <div class="scenario-summary__detail">Resources:</div>
          <div class="scenario-summary__resources">
            {resourceEntries.map(([t, n]) => (
              <div key={t} class="scenario-summary__resource"
                   aria-label={`${n} ${formatName(t)}`}>
                <img src={resourceIcon(t)} alt="" class="scenario-summary__resource-icon" aria-hidden="true" />
                <span class="scenario-summary__resource-count">×{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div class="scenario-summary__card-section">
        <div class="scenario-summary__detail">
          Battle goal checks:
        </div>
        <div class="scenario-summary__stepper" role="radiogroup" aria-label={`${row.name} battle goal checks`}>
          {[0, 1, 2, 3].map((n) => {
            const active = row.battleGoalChecks === n;
            return (
              <button
                key={n}
                type="button"
                class={`scenario-summary__stepper-btn${active ? ' scenario-summary__stepper-btn--active' : ''}`}
                onClick={() => onSetChecks(n)}
                disabled={!isVictory}
                aria-pressed={active}
                aria-label={`${n} check${n === 1 ? '' : 's'}`}
              >
                {n === 0 ? '0' : `+${n}`}
              </button>
            );
          })}
        </div>
      </div>

      {(row.treasuresPending.length > 0 || row.treasuresClaimed.length > 0) && (
        <div class="scenario-summary__card-section">
          <div class="scenario-summary__detail">Treasures:</div>
          <div class="scenario-summary__treasures">
            {row.treasuresPending.map((id) => (
              <div key={id} class="scenario-summary__treasure">
                <span class="scenario-summary__treasure-id">#{id}</span>
                <span class="scenario-summary__treasure-narrative">
                  {treasureDetails[id]?.reward ?? '…'}
                </span>
                <button
                  type="button"
                  class="scenario-summary__treasure-claim"
                  onClick={() => onClaimTreasure(id)}
                  aria-label={`Claim treasure ${id} for ${row.name}`}
                >
                  Claim
                </button>
              </div>
            ))}
            {row.treasuresClaimed.map((id) => (
              <div
                key={`c-${id}`}
                class="scenario-summary__treasure scenario-summary__treasure--claimed"
              >
                <span class="scenario-summary__treasure-id">#{id}</span>
                <span class="scenario-summary__treasure-narrative">
                  {row.treasuresResolved?.[id] ?? treasureDetails[id]?.reward ?? ''}
                </span>
                <span class="scenario-summary__treasure-pill">Claimed</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
