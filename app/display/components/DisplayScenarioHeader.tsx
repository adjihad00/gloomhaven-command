import { h } from 'preact';
import type { ElementModel } from '@gloomhaven-command/shared';
import { deriveLevelValues } from '@gloomhaven-command/shared';
import { DisplayElementBoard } from './DisplayElementBoard';

interface DisplayScenarioHeaderProps {
  scenarioName: string;
  scenarioIndex: string;
  round: number;
  level: number;
  elements: ElementModel[];
  isPending?: boolean;
}

export function DisplayScenarioHeader({ scenarioName, scenarioIndex, round, level, elements, isPending }: DisplayScenarioHeaderProps) {
  const derived = deriveLevelValues(level);

  return (
    <div class="display-header">
      {/* Collapsible portion — visible when pending, scrolls off during active play */}
      <div class={`display-header__collapsible ${isPending ? 'display-header__collapsible--visible' : ''}`}>
        <div class="display-header__scenario-number">Scenario #{scenarioIndex}</div>
        <div class="display-header__scenario-name">{scenarioName || `Scenario ${scenarioIndex}`}</div>
      </div>

      {/* Sticky portion — remains fixed at top */}
      <div class="display-header__sticky">
        <div class="display-header__round">
          Round <span class="display-header__round-number">{round}</span>
        </div>
        <div class="display-header__derived">
          <div class="display-header__pill">
            <span class="display-header__pill-value">Lv {level}</span>
          </div>
          <div class="display-header__pill">
            <span>Trap</span>
            <span class="display-header__pill-value">{derived.trapDamage}</span>
          </div>
          <div class="display-header__pill">
            <span>Gold</span>
            <span class="display-header__pill-value">{derived.goldConversion}</span>
          </div>
          <div class="display-header__pill">
            <span>Hazard</span>
            <span class="display-header__pill-value">{derived.hazardousTerrain}</span>
          </div>
          <div class="display-header__pill">
            <span>Bonus XP</span>
            <span class="display-header__pill-value">{derived.bonusXP}</span>
          </div>
        </div>
        <DisplayElementBoard elements={elements} />
      </div>
    </div>
  );
}
