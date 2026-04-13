import { h } from 'preact';
import { useState } from 'preact/hooks';
import { LongRestIcon } from './Icons';

interface InitiativeDisplayProps {
  value: number;
  onSetInitiative?: (value: number) => void;
  editable?: boolean;
  longRest?: boolean;
  size?: 'normal' | 'large';
}

export function InitiativeDisplay({ value, onSetInitiative, editable, longRest, size = 'normal' }: InitiativeDisplayProps) {
  const [editing, setEditing] = useState(false);

  if (longRest) {
    return (
      <span class={`initiative-display initiative-display--${size} initiative-display--rest`}>
        <LongRestIcon size={size === 'large' ? 28 : 20} />
      </span>
    );
  }

  if (editable && editing) {
    return (
      <input
        type="number"
        class={`initiative-input initiative-input--${size}`}
        min={1}
        max={99}
        value={value || ''}
        onInput={(e) => {
          const v = parseInt((e.target as HTMLInputElement).value, 10);
          if (v >= 1 && v <= 99) onSetInitiative?.(v);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false); }}
        autoFocus
      />
    );
  }

  const display = value > 0 ? String(value) : '—';

  return (
    <span
      class={`initiative-display initiative-display--${size} ${editable ? 'initiative-display--editable' : ''}`}
      onClick={editable ? () => setEditing(true) : undefined}
    >
      {display}
    </span>
  );
}
