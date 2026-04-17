import { h } from 'preact';
import { useRef, useEffect, useState } from 'preact/hooks';
import type { Character } from '@gloomhaven-command/shared';
import { useGameState } from '../../../hooks/useGameState';

interface OverviewStatMedallionsProps {
  character: Character;
}

interface MedallionProps {
  value: number | string;
  label: string;
}

/**
 * Single medallion — circular gilt ring with parchment inner, tabular
 * figures for the value, small-caps for the label. A 240ms gold flash
 * animation fires whenever the displayed value changes (tracked via
 * `key={value}` on the inner wrapper so the animation re-runs on each
 * delta). Reduced-motion media query disables the animation.
 *
 * Kept as a top-level component (not inline) per
 * `rerender-no-inline-components`.
 */
function StatMedallion({ value, label }: MedallionProps) {
  return (
    <div class="stat-medallion">
      <svg class="stat-medallion__ring" viewBox="0 0 72 72" aria-hidden="true">
        <defs>
          <linearGradient id={`stat-ring-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--gilt-gold)" />
            <stop offset="100%" stop-color="var(--gilt-gold-shadow)" />
          </linearGradient>
        </defs>
        <circle
          cx="36" cy="36" r="33"
          fill="none"
          stroke={`url(#stat-ring-${label})`}
          stroke-width="3"
        />
      </svg>
      <div class="stat-medallion__inner">
        <span key={String(value)} class="stat-medallion__value">{value}</span>
        <span class="stat-medallion__label">{label}</span>
      </div>
    </div>
  );
}

/**
 * Phase T0a: four-up stat row (Gold / HP / Scenarios / Perks).
 *
 * Haptic feedback fires on "significant" changes (absolute delta ≥ 5 for
 * gold, ≥ 1 for HP max / scenarios / perks). Feature-detected via
 * `navigator.vibrate` — no-op on unsupported browsers.
 */
export function OverviewStatMedallions({ character }: OverviewStatMedallionsProps) {
  const { state } = useGameState();

  const gold = character.progress?.gold ?? 0;
  const hpMax = character.maxHealth;
  const scenarios = state?.party?.scenarios?.length ?? 0;
  const perksApplied = (character.progress?.perks ?? []).filter((p) => p > 0).length;
  const perksTotal = 18; // rules §12: 18 checkmarks = 6 extra perk marks. Shown as out-of-total.

  const prev = useRef({ gold, hpMax, scenarios, perksApplied });
  useEffect(() => {
    const p = prev.current;
    const buzz = (delta: number, threshold: number) => {
      if (Math.abs(delta) >= threshold && typeof navigator !== 'undefined') {
        navigator.vibrate?.(10);
      }
    };
    buzz(gold - p.gold, 5);
    buzz(hpMax - p.hpMax, 1);
    buzz(scenarios - p.scenarios, 1);
    buzz(perksApplied - p.perksApplied, 1);
    prev.current = { gold, hpMax, scenarios, perksApplied };
  }, [gold, hpMax, scenarios, perksApplied]);

  return (
    <div class="stat-medallions" role="list">
      <div role="listitem"><StatMedallion value={gold} label="Gold" /></div>
      <div role="listitem"><StatMedallion value={hpMax} label="HP" /></div>
      <div role="listitem"><StatMedallion value={scenarios} label="Scenarios" /></div>
      <div role="listitem"><StatMedallion value={`${perksApplied}/${perksTotal}`} label="Perks" /></div>
    </div>
  );
}
