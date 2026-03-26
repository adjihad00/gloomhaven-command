import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import type { GameState, ScenarioData } from '@gloomhaven-command/shared';
import { calculateScenarioLevel, deriveLevelValues } from '@gloomhaven-command/shared';
import { useCommands } from '../../hooks/useCommands';
import { useEditions, useCharacterList, useScenarioList, useDataApi } from '../../hooks/useDataApi';
import { OverlayBackdrop } from './OverlayBackdrop';
import { formatName } from '../../shared/formatName';

interface ScenarioSetupOverlayProps {
  state: GameState;
  onClose: () => void;
}

type SetupStep = 'main' | 'scenarioPreview';

export function ScenarioSetupOverlay({ state, onClose }: ScenarioSetupOverlayProps) {
  const commands = useCommands();
  const currentEdition = state.edition || 'gh';

  const [selectedEdition, setSelectedEdition] = useState(currentEdition);
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [newCharLevel, setNewCharLevel] = useState(1);
  const [step, setStep] = useState<SetupStep>('main');
  const [previewScenario, setPreviewScenario] = useState<{ index: string; name: string } | null>(null);

  const { data: editions } = useEditions();
  const { data: characters } = useCharacterList(selectedEdition);
  const { data: scenarios } = useScenarioList(selectedEdition);

  // Fetch full scenario data for preview
  const { data: scenarioData } = useDataApi<ScenarioData>(
    previewScenario ? `${selectedEdition}/scenario/${previewScenario.index}` : '',
    !!previewScenario,
  );

  const filteredScenarios = useMemo(() => {
    if (!scenarios) return [];
    const search = scenarioSearch.toLowerCase();
    if (!search) return scenarios;
    return scenarios.filter((s: any) =>
      s.name?.toLowerCase().includes(search) || s.index?.toString().includes(search)
    );
  }, [scenarios, scenarioSearch]);

  // Characters already in party
  const existingNames = useMemo(
    () => new Set(state.characters.map(c => c.name)),
    [state.characters],
  );

  // Available character classes (not yet added)
  const availableClasses = useMemo(() => {
    if (!characters) return [];
    return characters.filter((c: any) => !existingNames.has(c.name));
  }, [characters, existingNames]);

  // Level calculation
  const charLevels = state.characters.filter(c => !c.absent).map(c => c.level);
  const autoLevel = charLevels.length > 0
    ? calculateScenarioLevel(charLevels, state.levelAdjustment, state.solo)
    : state.level;
  const levelValues = deriveLevelValues(state.level);
  const playerCount = state.characters.filter(c => !c.absent && !c.exhausted).length;

  const handleSelectScenario = (index: string, name: string) => {
    setPreviewScenario({ index, name });
    setStep('scenarioPreview');
  };

  const handleConfirmScenario = () => {
    if (!previewScenario) return;
    const s = scenarios?.find((sc: any) => sc.index === previewScenario.index);
    commands.setScenario(previewScenario.index, selectedEdition, s?.group);
    setStep('main');
    setPreviewScenario(null);
  };

  const handleAddCharacter = (name: string) => {
    commands.addCharacter(name, selectedEdition, newCharLevel);
  };

  // Scenario preview: resolve Room 1 spawns client-side for display
  const room1Spawns = useMemo(() => {
    if (!scenarioData?.rooms) return [];
    const room1 = scenarioData.rooms.find(r => r.initial);
    if (!room1) return [];
    const spawns: { monsterName: string; type: string }[] = [];
    for (const m of room1.monster || []) {
      if (m.type) spawns.push({ monsterName: m.name, type: m.type });
      if (m.player2 && playerCount >= 2) spawns.push({ monsterName: m.name, type: m.player2 });
      if (m.player3 && playerCount >= 3) spawns.push({ monsterName: m.name, type: m.player3 });
      if (m.player4 && playerCount >= 4) spawns.push({ monsterName: m.name, type: m.player4 });
    }
    return spawns;
  }, [scenarioData, playerCount]);

  // ── Scenario Preview Step ──
  if (step === 'scenarioPreview' && previewScenario) {
    return (
      <OverlayBackdrop onClose={onClose} position="right">
        <div class="setup-overlay">
          <h2 class="setup-overlay__title">Scenario Preview</h2>

          <div class="setup-overlay__section">
            <div class="scenario-preview__header">
              <span class="scenario-preview__number">#{previewScenario.index}</span>
              <span class="scenario-preview__name">{previewScenario.name}</span>
            </div>

            {scenarioData && (
              <div class="scenario-preview__info">
                <span>{scenarioData.rooms?.length ?? 0} rooms</span>
                <span>{scenarioData.monsters?.length ?? 0} monster types</span>
              </div>
            )}

            {scenarioData?.monsters && scenarioData.monsters.length > 0 && (
              <div class="scenario-preview__monsters">
                <label class="setup-overlay__label">Monsters</label>
                {scenarioData.monsters.map(name => (
                  <div key={name} class="scenario-preview__monster-row">
                    <span>{formatName(name)}</span>
                  </div>
                ))}
              </div>
            )}

            {room1Spawns.length > 0 && (
              <div class="scenario-preview__spawns">
                <label class="setup-overlay__label">
                  Room 1 Spawns ({playerCount} player{playerCount !== 1 ? 's' : ''})
                </label>
                <div class="scenario-preview__spawn-list">
                  {room1Spawns.map((s, i) => (
                    <span key={i} class={`spawn-badge spawn-badge--${s.type}`}>
                      {formatName(s.monsterName)} ({s.type})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!scenarioData && <div class="setup-overlay__loading">Loading scenario data...</div>}
          </div>

          <div class="scenario-preview__actions">
            <button class="btn" onClick={() => { setStep('main'); setPreviewScenario(null); }}>
              Back
            </button>
            <button
              class="btn btn-primary"
              onClick={handleConfirmScenario}
              disabled={!scenarioData}
            >
              Start Scenario
            </button>
          </div>
        </div>
      </OverlayBackdrop>
    );
  }

  // ── Main Setup Step ──
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

        {/* Characters — current party */}
        <div class="setup-overlay__section">
          <label class="setup-overlay__label">
            Party ({state.characters.length} character{state.characters.length !== 1 ? 's' : ''})
          </label>
          {state.characters.map(c => (
            <div key={`${c.edition}-${c.name}`} class="setup-overlay__char-row">
              <span class="setup-overlay__char-name">{formatName(c.name)}</span>
              <span class="setup-overlay__char-level">Lv {c.level}</span>
              <span class="setup-overlay__char-hp">{c.health}/{c.maxHealth} HP</span>
              <button
                class="btn setup-overlay__remove-btn"
                onClick={() => commands.removeCharacter(c.name, c.edition)}
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        {/* Add character — class grid */}
        <div class="setup-overlay__section">
          <label class="setup-overlay__label">Add Character</label>

          {/* Level selector */}
          <div class="setup-overlay__level-row">
            <span class="setup-overlay__level-label">Level:</span>
            {[1,2,3,4,5,6,7,8,9].map(lvl => (
              <button
                key={lvl}
                class={`btn setup-overlay__level-pip ${lvl === newCharLevel ? 'btn-primary' : ''}`}
                onClick={() => setNewCharLevel(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Character class grid */}
          <div class="char-class-grid">
            {availableClasses.map((c: any) => {
              const hpAtLevel = c.stats?.find((s: any) => s.level === newCharLevel)?.health ?? '?';
              return (
                <button
                  key={c.name}
                  class="char-class-card"
                  style={c.color ? { borderColor: c.color } : undefined}
                  onClick={() => handleAddCharacter(c.name)}
                >
                  <span class="char-class-card__name">{formatName(c.name)}</span>
                  <span class="char-class-card__hp">HP: {hpAtLevel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scenario Level */}
        <div class="setup-overlay__section">
          <label class="setup-overlay__label">Scenario Level</label>
          <div class="setup-overlay__level-info">
            <span>Auto: <strong>{autoLevel}</strong></span>
            {charLevels.length > 0 && (
              <span class="setup-overlay__level-formula">
                (avg {(charLevels.reduce((a,b) => a+b, 0) / charLevels.length).toFixed(1)} / 2)
              </span>
            )}
            <span>Current: <strong>{state.level}</strong></span>
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

        {/* Scenario selection */}
        <div class="setup-overlay__section">
          <label class="setup-overlay__label">Select Scenario</label>
          <input
            class="form-input"
            type="text"
            placeholder="Search by number or name..."
            value={scenarioSearch}
            onInput={e => setScenarioSearch((e.target as HTMLInputElement).value)}
          />
          <div class="setup-overlay__scenario-list">
            {filteredScenarios.slice(0, 30).map((s: any) => (
              <button
                key={s.index}
                class={`setup-overlay__scenario-item ${state.scenario?.index === s.index ? 'active' : ''}`}
                onClick={() => handleSelectScenario(s.index, s.name || `Scenario ${s.index}`)}
              >
                <span class="setup-overlay__scenario-num">#{s.index}</span>
                <span class="setup-overlay__scenario-name">{s.name || 'Unnamed'}</span>
                {s.monsters && (
                  <span class="setup-overlay__monster-preview">{s.monsters.length} groups</span>
                )}
              </button>
            ))}
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
