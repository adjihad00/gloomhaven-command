import { h } from 'preact';
import type { AttackModifierDeckModel, LevelDerivedValues } from '@gloomhaven-command/shared';
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
  doors?: DoorInfo[];
  onRevealRoom?: (roomNumber: number) => void;
  levelValues: LevelDerivedValues;
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
  doors, onRevealRoom, levelValues,
  modifierDeck, onDrawModifier, onShuffleModifier,
  onAddBless, onRemoveBless, onAddCurse, onRemoveCurse,
  readonly,
}: ScenarioFooterProps) {
  return (
    <div class="scenario-footer">
      {/* Left: phase action */}
      <button
        class={`phase-btn ${canAdvance ? 'ready' : 'waiting'}`}
        onClick={onAdvance}
        disabled={!canAdvance || readonly}
      >
        {advanceLabel}
      </button>

      {/* Center-left: door controls */}
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

      {/* Center: level-derived values */}
      <div class="footer-derived">
        <span class="derived-pill" title="Trap Damage">
          <span class="derived-icon">{'\u26A0'}</span>{levelValues.trapDamage}
        </span>
        <span class="derived-pill" title="Gold per Coin">
          <span class="derived-icon">{'\uD83D\uDCB0'}</span>{levelValues.goldConversion}
        </span>
        <span class="derived-pill" title="Bonus XP">
          <span class="derived-icon">{'\u2605'}</span>{levelValues.bonusXP}
        </span>
        <span class="derived-pill" title="Hazardous Terrain">
          <span class="derived-icon">{'\u2623'}</span>{levelValues.hazardousTerrain}
        </span>
      </div>

      {/* Right: modifier deck */}
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
  );
}
