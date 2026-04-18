import { h, type ComponentChildren } from 'preact';

interface WaxSealHeaderProps {
  /** Tab title, e.g. "Prosperity" or "Outpost". */
  title: string;
  /**
   * Icon rendered inside the wax seal. Pass a compact SVG VNode (≤22×22)
   * or a single-character glyph. The seal's circular stamp is drawn
   * by CSS; this is the central relief.
   */
  icon?: ComponentChildren;
}

/**
 * Phase T0c: Campaign Sheet signature element. A wax-sealed header
 * opens every Campaign tab's content area — consistent visual language
 * across all 7 tabs.
 *
 * Layout: 44 px gilt seal with tab-specific icon · Cinzel 22 px gilt
 * title · thin gilt rule below. `role="heading" aria-level="2"`.
 */
export function WaxSealHeader({ title, icon }: WaxSealHeaderProps) {
  return (
    <div class="campaign-sheet__wax-header">
      <div class="campaign-sheet__wax-seal" aria-hidden="true">
        <svg class="campaign-sheet__wax-seal-svg" viewBox="0 0 44 44">
          <defs>
            <radialGradient id="cs-seal-wax" cx="30%" cy="30%" r="80%">
              <stop offset="0%" stop-color="var(--gilt-gold)" stop-opacity="0.75" />
              <stop offset="60%" stop-color="var(--gilt-gold-shadow)" />
              <stop offset="100%" stop-color="var(--leather-brown-deep)" />
            </radialGradient>
          </defs>
          <circle cx="22" cy="22" r="20" fill="url(#cs-seal-wax)" />
          <circle
            cx="22"
            cy="22"
            r="14"
            fill="var(--gilt-gold)"
            opacity="0.18"
          />
          <circle
            cx="22"
            cy="22"
            r="14"
            fill="none"
            stroke="var(--gilt-gold)"
            stroke-width="0.8"
            opacity="0.6"
          />
        </svg>
        {icon !== undefined && (
          <span class="campaign-sheet__wax-seal-icon">{icon}</span>
        )}
      </div>
      <h2
        class="campaign-sheet__wax-title"
        role="heading"
        aria-level={2}
      >
        {title}
      </h2>
      <div class="campaign-sheet__wax-rule" aria-hidden="true" />
    </div>
  );
}
