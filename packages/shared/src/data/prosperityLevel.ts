/**
 * Prosperity level thresholds — cumulative checkmark counts required to
 * reach each level. Prosperity is a running count of checkmarks accrued
 * during the campaign; at each threshold the level increments, unlocking
 * new items / rewards.
 *
 * Source: docs/GAME_RULES_REFERENCE.md §Prosperity.
 *
 * Index i = checkmarks needed for level (i + 1). Level 1 = starting level
 * (0 checkmarks). Levels 1..9.
 */

export const PROSPERITY_THRESHOLDS_GH: readonly number[] = [0, 3, 8, 14, 21, 29, 38, 48, 59];
export const PROSPERITY_THRESHOLDS_FH: readonly number[] = [0, 5, 12, 21, 32, 45, 60, 77, 96];

function thresholdsFor(edition: string): readonly number[] {
  return edition === 'fh' ? PROSPERITY_THRESHOLDS_FH : PROSPERITY_THRESHOLDS_GH;
}

/**
 * Given a raw prosperity checkmark count, return the current prosperity
 * level (1..9). Clamps to 9 above the final threshold.
 */
export function getProsperityLevel(prosperity: number, edition: string): number {
  const thresholds = thresholdsFor(edition);
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (prosperity >= thresholds[i]) level = i + 1;
    else break;
  }
  return level;
}

/**
 * Progress toward the next prosperity level. `nextThreshold` is null when
 * the party is at max level.
 */
export function getProsperityProgress(
  prosperity: number,
  edition: string,
): { level: number; currentFloor: number; nextThreshold: number | null } {
  const thresholds = thresholdsFor(edition);
  const level = getProsperityLevel(prosperity, edition);
  const currentFloor = thresholds[level - 1];
  const nextThreshold = level < thresholds.length ? thresholds[level] : null;
  return { level, currentFloor, nextThreshold };
}
