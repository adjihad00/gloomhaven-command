import { h } from 'preact';
import type { ElementModel } from '@gloomhaven-command/shared';
import { elementIcon } from '../shared/assets';

interface ElementBoardProps {
  elements: ElementModel[];
  onCycleElement?: (elementType: string, currentState: string) => void;
  layout?: 'horizontal' | 'vertical' | 'grid';
  readonly?: boolean;
  size?: 'normal' | 'compact' | 'header';
}

export function ElementBoard({ elements, onCycleElement, layout = 'horizontal', readonly, size = 'normal' }: ElementBoardProps) {
  const sizeClass = size === 'compact' ? 'element-board--compact' : size === 'header' ? 'element-board--header' : '';

  return (
    <div class={`element-board element-board--${layout} ${sizeClass}`}>
      {elements.map(el => {
        const isWaning = el.state === 'waning';
        return (
          <button
            key={el.type}
            class={`element-btn element-${el.state} ${size === 'header' ? 'element-header' : ''}`}
            onClick={readonly ? undefined : () => onCycleElement?.(el.type, el.state)}
            disabled={readonly}
            data-element={el.type}
            title={`${el.type}: ${el.state}`}
          >
            <div class="element-img-container">
              <img src={elementIcon(el.type)} alt={el.type} class="element-img" />
              {isWaning && (
                <img src={elementIcon(el.type)} alt="" class="element-img-overlay" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
