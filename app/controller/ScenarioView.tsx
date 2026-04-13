import { h } from 'preact';
import { useState, useMemo, useContext } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { useGameState } from '../hooks/useGameState';
import { useCommands } from '../hooks/useCommands';
import { useMonsterData } from './hooks/useMonsterData';
import { useDataApi } from '../hooks/useDataApi';
import { getInitiativeOrder, deriveLevelValues } from '@gloomhaven-command/shared';
import type { ConditionName, ScenarioData } from '@gloomhaven-command/shared';
import { FigureList } from '../components/FigureList';
import { ScenarioHeader } from '../components/ScenarioHeader';
import { ScenarioFooter } from '../components/ScenarioFooter';
import { CharacterDetailOverlay } from './overlays/CharacterDetailOverlay';
import { CharacterSheetOverlay } from './overlays/CharacterSheetOverlay';
import { ScenarioSetupOverlay } from './overlays/ScenarioSetupOverlay';
import { MenuOverlay } from './overlays/MenuOverlay';
import { LootDeckOverlay } from './overlays/LootDeckOverlay';

type OverlayState =
  | { type: 'none' }
  | { type: 'characterDetail'; characterName: string }
  | { type: 'characterSheet'; characterName: string }
  | { type: 'scenarioSetup' }
  | { type: 'menu' }
  | { type: 'lootDeck' };

