import { useState, useEffect, useRef } from 'preact/hooks';
import type { Monster, MonsterLevelStats } from '@gloomhaven-command/shared';
import type { MonsterInnateStats } from '../components/DisplayFigureCard';
import type { MockMonsterBaseStats, MockMonsterAbility, MockAbilityAction } from '../mockData';

interface MonsterDisplayData {
  innateStats: MonsterInnateStats;
  baseStats: MockMonsterBaseStats;
  ability: MockMonsterAbility | null;
}

/**
 * Fetches real monster stat data and ability cards for all active monsters.
 * Returns maps keyed by monster name (e.g., 'snow-imp').
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
        const baseStats: MockMonsterBaseStats = {
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

        // Fetch ability deck
        let ability: MockMonsterAbility | null = null;
        const deckName = monsterData.deck || m.name;
        if (m.ability >= 0) {
          try {
            const deckResp = await fetch(`/api/data/${ed}/monster-deck/${deckName}`);
            if (deckResp.ok) {
              const deckData = await deckResp.json();
              if (deckData.abilities && m.ability < deckData.abilities.length) {
                const card = deckData.abilities[m.ability];
                // Convert ability card actions to display format
                const actions: MockAbilityAction[] = [];
                for (const a of card.actions || []) {
                  if (['move', 'attack', 'range', 'shield', 'heal'].includes(a.type)) {
                    const val = typeof a.value === 'number' ? a.value : parseInt(String(a.value), 10) || 0;
                    // valueType "plus" means additive, absent means absolute
                    actions.push({ type: a.type, value: a.valueType === 'plus' || a.valueType === 'minus' ? val : val });
                  }
                }
                ability = {
                  monsterName: m.name,
                  name: `Card ${card.cardId}`,
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
