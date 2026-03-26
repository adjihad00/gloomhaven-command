import { h } from 'preact';
import type { ElementModel, AttackModifierDeckModel } from '@gloomhaven-command/shared';
import { ElementBoard } from './ElementBoard';
import { ModifierDeck } from './ModifierDeck';

interface DoorInfo {
  roomNumber: number;
  ref: string;
  revealed: boolean;
  marker?: string;
}

interface ScenarioFooterProps {
  phase: string;
  canAdvance: boolean;
  advanceLabel: string;
  onAdvance: () => void;
  scenarioName?: string;
  doors?: DoorInfo[];
  onRevealRoom?: (roomNumber: number) => void;
  elementBoard: ElementModel[];
  onCycleElement?: (elementType: string, currentState: string) => void;
  modifierDeck?: AttackModifierDeckModel;
  onDrawModifier?: () => void;
  onShuffleModifier?: () => void;
  onAddBless?: () => void;
  onRemoveBless?: () => void;
  onAddCurse?: () => void;
  onRemoveCurse?: () => void;
  readonly?: boolean;
}

export function ScenarioFooter({
  phase, canAdvance, advanceLabel, onAdvance,
  scenarioName, doors, onRevealRoom,
  elementBoard, onCycleElement,
  modifierDeck, onDrawModifier, onShuffleModifier,
  onAddBless, onRemoveBless, onAddCurse, onRemoveCurse,
  readonly,
}: ScenarioFooterProps) {
  return (
    <div class="scenario-footer">
      {/* Left: phase action */}
      <div class="scenario-footer__left">
        <button
          class={`btn ${canAdvance ? 'btn-primary' : ''}`}
          onClick={onAdvance}
          disabled={!canAdvance || readonly}
        >
          {advanceLabel}
        </button>
      </div>

      {/* Center: scenario + doors */}
      <div class="scenario-footer__center">
        {scenarioName && <span class="scenario-footer__name">{scenarioName}</span>}
        {doors && doors.length > 0 && (
          <div class="scenario-footer__doors">
            {doors.map(door => (
              <button
                key={door.roomNumber}
                class={`scenario-footer__door ${door.revealed ? 'revealed' : ''}`}
                onClick={() => !door.revealed && onRevealRoom?.(door.roomNumber)}
                disabled={door.revealed || readonly}
                title={door.revealed
                  ? `Room ${door.roomNumber} (${door.ref}) - revealed`
                  : `Open door to Room ${door.roomNumber} (${door.ref})`
                }
              >
                <span class="scenario-footer__door-icon">{door.revealed ? '\u25A1' : '\u25A0'}</span>
                <span class="scenario-footer__door-ref">{door.ref}</span>
                {door.marker && !door.revealed && (
                  <span class="scenario-footer__door-marker">&sect;</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: elements + modifier deck */}
      <div class="scenario-footer__right">
        <ElementBoard
          elements={elementBoard}
          onCycleElement={onCycleElement}
          layout="horizontal"
          readonly={readonly}
          size="compact"
        />
        {modifierDeck && onDrawModifier && onShuffleModifier && (
          <ModifierDeck
            deck={modifierDeck}
            deckName="Monster"
            onDraw={onDrawModifier}
            onShuffle={onShuffleModifier}
            onAddBless={onAddBless ?? (() => {})}
            onRemoveBless={onRemoveBless ?? (() => {})}
            onAddCurse={onAddCurse ?? (() => {})}
            onRemoveCurse={onRemoveCurse ?? (() => {})}
            readonly={readonly}
            compact
          />
        )}
      </div>
    </div>
  );
}
