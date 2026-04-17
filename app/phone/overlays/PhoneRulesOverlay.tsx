import { h } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { useGameState } from '../../hooks/useGameState';
import { useDataApi } from '../../hooks/useDataApi';
import { deriveLevelValues } from '@gloomhaven-command/shared';
import type { ScenarioData } from '@gloomhaven-command/shared';
import { formatName } from '../../shared/formatName';
import { useScenarioText } from '../../hooks/useScenarioText';
import { useScenarioBookData } from '../../hooks/useScenarioBookData';

interface PhoneRulesOverlayProps {
  selectedCharacter: string;
}

export function PhoneRulesOverlay({ selectedCharacter }: PhoneRulesOverlayProps) {
  const { state } = useGameState();
  const [visible, setVisible] = useState(false);
  const prevPhase = useRef<string | undefined>(undefined);

  const setupPhase = state?.setupPhase;
  const setupData = state?.setupData;

  // Fetch scenario data for rules
  const scenarioApiPath = setupData
    ? `${setupData.edition}/scenario/${setupData.scenarioIndex}`
    : '';
  const { data: scenarioData } = useDataApi<ScenarioData>(scenarioApiPath, !!setupData);
  const { specialRules: refRules } = useScenarioText(
    setupData?.edition || '', setupData?.scenarioIndex || '',
  );
  const bookData = useScenarioBookData(
    setupData?.edition || '', setupData?.scenarioIndex || '',
  );

  const levelValues = useMemo(() => deriveLevelValues(state?.level ?? 0), [state?.level]);

  useEffect(() => {
    if (setupPhase === 'rules' && prevPhase.current !== 'rules') {
      setVisible(true);
    }
    if (setupPhase !== 'rules' && prevPhase.current === 'rules') {
      setVisible(false);
    }
    if (!setupPhase && prevPhase.current) {
      setVisible(false);
    }
    prevPhase.current = setupPhase ?? undefined;
  }, [setupPhase]);

  if (!visible || !setupData || setupPhase !== 'rules') return null;

  const hasRules = (scenarioData as any)?.rules?.length > 0;

  return (
    <div class="phone-rules" role="dialog" aria-modal="true">
      <div class="phone-rules__overlay" />
      <div class="phone-rules__content">
        <h2 class="phone-rules__heading">Scenario Briefing</h2>

        <div class="phone-rules__scenario-id">
          #{setupData.scenarioIndex}
          {scenarioData?.name && ` — ${scenarioData.name}`}
        </div>

        <div class="phone-rules__section">
          <h3 class="phone-rules__section-title">Special Rules</h3>
          {refRules.length > 0 ? (
            refRules.map((rule, i) => (
              <p key={i} class="phone-rules__text" dangerouslySetInnerHTML={{ __html: rule }} />
            ))
          ) : (
            <p class="phone-rules__text">No special rules for this scenario.</p>
          )}
        </div>

        <div class="phone-rules__section">
          <h3 class="phone-rules__section-title">Win Condition</h3>
          <p class="phone-rules__text">{bookData.goalText || 'See Scenario Book.'}</p>
        </div>

        <div class="phone-rules__section">
          <h3 class="phone-rules__section-title">Loss Condition</h3>
          <p class="phone-rules__text">{bookData.lossText || 'All characters exhausted.'}</p>
        </div>

        <div class="phone-rules__derived">
          <span class="phone-rules__derived-label">Level {state?.level ?? 0}</span>
          <span class="phone-rules__derived-pill">Trap: {levelValues.trapDamage}</span>
          <span class="phone-rules__derived-pill">Gold: {levelValues.goldConversion}x</span>
          <span class="phone-rules__derived-pill">Hazard: {levelValues.hazardousTerrain}</span>
          <span class="phone-rules__derived-pill">XP: +{levelValues.bonusXP}</span>
        </div>

        <div class="phone-rules__waiting">
          Waiting for GM to proceed...
        </div>
      </div>
    </div>
  );
}
