import { h } from 'preact';

/**
 * Phase T0a: visual placeholder for the full hand view (shipping in T2b).
 *
 * Three card-back SVGs in a subtle fan layout, non-interactive. Exists
 * to signal "there's more here" at the bottom of the Overview tab so
 * players aren't surprised when Progression lands.
 */
export function OverviewHandPreview() {
  return (
    <section class="overview-hand-preview" aria-labelledby="overview-hand-preview-heading">
      <h3 id="overview-hand-preview-heading" class="overview-hand-preview__heading">
        Hand
      </h3>
      <div class="overview-hand-preview__fan" aria-hidden="true">
        {[-14, 0, 14].map((rot, i) => (
          <div
            key={i}
            class="overview-hand-preview__card"
            style={{ transform: `rotate(${rot}deg) translateY(${Math.abs(rot) * 0.3}px)` }}
          >
            <svg viewBox="0 0 60 90" width="60" height="90">
              <rect
                x="2" y="2" width="56" height="86"
                rx="4"
                fill="var(--parchment-dark)"
                stroke="var(--class-accent)"
                stroke-width="1.5"
                opacity="0.85"
              />
              <path
                d="M 10 20 L 50 20 M 10 32 L 50 32 M 10 44 L 50 44"
                stroke="var(--class-accent)"
                stroke-width="0.8"
                opacity="0.3"
              />
              <circle cx="30" cy="66" r="8" fill="none" stroke="var(--class-accent)" stroke-width="1" opacity="0.4" />
            </svg>
          </div>
        ))}
      </div>
      <p class="overview-hand-preview__label">
        Hand and deck viewer — <span class="overview-hand-preview__batch">T2b</span>.
      </p>
    </section>
  );
}
