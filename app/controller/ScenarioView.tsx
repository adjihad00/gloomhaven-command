import { h } from 'preact';
import { useState, useMemo, useContext, useCallback } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { useGameState } from '../hooks/useGameState';
import { useCommands } from '../hooks/useCommands';
import { useMonsterData } from './hooks/useMonsterData';
import { useDataApi } from '../hooks/useDataApi';
import { getInitiativeOrder, deriveLevelValues } from '@gloomhaven-command/shared';
import type { ConditionName, ScenarioData } from '@gloomhaven-command/shared';
import { getConditionsForEdition } from '@gloomhaven-command/shared';
import { FigureList } from '../components/FigureList';
import { ScenarioHeader } from '../components/ScenarioHeader';
import { ScenarioFooter } from '../components/ScenarioFooter';
import { CharacterDetailOverlay } from './overlays/CharacterDetailOverlay';
import { CharacterSheetOverlay } from './overlays/CharacterSheetOverlay';
import { ScenarioSetupOverlay } from './overlays/ScenarioSetupOverlay';
import { MenuOverlay } from './overlays/MenuOverlay';
import { LootDeckOverlay } from './overlays/LootDeckOverlay';
import { ScenarioSummaryOverlay } from './overlays/ScenarioSummaryOverlay';
import { InitiativeNumpad } from './overlays/InitiativeNumpad';
import { characterThumbnail } from '../shared/assets';
import { formatName } from '../shared/formatName';

type OverlayState =
  | { type: 'none' }
  | { type: 'characterDetail'; characterName: string }
  | { type: 'characterSheet'; characterName: string }
  | { type: 'scenarioSetup' }
  | { type: 'menu' }
  | { type: 'lootDeck' }
  | { type: 'scenarioSummary'; outcome: 'victory' | 'defeat' };

export function ScenarioView() {
  const { gameCode, disconnect } = useContext(AppContext);
  const gameState = useGameState();
  const commands = useCommands();
  const { state, characters, monsters, elementBoard, round, phase, level, edition } = gameState;

  const [activeOverlay, setActiveOverlay] = useState<OverlayState>({ type: 'none' });
  const [numpadTarget, setNumpadTarget] = useState<{ name: string; edition: string } | null>(null);
  const [pendingLootCard, setPendingLootCard] = useState<number | null>(null);

  // Draw loot card — auto-assigns to active character server-side.
  // If no active character, show floating picker for manual assignment.
  const handleDrawLoot = useCallback(() => {
    const cardIndex = state?.lootDeck?.current ?? 0;
    commands.drawLootCard();
    // Check if there's an active character — if not, show picker
    const hasActive = characters.some(c => c.active && !c.exhausted && !c.absent);
    if (!hasActive) {
      setPendingLootCard(cardIndex);
    }
  }, [state, characters, commands]);

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

  // Available conditions — filtered by edition
  const conditionEdition = state?.scenario?.edition ?? state?.party?.edition ?? edition ?? 'gh';
  const availableConditions = useMemo<ConditionName[]>(() => {
    if (state?.conditions && state.conditions.length > 0) return state.conditions;
    return [...getConditionsForEdition(conditionEdition)];
  }, [state?.conditions, conditionEdition]);

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
          onOpenNumpad={(name, ed) => setNumpadTarget({ name, edition: ed })}
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
        onDrawLoot={handleDrawLoot}
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
          hasScenario={!!state?.scenario}
          onClose={() => setActiveOverlay({ type: 'none' })}
          onDisconnect={disconnect}
          onOpenSetup={() => setActiveOverlay({ type: 'scenarioSetup' })}
          onScenarioEnd={(outcome) => setActiveOverlay({ type: 'scenarioSummary', outcome })}
        />
      )}

      {activeOverlay.type === 'scenarioSummary' && (
        <ScenarioSummaryOverlay
          state={state}
          outcome={activeOverlay.outcome}
          onConfirm={() => {
            commands.completeScenario(activeOverlay.outcome);
            setActiveOverlay({ type: 'none' });
          }}
          onCancel={() => setActiveOverlay({ type: 'none' })}
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

      {/* Initiative numpad — rendered at top level to avoid stacking context issues */}
      {numpadTarget && (() => {
        const char = characters.find(c => c.name === numpadTarget.name && (c.edition || edition) === numpadTarget.edition);
        if (!char) return null;
        const ed = char.edition || edition;
        return (
          <InitiativeNumpad
            characterName={char.name}
            currentInitiative={char.initiative}
            onSet={(value) => {
              commands.setInitiative(numpadTarget.name, ed, value);
              setNumpadTarget(null);
            }}
            onLongRest={() => {
              commands.toggleLongRest(numpadTarget.name, ed);
              setNumpadTarget(null);
            }}
            onClose={() => setNumpadTarget(null)}
          />
        );
      })()}

      {/* Floating loot assignment picker — shown when card drawn with no active character */}
      {pendingLootCard !== null && (
        <div class="loot-assign-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setPendingLootCard(null); }}>
          <div class="loot-assign-picker">
            <span class="loot-assign-picker__label">Assign loot to:</span>
            <div class="loot-assign-picker__chars">
              {characters.filter(c => !c.exhausted && !c.absent).map(c => (
                <button key={c.name} class="loot-assign-picker__char"
                  onClick={() => {
                    commands.assignLoot(pendingLootCard, c.name, c.edition || edition);
                    setPendingLootCard(null);
                  }}
                  title={c.title || formatName(c.name)}>
                  <img src={characterThumbnail(c.edition || edition, c.name)}
                    alt={formatName(c.name)} class="loot-assign-picker__img" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
