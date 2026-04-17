/**
 * Per-item gold price modifier from party reputation.
 *
 * Positive reputation → price discount (negative modifier on cost).
 * Negative reputation → price increase.
 *
 * Returns an integer in the closed range [-5, +5]. Price floor-at-0 is the
 * caller's responsibility (T2a purchase logic).
 *
 * Source: docs/GAME_RULES_REFERENCE.md §16 Reputation & Economy.
 *
 * Brackets (reputation ≥ …):
 *   +19 → −5   +15 → −4   +11 → −3   +7 → −2   +3 → −1
 *   between −2 and +2 → 0
 *   ≤ −3 → +1   ≤ −7 → +2   ≤ −11 → +3   ≤ −15 → +4   ≤ −19 → +5
 */
export function getReputationPriceModifier(reputation: number): number {
  if (reputation >= 19) return -5;
  if (reputation >= 15) return -4;
  if (reputation >= 11) return -3;
  if (reputation >= 7) return -2;
  if (reputation >= 3) return -1;
  if (reputation >= -2) return 0;
  if (reputation >= -6) return 1;
  if (reputation >= -10) return 2;
  if (reputation >= -14) return 3;
  if (reputation >= -18) return 4;
  return 5;
}
