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
  readonly?: boolean;
}

export function ScenarioHeader({ round, phase, scenarioName, scenarioIndex, level, elementBoard, onCycleElement, onMenuOpen, readonly }: ScenarioHeaderProps) {
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
        <span class="scenario-label">{scenarioDisplay}</span>
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
