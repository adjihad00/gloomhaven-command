import { h } from 'preact';
import { useRef, useEffect, useState } from 'preact/hooks';

interface IlluminatedCapitalProps {
  /** The letter to illuminate. Only the first character is used. */
  letter: string;
  /** Accessible label for screen readers. Falls back to the letter. */
  ariaLabel?: string;
}

/**
 * Phase T0a: stylized-modern drop-cap for Player Sheet headers.
 *
 * Letter centred in Cinzel 700 at `--class-accent`, with a single
 * flowing corner flourish (no heavy medieval frame — per design brief's
 * "stylized-modern, not literal manuscript" direction). Fades in with
 * scale 0.9→1.0 and ink-settle easing on first mount only; subsequent
 * re-renders skip the animation (tracked via ref).
 *
 * Respects `prefers-reduced-motion` — the CSS rule in sheets.css
 * disables the animation there.
 */
export function IlluminatedCapital({ letter, ariaLabel }: IlluminatedCapitalProps) {
  const hasAnimated = useRef(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    setShouldAnimate(true);
  }, []);

  const char = (letter || '').slice(0, 1).toUpperCase();

  return (
    <div
      class={`illuminated-capital${shouldAnimate ? ' illuminated-capital--entering' : ''}`}
      role="img"
      aria-label={ariaLabel || char}
    >
      <svg
        viewBox="0 0 80 80"
        width="80"
        height="80"
        class="illuminated-capital__svg"
        aria-hidden="true"
      >
        {/* Single flowing flourish in the top-left corner — vine/ribbon motif */}
        <path
          class="illuminated-capital__flourish"
          d="M 8 14 C 14 10, 22 10, 26 16 C 22 18, 16 20, 14 26 C 12 20, 10 16, 8 14 Z"
          fill="var(--class-accent)"
          opacity="0.85"
        />
        {/* Thin accent rule dropping from the flourish — implies manuscript margin */}
        <path
          class="illuminated-capital__rule"
          d="M 14 26 L 14 62"
          stroke="var(--class-accent)"
          stroke-width="1"
          opacity="0.35"
          stroke-linecap="round"
        />
        <text
          class="illuminated-capital__letter"
          x="44"
          y="60"
          text-anchor="middle"
          fill="var(--class-accent)"
        >
          {char}
        </text>
      </svg>
    </div>
  );
}
