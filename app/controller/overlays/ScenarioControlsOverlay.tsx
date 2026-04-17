import { h } from 'preact';
import { useState } from 'preact/hooks';
import { OverlayBackdrop } from './OverlayBackdrop';

interface ScenarioControlsOverlayProps {
  scenarioName?: string;
  scenarioIndex?: string;
  level: number;
  onClose: () => void;
  onScenarioEnd: (outcome: 'victory' | 'defeat') => void;
  onAbortScenario: () => void;
}

/**
 * Phase T0b: scenario-controls overlay.
 *
 * Triggered by clicking the scenario name in ScenarioHeader (not the
 * hamburger ☰ — that's for cross-mode items now: Undo, Party Sheet,
 * Export, Disconnect). Houses scenario-specific actions that cluster
 * naturally next to the scenario title:
 *
 *  - Scenario Complete (Victory)  → prepareScenarioEnd('victory')
 *  - Scenario Failed (Defeat)     → prepareScenarioEnd('defeat')
 *  - Cancel Scenario              → abortScenario (two-step confirm)
 *
 * Cancel Scenario uses an inline reveal-to-confirm step because it
 * discards scenario progress without applying rewards. Same pattern as
 * ScenarioFooter's door-reveal confirmation.
 */
export function ScenarioControlsOverlay({
  scenarioName,
  scenarioIndex,
  level,
  onClose,
  onScenarioEnd,
  onAbortScenario,
}: ScenarioControlsOverlayProps) {
  const [confirmCancel, setConfirmCancel] = useState(false);

  const title = scenarioIndex && scenarioName
    ? `#${scenarioIndex} — ${scenarioName}`
    : scenarioIndex
    ? `Scenario #${scenarioIndex}`
    : 'Current Scenario';

  return (
    <OverlayBackdrop onClose={onClose} position="center">
      <div class="menu-overlay">
        <h2 class="menu-overlay__title">{title}</h2>
        <div class="menu-overlay__subtitle">Level {level}</div>

        <div class="menu-overlay__section">
          <h3 class="menu-overlay__section-title">End Scenario</h3>
          <button
            class="menu-overlay__item menu-overlay__item--victory"
            onClick={() => { onClose(); onScenarioEnd('victory'); }}
          >
            Scenario Complete (Victory)
          </button>
          <button
            class="menu-overlay__item menu-overlay__item--defeat"
            onClick={() => { onClose(); onScenarioEnd('defeat'); }}
          >
            Scenario Failed (Defeat)
          </button>
        </div>

        <div class="menu-overlay__section">
          <h3 class="menu-overlay__section-title">Abort</h3>
          {!confirmCancel ? (
            <button
              class="menu-overlay__item menu-overlay__item--danger"
              onClick={() => setConfirmCancel(true)}
            >
              Cancel Scenario…
            </button>
          ) : (
            <div class="menu-overlay__confirm">
              <p class="menu-overlay__confirm-text">
                Abort scenario? Scenario progress (HP, conditions, in-scenario
                XP / loot / treasures) will be discarded. No rewards will be
                applied.
              </p>
              <div class="menu-overlay__confirm-actions">
                <button
                  class="menu-overlay__item menu-overlay__item--danger"
                  onClick={() => { onClose(); onAbortScenario(); }}
                >
                  Confirm — abort and return to lobby
                </button>
                <button
                  class="menu-overlay__item"
                  onClick={() => setConfirmCancel(false)}
                >
                  Keep scenario
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </OverlayBackdrop>
  );
}
