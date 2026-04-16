import { h } from 'preact';

interface DisplayScenarioFooterProps {
  specialRules: string[];
  winConditions: string;
  lossConditions: string;
}

export function DisplayScenarioFooter({ specialRules, winConditions, lossConditions }: DisplayScenarioFooterProps) {
  return (
    <div class="display-footer">
      <div class="display-footer__rules">
        <div class="display-footer__label">Special Rules</div>
        {specialRules.length === 0 ? (
          <div class="display-footer__text">No special rules.</div>
        ) : specialRules.length === 1 && !specialRules[0].includes('<') ? (
          <div class="display-footer__text">{specialRules[0]}</div>
        ) : (
          specialRules.map((rule, i) => (
            <div key={i} class="display-footer__text"
              dangerouslySetInnerHTML={{ __html: rule }} />
          ))
        )}
      </div>
      <div class="display-footer__conditions">
        <div class="display-footer__condition display-footer__condition--win">
          <div class="display-footer__label display-footer__label--win">Victory</div>
          <div class="display-footer__text">{winConditions}</div>
        </div>
        <div class="display-footer__condition display-footer__condition--loss">
          <div class="display-footer__label display-footer__label--loss">Defeat</div>
          <div class="display-footer__text">{lossConditions}</div>
        </div>
      </div>
    </div>
  );
}
