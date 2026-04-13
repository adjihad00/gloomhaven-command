// Scenario level auto-calculation and derived values

export interface LevelDerivedValues {
  scenarioLevel: number;
  monsterLevel: number;
  goldConversion: number;
  trapDamage: number;
  hazardousTerrain: number;
  bonusXP: number;
}

/** Auto-calculate scenario level from character levels */
export function calculateScenarioLevel(
  characterLevels: number[],
  adjustment: number = 0,
  solo: boolean = false,
): number {
  if (characterLevels.length === 0) return 1;

  const avg = characterLevels.reduce((a, b) => a + b, 0) / characterLevels.length;
  let level: number;

  if (solo) {
    level = Math.ceil(avg);
  } else {
    level = Math.ceil(avg / 2);
  }

  level += adjustment;
  return Math.max(0, Math.min(7, level));
}

/** Derive all level-dependent values */
export function deriveLevelValues(scenarioLevel: number): LevelDerivedValues {
  const goldTable = [2, 2, 3, 3, 4, 4, 5, 6];
  const hazardTable = [1, 2, 2, 2, 3, 3, 3, 4];

  return {
    scenarioLevel,
    monsterLevel: scenarioLevel,
    goldConversion: goldTable[scenarioLevel] ?? 2,
    trapDamage: 2 + scenarioLevel,
    hazardousTerrain: hazardTable[scenarioLevel] ?? 1,
    bonusXP: 4 + 2 * scenarioLevel,
  };
}

/** Minimum XP for each character level (index = level) */
export const XP_THRESHOLDS = [0, 0, 45, 95, 150, 210, 275, 345, 420, 500] as const;

/** Get minimum XP for a given level */
export function getMinXPForLevel(level: number): number {
  return XP_THRESHOLDS[Math.min(level, XP_THRESHOLDS.length - 1)] ?? 0;
}

/** Get active player count (non-absent, non-exhausted characters) */
export function getPlayerCount(
  characters: { absent?: boolean; exhausted?: boolean }[],
): number {
  return characters.filter((c) => !c.absent && !c.exhausted).length;
}
