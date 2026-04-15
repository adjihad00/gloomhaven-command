import { h } from 'preact';
import { useContext, useState, useEffect, useRef } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { AmbientParticles } from './components/AmbientParticles';
import { DisplayScenarioHeader } from './components/DisplayScenarioHeader';
import { DisplayInitiativeColumn } from './components/DisplayInitiativeColumn';
import { DisplayFigureCard, StandeeMiniCard } from './components/DisplayFigureCard';
import { DisplayScenarioFooter } from './components/DisplayScenarioFooter';
import { DisplayTransitions } from './components/DisplayTransitions';
import { DisplayAMDSplash } from './components/DisplayAMDSplash';
import { DisplayLootSplash } from './components/DisplayLootSplash';
import type { TransitionType } from './components/DisplayTransitions';
import { useDisplayMonsterData } from './hooks/useDisplayMonsterData';
import { mockAbilities, mockScenarioRules, mockMonsterStats } from './mockData';

const AMD_DEMO_CARDS = ['plus1', 'minus1', 'plus2', 'minus2', 'bless', 'curse', 'double', 'null'];
const LOOT_DEMO_TYPES = [
  { type: 'money', coinValue: 2, playerName: 'Drifter' },
  { type: 'lumber', playerName: 'Blinkblade' },
  { type: 'metal', playerName: 'Boneshaper' },
  { type: 'hide', playerName: 'Drifter' },
];

const ELEMENT_CYCLE: Record<string, string> = {
  inert: 'strong',
  strong: 'waning',
  waning: 'inert',
  new: 'strong',
  consumed: 'inert',
};

