import { h } from 'preact';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface Props {
  label: string;
  description?: string;
}

export function Placeholder({ label, description }: Props) {
  return (
    <div class="placeholder-view">
      <LoadingSpinner size={28} label={label} />
      {description && <span class="placeholder-view__desc">{description}</span>}
    </div>
  );
}
