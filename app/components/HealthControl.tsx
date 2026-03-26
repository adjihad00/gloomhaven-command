import { h } from 'preact';

interface HealthControlProps {
  current: number;
  max: number;
  onChangeHealth: (delta: number) => void;
  readonly?: boolean;
  size?: 'normal' | 'compact';
}

export function HealthControl({ current, max, onChangeHealth, readonly, size = 'normal' }: HealthControlProps) {
  const pct = max > 0 ? current / max : 0;
  const barColor = pct > 0.5 ? 'var(--health-green)' : pct > 0.25 ? '#b8860b' : 'var(--negative-red)';
  const compact = size === 'compact';

  return (
    <div class={`health-control ${compact ? 'health-control--compact' : ''}`}>
      <div class="health-control__bar" style={{ width: `${pct * 100}%`, background: barColor }} />
      <div class="health-control__content">
        {!readonly && (
          <button
            class={`health-btn ${compact ? 'health-btn--compact' : ''} damage`}
            onClick={() => onChangeHealth(-1)}
            disabled={current <= 0}
          >
            −
          </button>
        )}
        <span class="health-control__value">
          <span class="health-control__current">{current}</span>
          <span class="health-control__sep">/</span>
          <span class="health-control__max">{max}</span>
        </span>
        {!readonly && (
          <button
            class={`health-btn ${compact ? 'health-btn--compact' : ''} heal`}
            onClick={() => onChangeHealth(1)}
            disabled={current >= max}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
