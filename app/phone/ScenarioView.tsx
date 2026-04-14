import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { useGameState } from '../hooks/useGameState';
import { useCommands } from '../hooks/useCommands';
import { useDataApi } from '../hooks/useDataApi';
import { HealthIcon } from '../components/Icons';
import { PhoneCharacterHeader } from './components/PhoneCharacterHeader';
import { PhoneInitiativeSection } from './components/PhoneInitiativeSection';
import { PhoneTurnBanner } from './components/PhoneTurnBanner';
import { PhoneConditionStrip } from './components/PhoneConditionStrip';
import { PhoneElementRow } from './components/PhoneElementRow';
import { PhoneInitiativeTimeline } from './components/PhoneInitiativeTimeline';
import { PhoneActionBar } from './components/PhoneActionBar';
import { PhoneInitiativeNumpad } from './overlays/PhoneInitiativeNumpad';
import { PhoneConditionPicker } from './overlays/PhoneConditionPicker';
import { PhoneCharacterDetail } from './overlays/PhoneCharacterDetail';
import { PhoneExhaustPopup } from './overlays/PhoneExhaustPopup';
import { PhoneLootDeckPopup } from './overlays/PhoneLootDeckPopup';
import { PhoneConditionSplash } from './overlays/PhoneConditionSplash';
import { PhoneRewardsOverlay } from './overlays/PhoneRewardsOverlay';
import type { ConditionName, CommandTarget, ElementType, ElementState } from '@gloomhaven-command/shared';

type OverlayState =
  | { type: 'none' }
  | { type: 'numpad' }
  | { type: 'conditionPicker' }
  | { type: 'characterDetail' }
  | { type: 'lootDeck' };

interface ScenarioViewProps {
  selectedCharacter: string;
  onSwitchCharacter?: () => void;
}