export function ScenarioView() {
  const { state } = useContext(AppContext);
  const [demoTransition, setDemoTransition] = useState<TransitionType>(null);
  const [amdSplash, setAmdSplash] = useState<string | null>(null);
  const [lootSplash, setLootSplash] = useState<{ type: string; coinValue?: number; playerName?: string } | null>(null);
  const [elementOverrides, setElementOverrides] = useState<Record<string, string>>({});
  const [demoActiveIdx, setDemoActiveIdx] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch real monster data from API
  const monsterDataMap = useDisplayMonsterData(
    state?.monsters || [],
    state?.edition || 'fh',
    state?.level ?? 2,
  );

  // Demo keyboard triggers for splash animations + element cycling
  useEffect(() => {
    let amdIdx = 0;
    let lootIdx = 0;
    const elementKeys = ['fire', 'ice', 'air', 'earth', 'light', 'dark'];

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'a' && !amdSplash) {
        setAmdSplash(AMD_DEMO_CARDS[amdIdx % AMD_DEMO_CARDS.length]);
        amdIdx++;
      }
      if (e.key === 'l' && !lootSplash) {
        const demo = LOOT_DEMO_TYPES[lootIdx % LOOT_DEMO_TYPES.length];
        setLootSplash(demo);
        lootIdx++;
      }
      // Transition demos
      if (e.key === 'v') setDemoTransition('victory');
      if (e.key === 'd') setDemoTransition('defeat');
      if (e.key === 'r') setDemoTransition('round');

      // Element cycling: keys 1-6 cycle fire/ice/air/earth/light/dark
      const keyNum = parseInt(e.key);
      if (keyNum >= 1 && keyNum <= 6) {
        const elType = elementKeys[keyNum - 1];
        setElementOverrides(prev => {
          const currentState = prev[elType] || state?.elementBoard?.find(el => el.type === elType)?.state || 'inert';
          const nextState = ELEMENT_CYCLE[currentState] || 'inert';
          return { ...prev, [elType]: nextState };
        });
      }

      // Tab / Shift+Tab: cycle active figure forward/backward
      if (e.key === 'Tab') {
        e.preventDefault();
        setDemoActiveIdx(prev => {
          // Total figure count from state
          const total = state?.figures?.length || 0;
          if (total === 0) return null;
          if (prev === null) return 0;
          if (e.shiftKey) {
            return prev <= 0 ? total - 1 : prev - 1;
          }
          return prev >= total - 1 ? 0 : prev + 1;
        });
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [amdSplash, lootSplash, state?.elementBoard]);

  // Auto-scroll to active figure
  useEffect(() => {
    if (!contentRef.current) return;
    const activeEl = contentRef.current.querySelector('.figure-card--active');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [state?.figures, state?.monsters, state?.characters, demoActiveIdx]);

  if (!state) return null;

  const scenarioName = state.scenario
    ? `Scenario ${state.scenario.index}`
    : 'Unknown Scenario';
  const scenarioIndex = state.scenario?.index ?? '?';

  // Detect pending initiative state
  const isPending = state.characters.every(c => c.initiative === 0 || c.absent || c.exhausted);

  // Build figure order from state.figures[]
  const figureEntries = state.figures.map(figRef => {
    const dashIdx = figRef.indexOf('-');
    const edition = figRef.substring(0, dashIdx);
    const name = figRef.substring(dashIdx + 1);

    const character = state.characters.find(c => c.name === name && c.edition === edition);
    if (character && !character.absent && !character.exhausted) {
      return {
        type: 'character' as const,
        name, edition,
        initiative: character.initiative,
        active: character.active,
        done: character.off && !character.active,
        character,
      };
    }

    const monster = state.monsters.find(m => m.name === name && m.edition === edition);
    if (monster) {
      const hasLiving = monster.entities.some(e => !e.dead);
      if (!hasLiving) return null;
      return {
        type: 'monster' as const,
        name, edition,
        initiative: monster.initiative,
        active: monster.active,
        done: monster.off && !monster.active,
        monster,
      };
    }

    return null;
  }).filter(Boolean) as Array<{
    type: 'character' | 'monster';
    name: string;
    edition: string;
    initiative: number;
    active: boolean;
    done: boolean;
    character?: any;
    monster?: any;
  }>;

  // Apply demo active index override
  const displayEntries = demoActiveIdx !== null
    ? figureEntries.map((entry, i) => ({
        ...entry,
        active: i === demoActiveIdx,
        done: i < demoActiveIdx,
      }))
    : figureEntries;

  // Pending layout: characters first, then monsters/allies
  let activeFigures = displayEntries;
  let completedFigures: typeof displayEntries = [];

  if (isPending && demoActiveIdx === null) {
    const chars = displayEntries.filter(f => f.type === 'character');
    const others = displayEntries.filter(f => f.type !== 'character');
    activeFigures = [...chars, ...others];
    completedFigures = [];
  } else {
    activeFigures = displayEntries.filter(f => !f.done);
    completedFigures = displayEntries.filter(f => f.done);
  }

  const edition = state.edition || 'gh';

  // Find target character portrait position for loot animation
  const getLootTargetPosition = (playerName: string): { x: number; y: number } | null => {
    const el = document.querySelector(`[data-character-name="${playerName}"]`) as HTMLElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  return (
    <div class="display" data-edition={edition}>
      <AmbientParticles preset={edition === 'fh' ? 'snow' : 'embers'} />
      <div class="display__ambient" />
      <div class="display__vignette" />

      <div class="display__content" ref={contentRef}>
        <DisplayScenarioHeader
          scenarioName={scenarioName}
          scenarioIndex={scenarioIndex}
          round={state.round}
          level={state.level}
          elements={state.elementBoard.map(el =>
            elementOverrides[el.type] ? { ...el, state: elementOverrides[el.type] as any } : el
          )}
          isPending={isPending}
        />

        <DisplayInitiativeColumn>
          {activeFigures.map(entry => {
            const monsterData = entry.type === 'monster' ? monsterDataMap.get(entry.name) : undefined;
            // Merge real API ability with mock name fallback
            const apiAbility = monsterData?.ability;
            const mockAbility = entry.type === 'monster' ? mockAbilities[entry.name] : undefined;
            const ability = apiAbility
              ? { ...apiAbility, name: mockAbility?.name || apiAbility.name }
              : mockAbility;
            return (
              <DisplayFigureCard
                key={`${entry.edition}-${entry.name}`}
                type={entry.type}
                name={entry.name}
                edition={entry.edition}
                initiative={entry.initiative}
                active={entry.active}
                done={entry.done}
                character={entry.character}
                monster={entry.monster}
                ability={ability}
                baseStats={monsterData?.baseStats || (entry.type === 'monster' ? mockMonsterStats[entry.name] : undefined)}
                innateStats={monsterData?.innateStats}
              />
            );
          })}
        </DisplayInitiativeColumn>

        {/* Completed figures tray */}
        {completedFigures.length > 0 && (() => {
          const completedMonsters = completedFigures.filter(f => f.type === 'monster' && f.monster);
          return (
            <div class="display-completed-tray">
              <div class="display-completed-tray__layout">
                {/* Standees bottom-left, grouped by monster type */}
                {completedMonsters.length > 0 && (
                  <div class="display-completed-tray__standees">
                    {completedMonsters.map(entry => {
                      const living = entry.monster.entities
                        .filter((e: any) => !e.dead)
                        .sort((a: any, b: any) => {
                          if (a.type === 'elite' && b.type !== 'elite') return -1;
                          if (a.type !== 'elite' && b.type === 'elite') return 1;
                          return a.number - b.number;
                        });
                      if (living.length === 0) return null;
                      return (
                        <div key={`standees-${entry.name}`} class="display-completed-tray__standee-row">
                          {living.map((entity: any) => (
                            <StandeeMiniCard
                              key={entity.number}
                              entity={entity}
                              edition={entry.edition}
                              monsterName={entry.name}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Compact cards bottom-right, stacked vertically */}
                <div class="display-completed-tray__cards">
                  {completedFigures.map(entry => {
                    const monsterData = entry.type === 'monster' ? monsterDataMap.get(entry.name) : undefined;
                    const apiAbility = monsterData?.ability;
                    const mockAbility = entry.type === 'monster' ? mockAbilities[entry.name] : undefined;
                    const ability = apiAbility
                      ? { ...apiAbility, name: mockAbility?.name || apiAbility.name }
                      : mockAbility;
                    return (
                      <DisplayFigureCard
                        key={`${entry.edition}-${entry.name}-compact`}
                        type={entry.type}
                        name={entry.name}
                        edition={entry.edition}
                        initiative={entry.initiative}
                        active={false}
                        done={true}
                        compact={true}
                        character={entry.character}
                        monster={entry.monster}
                        ability={ability}
                        baseStats={monsterData?.baseStats || (entry.type === 'monster' ? mockMonsterStats[entry.name] : undefined)}
                        innateStats={monsterData?.innateStats}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <DisplayScenarioFooter
        specialRules={mockScenarioRules.specialRules}
        winConditions={mockScenarioRules.winConditions}
        lossConditions={mockScenarioRules.lossConditions}
      />

      {amdSplash && (
        <DisplayAMDSplash
          cardType={amdSplash}
          onComplete={() => setAmdSplash(null)}
        />
      )}

      {lootSplash && (
        <DisplayLootSplash
          lootType={lootSplash.type}
          coinValue={lootSplash.coinValue}
          playerName={lootSplash.playerName || 'Drifter'}
          targetPosition={getLootTargetPosition(lootSplash.playerName || 'Drifter')}
          onComplete={() => setLootSplash(null)}
        />
      )}

      <DisplayTransitions
        transition={demoTransition}
        roundNumber={state.round}
        scenarioName={scenarioName}
        onComplete={() => setDemoTransition(null)}
      />
    </div>
  );
}
