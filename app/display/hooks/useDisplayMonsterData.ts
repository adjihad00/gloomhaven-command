import { useState, useEffect, useRef } from 'preact/hooks';
import type { Monster, MonsterLevelStats, MonsterAbilityAction } from '@gloomhaven-command/shared';
import type { MonsterInnateStats } from '../components/DisplayFigureCard';

export interface DisplayAbility {
  monsterName: string;
  name: string | null;
  initiative: number;
  actions: MonsterAbilityAction[];
  shuffle: boolean;
}

export interface DisplayBaseStats {
  normal: Record<string, number>;
  elite: Record<string, number>;
}

interface MonsterDisplayData {
  innateStats: MonsterInnateStats;
  baseStats: DisplayBaseStats;
  ability: DisplayAbility | null;
}

/**
 * Fetches real monster stat data and ability cards for all active monsters.
 * Innate stats from /api/data/, ability cards from /api/ref/ability-cards.
 */
export function useDisplayMonsterData(monsters: Monster[], edition: string, level: number) {
  const [dataMap, setDataMap] = useState<Map<string, MonsterDisplayData>>(new Map());
  const generationRef = useRef(0);

  useEffect(() => {
    if (monsters.length === 0) {
      setDataMap(new Map());
      return;
    }

    const generation = ++generationRef.current;

    const fetchOne = async (m: Monster): Promise<{ name: string; data: MonsterDisplayData | null }> => {
      const ed = m.edition || edition;
      try {
        const resp = await fetch(`/api/data/${ed}/monster/${m.name}`);
        if (!resp.ok) return { name: m.name, data: null };
        const monsterData = await resp.json();

        // Extract level-specific stats
        const normalStats: MonsterLevelStats | null =
          monsterData.stats?.find((s: MonsterLevelStats) => s.level === level && !s.type) ?? null;
        const eliteStats: MonsterLevelStats | null =
          monsterData.stats?.find((s: MonsterLevelStats) => s.level === level && s.type === 'elite') ?? null;

        const innateStats: MonsterInnateStats = {
          flying: !!monsterData.flying,
          normalStats,
          eliteStats,
        };

        // Build base stats for ability totalization
        const baseStats: DisplayBaseStats = {
          normal: {
            health: typeof normalStats?.health === 'number' ? normalStats.health : 0,
            move: normalStats?.movement ?? 0,
            attack: normalStats?.attack ?? 0,
            ...(normalStats?.range != null ? { range: normalStats.range } : {}),
          },
          elite: {
            health: typeof eliteStats?.health === 'number' ? eliteStats.health : 0,
            move: eliteStats?.movement ?? 0,
            attack: eliteStats?.attack ?? 0,
            ...(eliteStats?.range != null ? { range: eliteStats.range } : {}),
          },
        };

        // Fetch ability deck from reference DB
        let ability: DisplayAbility | null = null;
        const deckName = monsterData.deck || m.name;
        if (m.ability >= 0) {
          try {
            const deckResp = await fetch(`/api/ref/ability-cards/${ed}/${deckName}`);
            if (deckResp.ok) {
              const cards: Array<{
                card_id: number;
                name: string | null;
                initiative: number;
                shuffle: number;
                actions_json: string;
              }> = await deckResp.json();

              if (m.ability < cards.length) {
                const card = cards[m.ability];
                const actions: MonsterAbilityAction[] = JSON.parse(card.actions_json);
                ability = {
                  monsterName: m.name,
                  name: card.name || null,
                  initiative: card.initiative,
                  actions,
                  shuffle: !!card.shuffle,
                };
              }
            }
          } catch { /* skip deck errors */ }
        }

        return { name: m.name, data: { innateStats, baseStats, ability } };
      } catch {
        return { name: m.name, data: null };
      }
    };

    Promise.all(monsters.map(fetchOne)).then(results => {
      if (generation !== generationRef.current) return;
      const newMap = new Map<string, MonsterDisplayData>();
      for (const { name, data } of results) {
        if (data) newMap.set(name, data);
      }
      setDataMap(newMap);
    });
  }, [monsters, edition, level]);

  return dataMap;
}
