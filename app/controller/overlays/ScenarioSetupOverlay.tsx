import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { GameState } from '@gloomhaven-command/shared';
import { calculateScenarioLevel, deriveLevelValues } from '@gloomhaven-command/shared';
import { useCommands } from '../../hooks/useCommands';
import { useEditions, useCharacterList, useScenarioList } from '../../hooks/useDataApi';
import { OverlayBackdrop } from './OverlayBackdrop';
import { formatName } from '../../shared/formatName';

interface ScenarioSetupOverlayProps {
  state: GameState;
  onClose: () => void;
}

export function ScenarioSetupOverlay({ state, onClose }: ScenarioSetupOverlayProps) {
  const commands = useCommands();
  const currentEdition = state.edition || 'gh';

  const [selectedEdition, setSelectedEdition] = useState(currentEdition);
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [newCharClass, setNewCharClass] = useState('');
  const [newCharLevel, setNewCharLevel] = useState(1);

  const { data: editions } = useEditions();
  const { data: characters } = useCharacterList(selectedEdition);
  const { data: scenarios } = useScenarioList(selectedEdition);

  const filteredScenarios = scenarios?.filter(s => {
    const search = scenarioSearch.toLowerCase();
    return !search || s.name?.toLowerCase().includes(search) || s.index?.toString().includes(search);
  }) ?? [];

  // Level calculation
  const charLevels = state.characters.filter(c => !c.absent).map(c => c.level);
  const autoLevel = charLevels.length > 0 ? calculateScenarioLevel(charLevels, state.levelAdjustment, state.solo) : state.level;
  const levelValues = deriveLevelValues(state.level);

  const handleAddCharacter = () => {
    if (!newCharClass) return;
    commands.addCharacter(newCharClass, selectedEdition, newCharLevel);
    setNewCharClass('');
  };

  return (
    <OverlayBackdrop onClose={onClose} position="right">
      <div class="setup-overlay">
        <h2 class="setup-overlay__title">Scenario Setup</h2>

        {/* Edition selection */}
        <div class="setup-overlay__section">
          <label class="setup-overlay__label">Edition</label>
          <select
            class="form-input"
            value={selectedEdition}
            onChange={e => setSelectedEdition((e.target as HTMLSelectElement).value)}
          >
            {(editions ?? [currentEdition]).map(ed => (
              <option key={ed} value={ed}>{ed.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Scenario selection */}
        <div class="setup-overlay__section">
          <label class="setup-overlay__label">Scenario</label>
          <input
            class="form-input"
            type="text"
            placeholder="Search scenarios..."
            value={scenarioSearch}
            onInput={e => setScenarioSearch((e.target as HTMLInputElement).value)}
          />
          <div class="setup-overlay__scenario-list">
            {filteredScenarios.slice(0, 20).map(s => (
              <button
                key={s.index}
                class={`setup-overlay__scenario-item ${state.scenario?.index === s.index ? 'active' : ''}`}
                onClick={() => commands.setScenario(s.index, selectedEdition, s.group)}
              >
                #{s.index} {s.name}
                {s.monsters && <span class="setup-overlay__monster-preview"> ({s.monsters.length} groups)</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Character management */}
        <div class="setup-overlay__section">
          <label class="setup-overlay__label">Characters</label>
          {state.characters.map(c => (
            <div key={`${c.edition}-${c.name}`} class="setup-overlay__char-row">
              <span class="setup-overlay__char-name">{formatName(c.name)}</span>
              <span class="setup-overlay__char-level">Lv {c.level}</span>
              <span class="setup-overlay__char-hp">{c.health}/{c.maxHealth} HP</span>
              <button class="btn setup-overlay__remove-btn" onClick={() => commands.removeCharacter(c.name, c.edition)}>
                &times;
              </button>
            </div>
          ))}

          {/* Add character form */}
          <div class="setup-overlay__add-char">
            <select
              class="form-input"
              value={newCharClass}
              onChange={e => setNewCharClass((e.target as HTMLSelectElement).value)}
            >
              <option value="">Select class...</option>
              {(characters ?? []).map(c => (
                <option key={c.name} value={c.name}>{formatName(c.name)}</option>
              ))}
            </select>
            <select
              class="form-input setup-overlay__level-select"
              value={newCharLevel}
              onChange={e => setNewCharLevel(Number((e.target as HTMLSelectElement).value))}
            >
              {[1,2,3,4,5,6,7,8,9].map(l => (
                <option key={l} value={l}>Lv {l}</option>
              ))}
            </select>
            <button class="btn btn-primary" onClick={handleAddCharacter} disabled={!newCharClass}>Add</button>
          </div>
        </div>

        {/* Level & derived values */}
        <div class="setup-overlay__section">
          <label class="setup-overlay__label">Scenario Level</label>
          <div class="setup-overlay__level-info">
            <span>Auto: {autoLevel}</span>
            <span>Current: {state.level}</span>
          </div>
          <div class="setup-overlay__level-buttons">
            {[0,1,2,3,4,5,6,7].map(l => (
              <button
                key={l}
                class={`btn ${state.level === l ? 'btn-primary' : ''}`}
                onClick={() => commands.setLevel(l)}
              >
                {l}
              </button>
            ))}
          </div>
          <div class="setup-overlay__derived">
            <span>Trap: {levelValues.trapDamage}</span>
            <span>Gold: {levelValues.goldConversion}</span>
            <span>XP: {levelValues.bonusXP}</span>
            <span>Hazard: {levelValues.hazardousTerrain}</span>
          </div>
        </div>

        {/* Active scenario info */}
        {state.scenario && (
          <div class="setup-overlay__section">
            <label class="setup-overlay__label">Active Scenario</label>
            <div class="setup-overlay__active-info">
              <span>#{state.scenario.index} ({state.scenario.edition})</span>
              <span>Monsters: {state.monsters.length} groups</span>
              <span>Rooms revealed: {state.scenario.revealedRooms?.length ?? 0}</span>
            </div>
          </div>
        )}
      </div>
    </OverlayBackdrop>
  );
}
