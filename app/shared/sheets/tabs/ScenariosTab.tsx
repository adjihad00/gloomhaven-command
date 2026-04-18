import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { Party, ScenarioModel } from '@gloomhaven-command/shared';
import { WaxSealHeader } from '../WaxSealHeader';

interface ScenariosTabProps {
  party: Party;
}

type Filter = 'all' | 'main' | 'casual' | 'conclusions';

const SCROLL_ICON = (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path
      d="M4 3 H14 C15.5 3 16.5 4 16.5 5.5 V14.5 C16.5 16 15.5 17 14 17 H4 V3 Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linejoin="round"
    />
    <path
      d="M4 3 V17 C2.5 17 1.5 16 1.5 14.5 V5.5 C1.5 4 2.5 3 4 3 Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
    />
    <path
      d="M6 8 H13 M6 11 H13 M6 14 H11"
      stroke="currentColor"
      stroke-width="1"
      stroke-linecap="round"
    />
  </svg>
);

/**
 * Phase T0c: Scenarios tab.
 *
 * Reverse-chronological list of completed scenarios. Filter chips toggle
 * which source array is shown (main victories / casual / conclusions).
 *
 * No date field exists on `ScenarioModel`, so dates are omitted. No "add"
 * action — scenarios append automatically via `completeScenario`.
 */
export function ScenariosTab({ party }: ScenariosTabProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const main = party.scenarios ?? [];
  const casual = party.casualScenarios ?? [];
  const conclusions = party.conclusions ?? [];

  const list = useMemo(() => {
    let source: ScenarioModel[];
    switch (filter) {
      case 'main':
        source = main;
        break;
      case 'casual':
        source = casual;
        break;
      case 'conclusions':
        source = conclusions;
        break;
      case 'all':
      default:
        source = [...main, ...conclusions, ...casual];
        break;
    }
    return [...source].reverse();
  }, [filter, main, casual, conclusions]);

  const totalAll = main.length + casual.length + conclusions.length;

  return (
    <div class="scenarios-tab">
      <WaxSealHeader title="Scenarios" icon={SCROLL_ICON} />

      <div class="scenarios-tab__meta">
        <span class="scenarios-tab__count">
          {totalAll} completed
        </span>
        <div class="scenarios-tab__filters" role="group" aria-label="Filter scenarios">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
          <FilterChip
            active={filter === 'main'}
            onClick={() => setFilter('main')}
            label={`Main · ${main.length}`}
          />
          {casual.length > 0 && (
            <FilterChip
              active={filter === 'casual'}
              onClick={() => setFilter('casual')}
              label={`Casual · ${casual.length}`}
            />
          )}
          {conclusions.length > 0 && (
            <FilterChip
              active={filter === 'conclusions'}
              onClick={() => setFilter('conclusions')}
              label={`Conclusions · ${conclusions.length}`}
            />
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <div class="scenarios-tab__empty">
          <svg viewBox="0 0 64 64" class="scenarios-tab__empty-sigil" aria-hidden="true">
            <rect x="14" y="10" width="36" height="44" rx="3" fill="none" stroke="currentColor" stroke-width="1.2" />
            <path d="M14 10 H10 A2 2 0 0 0 10 14 V50 A2 2 0 0 0 10 54 H14" fill="none" stroke="currentColor" stroke-width="1.2" />
            <path d="M22 22 H42 M22 30 H42 M22 38 H34" stroke="currentColor" stroke-width="0.8" />
            <path d="M44 38 L50 50" stroke="currentColor" stroke-width="1" />
          </svg>
          <p class="scenarios-tab__empty-text">
            No scenarios completed yet.<br />Your first victory will be recorded here.
          </p>
        </div>
      ) : (
        <ul class="scenarios-tab__list">
          {list.map((s, i) => (
            <li key={`${s.edition}-${s.index}-${i}`} class="scenarios-tab__row">
              <span class="scenarios-tab__badge">{s.index}</span>
              <div class="scenarios-tab__info">
                <span class="scenarios-tab__name">
                  {s.isCustom && s.custom ? s.custom : `Scenario ${s.index}`}
                </span>
                <div class="scenarios-tab__meta-row">
                  <span class="scenarios-tab__edition-chip">{s.edition.toUpperCase()}</span>
                  {s.group && <span class="scenarios-tab__group">{s.group}</span>}
                </div>
              </div>
              <span class="scenarios-tab__outcome" aria-label="Victory">
                <VictoryWreath />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      class={`scenarios-tab__filter${active ? ' scenarios-tab__filter--active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function VictoryWreath() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M12 3 L13.5 8 L18.5 8 L14.5 11 L16 16 L12 13 L8 16 L9.5 11 L5.5 8 L10.5 8 Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}
