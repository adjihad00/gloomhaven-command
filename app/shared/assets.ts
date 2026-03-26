// Asset URL helpers — all assets served at /assets/ by the server
export function characterThumbnail(edition: string, name: string): string {
  return `/assets/images/character/thumbnail/${edition}-${name}.png`;
}

export function monsterThumbnail(edition: string, name: string): string {
  return `/assets/images/monster/thumbnail/${edition}-${name}.png`;
}

export function conditionIcon(name: string): string {
  return `/assets/images/condition/${name}.svg`;
}

export function elementIcon(name: string): string {
  return `/assets/images/element/${name}.svg`;
}
