import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface PartySheetIntroProps {
  partyName: string;
  onComplete: () => void;
}

/**
 * Phase T0b: one-time intro animation — "A leather book opening".
 *
 * Parallel to T0a's PlayerSheetIntro. JS advances a `data-phase` attribute
 * and CSS reacts; keeps interactivity out of effects. Respects
 * `prefers-reduced-motion` (fires complete immediately).
 *
 * Phase timing (additive, ~3 s total):
 *   0–300ms    backdrop fades to opaque
 *   300–900    closed leather book fades in
 *   900–1600   cover swings open on Y-axis (transform-origin: left); inside page fades in
 *   1600–2200  party name fades in above the open book
 *   2200–2800  "Your campaign begins…" subtitle appears
 *   2800–3000  everything fades as the Party Sheet fades in behind
 */
export function PartySheetIntro({ partyName, onComplete }: PartySheetIntroProps) {
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
    timers.push(setTimeout(() => setPhase(1), 0));       // backdrop + closed book
    timers.push(setTimeout(() => setPhase(2), 300));     // book fade-in complete
    timers.push(setTimeout(() => setPhase(3), 900));     // cover opens
    timers.push(setTimeout(() => setPhase(4), 1600));    // title
    timers.push(setTimeout(() => setPhase(5), 2800));    // fade out
    timers.push(setTimeout(finish, 3000));               // complete
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  const displayName = partyName?.trim() || 'Your Party';

  const handleSkip = () => {
    setPhase(5);
    setTimeout(finish, 200);
  };

  return (
    <div
      class="party-sheet-intro"
      data-phase={phase}
      onClick={handleSkip}
      role="presentation"
    >
      <div class="party-sheet-intro__backdrop" />

      <div class="party-sheet-intro__stage">
        {/* Two-layer SVG: spine + inside page (rendered on open), cover swings on Y-axis. */}
        <div class="party-sheet-intro__book" aria-hidden="true">
          <svg
            class="party-sheet-intro__book-page"
            viewBox="0 0 220 280"
            preserveAspectRatio="xMidYMid meet"
          >
            <rect x="0" y="0" width="220" height="280" rx="6" fill="var(--parchment-aged)" />
            <rect x="12" y="20" width="196" height="2" fill="var(--gilt-gold-shadow)" opacity="0.4" />
            <rect x="12" y="30" width="140" height="2" fill="var(--gilt-gold-shadow)" opacity="0.3" />
            <rect x="12" y="48" width="196" height="1" fill="var(--parchment-ink-dim)" opacity="0.25" />
            <rect x="12" y="62" width="176" height="1" fill="var(--parchment-ink-dim)" opacity="0.2" />
            <rect x="12" y="74" width="190" height="1" fill="var(--parchment-ink-dim)" opacity="0.2" />
            <rect x="12" y="86" width="160" height="1" fill="var(--parchment-ink-dim)" opacity="0.2" />
            <rect x="12" y="98" width="184" height="1" fill="var(--parchment-ink-dim)" opacity="0.2" />
          </svg>
          <svg
            class="party-sheet-intro__book-cover"
            viewBox="0 0 220 280"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="ps-intro-leather" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stop-color="var(--leather-brown)" />
                <stop offset="100%" stop-color="var(--leather-brown-deep)" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="220" height="280" rx="6" fill="url(#ps-intro-leather)" />
            <rect x="0" y="0" width="18" height="280" fill="var(--leather-seam)" opacity="0.7" />
            <rect
              x="28" y="28" width="164" height="224"
              rx="4"
              fill="none"
              stroke="var(--gilt-gold)" stroke-width="1.5"
              opacity="0.85"
            />
            <rect
              x="36" y="104" width="148" height="60"
              rx="2"
              fill="var(--gilt-gold)"
              opacity="0.15"
            />
            <rect
              x="36" y="116" width="148" height="2"
              fill="var(--gilt-gold)"
              opacity="0.9"
            />
            <rect
              x="36" y="150" width="148" height="2"
              fill="var(--gilt-gold)"
              opacity="0.9"
            />
          </svg>
        </div>

        <div class="party-sheet-intro__name">{displayName}</div>
        <p class="party-sheet-intro__subtitle">Your campaign begins&hellip;</p>
      </div>

      <span class="party-sheet-intro__skip-hint" aria-hidden="true">
        Tap to continue
      </span>
    </div>
  );
}
