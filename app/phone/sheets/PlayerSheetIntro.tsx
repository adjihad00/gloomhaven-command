import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Character } from '@gloomhaven-command/shared';
import { characterIcon } from '../../shared/assets';
import { formatName } from '../../shared/formatName';
import { IlluminatedCapital } from './IlluminatedCapital';

interface PlayerSheetIntroProps {
  character: Character;
  edition: string;
  onComplete: () => void;
}

/**
 * Phase T0a: one-time intro animation — "Your story begins…"
 *
 * 5-phase CSS-driven sequence, ~3 seconds total. Tap anywhere to skip.
 * Respects `prefers-reduced-motion` — fires `onComplete` immediately so
 * the flag still persists without any animation.
 *
 * Phase timing (all additive):
 *   0–400ms   backdrop + sigil fade in
 *   400–1000  character name types on
 *   1000–1600 illuminated capital paints in
 *   1600–2400 "Your story begins..." subtitle appears
 *   2400–3000 everything fades out; onComplete fires
 *
 * Implementation notes:
 *   - Single `requestAnimationFrame`-driven timer chain. Cleaned up on
 *     unmount so a mid-intro close still cleans timeouts.
 *   - `onComplete` fires exactly once (guarded via ref) even on skip.
 *   - All animations in CSS; JS only advances a `data-phase` attribute
 *     which the stylesheet reacts to. Keeps interactivity out of
 *     effects per `rerender-move-effect-to-event`.
 */
export function PlayerSheetIntro({ character, edition, onComplete }: PlayerSheetIntroProps) {
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const completedRef = useRef(false);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  // Reduced-motion: complete immediately, no animation.
  useEffect(() => {
    if (!reducedMotion) return;
    finish();
  }, [reducedMotion]);

  // Timer chain. Each setTimeout is captured for cleanup on unmount.
  useEffect(() => {
    if (reducedMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase(1), 0));       // sigil
    timers.push(setTimeout(() => setPhase(2), 400));     // name
    timers.push(setTimeout(() => setPhase(3), 1000));    // illuminated capital
    timers.push(setTimeout(() => setPhase(4), 1600));    // subtitle
    timers.push(setTimeout(() => setPhase(5), 2400));    // fade out
    timers.push(setTimeout(finish, 3000));                // onComplete
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  const displayTitle = character.title || formatName(character.name);

  const handleSkip = () => {
    // Jump to phase 5 (fade out) and finish slightly earlier.
    setPhase(5);
    setTimeout(finish, 200);
  };

  return (
    <div
      class="player-sheet-intro"
      data-phase={phase}
      onClick={handleSkip}
      role="presentation"
    >
      <div class="player-sheet-intro__backdrop" />

      <div class="player-sheet-intro__stage">
        <img
          class="player-sheet-intro__sigil"
          src={characterIcon(character.edition || edition, character.name)}
          alt=""
        />

        <div class="player-sheet-intro__name">
          {[...displayTitle].map((char, i) => (
            <span
              key={i}
              class="player-sheet-intro__char"
              style={{ animationDelay: `${400 + i * 30}ms` }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </div>

        <div class="player-sheet-intro__capital">
          <IlluminatedCapital letter={displayTitle.charAt(0)} />
        </div>

        <p class="player-sheet-intro__subtitle">Your story begins&hellip;</p>
      </div>

      <span class="player-sheet-intro__skip-hint" aria-hidden="true">
        Tap to continue
      </span>
    </div>
  );
}
