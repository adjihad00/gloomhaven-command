import { h } from 'preact';
import type { Character } from '@gloomhaven-command/shared';
import { XP_THRESHOLDS } from '@gloomhaven-command/shared';

interface OverviewXPBarProps {
  character: Character;
}

const MAX_LEVEL = XP_THRESHOLDS.length - 1;

/**
 * Phase T0a: Overview tab XP progress bar.
 *
 * Parchment-strip background with ink fill (class-accent gradient). Shows
 * `{careerXP} / {nextThreshold}` in tabular figures. When within 10% of
 * the next threshold, the bar pulses with class-accent glow (CSS only);
 * when the threshold is reached, a small wax-seal "Level Up" indicator
 * animates in at the right edge. At level 9 the bar shows "MAX" and
 * solid fill.
 *
 * Values derived during render (no effect needed) per
 * `rerender-derived-state-no-effect`.
 */
export function OverviewXPBar({ character }: OverviewXPBarProps) {
  const careerXP = character.progress?.experience ?? 0;
  const level = character.level;
  const atMax = level >= MAX_LEVEL;

  const currentFloor = XP_THRESHOLDS[level] ?? 0;
  const nextThreshold = atMax
    ? XP_THRESHOLDS[MAX_LEVEL]
    : XP_THRESHOLDS[level + 1] ?? currentFloor;

  const span = Math.max(1, nextThreshold - currentFloor);
  const progress = atMax ? 1 : Math.min(1, Math.max(0, (careerXP - currentFloor) / span));
  const pct = progress * 100;

  const readyToLevel = !atMax && careerXP >= nextThreshold;
  // "Within 10 XP of threshold" per design brief — absolute remaining, not %.
  // Using a count (<= 10) instead of progress >= 0.9 catches low-span cases
  // like 40/45 (progress 0.888) that would otherwise miss.
  const nearThreshold = !atMax && !readyToLevel && (nextThreshold - careerXP) <= 10;

  let stateClass = '';
  if (readyToLevel) stateClass = ' overview-xp-bar--ready';
  else if (nearThreshold) stateClass = ' overview-xp-bar--near';

  return (
    <div class={`overview-xp-bar${stateClass}`}>
      <div class="overview-xp-bar__track" aria-hidden="true">
        <div class="overview-xp-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <div
        class="overview-xp-bar__text"
        role="progressbar"
        aria-label={atMax ? 'Experience at maximum level' : 'Experience toward next level'}
        aria-valuemin={0}
        aria-valuemax={atMax ? careerXP : nextThreshold}
        aria-valuenow={careerXP}
        aria-valuetext={atMax ? `${careerXP} XP (max level)` : `${careerXP} of ${nextThreshold} XP`}
      >
        <span class="overview-xp-bar__label">XP</span>
        <span class="overview-xp-bar__value">
          {atMax ? (
            <>
              <span class="overview-xp-bar__max">MAX</span>
              <span class="overview-xp-bar__career">{careerXP}</span>
            </>
          ) : readyToLevel ? (
            // Hide numerator/denominator while the seal is present so its
            // text isn't muddled by the XP count behind it. The seal itself
            // announces the state.
            null
          ) : (
            <>
              <span class="overview-xp-bar__career">{careerXP}</span>
              <span class="overview-xp-bar__sep"> / </span>
              <span class="overview-xp-bar__threshold">{nextThreshold}</span>
            </>
          )}
        </span>
      </div>
      {readyToLevel && (
        <div class="overview-xp-bar__seal" aria-label="Level up available">
          <span class="overview-xp-bar__seal-text">LEVEL UP</span>
        </div>
      )}
    </div>
  );
}
