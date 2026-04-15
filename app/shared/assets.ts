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

export function lootCardIcon(type: string, coinValue?: number): string {
  if (type === 'money' && coinValue) {
    return `/assets/ghs/images/fh/loot/loot-money${coinValue}.png`;
  }
  return `/assets/ghs/images/fh/loot/loot-${type}.png`;
}
