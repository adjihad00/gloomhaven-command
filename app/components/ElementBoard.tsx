import { h } from 'preact';
import type { ElementModel } from '@gloomhaven-command/shared';
import { elementIcon } from '../shared/assets';

interface ElementBoardProps {
  elements: ElementModel[];
  onCycleElement?: (elementType: string, currentState: string) => void;
  layout?: 'horizontal' | 'vertical' | 'grid';
  readonly?: boolean;
  size?: 'normal' | 'compact';
}

export function ElementBoard({ elements, onCycleElement, layout = 'horizontal', readonly, size = 'normal' }: ElementBoardProps) {
  const compact = size === 'compact';

  return (
    <div class={`element-board element-board--${layout} ${compact ? 'element-board--compact' : ''}`}>
      {elements.map(el => (
        <button
          key={el.type}
          class={`element-btn element-${el.state}`}
          onClick={readonly ? undefined : () => onCycleElement?.(el.type, el.state)}
          disabled={readonly}
        >
          <img src={elementIcon(el.type)} alt={el.type} />
        </button>
      ))}
    </div>
  );
}
