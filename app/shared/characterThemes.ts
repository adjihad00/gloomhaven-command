/**
 * Per-character color palettes derived from character mat artwork.
 * Each theme has: bg (dark background tint), accent (primary highlight),
 * flair (secondary/tertiary color for additional visual interest).
 * Fallback uses the GHS `color` field from edition data.
 *
 * Shared across phone / controller / display. Prior to Phase T0a this lived
 * at `app/phone/characterThemes.ts` and was cross-imported by the display
 * client — moved to `app/shared/` to remove the cross-client import smell
 * and give the new Player Sheet surface a single source of truth.
 */

export interface CharacterTheme {
  bg: string;       // Dark background tint (replaces #1a1410)
  accent: string;   // Primary accent (borders, glows, active states)
  flair: string;    // Secondary color (extra highlights, gradients)
}

const THEMES: Record<string, CharacterTheme> = {
  // ── Frosthaven ──
  'boneshaper':    { bg: '#0f2618', accent: '#44cc66', flair: '#cc44aa' },
  'drifter':       { bg: '#2a1f10', accent: '#ccaa44', flair: '#e8d4a0' },
  'blinkblade':    { bg: '#0f1e2e', accent: '#44bbee', flair: '#88ddff' },
  'banner-spear':  { bg: '#2a2010', accent: '#ddaa33', flair: '#4499cc' },
  'deathwalker':   { bg: '#141e24', accent: '#6699aa', flair: '#99ccdd' },
  'geminate':      { bg: '#2a1028', accent: '#cc4488', flair: '#ee88bb' },
  'infuser':       { bg: '#1a1830', accent: '#7766cc', flair: '#aa99ee' },
  'pyroclast':     { bg: '#2a1008', accent: '#ee6622', flair: '#ffaa44' },
  'shattersong':   { bg: '#201028', accent: '#aa55cc', flair: '#dd88ee' },
  'trapper':       { bg: '#1a2818', accent: '#66aa44', flair: '#99cc77' },
  'crashing-tide': { bg: '#0e1e2a', accent: '#3399bb', flair: '#66ccee' },
  'deepwraith':    { bg: '#10182a', accent: '#4466bb', flair: '#7799dd' },
  'frozen-fist':   { bg: '#142030', accent: '#5588cc', flair: '#88bbee' },
  'hive':          { bg: '#1e2010', accent: '#99aa33', flair: '#ccdd66' },
  'metal-mosaic':  { bg: '#1e1818', accent: '#aa7744', flair: '#cc9966' },
  'pain-conduit':  { bg: '#2a0e0e', accent: '#cc3333', flair: '#ee6666' },
  'snowdancer':    { bg: '#162030', accent: '#77aadd', flair: '#aaddff' },

  // ── Gloomhaven starters ──
  'brute':         { bg: '#141828', accent: '#4488cc', flair: '#ddaa33' },
  'cragheart':     { bg: '#1e1a0e', accent: '#aa8833', flair: '#ddcc77' },
  'mindthief':     { bg: '#181428', accent: '#6655aa', flair: '#9988dd' },
  'scoundrel':     { bg: '#141e10', accent: '#669933', flair: '#99cc66' },
  'spellweaver':   { bg: '#1e1028', accent: '#9944cc', flair: '#cc77ee' },
  'tinkerer':      { bg: '#201810', accent: '#bb7733', flair: '#ddaa66' },

  // ── GH unlockables ──
  'berserker':     { bg: '#2a0e0e', accent: '#cc3333', flair: '#ee7744' },
  'sunkeeper':     { bg: '#1e1a08', accent: '#ddaa22', flair: '#ffdd66' },
  'nightshroud':   { bg: '#0e1428', accent: '#4466cc', flair: '#8899ee' },
  'plagueherald':  { bg: '#141e14', accent: '#559944', flair: '#88cc66' },
  'quartermaster': { bg: '#1e1818', accent: '#997744', flair: '#ccaa77' },
  'soothsinger':   { bg: '#201828', accent: '#8855aa', flair: '#bb88cc' },
  'doomstalker':   { bg: '#1a1e10', accent: '#778833', flair: '#aabb66' },
  'sawbones':      { bg: '#181e1e', accent: '#558888', flair: '#88bbbb' },
  'elementalist':  { bg: '#181420', accent: '#7755aa', flair: '#aa88dd' },
  'beast-tyrant':  { bg: '#1e1810', accent: '#aa7733', flair: '#cc9955' },
  'bladeswarm':    { bg: '#1a1010', accent: '#aa4444', flair: '#cc7766' },
  'summoner':      { bg: '#1e1428', accent: '#8844aa', flair: '#bb77dd' },
};

/**
 * Get the theme for a character, falling back to a generated theme
 * from the GHS color field if no manual mapping exists.
 */
export function getCharacterTheme(name: string, fallbackColor?: string): CharacterTheme {
  const theme = THEMES[name];
  if (theme) return theme;

  // Generate from GHS color field
  if (fallbackColor) {
    return {
      bg: darkenColor(fallbackColor, 0.85),
      accent: fallbackColor,
      flair: lightenColor(fallbackColor, 0.3),
    };
  }

  // Ultimate fallback — warm gold
  return { bg: '#1a1410', accent: '#d3a663', flair: '#b87333' };
}

/**
 * Append an alpha byte to a `#rrggbb` hex string. Returns `#rrggbbaa`.
 * `alpha` is 0..1 (inclusive); clamped and rounded to a 0..255 integer.
 * Pass-through on malformed input so callers never crash on bad data.
 */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const clamped = Math.max(0, Math.min(1, alpha));
  const byte = Math.round(clamped * 255);
  return `${hex}${byte.toString(16).padStart(2, '0')}`;
}

function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#1a1410';
  return `#${Math.round(rgb.r * (1 - amount)).toString(16).padStart(2, '0')}${Math.round(rgb.g * (1 - amount)).toString(16).padStart(2, '0')}${Math.round(rgb.b * (1 - amount)).toString(16).padStart(2, '0')}`;
}

function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#d3a663';
  const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * amount));
  const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * amount));
  const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}
