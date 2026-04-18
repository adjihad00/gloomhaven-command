import { h } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import type { Party } from '@gloomhaven-command/shared';
import {
  getProsperityLevel,
  getProsperityProgress,
  PROSPERITY_THRESHOLDS_FH,
  PROSPERITY_THRESHOLDS_GH,
} from '@gloomhaven-command/shared';
import { useCommands } from '../../../hooks/useCommands';
import { CampaignSheetContext } from '../CampaignSheetContext';
import { WaxSealHeader } from '../WaxSealHeader';

interface ProsperityTabProps {
  party: Party;
}

const GEARS_ICON = (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" stroke-width="1.4" />
    <g stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
      <path d="M10 2.5 L10 5" />
      <path d="M10 15 L10 17.5" />
      <path d="M2.5 10 L5 10" />
      <path d="M15 10 L17.5 10" />
      <path d="M4.6 4.6 L6.4 6.4" />
      <path d="M13.6 13.6 L15.4 15.4" />
      <path d="M15.4 4.6 L13.6 6.4" />
      <path d="M6.4 13.6 L4.6 15.4" />
    </g>
  </svg>
);

/**
 * Phase T0c: Prosperity tab.
 *
 * Current level · progress bar · level list · "+1 checkmark" GM action.
 * Level-up flash fires on threshold crossing.
 */
export function ProsperityTab({ party }: ProsperityTabProps) {
  const { readOnly, edition } = useContext(CampaignSheetContext);
  const commands = useCommands();
  const prosperity = party.prosperity ?? 0;
  const thresholds = edition === 'fh' ? PROSPERITY_THRESHOLDS_FH : PROSPERITY_THRESHOLDS_GH;
  const { level, currentFloor, nextThreshold } = getProsperityProgress(prosperity, edition);

  // Level-up animation cue.
  const lastLevelRef = useRef(level);
  const [flashLevelUp, setFlashLevelUp] = useState(false);
  useEffect(() => {
    if (lastLevelRef.current === level) return;
    const rose = level > lastLevelRef.current;
    lastLevelRef.current = level;
    if (!rose) return;
    setFlashLevelUp(true);
    const t = window.setTimeout(() => setFlashLevelUp(false), 1600);
    return () => window.clearTimeout(t);
  }, [level]);

  const progressDenom = nextThreshold !== null ? nextThreshold - currentFloor : 1;
  const progressNum = Math.min(prosperity - currentFloor, progressDenom);
  const progressPct = nextThreshold !== null
    ? Math.max(0, Math.min(100, (progressNum / progressDenom) * 100))
    : 100;

  const handleIncrement = () => {
    commands.updateCampaign('prosperity', prosperity + 1);
  };

  return (
    <div class={`prosperity-tab${flashLevelUp ? ' prosperity-tab--flash' : ''}`}>
      <WaxSealHeader title="Prosperity" icon={GEARS_ICON} />

      <div class="prosperity-tab__level">
        <span class="prosperity-tab__level-label">Level</span>
        <span class="prosperity-tab__level-value">{level}</span>
      </div>

      <div class="prosperity-tab__progress">
        <div class="prosperity-tab__progress-track" aria-hidden="true">
          <div
            class="prosperity-tab__progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div class="prosperity-tab__progress-label" aria-live="polite">
          {nextThreshold !== null
            ? `${progressNum} of ${progressDenom} checkmarks to level ${level + 1}`
            : 'Prosperity maxed out'}
        </div>
      </div>

      <ol class="prosperity-tab__level-list" aria-label="Prosperity levels">
        {thresholds.map((threshold, i) => {
          const rowLevel = i + 1;
          const status: 'completed' | 'current' | 'next' | 'locked' =
            rowLevel < level
              ? 'completed'
              : rowLevel === level
              ? 'current'
              : rowLevel === level + 1
              ? 'next'
              : 'locked';
          const checksRemaining = nextThreshold !== null ? nextThreshold - prosperity : 0;
          return (
            <li
              key={rowLevel}
              class={`prosperity-tab__row prosperity-tab__row--${status}`}
              aria-current={status === 'current' ? 'true' : undefined}
            >
              <span class="prosperity-tab__row-level">{rowLevel}</span>
              <span class="prosperity-tab__row-pip" aria-hidden="true">
                {status === 'completed' ? '✓' : status === 'current' ? '●' : ''}
              </span>
              <span class="prosperity-tab__row-label">
                {status === 'completed'
                  ? 'Rewards revealed in-game'
                  : status === 'current'
                  ? 'You are here'
                  : status === 'next'
                  ? `${checksRemaining} check${checksRemaining === 1 ? '' : 's'} to unlock`
                  : 'Locked'}
              </span>
              <span class="prosperity-tab__row-threshold">{threshold}</span>
            </li>
          );
        })}
      </ol>

      {!readOnly && (
        <div class="prosperity-tab__actions">
          <button
            type="button"
            class="prosperity-tab__increment"
            aria-label={
              nextThreshold !== null
                ? `Add prosperity checkmark (current: ${prosperity}, ${progressNum} of ${progressDenom} toward level ${level + 1})`
                : `Add prosperity checkmark (current: ${prosperity}, at max level)`
            }
            onClick={handleIncrement}
          >
            +1 Checkmark
          </button>
        </div>
      )}
    </div>
  );
}
