import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { lootCardIcon } from '../../shared/assets';

interface DisplayLootSplashProps {
  lootType: string;
  coinValue?: number;
  playerName?: string;
  targetPosition?: { x: number; y: number } | null;
  onComplete: () => void;
}

export function DisplayLootSplash({ lootType, coinValue, playerName, targetPosition, onComplete }: DisplayLootSplashProps) {
  const [phase, setPhase] = useState<'enter' | 'display' | 'shrink' | 'done'>('enter');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('display'), 500),
      setTimeout(() => setPhase('shrink'), 2000),
      setTimeout(() => {
        setPhase('done');
        onComplete();
      }, 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const label = lootType === 'money'
    ? `${coinValue || 1} Gold`
    : lootType.charAt(0).toUpperCase() + lootType.slice(1);

  // Calculate shrink animation target
  const shrinkStyle: Record<string, string> = {};
  if (phase === 'shrink' && targetPosition) {
    // Center of viewport
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = targetPosition.x - cx;
    const dy = targetPosition.y - cy;
    shrinkStyle['--loot-target-x'] = `${dx}px`;
    shrinkStyle['--loot-target-y'] = `${dy}px`;
  }

  const cardClass = targetPosition && phase === 'shrink'
    ? 'loot-splash__card loot-splash__card--shrink-to-target'
    : `loot-splash__card loot-splash__card--${phase}`;

  return (
    <div class={`loot-splash loot-splash--${phase}`}>
      <div class={cardClass} style={shrinkStyle}>
        <img src={lootCardIcon(lootType, coinValue)} alt={label}
          class="loot-splash__card-img" />
        <div class="loot-splash__label">{label}</div>
        {playerName && phase === 'shrink' && (
          <div class="loot-splash__player">{'\u2192'} {playerName}</div>
        )}
      </div>
    </div>
  );
}
