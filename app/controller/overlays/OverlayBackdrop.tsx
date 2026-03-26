import { h, ComponentChildren } from 'preact';

interface OverlayBackdropProps {
  onClose: () => void;
  children: ComponentChildren;
  position?: 'center' | 'right' | 'full';
}

export function OverlayBackdrop({ onClose, children, position = 'center' }: OverlayBackdropProps) {
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const panelClass = position === 'right'
    ? 'overlay-panel right'
    : position === 'full'
      ? 'overlay-panel full'
      : 'overlay-panel';

  return (
    <div class="overlay-backdrop" onClick={handleBackdropClick}>
      <div class={panelClass}>
        <button class="overlay-close" onClick={onClose}>&times;</button>
        {children}
      </div>
    </div>
  );
}