export function ScenarioView({ selectedCharacter, onSwitchCharacter }: ScenarioViewProps) {
  const { getCharacter, phase, figures, edition, round, elementBoard, lootDeck } = useGameState();
  const commands = useCommands();
  const [overlay, setOverlay] = useState<OverlayState>({ type: 'none' });

  const character = getCharacter(selectedCharacter);

  // Fetch class data for character color
  const { data: classData } = useDataApi<any>(
    `${edition}/character/${selectedCharacter}`,
    !!edition && !!selectedCharacter
  );
  const characterColor = classData?.color;

  // Compute initiative position among all figures
  const { position, total } = useMemo(() => {
    if (!character || phase === 'draw') return { position: 0, total: 0 };
    const sorted = [...figures]
      .filter(f => f.initiative > 0 && !f.absent && !f.exhausted)
      .sort((a, b) => a.initiative - b.initiative);
    const idx = sorted.findIndex(f => f.type === 'character' && f.name === selectedCharacter);
    return { position: idx + 1, total: sorted.length };
  }, [figures, character, phase, selectedCharacter]);

  if (!character) {
    return (
      <div class="phone-scenario phone-scenario--empty">
        <p>Character not found. They may have been removed from the game.</p>
      </div>
    );
  }

  if (character.exhausted) {
    return (
      <div class="phone-scenario phone-scenario--exhausted">
        <p class="phone-scenario__exhausted-text">Exhausted</p>
        <p class="phone-scenario__exhausted-sub">{character.name} is out of this scenario.</p>
      </div>
    );
  }

  const ed = character.edition;
  const charTarget: CommandTarget = { type: 'character', name: character.name, edition: ed };
  const isActive = character.active && !character.off;
  const isDone = character.off;
  const hasLootDeck = !!(lootDeck?.cards?.length);
  const isPlayPhase = phase !== 'draw';

  return (
    <div class="phone-scenario">
      {/* Initiative Timeline — auto-shows during play phase */}
      <PhoneInitiativeTimeline
        selectedCharacter={selectedCharacter}
        characterColor={characterColor}
      />

      {/* Condition Splash — shows on turn start with active conditions */}
      <PhoneConditionSplash
        conditions={character.entityConditions}
        isActive={isActive}
        phase={phase}
      />

      {/* Character header with integrated HP bar background */}
      <PhoneCharacterHeader
        name={character.name}
        edition={ed}
        level={character.level}
        characterColor={characterColor}
        health={character.health}
        maxHealth={character.maxHealth}
        onTap={() => setOverlay({ type: 'characterDetail' })}
      />

      <PhoneTurnBanner
        phase={phase}
        isActive={isActive}
        isDone={isDone}
        initiativePosition={position}
        totalFigures={total}
      />

      <div class="phone-scenario__body">
        {/* Initiative/HP row: initiative left, HP controls right */}
        {/* During active turn, End Turn replaces the initiative section */}
        <div class="phone-control-row">
          {isPlayPhase && isActive && !isDone ? (
            <button
              class="phone-control-row__end-turn"
              onClick={() => commands.toggleTurn({ type: 'character', name: character.name, edition: ed })}
              aria-label="End Turn"
            >
              End Turn
            </button>
          ) : (
            <PhoneInitiativeSection
              initiative={character.initiative}
              longRest={character.longRest}
              phase={phase}
              isActive={isActive}
              isDone={isDone}
              onOpenNumpad={() => setOverlay({ type: 'numpad' })}
            />
          )}

          <div class="phone-control-row__hp">
            <button
              class="phone-control-row__hp-btn phone-control-row__hp-btn--minus"
              onClick={() => commands.changeHealth(charTarget, -1)}
              disabled={character.health <= 0}
              aria-label="Decrease health"
            >
              &minus;
            </button>
            <HealthIcon size={18} />
            <button
              class="phone-control-row__hp-btn phone-control-row__hp-btn--plus"
              onClick={() => commands.changeHealth(charTarget, 1)}
              disabled={character.health >= character.maxHealth}
              aria-label="Increase health"
            >
              +
            </button>
          </div>
        </div>

        <PhoneConditionStrip
          conditions={character.entityConditions}
          onToggleCondition={(name) => commands.toggleCondition(charTarget, name)}
          onOpenPicker={() => setOverlay({ type: 'conditionPicker' })}
        />

        <PhoneElementRow
          elements={elementBoard}
          isActive={isActive}
          onMoveElement={(element, newState) => commands.moveElement(element, newState)}
        />
      </div>

      {/* Action bar: XP + Loot at bottom */}
      <PhoneActionBar
        phase={phase}
        isActive={isActive}
        isDone={isDone}
        xp={character.experience}
        loot={character.loot}
        onEndTurn={() => {}}
        onSetXP={(v) => commands.setExperience(character.name, ed, v)}
        hasLootDeck={hasLootDeck}
        canDrawLoot={isActive && hasLootDeck}
        onDrawLoot={() => setOverlay({ type: 'lootDeck' })}
      />

      {/* Rewards overlay — triggered when scenario completes */}
      <PhoneRewardsOverlay selectedCharacter={selectedCharacter} />

      {/* Exhaust popup — triggered when health reaches 0 */}
      <PhoneExhaustPopup
        characterHealth={character.health}
        onConfirmExhaust={() => commands.toggleExhausted(character.name, ed)}
        onCancelToOneHP={() => commands.changeHealth(charTarget, 1)}
      />

      {/* Overlays */}
      {overlay.type === 'numpad' && (
        <PhoneInitiativeNumpad
          characterName={character.name}
          currentInitiative={character.initiative}
          onSet={(v) => commands.setInitiative(character.name, ed, v)}
          onLongRest={() => commands.toggleLongRest(character.name, ed)}
          onClose={() => setOverlay({ type: 'none' })}
        />
      )}

      {overlay.type === 'conditionPicker' && (
        <PhoneConditionPicker
          edition={ed}
          activeConditions={character.entityConditions}
          onToggle={(name) => commands.toggleCondition(charTarget, name)}
          onClose={() => setOverlay({ type: 'none' })}
        />
      )}

      {overlay.type === 'characterDetail' && (
        <PhoneCharacterDetail
          character={character}
          edition={ed}
          characterColor={characterColor}
          elements={elementBoard}
          lootDeck={lootDeck}
          isActive={isActive}
          onChangeHealth={(delta) => commands.changeHealth(charTarget, delta)}
          onSetXP={(v) => commands.setExperience(character.name, ed, v)}
          onToggleCondition={(name) => commands.toggleCondition(charTarget, name)}
          onMoveElement={(element, newState) => commands.moveElement(element, newState)}
          onToggleLongRest={() => commands.toggleLongRest(character.name, ed)}
          onToggleAbsent={() => commands.toggleAbsent(character.name, ed)}
          onToggleExhausted={() => commands.toggleExhausted(character.name, ed)}
          onSwitchCharacter={onSwitchCharacter}
          onClose={() => setOverlay({ type: 'none' })}
        />
      )}

      {overlay.type === 'lootDeck' && lootDeck && (
        <PhoneLootDeckPopup
          lootDeck={lootDeck}
          characterName={character.name}
          characterEdition={ed}
          isActive={isActive}
          onDrawLootCard={() => commands.drawLootCard()}
          onAssignLoot={(idx, name, ed) => commands.assignLoot(idx, name, ed)}
          onClose={() => setOverlay({ type: 'none' })}
        />
      )}
    </div>
  );
}
