import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface CampaignSheetIntroProps {
  title: string;
  onComplete: () => void;
}

/**
 * Phase T0c: one-time intro animation — "A map unfurling".
 *
 * Parallel to T0a's PlayerSheetIntro and T0b's PartySheetIntro. JS advances
 * a `data-phase` attribute and CSS reacts; keeps interactivity out of
 * effects. Respects `prefers-reduced-motion` (fires complete immediately).
 *
 * Phase timing (additive, ~3 s total):
 *   0–300ms    backdrop fades to opaque
 *   300–900    rolled scroll (with wax seal) fades in center
 *   900–1800   scroll unfurls horizontally; parchment reveals
 *   1800–2300  campaign title fades in above the scroll
 *   2300–2800  "The world turns." subtitle in italics
 *   2800–3000  everything fades as the Campaign Sheet fades in behind
 */
export function CampaignSheetIntro({ title, onComplete }: CampaignSheetIntroProps) {
  const reducedMotion =
    typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const completedRef = useRef(false);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  useEffect(() => {
    if (!reducedMotion) return;
    finish();
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase(1), 0));       // backdrop + rolled scroll
    timers.push(setTimeout(() => setPhase(2), 300));     // scroll fade-in complete
    timers.push(setTimeout(() => setPhase(3), 900));     // unfurl
    timers.push(setTimeout(() => setPhase(4), 1800));    // title + subtitle
    timers.push(setTimeout(() => setPhase(5), 2800));    // fade out
    timers.push(setTimeout(finish, 3000));
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  const handleSkip = () => {
    setPhase(5);
    setTimeout(finish, 200);
  };

  return (
    <div
      class="campaign-sheet-intro"
      data-phase={phase}
      onClick={handleSkip}
      role="presentation"
    >
      <div class="campaign-sheet-intro__backdrop" />

      <div class="campaign-sheet-intro__stage">
        {/* Rolled scroll with wax seal → unfurls horizontally via CSS */}
        <div class="campaign-sheet-intro__scroll" aria-hidden="true">
          <svg
            class="campaign-sheet-intro__parchment"
            viewBox="0 0 320 140"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="cs-intro-parchment" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="var(--parchment-aged)" />
                <stop offset="100%" stop-color="var(--parchment-base)" />
              </linearGradient>
            </defs>
            <rect x="20" y="16" width="280" height="108" rx="4" fill="url(#cs-intro-parchment)" />
            {/* Map-ish hinting — compass rose + trail lines */}
            <g opacity="0.25" stroke="var(--parchment-ink-dim)" fill="none" stroke-width="1">
              <path d="M 60 70 Q 110 40 170 70 T 270 70" />
              <circle cx="90" cy="80" r="3" fill="var(--parchment-ink-dim)" stroke="none" />
              <circle cx="220" cy="60" r="3" fill="var(--parchment-ink-dim)" stroke="none" />
              <path d="M 160 35 L 160 105 M 130 70 L 190 70" />
            </g>
          </svg>
          {/* Rolled-end caps (left + right) that slide outward */}
          <div class="campaign-sheet-intro__roll campaign-sheet-intro__roll--left" aria-hidden="true">
            <svg viewBox="0 0 40 140" preserveAspectRatio="xMidYMid meet">
              <rect x="0" y="10" width="40" height="120" rx="20" fill="var(--leather-brown-deep)" />
              <rect x="4" y="14" width="32" height="112" rx="16" fill="var(--leather-brown)" />
              <rect x="10" y="18" width="2" height="104" fill="var(--gilt-gold-shadow)" opacity="0.5" />
            </svg>
          </div>
          <div class="campaign-sheet-intro__roll campaign-sheet-intro__roll--right" aria-hidden="true">
            <svg viewBox="0 0 40 140" preserveAspectRatio="xMidYMid meet">
              <rect x="0" y="10" width="40" height="120" rx="20" fill="var(--leather-brown-deep)" />
              <rect x="4" y="14" width="32" height="112" rx="16" fill="var(--leather-brown)" />
              <rect x="28" y="18" width="2" height="104" fill="var(--gilt-gold-shadow)" opacity="0.5" />
            </svg>
          </div>
          {/* Wax seal hanging at bottom center */}
          <div class="campaign-sheet-intro__seal" aria-hidden="true">
            <svg viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="12" fill="var(--gilt-gold-shadow)" />
              <circle cx="14" cy="14" r="8" fill="var(--gilt-gold)" opacity="0.85" />
              <path
                d="M 10 14 L 13 17 L 18 11"
                fill="none"
                stroke="var(--parchment-base)"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>

        <div class="campaign-sheet-intro__title">{title}</div>
        <p class="campaign-sheet-intro__subtitle">The world turns&hellip;</p>
      </div>

      <span class="campaign-sheet-intro__skip-hint" aria-hidden="true">
        Tap to continue
      </span>
    </div>
  );
}
