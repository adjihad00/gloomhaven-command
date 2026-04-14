import { h } from 'preact';
import { ElementBoard } from '../../components/ElementBoard';
import type { ElementModel, ElementType, ElementState } from '@gloomhaven-command/shared';

interface PhoneElementRowProps {
  elements: ElementModel[];
  isActive: boolean;
  onMoveElement: (element: ElementType, newState: ElementState) => void;
}

export function PhoneElementRow({ elements, isActive, onMoveElement }: PhoneElementRowProps) {
  // Phone uses simple infuse/consume (not the controller's full cycle):
  // - Inert → Strong (infuse)
  // - Strong/Waning/New → Inert (consume)
  const handleTap = (type: string, currentState: string) => {
    if (currentState === 'inert') {
      onMoveElement(type as ElementType, 'strong' as ElementState);
    } else {
      onMoveElement(type as ElementType, 'inert' as ElementState);
    }
  };

  return (
    <div class="phone-elements">
      <ElementBoard
        elements={elements}
        onCycleElement={handleTap}
        layout="horizontal"
        readonly={!isActive}
        size="compact"
      />
    </div>
  );
}
