import { h } from 'preact';

interface IconProps {
  size?: number;
  class?: string;
}

export function HeartIcon({ size = 16, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" class={className} aria-hidden="true">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  );
}

export function StarIcon({ size = 14, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" class={className} aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}

export function CoinIcon({ size = 14, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" class={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function PawIcon({ size = 14, class: className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" class={className} aria-hidden="true">
      <ellipse cx="12" cy="16" rx="5" ry="4"/>
      <circle cx="7" cy="9" r="2.5"/>
      <circle cx="17" cy="9" r="2.5"/>
      <circle cx="4.5" cy="13" r="2"/>
      <circle cx="19.5" cy="13" r="2"/>
    </svg>
  );
}
