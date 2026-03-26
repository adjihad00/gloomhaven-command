import { useState, useEffect, useRef } from 'preact/hooks';
import type { Monster, MonsterLevelStats, MonsterAbilityCard } from '@gloomhaven-command/shared';

type StatsEntry = { normal: MonsterLevelStats | null; elite: MonsterLevelStats | null };

/**
 * Fetches monster stats and ability cards for all active monster groups.
 * Keys are `${edition}-${name}` to match FigureList's key format.
 */
export function useMonsterData(monsters: Monster[], edition: string, level: number) {
  const [statsMap, setStatsMap] = useState<Map<string, StatsEntry>>(new Map());
  const [abilitiesMap, setAbilitiesMap] = useState<Map<string, MonsterAbilityCard | null>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (monsters.length === 0) {
      setStatsMap(new Map());
      setAbilitiesMap(new Map());
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchData = async () => {
      const newStats = new Map<string, StatsEntry>();
      const newAbilities = new Map<string, MonsterAbilityCard | null>();

      for (const m of monsters) {
        if (controller.signal.aborted) return;
        const ed = m.edition || edition;
        const key = `${ed}-${m.name}`;

        try {
          const resp = await fetch(`/api/data/${ed}/monster/${m.name}`, { signal: controller.signal });
          if (!resp.ok) continue;
          const data = await resp.json();

          // Extract stats for current level
          const normalStats = data.stats?.find((s: MonsterLevelStats) => s.level === level && !s.type) ?? null;
          const eliteStats = data.stats?.find((s: MonsterLevelStats) => s.level === level && s.type === 'elite') ?? null;
          newStats.set(key, { normal: normalStats, elite: eliteStats });

          // Fetch ability card if monster has drawn one
          if (data.deck && m.ability >= 0) {
            try {
              const deckResp = await fetch(`/api/data/${ed}/monster-deck/${data.deck}`, { signal: controller.signal });
              if (deckResp.ok) {
                const deckData = await deckResp.json();
                if (deckData.abilities && m.ability < deckData.abilities.length) {
                  newAbilities.set(key, deckData.abilities[m.ability]);
                } else {
                  newAbilities.set(key, null);
                }
              }
            } catch { /* skip deck fetch errors */ }
          }
        } catch { /* skip fetch errors */ }
      }

      if (!controller.signal.aborted) {
        setStatsMap(newStats);
        setAbilitiesMap(newAbilities);
      }
    };

    fetchData();

    return () => controller.abort();
  }, [monsters, edition, level]);

  return { statsMap, abilitiesMap };
}
