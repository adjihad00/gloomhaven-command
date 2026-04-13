import { h } from 'preact';

interface LoadingSpinnerProps {
  size?: number;
  label?: string;
}

export function LoadingSpinner({ size = 32, label }: LoadingSpinnerProps) {
  return (
    <div class="loading-spinner" role="status" aria-label={label || 'Loading'}>
      <div class="loading-spinner__ring" style={{ width: size, height: size }} />
      {label && <span class="loading-spinner__label">{label}</span>}
    </div>
  );
}
