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
