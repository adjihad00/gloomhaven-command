import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { amCardImage } from '../../shared/assets';

interface DisplayAMDSplashProps {
  cardType: string;  // 'plus1', 'minus1', 'bless', 'curse', 'double', 'null', etc.
  onComplete: () => void;
}

const FLARE_CLASSES: Record<string, string> = {
  bless: 'amd-splash__flare--bless',
  curse: 'amd-splash__flare--curse',
  double: 'amd-splash__flare--double',
  null: 'amd-splash__flare--null',
};

export function DisplayAMDSplash({ cardType, onComplete }: DisplayAMDSplashProps) {
  const [phase, setPhase] = useState<'enter' | 'flip' | 'reveal' | 'exit'>('enter');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('flip'), 400),
      setTimeout(() => setPhase('reveal'), 800),
      setTimeout(() => setPhase('exit'), 2200),
      setTimeout(() => onComplete(), 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const flareClass = FLARE_CLASSES[cardType] || '';
  const isSpecial = ['bless', 'curse', 'double', 'null'].includes(cardType);

  return (
    <div class={`amd-splash amd-splash--${phase}`}>
      <div class="amd-splash__card-container">
        <div class={`amd-splash__card amd-splash__card--${phase}`}>
          <div class="amd-splash__card-back">
            <img src={amCardImage('am-back')} alt="Card back" class="amd-splash__card-img" />
          </div>
          <div class="amd-splash__card-front">
            <img src={amCardImage(cardType)} alt={cardType} class="amd-splash__card-img" />
          </div>
        </div>
        {isSpecial && phase === 'reveal' && (
          <div class={`amd-splash__flare ${flareClass}`} />
        )}
      </div>
    </div>
  );
}
