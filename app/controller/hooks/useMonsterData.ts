import { useState, useEffect, useRef } from 'preact/hooks';
import type { Monster, MonsterLevelStats, MonsterAbilityCard } from '@gloomhaven-command/shared';

type StatsEntry = { normal: MonsterLevelStats | null; elite: MonsterLevelStats | null };

/**
 * Fetches monster stats and ability cards for all active monster groups.
 * Keys are `${edition}-${name}` to match FigureList's key format.
 * Uses a generation counter to avoid discarding valid results from stale abort signals.
 */
export function useMonsterData(monsters: Monster[], edition: string, level: number) {
  const [statsMap, setStatsMap] = useState<Map<string, StatsEntry>>(new Map());
  const [abilitiesMap, setAbilitiesMap] = useState<Map<string, MonsterAbilityCard | null>>(new Map());
  const generationRef = useRef(0);

  useEffect(() => {
    if (monsters.length === 0) {
      setStatsMap(new Map());
      setAbilitiesMap(new Map());
      return;
    }

    const generation = ++generationRef.current;

    const fetchOne = async (m: Monster): Promise<{
      key: string;
      stats: StatsEntry | null;
      ability: MonsterAbilityCard | null;
    }> => {
      const ed = m.edition || edition;
      const key = `${ed}-${m.name}`;

      try {
        const resp = await fetch(`/api/data/${ed}/monster/${m.name}`);
        if (!resp.ok) return { key, stats: null, ability: null };
        const data = await resp.json();

        const normalStats = data.stats?.find((s: MonsterLevelStats) => s.level === level && !s.type) ?? null;
        const eliteStats = data.stats?.find((s: MonsterLevelStats) => s.level === level && s.type === 'elite') ?? null;
        const stats: StatsEntry = { normal: normalStats, elite: eliteStats };

        let ability: MonsterAbilityCard | null = null;
        const deckName = data.deck || m.name;
        if (m.ability >= 0) {
          try {
            const deckResp = await fetch(`/api/data/${ed}/monster-deck/${deckName}`);
            if (deckResp.ok) {
              const deckData = await deckResp.json();
              if (deckData.abilities && m.ability < deckData.abilities.length) {
                ability = deckData.abilities[m.ability];
              }
            }
          } catch { /* skip deck fetch errors */ }
        }

        return { key, stats, ability };
      } catch {
        return { key, stats: null, ability: null };
      }
    };

    Promise.all(monsters.map(fetchOne)).then(results => {
      // Only apply if this is still the latest generation
      if (generation !== generationRef.current) return;

      const newStats = new Map<string, StatsEntry>();
      const newAbilities = new Map<string, MonsterAbilityCard | null>();

      for (const { key, stats, ability } of results) {
        if (stats) newStats.set(key, stats);
        if (ability !== null) newAbilities.set(key, ability);
      }

      setStatsMap(newStats);
      setAbilitiesMap(newAbilities);
    });
  }, [monsters, edition, level]);

  return { statsMap, abilitiesMap };
}
