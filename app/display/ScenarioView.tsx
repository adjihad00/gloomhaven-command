import { h } from 'preact';
import { useContext, useState, useEffect, useRef } from 'preact/hooks';
import type { RefObject } from 'preact';
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
import { useStateTransition } from './hooks/useStateTransitions';
import { useScenarioText } from '../hooks/useScenarioText';

// ── Prototype-only imports (keyboard demo controls) ─────────────────────────

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

// ── Props ──────────────────────────────────────────────────────────────────

interface ScenarioViewProps {
  prototypeMode?: boolean;
  isReconnect?: RefObject<boolean>;
  onOpenMenu?: () => void;
}

export function ScenarioView({ prototypeMode, isReconnect, onOpenMenu }: ScenarioViewProps) {
  const { state } = useContext(AppContext);
  const [transition, setTransition] = useState<TransitionType>(null);
  const [amdSplash, setAmdSplash] = useState<string | null>(null);
  const [lootSplash, setLootSplash] = useState<{ type: string; coinValue?: number; playerName?: string } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ── Prototype-only state ────────────────────────────────────────────────
  const [elementOverrides, setElementOverrides] = useState<Record<string, string>>({});
  const [demoActiveIdx, setDemoActiveIdx] = useState<number | null>(null);

  // Fetch real monster data from API
  const monsterDataMap = useDisplayMonsterData(
    state?.monsters || [],
    state?.edition || 'fh',
    state?.level ?? 2,
  );

  // ── Live state transition detection (production only) ───────────────────

  // Round change → round flourish
  useStateTransition(state?.round, (prev, curr) => {
    if (prototypeMode || isReconnect?.current) return;
    if (prev !== undefined && curr !== undefined && curr > prev) {
      setTransition('round');
    }
  });

  // Scenario finish → victory/defeat overlay
  useStateTransition(state?.finish, (prev, curr) => {
    if (prototypeMode || isReconnect?.current) return;
    if (curr === 'pending:victory') setTransition('victory');
    else if (curr === 'pending:failure') setTransition('defeat');
    else if (curr === 'success') setTransition('victory');
    else if (curr === 'failure') setTransition('defeat');
    else if (!curr && prev) setTransition(null); // cancelled
  });

  // AMD card draw → flip animation
  useStateTransition(state?.monsterAttackModifierDeck?.lastDrawn, (prev, curr) => {
    if (prototypeMode || isReconnect?.current) return;
    if (prev !== undefined && curr && !amdSplash) {
      // Map card ID to display type
      const cardType = resolveAMDCardType(curr);
      setAmdSplash(cardType);
    }
  });

  // Loot card draw → shrink-to-character animation
  useStateTransition(state?.lootDeck?.current, (prev, curr) => {
    if (prototypeMode || isReconnect?.current) return;
    if (prev !== undefined && curr !== undefined && curr > prev && !lootSplash) {
      // The drawn card is at index prev (before current incremented)
      const drawnCard = state?.lootDeck?.cards?.[prev];
      // Active character is the one who drew
      const activeChar = state?.characters?.find(c => c.active && !c.exhausted && !c.absent);
      setLootSplash({
        type: drawnCard?.type || 'money',
        coinValue: drawnCard?.type === 'money' ? (drawnCard as any)?.value4P : undefined,
        playerName: activeChar?.name,
      });
    }
  });

  // ── Prototype keyboard controls ─────────────────────────────────────────

  useEffect(() => {
    if (!prototypeMode) return;

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
      if (e.key === 'v') setTransition('victory');
      if (e.key === 'd') setTransition('defeat');
      if (e.key === 'r') setTransition('round');

      const keyNum = parseInt(e.key);
      if (keyNum >= 1 && keyNum <= 6) {
        const elType = elementKeys[keyNum - 1];
        setElementOverrides(prev => {
          const currentState = prev[elType] || state?.elementBoard?.find(el => el.type === elType)?.state || 'inert';
          const nextState = ELEMENT_CYCLE[currentState] || 'inert';
          return { ...prev, [elType]: nextState };
        });
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        setDemoActiveIdx(prev => {
          const total = state?.figures?.length || 0;
          if (total === 0) return null;
          if (prev === null) return 0;
          if (e.shiftKey) return prev <= 0 ? total - 1 : prev - 1;
          return prev >= total - 1 ? 0 : prev + 1;
        });
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prototypeMode, amdSplash, lootSplash, state?.elementBoard]);

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

  // Apply demo active index override (prototype only)
  const displayEntries = (prototypeMode && demoActiveIdx !== null)
    ? figureEntries.map((entry, i) => ({
        ...entry,
        active: i === demoActiveIdx,
        done: i < demoActiveIdx,
      }))
    : figureEntries;

  // Pending layout: characters first, then monsters/allies
  let activeFigures = displayEntries;
  let completedFigures: typeof displayEntries = [];

  if (isPending && (!prototypeMode || demoActiveIdx === null)) {
    const chars = displayEntries.filter(f => f.type === 'character');
    const others = displayEntries.filter(f => f.type !== 'character');
    activeFigures = [...chars, ...others];
    completedFigures = [];
  } else {
    activeFigures = displayEntries.filter(f => !f.done);
    completedFigures = displayEntries.filter(f => f.done);
  }

  const edition = state.edition || 'gh';

  // Elements: use overrides in prototype mode, live state in production
  const elements = prototypeMode
    ? state.elementBoard.map(el =>
        elementOverrides[el.type] ? { ...el, state: elementOverrides[el.type] as any } : el
      )
    : state.elementBoard;

  // Find target character portrait position for loot animation
  const getLootTargetPosition = (playerName: string): { x: number; y: number } | null => {
    const el = document.querySelector(`[data-character-name="${playerName}"]`) as HTMLElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  // Resolve ability data for a monster — API first, mock fallback in prototype
  const getMonsterAbility = (monsterName: string) => {
    const apiData = monsterDataMap.get(monsterName);
    if (apiData?.ability) return apiData.ability;
    if (prototypeMode) return mockAbilities[monsterName] as any;
    return null;
  };

  const getMonsterBaseStats = (monsterName: string) => {
    const apiData = monsterDataMap.get(monsterName);
    if (apiData?.baseStats) return apiData.baseStats;
    if (prototypeMode) return mockMonsterStats[monsterName] as any;
    return undefined;
  };

  // Scenario footer: real rules from reference DB, or mock in prototype mode
  const { specialRules: refRules } = useScenarioText(
    prototypeMode ? '' : (state?.edition || ''),
    prototypeMode ? '' : scenarioIndex,
  );
  const footerRules = prototypeMode
    ? { specialRules: [mockScenarioRules.specialRules], winConditions: mockScenarioRules.winConditions, lossConditions: mockScenarioRules.lossConditions }
    : {
        specialRules: refRules.length > 0 ? refRules : ['See Scenario Book'],
        winConditions: 'See Scenario Book',
        lossConditions: 'All characters exhausted.',
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
          elements={elements}
          isPending={isPending}
          onOpenMenu={onOpenMenu}
        />

        <DisplayInitiativeColumn>
          {activeFigures.map(entry => {
            const ability = entry.type === 'monster' ? getMonsterAbility(entry.name) : undefined;
            const baseStats = entry.type === 'monster' ? getMonsterBaseStats(entry.name) : undefined;
            const innateStats = entry.type === 'monster' ? monsterDataMap.get(entry.name)?.innateStats : undefined;
            return (
              <DisplayFigureCard
                key={`${entry.edition}-${entry.name}`}
                type={entry.type}
                name={entry.name}
                edition={entry.edition}
                initiative={entry.initiative}
                active={entry.active}
                done={entry.done}
                phase={state.state}
                character={entry.character}
                monster={entry.monster}
                ability={ability}
                baseStats={baseStats}
                innateStats={innateStats}
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

                <div class="display-completed-tray__cards">
                  {completedFigures.map(entry => {
                    const ability = entry.type === 'monster' ? getMonsterAbility(entry.name) : undefined;
                    const baseStats = entry.type === 'monster' ? getMonsterBaseStats(entry.name) : undefined;
                    const innateStats = entry.type === 'monster' ? monsterDataMap.get(entry.name)?.innateStats : undefined;
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
                        baseStats={baseStats}
                        innateStats={innateStats}
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
        specialRules={footerRules.specialRules}
        winConditions={footerRules.winConditions}
        lossConditions={footerRules.lossConditions}
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
          playerName={lootSplash.playerName || 'Unknown'}
          targetPosition={getLootTargetPosition(lootSplash.playerName || '')}
          onComplete={() => setLootSplash(null)}
        />
      )}

      <DisplayTransitions
        transition={transition}
        roundNumber={state.round}
        scenarioName={scenarioName}
        onComplete={() => setTransition(null)}
      />
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Map AMD card ID string to display card type */
function resolveAMDCardType(cardId: string): string {
  const id = cardId.toLowerCase();
  if (id.includes('bless')) return 'bless';
  if (id.includes('curse')) return 'curse';
  if (id === '2x' || id.includes('double') || id.includes('2x')) return 'double';
  if (id === 'null' || id.includes('miss') || id.includes('null')) return 'null';
  if (id.includes('+2')) return 'plus2';
  if (id.includes('-2')) return 'minus2';
  if (id.includes('+1')) return 'plus1';
  if (id.includes('-1')) return 'minus1';
  if (id.includes('+0') || id === '0') return 'plus0';
  return 'plus0';
}
