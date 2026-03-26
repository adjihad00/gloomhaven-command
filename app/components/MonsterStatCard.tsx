import { h } from 'preact';
import type { MonsterLevelStats } from '@gloomhaven-command/shared';

interface MonsterStatCardProps {
  normal: MonsterLevelStats | null;
  elite: MonsterLevelStats | null;
  level: number;
  monsterName: string;
}

function StatColumn({ stats, label }: { stats: MonsterLevelStats | null; label: string }) {
  if (!stats) return null;
  return (
    <div class={`stat-column stat-column--${label.toLowerCase()}`}>
      <div class="stat-column__label">{label}</div>
      <div class="stat-column__row"><span class="stat-column__key">HP</span><span class="stat-column__val">{stats.health}</span></div>
      <div class="stat-column__row"><span class="stat-column__key">MOV</span><span class="stat-column__val">{stats.movement}</span></div>
      <div class="stat-column__row"><span class="stat-column__key">ATK</span><span class="stat-column__val">{stats.attack}</span></div>
      {stats.range !== undefined && stats.range > 0 && (
        <div class="stat-column__row"><span class="stat-column__key">RNG</span><span class="stat-column__val">{stats.range}</span></div>
      )}
      {stats.actions && stats.actions.length > 0 && (
        <div class="stat-column__specials">
          {stats.actions.map((a, i) => (
            <span key={i} class="stat-column__special">{a.type}: {a.value}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function MonsterStatCard({ normal, elite, level, monsterName }: MonsterStatCardProps) {
  return (
    <div class="monster-stat-card">
      <div class="monster-stat-card__header">
        <span class="monster-stat-card__name">{monsterName}</span>
        <span class="monster-stat-card__level">Lv {level}</span>
      </div>
      <div class="monster-stat-card__columns">
        <StatColumn stats={normal} label="Normal" />
        <StatColumn stats={elite} label="Elite" />
      </div>
    </div>
  );
}
