import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { conditionIcon } from '../../shared/assets';
import type { ConditionName, EntityCondition } from '@gloomhaven-command/shared';

/** Conditions that trigger splash overlays, in priority order (most restrictive first). */
const SPLASH_CONDITIONS: {
  name: ConditionName;
  title: string;
  subtitle: string;
  cssClass: string;
  positive?: boolean;
}[] = [
  {
    name: 'stun',
    title: 'STUNNED',
    subtitle: 'You cannot perform any abilities or use items. Removed at end of your turn.',
    cssClass: 'splash--stun',
  },
  {
    name: 'wound',
    title: 'WOUNDED',
    subtitle: 'You suffer 1 damage at start of turn. Removed when healed.',
    cssClass: 'splash--wound',
  },
  {
    name: 'poison',
    title: 'POISONED',
    subtitle: 'All attacks against you gain +1. Heal removes poison instead of restoring HP.',
    cssClass: 'splash--poison',
  },
  {
    name: 'disarm',
    title: 'DISARMED',
    subtitle: 'You cannot perform attack abilities. You may still move. Removed at end of your turn.',
    cssClass: 'splash--disarm',
  },
  {
    name: 'immobilize',
    title: 'IMMOBILIZED',
    subtitle: 'You cannot perform move abilities. You may still attack. Removed at end of your turn.',
    cssClass: 'splash--immobilize',
  },
  {
    name: 'muddle',
    title: 'MUDDLED',
    subtitle: 'Disadvantage on all attacks. Draw 2 modifiers, use worse. Removed at end of your turn.',
    cssClass: 'splash--muddle',
  },
  {
    name: 'bane',
    title: 'BANE',
    subtitle: 'You will suffer 10 damage at end of next turn. Removed by healing.',
    cssClass: 'splash--bane',
  },
  {
    name: 'regenerate',
    title: 'REGENERATE',
    subtitle: 'Heal 1, self at start of turn. Removed when you suffer damage.',
    cssClass: 'splash--regenerate',
    positive: true,
  },
  {
    name: 'strengthen',
    title: 'STRENGTHENED',
    subtitle: 'Advantage on all attacks. Removed at end of your turn.',
    cssClass: 'splash--strengthen',
    positive: true,
  },
  {
    name: 'invisible',
    title: 'INVISIBLE',
    subtitle: 'Cannot be focused or targeted by enemies. Removed at end of your turn.',
    cssClass: 'splash--invisible',
    positive: true,
  },
  {
    name: 'ward',
    title: 'WARDED',
    subtitle: 'Next damage suffered is halved (round down). Removed after halving once.',
    cssClass: 'splash--ward',
    positive: true,
  },
  {
    name: 'brittle',
    title: 'BRITTLE',
    subtitle: 'Next damage suffered is doubled. Removed after doubling once, or when healed.',
    cssClass: 'splash--brittle',
  },
  {
    name: 'impair',
    title: 'IMPAIRED',
    subtitle: 'Cannot use or trigger items. Removed at end of your turn.',
    cssClass: 'splash--impair',
  },
];

interface PhoneConditionSplashProps {
  conditions: EntityCondition[];
  isActive: boolean;
  phase: string;
}

export function PhoneConditionSplash({ conditions, isActive, phase }: PhoneConditionSplashProps) {
  const [queue, setQueue] = useState<typeof SPLASH_CONDITIONS>([]);
  const [currentSplash, setCurrentSplash] = useState<typeof SPLASH_CONDITIONS[0] | null>(null);
  const prevActive = useRef(false);
  const autoTimer = useRef<number | null>(null);

  // Detect active transition (false → true) during play phase
  useEffect(() => {
    // GHS phase: 'draw' = card selection, 'next' = playing turns
    if (isActive && !prevActive.current && phase === 'next') {
      // Build queue of matching conditions
      const activeConditionNames = new Set(
        conditions
          .filter(c => c.state !== 'removed' && !c.expired)
          .map(c => c.name)
      );

      const matchingSplashes = SPLASH_CONDITIONS.filter(s => activeConditionNames.has(s.name));

      if (matchingSplashes.length > 0) {
        setQueue(matchingSplashes.slice(1));
        setCurrentSplash(matchingSplashes[0]);
      }
    }
    prevActive.current = isActive;
  }, [isActive, phase, conditions]);

  // Auto-dismiss timer
  useEffect(() => {
    if (currentSplash) {
      autoTimer.current = window.setTimeout(() => {
        advanceQueue();
      }, 4000);

      return () => {
        if (autoTimer.current) clearTimeout(autoTimer.current);
      };
    }
  }, [currentSplash]);

  const advanceQueue = useCallback(() => {
    if (autoTimer.current) {
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }

    if (queue.length > 0) {
      setCurrentSplash(queue[0]);
      setQueue(prev => prev.slice(1));
    } else {
      setCurrentSplash(null);
    }
  }, [queue]);

  const handleDismiss = () => {
    advanceQueue();
  };

  if (!currentSplash) return null;

  return (
    <div
      class={`splash-overlay ${currentSplash.cssClass}`}
      onClick={handleDismiss}
      role="alertdialog"
      aria-modal="true"
      aria-label={`${currentSplash.title} condition reminder`}
    >
      <div class="splash-overlay__bg" aria-hidden="true" />
      <div class="splash-overlay__content">
        <img
          src={conditionIcon(currentSplash.name)}
          alt=""
          class="splash-overlay__icon"
          aria-hidden="true"
        />
        <h2 class={`splash-overlay__title ${currentSplash.positive ? 'splash-overlay__title--positive' : ''}`}>
          {currentSplash.title}
        </h2>
        <p class="splash-overlay__subtitle">{currentSplash.subtitle}</p>
      </div>
      <span class="splash-overlay__hint">Tap to dismiss</span>
    </div>
  );
}
