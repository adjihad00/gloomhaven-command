import { h } from 'preact';
import type { Character, CommandTarget } from '@gloomhaven-command/shared';
import { useCommands } from '../../hooks/useCommands';
import { useGameState } from '../../hooks/useGameState';
import { PlayerSheet } from '../../phone/sheets/PlayerSheet';

interface PlayerSheetQuickViewProps {
  character: Character;
  edition: string;
  onClose: () => void;
}

/**
 * Phase T0a: controller-side read-only Player Sheet.
 *
 * Replaces the old `CharacterSheetOverlay`. Renders the same `PlayerSheet`
 * surface the phone uses with `readOnly` set — progression tabs disable
 * editable affordances and the header `⋯` menu is hidden (the close `←`
 * button is kept regardless so the GM can exit).
 *
 * The Active Scenario section remains interactive on the controller so the
 * GM can still adjust HP / conditions / long rest from here — matching the
 * pre-T0a behaviour of the old controller character detail flow. Command
 * handlers are wired directly to the controller's `useCommands()`.
 *
 * No `OverlayBackdrop` wrapper: `PlayerSheet` is itself a fixed-position
 * full-screen modal, and wrapping it in another overlay buried the
 * backdrop's X button under the sheet's own layer.
 */
export function PlayerSheetQuickView({ character, edition, onClose }: PlayerSheetQuickViewProps) {
  const commands = useCommands();
  const { state } = useGameState();

  const ed = character.edition || edition;
  const charTarget: CommandTarget = { type: 'character', name: character.name, edition: ed };

  return (
    <PlayerSheet
      character={character}
      edition={edition}
      onClose={onClose}
      readOnly
      elements={state?.elementBoard}
      lootDeck={state?.lootDeck ?? null}
      isActive={character.active && !character.off}
      onChangeHealth={(delta) => commands.changeHealth(charTarget, delta)}
      onSetXP={(v) => commands.setExperience(character.name, ed, v)}
      onToggleCondition={(name) => commands.toggleCondition(charTarget, name)}
      onToggleLongRest={() => commands.toggleLongRest(character.name, ed)}
      onToggleAbsent={() => commands.toggleAbsent(character.name, ed)}
      onToggleExhausted={() => commands.toggleExhausted(character.name, ed)}
      onMoveElement={(elType, newState) => commands.moveElement(elType, newState)}
    />
  );
}
