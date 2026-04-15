import { h } from 'preact';
import type { ComponentChildren } from 'preact';

interface DisplayInitiativeColumnProps {
  children: ComponentChildren;
}

export function DisplayInitiativeColumn({ children }: DisplayInitiativeColumnProps) {
  return (
    <div class="display-timeline">
      {children}
    </div>
  );
}
