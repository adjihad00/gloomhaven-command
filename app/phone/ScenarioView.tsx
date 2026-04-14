import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { useGameState } from '../hooks/useGameState';
import { useCommands } from '../hooks/useCommands';
import { useDataApi } from '../hooks/useDataApi';
import { PhoneCharacterHeader } from './components/PhoneCharacterHeader';
import { PhoneHealthBar } from './components/PhoneHealthBar';
import { PhoneInitiativeSection } from './components/PhoneInitiativeSection';
import { PhoneTurnBanner } from './components/PhoneTurnBanner';
import { PhoneConditionStrip } from './components/PhoneConditionStrip';
import { PhoneCounterRow } from './components/PhoneCounterRow';
import { PhoneSummonSection } from './components/PhoneSummonSection';
import { PhoneActionBar } from './components/PhoneActionBar';
import { PhoneInitiativeNumpad } from './overlays/PhoneInitiativeNumpad';
import { PhoneConditionPicker } from './overlays/PhoneConditionPicker';
import { PhoneCharacterDetail } from './overlays/PhoneCharacterDetail';
import type { ConditionName, CommandTarget } from '@gloomhaven-command/shared';

type OverlayState =
  | { type: 'none' }
  | { type: 'numpad' }
  | { type: 'conditionPicker' }
  | { type: 'characterDetail' };

interface ScenarioViewProps {
  selectedCharacter: string;
}

export function ScenarioView({ selectedCharacter }: ScenarioViewProps) {
  const { getCharacter, phase, figures, edition, round } = useGameState();
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

  return (
    <div class="phone-scenario">
      <PhoneCharacterHeader
        name={character.name}
        edition={ed}
        level={character.level}
        characterColor={characterColor}
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
        <PhoneHealthBar
          current={character.health}
          max={character.maxHealth}
          onChangeHealth={(delta) => commands.changeHealth(charTarget, delta)}
        />

        <PhoneInitiativeSection
          initiative={character.initiative}
          longRest={character.longRest}
          phase={phase}
          isActive={isActive}
          isDone={isDone}
          onOpenNumpad={() => setOverlay({ type: 'numpad' })}
        />

        <PhoneConditionStrip
          conditions={character.entityConditions}
          onToggleCondition={(name) => commands.toggleCondition(charTarget, name)}
          onOpenPicker={() => setOverlay({ type: 'conditionPicker' })}
        />

        <PhoneCounterRow
          xp={character.experience}
          loot={character.loot}
          onSetXP={(v) => commands.setExperience(character.name, ed, v)}
          onSetLoot={(v) => commands.setLoot(character.name, ed, v)}
        />

        <PhoneSummonSection
          summons={character.summons}
          characterName={character.name}
          characterEdition={ed}
          onChangeHealth={(uuid, delta) => commands.changeHealth(
            { type: 'summon', characterName: character.name, characterEdition: ed, summonUuid: uuid },
            delta
          )}
          onRemoveSummon={(uuid) => commands.removeSummon(character.name, ed, uuid)}
          onToggleCondition={(uuid, cond) => commands.toggleCondition(
            { type: 'summon', characterName: character.name, characterEdition: ed, summonUuid: uuid },
            cond
          )}
        />
      </div>

      <PhoneActionBar
        phase={phase}
        isActive={isActive}
        isDone={isDone}
        longRest={character.longRest}
        onEndTurn={() => commands.toggleTurn({ type: 'character', name: character.name, edition: ed })}
        onToggleLongRest={() => commands.toggleLongRest(character.name, ed)}
        onExhaust={() => commands.toggleExhausted(character.name, ed)}
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
          onChangeHealth={(delta) => commands.changeHealth(charTarget, delta)}
          onSetXP={(v) => commands.setExperience(character.name, ed, v)}
          onSetLoot={(v) => commands.setLoot(character.name, ed, v)}
          onToggleCondition={(name) => commands.toggleCondition(charTarget, name)}
          onToggleLongRest={() => commands.toggleLongRest(character.name, ed)}
          onToggleAbsent={() => commands.toggleAbsent(character.name, ed)}
          onToggleExhausted={() => commands.toggleExhausted(character.name, ed)}
          onClose={() => setOverlay({ type: 'none' })}
        />
      )}
    </div>
  );
}
