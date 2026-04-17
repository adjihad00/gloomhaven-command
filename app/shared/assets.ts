// Asset URL helpers — all assets served at /assets/ by the server
// GHS images live under assets/ghs/images/

export function characterThumbnail(edition: string, name: string): string {
  return `/assets/ghs/images/character/thumbnail/${edition}-${name}.png`;
}

export function monsterThumbnail(edition: string, name: string): string {
  return `/assets/ghs/images/monster/thumbnail/${edition}-${name}.png`;
}

export function conditionIcon(name: string): string {
  return `/assets/ghs/images/condition/${name}.svg`;
}

export function elementIcon(name: string): string {
  return `/assets/ghs/images/element/${name}.svg`;
}

export function statusIcon(name: string): string {
  return `/assets/ghs/images/status/${name}.svg`;
}

export function gameIcon(name: string): string {
  return `/assets/ghs/images/${name}.svg`;
}

export function editionLogo(edition: string): string {
  return `/assets/ghs/images/logos/${edition}.png`;
}

export function characterIcon(edition: string, name: string): string {
  return `/assets/ghs/images/character/icons/${edition}-${name}.svg`;
}

export function actionIcon(type: string): string {
  return `/assets/ghs/images/action/${type}.svg`;
}

export function amCardImage(type: string): string {
  return `/assets/ghs/images/attackmodifier/${type}.png`;
}

/** Edition directory names for Worldhaven battle goal images */
const EDITION_DIRS: Record<string, string> = {
  gh: 'gloomhaven', fh: 'frosthaven', jotl: 'jaws-of-the-lion',
  cs: 'crimson-scales', toa: 'trail-of-ashes',
};

export function battleGoalCard(edition: string, goalName: string): string {
  const dir = EDITION_DIRS[edition] || edition;
  const slug = goalName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `/assets/worldhaven/images/battle-goals/${dir}/${edition}-${slug}.png`;
}

export function battleGoalCardBack(edition: string): string {
  const dir = EDITION_DIRS[edition] || edition;
  return `/assets/worldhaven/images/battle-goals/${dir}/${edition}-battle-goals-back.png`;
}

export function lootCardIcon(type: string, coinValue?: number): string {
  if (type === 'money' && coinValue) {
    return `/assets/ghs/images/fh/loot/loot-money${coinValue}.png`;
  }
  return `/assets/ghs/images/fh/loot/loot-${type}.png`;
}

/**
 * Compact resource icon (black-and-white) for character-sheet / rewards surfaces.
 * Uses the Worldhaven `art/<edition>/icons/loot/` set — smaller, chip-friendly
 * art than the full loot-card images returned by `lootCardIcon`.
 *
 * Falls back to the FH icon set for non-FH editions because those editions have
 * no resource system in the rules anyway.
 */
export function resourceIcon(type: string): string {
  return `/assets/worldhaven/images/art/frosthaven/icons/loot/fh-${type}-bw-icon.png`;
}
