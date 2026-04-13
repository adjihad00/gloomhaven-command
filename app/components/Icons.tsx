import { h } from 'preact';
import { statusIcon, gameIcon } from '../shared/assets';

interface IconProps {
  size?: number;
  class?: string;
}

// ── GHS asset-based icons ─────────────────────────────────────────────────

/** Health — official GHS blood drop */
export function HealthIcon({ size = 16, class: className }: IconProps) {
  return <img src={statusIcon('health')} alt="" width={size} height={size}
    class={className} aria-hidden="true" loading="lazy" />;
}

/** XP — official GHS angular star */
export function XPIcon({ size = 14, class: className }: IconProps) {
  return <img src={statusIcon('experience')} alt="" width={size} height={size}
    class={className} aria-hidden="true" loading="lazy" />;
}

/** Gold/Loot — official GHS coin */
export function GoldIcon({ size = 14, class: className }: IconProps) {
  return <img src={statusIcon('loot')} alt="" width={size} height={size}
    class={className} aria-hidden="true" loading="lazy" />;
}

/** Loot — official GHS loot icon (bag/sack) */
export function LootIcon({ size = 14, class: className }: IconProps) {
  return <img src={statusIcon('loot')} alt="" width={size} height={size}
    class={className} aria-hidden="true" loading="lazy" />;
}

/** Trap — official GHS trap icon */
export function TrapIcon({ size = 14, class: className }: IconProps) {
  return <img src={gameIcon('trap')} alt="" width={size} height={size}
    class={className} aria-hidden="true" loading="lazy" />;
}

/** Long Rest — official GHS long-rest icon */
export function LongRestIcon({ size = 18, class: className }: IconProps) {
  return <img src={gameIcon('long-rest')} alt="" width={size} height={size}
    class={className} aria-hidden="true" loading="lazy" />;
}

// ── Custom inline SVG icons (no GHS equivalent) ───────────────────────────

/** Summon paw icon */
export function PawIcon({ size = 14, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      class={className} aria-hidden="true">
      <ellipse cx="12" cy="16" rx="5" ry="4"/>
      <circle cx="7" cy="9" r="2.5"/>
      <circle cx="17" cy="9" r="2.5"/>
      <circle cx="4.5" cy="13" r="2"/>
      <circle cx="19.5" cy="13" r="2"/>
    </svg>
  );
}

/** Closed door silhouette */
export function DoorClosedIcon({ size = 18, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      class={className} aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="1" fill="currentColor"/>
      <rect x="6" y="4" width="12" height="8" rx="0.5" fill="currentColor" opacity="0.5"/>
      <rect x="6" y="14" width="12" height="6" rx="0.5" fill="currentColor" opacity="0.5"/>
      <circle cx="16" cy="13" r="1.2" fill="currentColor" opacity="0.7"/>
    </svg>
  );
}

/** Open door silhouette */
export function DoorOpenIcon({ size = 18, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      class={className} aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="1" fill="none"
        stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>
      <rect x="6" y="4" width="5" height="16" rx="0.5" fill="currentColor" opacity="0.4"
        transform="skewY(-5)"/>
    </svg>
  );
}

/** Hazard/danger icon — spiky star shape */
export function HazardIcon({ size = 14, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      class={className} aria-hidden="true">
      <path d="M12 2L14 8L18 6L16 12L22 14L16 16L18 22L12 18L6 22L8 16L2 14L8 12L6 6L10 8L12 2Z"/>
    </svg>
  );
}

