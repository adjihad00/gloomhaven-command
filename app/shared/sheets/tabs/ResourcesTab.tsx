import { h } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import type { Party } from '@gloomhaven-command/shared';
import { useCommands } from '../../../hooks/useCommands';
import { PartySheetContext } from '../PartySheetContext';
import { resourceIcon } from '../../assets';

interface ResourcesTabProps {
  party: Party;
  edition: string;
}

interface GaugeSpec {
  field: 'morale' | 'defense' | 'soldiers' | 'inspiration' | 'trials';
  label: string;
  min: number;
  /** Upper hint for keyboard +/− validation; no hard clamp here (rules-
   *  derived; the GM can push higher via the plus button as needed). */
  max?: number;
}

const GAUGES: readonly GaugeSpec[] = [
  { field: 'morale', label: 'Morale', min: 0, max: 20 },
  { field: 'defense', label: 'Defense', min: 0, max: 20 },
  { field: 'soldiers', label: 'Soldiers', min: 0 },
  { field: 'inspiration', label: 'Inspiration', min: 0 },
  { field: 'trials', label: 'Trials', min: 0 },
];

const LOOT_TYPE_LABELS: Record<string, string> = {
  lumber: 'Lumber',
  metal: 'Metal',
  hide: 'Hide',
  arrowvine: 'Arrowvine',
  axenut: 'Axenut',
  corpsecap: 'Corpsecap',
  flamefruit: 'Flamefruit',
  rockroot: 'Rockroot',
  snowthistle: 'Snowthistle',
};

/**
 * Phase T0b: Resources tab (FH only).
 *
 * Five gauges + shared loot pool.
 *
 * Loot pool is read-only in T0b — mutation UI belongs to T3 outpost.
 */
export function ResourcesTab({ party, edition }: ResourcesTabProps) {
  const { readOnly } = useContext(PartySheetContext);
  const commands = useCommands();

  if (edition !== 'fh') return null;

  const lootEntries = Object.entries(party.loot ?? {})
    .filter(([, count]) => (count ?? 0) > 0) as Array<[string, number]>;

  return (
    <div class="resources-tab">
      <section class="resources-tab__gauges">
        {GAUGES.map((spec) => (
          <ResourceGauge
            key={spec.field}
            value={(party[spec.field] as number) ?? 0}
            label={spec.label}
            min={spec.min}
            max={spec.max}
            readOnly={readOnly}
            onChange={(next) => commands.updateCampaign(spec.field, next)}
          />
        ))}
      </section>

      <section class="resources-tab__loot">
        <h2 class="resources-tab__loot-title">Shared Loot Pool</h2>
        {lootEntries.length === 0 ? (
          <p class="resources-tab__loot-empty">
            The party's stores are empty.
          </p>
        ) : (
          <ul class="resources-tab__loot-list">
            {lootEntries.map(([type, count]) => (
              <li key={type} class="resources-tab__loot-chip">
                <img
                  class="resources-tab__loot-icon"
                  src={resourceIcon(type)}
                  alt=""
                  aria-hidden="true"
                />
                <span class="resources-tab__loot-count">×{count}</span>
                <span class="resources-tab__loot-label">
                  {LOOT_TYPE_LABELS[type] ?? type}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface ResourceGaugeProps {
  value: number;
  label: string;
  min: number;
  max?: number;
  readOnly: boolean;
  onChange: (next: number) => void;
}

function ResourceGauge({ value, label, min, max, readOnly, onChange }: ResourceGaugeProps) {
  // 240 ms flash on value change — copies T0a StatMedallion cue.
  const [flash, setFlash] = useState(false);
  const lastValueRef = useRef(value);
  useEffect(() => {
    if (lastValueRef.current === value) return;
    lastValueRef.current = value;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 240);
    return () => window.clearTimeout(t);
  }, [value]);

  const canDecrement = !readOnly && value > min;
  const canIncrement = !readOnly && (max === undefined || value < max);

  return (
    <div class={`resources-tab__gauge${flash ? ' resources-tab__gauge--flash' : ''}`}>
      {!readOnly && (
        <button
          type="button"
          class="resources-tab__gauge-btn resources-tab__gauge-btn--minus"
          aria-label={`Decrease ${label} by 1`}
          disabled={!canDecrement}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
      )}
      <div class="resources-tab__gauge-core">
        <div class="resources-tab__gauge-value" aria-live="polite">
          {value}
        </div>
        <div class="resources-tab__gauge-label">{label}</div>
      </div>
      {!readOnly && (
        <button
          type="button"
          class="resources-tab__gauge-btn resources-tab__gauge-btn--plus"
          aria-label={`Increase ${label} by 1`}
          disabled={!canIncrement}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      )}
    </div>
  );
}