export function ScenarioView() {
  const { gameCode, disconnect } = useContext(AppContext);
  const gameState = useGameState();
  const commands = useCommands();
  const { state, characters, monsters, elementBoard, round, phase, level, edition } = gameState;

  const [activeOverlay, setActiveOverlay] = useState<OverlayState>({ type: 'none' });

  // Monster data fetching
  const { statsMap: monsterStatsMap, abilitiesMap } = useMonsterData(monsters, edition, level);

  // Initiative order (for advance logic)
  const orderedFigures = useMemo(() => {
    if (!state) return [];
    return getInitiativeOrder(state);
  }, [state]);

  // Level-derived values
  const levelValues = useMemo(() => deriveLevelValues(level), [level]);

  // Phase advancement logic
  // GHS pattern: footer button handles phase transitions only.
  // Turn advancement is done via portrait clicks (toggleTurn).
  const advanceInfo = useMemo(() => {
    if (!state) return { canAdvance: false, label: '...' };

    if (phase === 'draw') {
      const activeChars = characters.filter(c => !c.absent && !c.exhausted);
      const allInitSet = activeChars.length > 0 && activeChars.every(c => c.initiative > 0);
      return {
        canAdvance: allInitSet,
        label: allInitSet ? 'Start Round' : 'Set Initiatives...',
      };
    }

    // Play phase — "Next Round" enabled only when all figures are done
    const nonAbsentFigures = orderedFigures.filter(f => !f.absent);
    const allDone = nonAbsentFigures.length > 0 && nonAbsentFigures.every(f => f.off);
    return { canAdvance: allDone, label: 'Next Round' };
  }, [state, orderedFigures, characters, phase]);

  // Available conditions
  const availableConditions = useMemo<ConditionName[]>(() => {
    if (state?.conditions && state.conditions.length > 0) return state.conditions;
    // Fallback: common GH conditions
    return [
      'stun', 'immobilize', 'disarm', 'wound', 'muddle',
      'poison', 'strengthen', 'invisible', 'curse', 'bless',
      'regenerate', 'ward', 'bane', 'brittle', 'impair',
    ];
  }, [state?.conditions]);

  // Fetch scenario room data for door controls
  const scenarioApiPath = state?.scenario
    ? `${state.scenario.edition}/scenario/${state.scenario.index}`
    : '';
  const { data: scenarioData } = useDataApi<ScenarioData>(scenarioApiPath, !!state?.scenario);

  const doorInfo = useMemo(() => {
    if (!scenarioData?.rooms || !state?.scenario) return [];
    const revealedSet = new Set(state.scenario.revealedRooms ?? []);
    return scenarioData.rooms
      .filter(r => !r.initial)
      .map(r => ({
        roomNumber: r.roomNumber,
        ref: r.ref,
        revealed: revealedSet.has(r.roomNumber),
        marker: r.marker,
      }));
  }, [scenarioData, state?.scenario]);

  if (!state) return <div class="scenario-empty"><p>Loading...</p></div>;

  // Empty state — no characters and no scenario
  if (characters.length === 0 && !state.scenario) {
    return (
      <div class="scenario-empty">
        <h2>No Game in Progress</h2>
        <p>Set up a scenario to begin.</p>
        <button class="btn btn-primary" onClick={() => setActiveOverlay({ type: 'scenarioSetup' })}>
          Scenario Setup
        </button>
        {activeOverlay.type === 'scenarioSetup' && (
          <ScenarioSetupOverlay state={state} onClose={() => setActiveOverlay({ type: 'none' })} />
        )}
      </div>
    );
  }

  return (
    <div class="controller-scenario">
      <ScenarioHeader
        round={round}
        phase={phase}
        scenarioIndex={state.scenario?.index}
        scenarioName={scenarioData?.name}
        level={level}
        elementBoard={elementBoard}
        onCycleElement={(type, currentState) => {
          const cycle: Record<string, string> = { inert: 'new', new: 'strong', strong: 'waning', waning: 'inert' };
          commands.moveElement(type as any, (cycle[currentState] || 'inert') as any);
        }}
        onMenuOpen={() => setActiveOverlay({ type: 'menu' })}
      />

      <div class="scenario-content">
        <FigureList
          state={state}
          monsterStats={monsterStatsMap}
          monsterAbilities={abilitiesMap}
          availableConditions={availableConditions}
          isDrawPhase={phase === 'draw'}
          onCharacterDetail={name => setActiveOverlay({ type: 'characterDetail', characterName: name })}
        />
      </div>

      <ScenarioFooter
        phase={phase}
        canAdvance={advanceInfo.canAdvance}
        advanceLabel={advanceInfo.label}
        onAdvance={() => commands.advancePhase()}
        doors={doorInfo}
        onRevealRoom={roomNum => commands.revealRoom(roomNum)}
        levelValues={levelValues}
        modifierDeck={state.monsterAttackModifierDeck}
        onDrawModifier={() => commands.drawModifierCard('monster')}
        onShuffleModifier={() => commands.shuffleModifierDeck('monster')}
        onAddBless={() => commands.addModifierCard('monster', 'bless')}
        onRemoveBless={() => commands.removeModifierCard('monster', 'bless')}
        onAddCurse={() => commands.addModifierCard('monster', 'curse')}
        onRemoveCurse={() => commands.removeModifierCard('monster', 'curse')}
        lootDeck={state.lootDeck}
        onOpenLootDeck={() => setActiveOverlay({ type: 'lootDeck' })}
      />

      {/* Overlays */}
      {activeOverlay.type === 'characterDetail' && (() => {
        const character = characters.find(c => c.name === activeOverlay.characterName);
        return character ? (
          <CharacterDetailOverlay
            character={character}
            edition={edition}
            availableConditions={availableConditions}
            isDrawPhase={phase === 'draw'}
            onClose={() => setActiveOverlay({ type: 'none' })}
            onOpenSheet={() => setActiveOverlay({ type: 'characterSheet', characterName: activeOverlay.characterName })}
          />
        ) : null;
      })()}

      {activeOverlay.type === 'characterSheet' && (() => {
        const character = characters.find(c => c.name === activeOverlay.characterName);
        return character ? (
          <CharacterSheetOverlay
            character={character}
            edition={edition}
            onClose={() => setActiveOverlay({ type: 'none' })}
          />
        ) : null;
      })()}

      {activeOverlay.type === 'scenarioSetup' && (
        <ScenarioSetupOverlay
          state={state}
          onClose={() => setActiveOverlay({ type: 'none' })}
        />
      )}

      {activeOverlay.type === 'menu' && (
        <MenuOverlay
          gameCode={gameCode}
          onClose={() => setActiveOverlay({ type: 'none' })}
          onDisconnect={disconnect}
          onOpenSetup={() => setActiveOverlay({ type: 'scenarioSetup' })}
        />
      )}

      {activeOverlay.type === 'lootDeck' && (
        <LootDeckOverlay
          lootDeck={state.lootDeck}
          characters={characters}
          edition={edition}
          onClose={() => setActiveOverlay({ type: 'none' })}
        />
      )}
    </div>
  );
}
