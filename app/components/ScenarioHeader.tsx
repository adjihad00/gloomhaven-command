import { h } from 'preact';
import type { ElementModel } from '@gloomhaven-command/shared';
import { ElementBoard } from './ElementBoard';

interface ScenarioHeaderProps {
  round: number;
  phase: string;
  scenarioName?: string;
  scenarioIndex?: string;
  level: number;
  elementBoard: ElementModel[];
  onCycleElement?: (elementType: string, currentState: string) => void;
  onMenuOpen?: () => void;
  /** Phase T0b: click scenario name to open scenario-controls overlay
   *  (End Scenario — Victory/Defeat). Relocated from MenuOverlay so the
   *  hamburger menu stays cross-mode (Party Sheet / Undo / Export /
   *  Disconnect) and scenario-specific flows cluster next to the
   *  scenario title. */
  onScenarioControls?: () => void;
  readonly?: boolean;
}

export function ScenarioHeader({
  round,
  phase,
  scenarioName,
  scenarioIndex,
  level,
  elementBoard,
  onCycleElement,
  onMenuOpen,
  onScenarioControls,
  readonly,
}: ScenarioHeaderProps) {
  const phaseLabel = phase === 'draw' ? 'Card Selection' : 'Playing';

  const scenarioDisplay = scenarioIndex && scenarioName
    ? `#${scenarioIndex} - ${scenarioName.toUpperCase()}, LEVEL ${level}`
    : scenarioIndex
    ? `#${scenarioIndex}, LEVEL ${level}`
    : `LEVEL ${level}`;

  return (
    <div class="scenario-header">
      <div class="header-left">
        {onMenuOpen && (
          <button class="menu-btn" onClick={onMenuOpen}>&#9776;</button>
        )}
        <div class="round-phase">
          <span class="round-label">Round {round}</span>
          <span class="phase-label">{phaseLabel}</span>
        </div>
      </div>

      <div class="header-center">
        {onScenarioControls ? (
          <button
            type="button"
            class="scenario-label scenario-label--interactive"
            onClick={onScenarioControls}
            aria-label="Open scenario controls"
          >
            {scenarioDisplay}
            <span class="scenario-label__caret" aria-hidden="true">▾</span>
          </button>
        ) : (
          <span class="scenario-label">{scenarioDisplay}</span>
        )}
      </div>

      <div class="header-right">
        <ElementBoard
          elements={elementBoard}
          onCycleElement={onCycleElement}
          layout="horizontal"
          readonly={readonly}
          size="header"
        />
      </div>
    </div>
  );
}
