import { h } from 'preact';
import { useRef, useEffect, useState } from 'preact/hooks';
import type { ElementModel } from '@gloomhaven-command/shared';
import { elementIcon } from '../../shared/assets';

interface DisplayElementBoardProps {
  elements: ElementModel[];
}

type ElementTransition = 'infusing' | 'consuming' | null;

const ELEMENT_COLORS: Record<string, string> = {
  fire: '#ff6633',
  ice: '#66bbff',
  air: '#cccccc',
  earth: '#88aa44',
  light: '#ffdd44',
  dark: '#6644aa',
};

export function DisplayElementBoard({ elements }: DisplayElementBoardProps) {
  const prevStatesRef = useRef<Record<string, string>>({});
  const [transitions, setTransitions] = useState<Record<string, ElementTransition>>({});

  useEffect(() => {
    const prev = prevStatesRef.current;
    const newTransitions: Record<string, ElementTransition> = {};

    for (const el of elements) {
      const prevState = prev[el.type];
      if (prevState && prevState !== el.state) {
        if (el.state === 'strong' || el.state === 'new') {
          newTransitions[el.type] = 'infusing';
        } else if (el.state === 'inert' && (prevState === 'strong' || prevState === 'waning')) {
          newTransitions[el.type] = 'consuming';
        }
      }
    }

    if (Object.keys(newTransitions).length > 0) {
      setTransitions(t => ({ ...t, ...newTransitions }));
      // Clear transitions after animation
      const timer = setTimeout(() => {
        setTransitions(t => {
          const next = { ...t };
          for (const key of Object.keys(newTransitions)) {
            delete next[key];
          }
          return next;
        });
      }, 1200);
      // Store cleanup
      prevStatesRef.current = {};
      for (const el of elements) {
        prevStatesRef.current[el.type] = el.state;
      }
      return () => clearTimeout(timer);
    }

    // Update previous states
    prevStatesRef.current = {};
    for (const el of elements) {
      prevStatesRef.current[el.type] = el.state;
    }
  }, [elements]);

  return (
    <div class="display-elements">
      {elements.map(el => {
        const stateClass = `display-element--${el.state === 'strong' || el.state === 'new' ? 'strong' : el.state === 'waning' ? 'waning' : 'inert'}`;
        const transClass = transitions[el.type] ? `display-element--${transitions[el.type]}` : '';
        const color = ELEMENT_COLORS[el.type] || '#d3a663';

        return (
          <div
            key={el.type}
            class={`display-element ${stateClass} ${transClass}`}
            title={`${el.type}: ${el.state}`}
            style={{ '--element-color': color } as any}
          >
            <img src={elementIcon(el.type)} alt={el.type} class="display-element__icon" />
            {el.state === 'waning' && <div class="display-element__waning-overlay" />}
            {transitions[el.type] === 'consuming' && <div class="display-element__consume-vortex" />}
            {transitions[el.type] === 'infusing' && <div class="display-element__infuse-burst" />}
          </div>
        );
      })}
    </div>
  );
}
