import { h } from 'preact';
import type { LevelDerivedValues } from '@gloomhaven-command/shared';

interface ScenarioHeaderProps {
  round: number;
  phase: string;
  scenarioName?: string;
  level: number;
  levelValues: LevelDerivedValues;
  connectionStatus: string;
  onMenuOpen?: () => void;
}

export function ScenarioHeader({ round, phase, scenarioName, level, levelValues, connectionStatus, onMenuOpen }: ScenarioHeaderProps) {
  const phaseLabel = phase === 'draw' ? 'Card Selection' : 'Playing';
  const connected = connectionStatus === 'connected';

  return (
    <div class="scenario-header">
      {onMenuOpen && (
        <button class="scenario-header__menu" onClick={onMenuOpen}>&#9776;</button>
      )}
      <span class="scenario-header__round">Round {round} — {phaseLabel}</span>
      {scenarioName && (
        <span class="scenario-header__scenario">{scenarioName} — Level {level}</span>
      )}
      <span class="scenario-header__derived">
        Trap:{levelValues.trapDamage} Gold:{levelValues.goldConversion} XP:{levelValues.bonusXP}
      </span>
      <span class={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
    </div>
  );
}
