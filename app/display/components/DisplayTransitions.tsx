import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

export type TransitionType = 'victory' | 'defeat' | 'round' | 'start' | null;

interface DisplayTransitionsProps {
  transition: TransitionType;
  roundNumber?: number;
  scenarioName?: string;
  onComplete?: () => void;
}

const DURATIONS: Record<string, number> = {
  victory: 3000,
  defeat: 3000,
  round: 1500,
  start: 2500,
};

export function DisplayTransitions({ transition, roundNumber, scenarioName, onComplete }: DisplayTransitionsProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!transition) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, DURATIONS[transition] || 3000);

    return () => clearTimeout(timer);
  }, [transition]);

  if (!visible || !transition) return null;

  let text = '';
  switch (transition) {
    case 'victory':
      text = 'Victory';
      break;
    case 'defeat':
      text = 'Defeated';
      break;
    case 'round':
      text = `Round ${roundNumber ?? ''}`;
      break;
    case 'start':
      text = scenarioName || 'Begin';
      break;
  }

  return (
    <div class={`display-transition display-transition--${transition}`}>
      <div class="display-transition__text">{text}</div>
    </div>
  );
}
