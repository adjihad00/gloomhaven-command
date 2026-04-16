import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import type { GameState, ScenarioData } from '@gloomhaven-command/shared';
import { deriveLevelValues } from '@gloomhaven-command/shared';
import { useCommands } from '../../hooks/useCommands';
import { useDataApi } from '../../hooks/useDataApi';
import { useScenarioText } from '../../hooks/useScenarioText';
import { OverlayBackdrop } from './OverlayBackdrop';
import { formatName } from '../../shared/formatName';
import { characterThumbnail } from '../../shared/assets';

interface SetupPhaseOverlayProps {
  state: GameState;
  onClose: () => void;
}

export function SetupPhaseOverlay({ state, onClose }: SetupPhaseOverlayProps) {
  const commands = useCommands();
  const setupData = state.setupData;
  const setupPhase = state.setupPhase;

  // Fetch scenario data for rules display
  const scenarioApiPath = setupData
    ? `${setupData.edition}/scenario/${setupData.scenarioIndex}`
    : '';
  const { data: scenarioData } = useDataApi<ScenarioData>(scenarioApiPath, !!setupData);
  const { specialRules: refRules } = useScenarioText(
    setupData?.edition || '', setupData?.scenarioIndex || '',
  );

  const levelValues = useMemo(() => deriveLevelValues(state.level), [state.level]);

  if (!setupData || !setupPhase) return null;

  const allConfirmed = useMemo(() => {
    const assigned = setupData.chores.map(c => c.characterName);
    return assigned.length > 0 && assigned.every(name => setupData.choreConfirmations[name]);
  }, [setupData]);

  const handleCancel = () => {
    commands.cancelScenarioSetup();
    onClose();
  };

  const handleStartScenario = () => {
    const s = scenarioData;
    commands.setScenario(setupData.scenarioIndex, setupData.edition, setupData.group);
    commands.cancelScenarioSetup();
    onClose();
  };

  // ── Chore tracking phase ──
  if (setupPhase === 'chores') {
    return (
      <OverlayBackdrop onClose={onClose} position="right">
        <div class="setup-overlay">
          <h2 class="setup-overlay__title">
            Scenario Setup — #{setupData.scenarioIndex}
            {scenarioData?.name && ` ${scenarioData.name}`}
          </h2>

          <div class="setup-overlay__section">
            <label class="setup-overlay__label">Setup Tasks</label>
            {setupData.chores.map(chore => {
              const confirmed = !!setupData.choreConfirmations[chore.characterName];
              return (
                <div key={chore.characterName} class={`setup-phase__chore-row ${confirmed ? 'setup-phase__chore-row--confirmed' : ''}`}>
                  <span class="setup-phase__chore-status">
                    {confirmed ? '\u2713' : '\u23F3'}
                  </span>
                  <img
                    src={characterThumbnail(chore.edition, chore.characterName)}
                    alt={formatName(chore.characterName)}
                    class="setup-phase__chore-thumb"
                    loading="lazy"
                  />
                  <span class="setup-phase__chore-name">{formatName(chore.characterName)}</span>
                  <span class="setup-phase__chore-type">
                    {chore.choreType === 'monsters' ? 'Monster Standees' :
                     chore.choreType === 'map' ? 'Map Tiles' :
                     chore.choreType === 'overlays' ? 'Overlay Tiles' :
                     'Stat Cards & Decks'}
                  </span>
                  <span class="setup-phase__chore-detail">
                    {confirmed ? 'Done' : 'Waiting...'}
                  </span>
                </div>
              );
            })}
          </div>

          <div class="scenario-preview__actions">
            <button class="btn" onClick={handleCancel}>Cancel</button>
            <button
              class="btn btn-primary"
              onClick={() => commands.proceedToRules()}
              disabled={!allConfirmed}
              aria-label="Proceed to rules display"
            >
              Proceed to Rules
            </button>
          </div>
        </div>
      </OverlayBackdrop>
    );
  }

  // ── Rules phase ──
  if (setupPhase === 'rules') {
    const hasRules = (scenarioData as any)?.rules?.length > 0;

    return (
      <OverlayBackdrop onClose={onClose} position="right">
        <div class="setup-overlay">
          <h2 class="setup-overlay__title">
            #{setupData.scenarioIndex}
            {scenarioData?.name && ` — ${scenarioData.name}`}
          </h2>

          <div class="setup-overlay__section">
            <label class="setup-overlay__label">Special Rules</label>
            {refRules.length > 0 ? (
              refRules.map((rule, i) => (
                <div key={i} class="setup-phase__rules-text" dangerouslySetInnerHTML={{ __html: rule }} />
              ))
            ) : (
              <div class="setup-phase__rules-text">No special rules for this scenario.</div>
            )}
          </div>

          <div class="setup-overlay__section">
            <label class="setup-overlay__label">Win Condition</label>
            <div class="setup-phase__rules-text">See Scenario Book.</div>
          </div>

          <div class="setup-overlay__section">
            <label class="setup-overlay__label">Loss Condition</label>
            <div class="setup-phase__rules-text">
              All characters exhausted.
            </div>
          </div>

          <div class="setup-overlay__section">
            <label class="setup-overlay__label">Scenario Level: {state.level}</label>
            <div class="setup-overlay__derived">
              <span class="setup-overlay__derived-pill">
                <span class="setup-overlay__derived-label">Trap</span>
                <span class="setup-overlay__derived-value">{levelValues.trapDamage}</span>
              </span>
              <span class="setup-overlay__derived-pill">
                <span class="setup-overlay__derived-label">Gold</span>
                <span class="setup-overlay__derived-value">{levelValues.goldConversion}</span>
              </span>
              <span class="setup-overlay__derived-pill">
                <span class="setup-overlay__derived-label">XP</span>
                <span class="setup-overlay__derived-value">{levelValues.bonusXP}</span>
              </span>
              <span class="setup-overlay__derived-pill">
                <span class="setup-overlay__derived-label">Hazard</span>
                <span class="setup-overlay__derived-value">{levelValues.hazardousTerrain}</span>
              </span>
            </div>
          </div>

          <div class="scenario-preview__actions">
            <button class="btn" onClick={handleCancel}>Cancel</button>
            <button
              class="btn btn-primary"
              onClick={() => commands.proceedToBattleGoals()}
              aria-label="Proceed to battle goals"
            >
              Proceed to Battle Goals
            </button>
          </div>
        </div>
      </OverlayBackdrop>
    );
  }

  // ── Battle goals phase ──
  if (setupPhase === 'goals') {
    const dealCount = setupData.edition === 'fh' ? 3 : 2;

    return (
      <OverlayBackdrop onClose={onClose} position="right">
        <div class="setup-overlay">
          <h2 class="setup-overlay__title">Battle Goals</h2>

          <div class="setup-overlay__section">
            <div class="setup-phase__goals-text">
              Players: choose your battle goals now.
            </div>
            <div class="setup-phase__goals-rule">
              {setupData.edition.toUpperCase()}: Deal {dealCount} goals, keep 1.
              Return the rest to the bottom of the deck.
            </div>
          </div>

          <div class="scenario-preview__actions">
            <button class="btn" onClick={handleCancel}>Cancel</button>
            <button
              class="btn btn-primary"
              onClick={handleStartScenario}
              aria-label="Start the scenario"
            >
              Start Scenario
            </button>
          </div>
        </div>
      </OverlayBackdrop>
    );
  }

  return null;
}
