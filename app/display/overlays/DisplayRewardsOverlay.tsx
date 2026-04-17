import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { ScenarioFinishData, ScenarioFinishCharacterReward } from '@gloomhaven-command/shared';
import { AmbientParticles } from '../components/AmbientParticles';
import { characterThumbnail, resourceIcon } from '../../shared/assets';
import { formatName } from '../../shared/formatName';
import { useScenarioText } from '../../hooks/useScenarioText';

interface DisplayRewardsOverlayProps {
  finishData: ScenarioFinishData;
  edition: string;
}

interface TreasureInfo {
  id: string;
  reward: string;
}

/**
 * Full-bleed read-only rewards tableau for the portrait display (Phase T1).
 * Layers above the scenario view once the pending-finish flourish has settled;
 * stays visible until `finishData` is cleared (cancel / completeTownPhase / new scenario).
 */
export function DisplayRewardsOverlay({ finishData, edition }: DisplayRewardsOverlayProps) {
  const isVictory = finishData.outcome === 'victory';
  const [treasureDetails, setTreasureDetails] = useState<Record<string, TreasureInfo>>({});
  const { name: refScenarioName } = useScenarioText(
    finishData.scenarioEdition,
    finishData.scenarioIndex,
  );

  useEffect(() => {
    const all = new Set<string>();
    for (const row of finishData.characters) {
      for (const id of row.treasuresPending) all.add(id);
      for (const id of row.treasuresClaimed) all.add(id);
    }
    const missing = [...all].filter((id) => !treasureDetails[id]);
    if (missing.length === 0) return;
    Promise.all(
      missing.map((id) =>
        fetch(`/api/ref/treasure/${finishData.scenarioEdition}/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { treasure_index: number; reward: string } | null) =>
            d ? { id, reward: d.reward } : null,
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
  }, [finishData.createdAtRevision]);

  const allDismissed = finishData.characters.every((c) => c.dismissed);

  return (
    <div
      class={`display-rewards display-rewards--${isVictory ? 'victory' : 'defeat'}`}
      data-edition={edition}
      role="img"
      aria-label={isVictory ? 'Scenario rewards — victory' : 'Scenario rewards — defeat'}
    >
      <AmbientParticles preset={edition === 'fh' ? 'snow' : 'embers'} />
      <div class="display-rewards__ambient" />
      <div class="display-rewards__vignette" />

      <div class="display-rewards__content">
        <header class="display-rewards__header">
          <h1 class="display-rewards__title">
            {isVictory ? 'Victory' : 'Scenario Failed'}
          </h1>
          {refScenarioName && (
            <p class="display-rewards__scenario-name">{refScenarioName}</p>
          )}
          <p class="display-rewards__subtitle">
            Scenario #{finishData.scenarioIndex} — Level {finishData.scenarioLevel}
          </p>
        </header>

        <ul class="display-rewards__list">
          {finishData.characters.map((row) => (
            <DisplayRewardsCard
              key={`${row.edition}:${row.name}`}
              row={row}
              treasureDetails={treasureDetails}
            />
          ))}
        </ul>

        {finishData.inspirationGained != null && finishData.inspirationGained > 0 && (
          <div class="display-rewards__inspiration">
            Party gains <strong>+{finishData.inspirationGained}</strong> inspiration
          </div>
        )}

        <footer class="display-rewards__footer">
          {allDismissed ? 'Rewards claimed.' : 'Waiting for players to continue…'}
        </footer>
      </div>
    </div>
  );
}

// ── Per-character card ─────────────────────────────────────────────────────

function DisplayRewardsCard({
  row, treasureDetails,
}: { row: ScenarioFinishCharacterReward; treasureDetails: Record<string, TreasureInfo> }) {
  const resourceEntries = Object.entries(row.resources).filter(([, n]) => !!n);
  const threshold = row.xpThresholds.nextThreshold;
  const floor = row.xpThresholds.currentFloor;
  const progressPct = threshold !== null
    ? Math.min(100, Math.max(0, ((row.careerXPAfter - floor) / (threshold - floor)) * 100))
    : 100;

  return (
    <li
      class={`display-rewards__card${row.dismissed ? ' display-rewards__card--dismissed' : ''}`}
      data-character-name={row.name}
    >
      <div class="display-rewards__portrait">
        <img src={characterThumbnail(row.edition, row.name)} alt="" />
      </div>
      <div class="display-rewards__card-body">
        <div class="display-rewards__char-title">{row.title || formatName(row.name)}</div>

        <div class="display-rewards__stat-row">
          <span class="display-rewards__stat-label">XP</span>
          <span class="display-rewards__stat-value">
            +{row.totalXPGained}
            <span class="display-rewards__stat-sub"> ({row.careerXPBefore} → {row.careerXPAfter})</span>
          </span>
        </div>
        {threshold !== null && (
          <div class="display-rewards__threshold">
            <div class="display-rewards__threshold-bar">
              <div class="display-rewards__threshold-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        <div class="display-rewards__stat-row">
          <span class="display-rewards__stat-label">Gold</span>
          <span class="display-rewards__stat-value">
            +{row.goldGained}
            <span class="display-rewards__stat-sub"> ({row.totalCoins} × {row.goldConversion})</span>
          </span>
        </div>

        {resourceEntries.length > 0 && (
          <div class="display-rewards__stat-row">
            <span class="display-rewards__stat-label">Resources</span>
            <span class="display-rewards__resources">
              {resourceEntries.map(([t, n]) => (
                <span key={t} class="display-rewards__resource"
                      aria-label={`${n} ${formatName(t)}`}>
                  <img src={resourceIcon(t)} alt="" class="display-rewards__resource-icon" aria-hidden="true" />
                  <span class="display-rewards__resource-count">×{n}</span>
                </span>
              ))}
            </span>
          </div>
        )}

        {row.battleGoalChecks > 0 && (
          <div class="display-rewards__stat-row">
            <span class="display-rewards__stat-label">Battle Goal</span>
            <span class="display-rewards__stat-value">
              +{row.battleGoalChecks} check{row.battleGoalChecks === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {(row.treasuresPending.length > 0 || row.treasuresClaimed.length > 0) && (
          <div class="display-rewards__treasures">
            {row.treasuresClaimed.map((id) => (
              <div key={`c-${id}`} class="display-rewards__treasure display-rewards__treasure--claimed">
                <span class="display-rewards__treasure-id">#{id}</span>
                <span class="display-rewards__treasure-text">
                  {row.treasuresResolved?.[id] ?? treasureDetails[id]?.reward ?? ''}
                </span>
              </div>
            ))}
            {row.treasuresPending.map((id) => (
              <div key={id} class="display-rewards__treasure">
                <span class="display-rewards__treasure-id">#{id}</span>
                <span class="display-rewards__treasure-text">
                  {treasureDetails[id]?.reward ?? '…'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
