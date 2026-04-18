import { h } from 'preact';
import type { Party, BuildingModel } from '@gloomhaven-command/shared';
import { WaxSealHeader } from '../WaxSealHeader';

interface OutpostTabProps {
  party: Party;
}

const BUILDING_ICON = (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path
      d="M3 17 V9 L10 4 L17 9 V17 Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linejoin="round"
    />
    <rect x="8" y="12" width="4" height="5" fill="none" stroke="currentColor" stroke-width="1.2" />
    <rect x="5" y="10" width="2" height="2" fill="currentColor" opacity="0.8" />
    <rect x="13" y="10" width="2" height="2" fill="currentColor" opacity="0.8" />
  </svg>
);

const WEEKS_PER_SEASON = 10;

interface ResourcePill {
  label: string;
  value: number;
  field: keyof Party & string;
}

/**
 * Phase T0c: Outpost tab (FH only). Centerpiece of this batch.
 *
 * Dashboard form — calendar · resource pills · building cards · campaign
 * stickers. Read-only (GM edits via Party Sheet Resources tab). Full
 * top-down outpost map is deferred.
 */
export function OutpostTab({ party }: OutpostTabProps) {
  const weeks = party.weeks ?? 0;
  const weekInSeason = weeks % WEEKS_PER_SEASON || WEEKS_PER_SEASON;
  const seasonIndex = Math.floor((weeks - 1) / WEEKS_PER_SEASON);
  const isSummer = seasonIndex % 2 === 0;
  const seasonLabel = isSummer ? 'Summer' : 'Winter';
  const seasonGlyph = isSummer ? '☀' : '❄';
  const seasonProgressPct = Math.min(100, Math.max(0, (weekInSeason / WEEKS_PER_SEASON) * 100));

  const pills: ResourcePill[] = [
    { label: 'Morale', value: party.morale ?? 0, field: 'morale' },
    { label: 'Defense', value: party.defense ?? 0, field: 'defense' },
    { label: 'Soldiers', value: party.soldiers ?? 0, field: 'soldiers' },
    { label: 'Inspiration', value: party.inspiration ?? 0, field: 'inspiration' },
    { label: 'Trials', value: party.trials ?? 0, field: 'trials' },
  ];

  const buildings = party.buildings ?? [];
  const activeCount = buildings.filter((b) => b.state === 'Active' || b.state === 'active').length;
  const stickers = party.campaignStickers ?? [];

  const weekSectionsThisSeason = collectWeekSections(
    party.weekSections ?? {},
    seasonIndex * WEEKS_PER_SEASON + 1,
    (seasonIndex + 1) * WEEKS_PER_SEASON,
  );

  return (
    <div class="outpost-tab">
      <WaxSealHeader title="Outpost" icon={BUILDING_ICON} />

      {/* Calendar strip ─────────────────────────────────────────────── */}
      <section class="outpost-tab__calendar">
        <div class="outpost-tab__calendar-head">
          <span class="outpost-tab__season-glyph" aria-hidden="true">{seasonGlyph}</span>
          <span class="outpost-tab__season-label">{seasonLabel}</span>
          <span class="outpost-tab__week-label">
            Week {weekInSeason} of {WEEKS_PER_SEASON}
          </span>
        </div>
        <div class="outpost-tab__calendar-track" aria-hidden="true">
          <div
            class="outpost-tab__calendar-fill"
            style={{ width: `${seasonProgressPct}%` }}
          />
          {weekSectionsThisSeason.map((w) => (
            <span
              key={w.week}
              class="outpost-tab__calendar-pip"
              style={{ left: `${((w.week - seasonIndex * WEEKS_PER_SEASON - 1) / WEEKS_PER_SEASON) * 100}%` }}
              aria-label={`Week ${w.week} sections: ${w.sections.join(', ')}`}
              title={`Week ${w.week}: ${w.sections.join(', ')}`}
            />
          ))}
        </div>
      </section>

      {/* Resource pills ─────────────────────────────────────────────── */}
      <section class="outpost-tab__pills" aria-label="Outpost resources">
        {pills.map((pill) => (
          <div key={pill.field} class="outpost-tab__pill">
            <span class="outpost-tab__pill-value">{pill.value}</span>
            <span class="outpost-tab__pill-label">{pill.label}</span>
          </div>
        ))}
      </section>

      {/* Buildings ──────────────────────────────────────────────────── */}
      <section class="outpost-tab__buildings">
        <div class="outpost-tab__buildings-head">
          <h3 class="outpost-tab__section-title">Buildings</h3>
          <span class="outpost-tab__buildings-count">
            {activeCount} active
          </span>
        </div>
        {buildings.length === 0 ? (
          <p class="outpost-tab__empty">
            No buildings constructed yet. Complete scenarios to unlock outpost buildings.
          </p>
        ) : (
          <ul class="outpost-tab__building-list">
            {buildings.map((b, i) => (
              <BuildingCard key={`${b.name}-${i}`} building={b} />
            ))}
          </ul>
        )}
      </section>

      {/* Campaign stickers ──────────────────────────────────────────── */}
      <section class="outpost-tab__stickers">
        <div class="outpost-tab__stickers-head">
          <h3 class="outpost-tab__section-title">Campaign Stickers</h3>
          <span class="outpost-tab__stickers-count">
            {stickers.length} applied
          </span>
        </div>
        {stickers.length === 0 ? (
          <p class="outpost-tab__empty">
            No campaign stickers applied yet.
          </p>
        ) : (
          <ul class="outpost-tab__sticker-list">
            {stickers.map((s, i) => (
              <li key={`${s}-${i}`} class="outpost-tab__sticker">{s}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface BuildingCardProps {
  building: BuildingModel;
}

function BuildingCard({ building }: BuildingCardProps) {
  const state = (building.state || 'active').toLowerCase();
  const stateClass =
    state === 'damaged' ? 'damaged'
    : state === 'wrecked' ? 'wrecked'
    : state === 'building' || state === 'underconstruction' ? 'building'
    : 'active';
  const stateLabel =
    stateClass === 'damaged' ? 'Damaged'
    : stateClass === 'wrecked' ? 'Wrecked'
    : stateClass === 'building' ? 'Building'
    : 'Active';

  return (
    <li class={`outpost-tab__building outpost-tab__building--${stateClass}`}>
      <div class="outpost-tab__building-icon" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path
            d="M4 28 V14 L16 6 L28 14 V28 Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
          <rect x="13" y="20" width="6" height="8" fill="none" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </div>
      <div class="outpost-tab__building-body">
        <div class="outpost-tab__building-head">
          <span class="outpost-tab__building-name">{building.name}</span>
          <span class="outpost-tab__building-level">Level {building.level}</span>
          <span class={`outpost-tab__building-chip outpost-tab__building-chip--${stateClass}`}>
            {stateLabel}
          </span>
        </div>
      </div>
    </li>
  );
}

function collectWeekSections(
  weekSections: Record<string, string[]>,
  lowInclusive: number,
  highInclusive: number,
): Array<{ week: number; sections: string[] }> {
  const out: Array<{ week: number; sections: string[] }> = [];
  for (const [key, sections] of Object.entries(weekSections)) {
    const w = Number(key);
    if (!Number.isFinite(w)) continue;
    if (w < lowInclusive || w > highInclusive) continue;
    if (!sections || sections.length === 0) continue;
    out.push({ week: w, sections });
  }
  return out;
}
