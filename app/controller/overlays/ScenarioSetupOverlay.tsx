import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import type { GameState, ScenarioData, ChoreAssignment, ChoreItem } from '@gloomhaven-command/shared';
import { calculateScenarioLevel, deriveLevelValues } from '@gloomhaven-command/shared';
import { useCommands } from '../../hooks/useCommands';
import { useEditions, useCharacterList, useScenarioList, useDataApi } from '../../hooks/useDataApi';
import { OverlayBackdrop } from './OverlayBackdrop';
import { formatName } from '../../shared/formatName';
import { characterThumbnail, monsterThumbnail } from '../../shared/assets';

/** Small component to fetch and display a single monster's data */
function MonsterPreviewCard({ edition, name }: { edition: string; name: string }) {
  const { data } = useDataApi<any>(`${edition}/monster/${name}`, true);
  return (
    <div class="scenario-preview__monster-card">
      <img
        src={monsterThumbnail(edition, name)}
        alt={formatName(name)}
        class="scenario-preview__monster-img"
        loading="lazy"
      />
      <span class="scenario-preview__monster-name">{formatName(name)}</span>
      {data?.count && (
        <span class="scenario-preview__monster-count">{data.count} standees</span>
      )}
    </div>
  );
}

/** Build chore assignments from scenario data and active characters */
function buildChoreAssignments(
  scenarioData: ScenarioData,
  characters: GameState['characters'],
  edition: string,
): ChoreAssignment[] {
  const active = characters.filter(c => !c.absent && !c.exhausted);
  if (active.length === 0) return [];

  const monsterItems: ChoreItem[] = (scenarioData.monsters || []).map(name => ({
    name: formatName(name),
    dataName: name,
    imageUrl: monsterThumbnail(edition, name),
  }));

  const mapItems: ChoreItem[] = (scenarioData.rooms || []).map(r => ({
    name: `Tile ${r.ref || `Room ${r.roomNumber}`}`,
    ref: r.ref,
    roomNumber: r.roomNumber,
    description: r.initial ? 'Starting room' : undefined,
  }));

  const overlayItems: ChoreItem[] = [{
    name: 'Overlay tiles for all rooms',
    description: 'Set up overlay tiles per Scenario Book. Place Room 1 overlays only during initial setup.',
  }];

  const deckItems: ChoreItem[] = (scenarioData.monsters || []).map(name => ({
    name: `${formatName(name)} ability deck + stat card`,
    dataName: name,
  }));

  const chores: ChoreAssignment[] = [];

  if (active.length === 1) {
    chores.push({
      characterName: active[0].name,
      edition: active[0].edition || edition,
      choreType: 'monsters',
      items: [...monsterItems, ...mapItems, ...overlayItems],
    });
  } else if (active.length === 2) {
    chores.push({
      characterName: active[0].name,
      edition: active[0].edition || edition,
      choreType: 'monsters',
      items: monsterItems,
    });
    chores.push({
      characterName: active[1].name,
      edition: active[1].edition || edition,
      choreType: 'map',
      items: [...mapItems, ...overlayItems],
    });
  } else if (active.length === 3) {
    chores.push({
      characterName: active[0].name,
      edition: active[0].edition || edition,
      choreType: 'monsters',
      items: monsterItems,
    });
    chores.push({
      characterName: active[1].name,
      edition: active[1].edition || edition,
      choreType: 'map',
      items: mapItems,
    });
    chores.push({
      characterName: active[2].name,
      edition: active[2].edition || edition,
      choreType: 'overlays',
      items: overlayItems,
    });
  } else {
    chores.push({
      characterName: active[0].name,
      edition: active[0].edition || edition,
      choreType: 'monsters',
      items: monsterItems,
    });
    chores.push({
      characterName: active[1].name,
      edition: active[1].edition || edition,
      choreType: 'map',
      items: mapItems,
    });
    chores.push({
      characterName: active[2].name,
      edition: active[2].edition || edition,
      choreType: 'overlays',
      items: overlayItems,
    });
    chores.push({
      characterName: active[3].name,
      edition: active[3].edition || edition,
      choreType: 'decks',
      items: deckItems,
    });
  }

  return chores;
}

interface ScenarioSetupOverlayProps {
  state: GameState;
  onClose: () => void;
}

type SetupStep = 'edition' | 'party' | 'scenario' | 'scenarioPreview';

export function ScenarioSetupOverlay({ state, onClose }: ScenarioSetupOverlayProps) {
  const commands = useCommands();
  const currentEdition = state.edition || 'gh';

  const [selectedEdition, setSelectedEdition] = useState(
    state.characters.length > 0 ? currentEdition : ''
  );
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [newCharLevel, setNewCharLevel] = useState(1);
  const [step, setStep] = useState<SetupStep>(() => {
    if (state.characters.length > 0) return 'scenario';
    // Fresh game — always start at edition selection
    return 'edition';
  });
  const [previewScenario, setPreviewScenario] = useState<{ index: string; name: string } | null>(null);
  const [showAllScenarios, setShowAllScenarios] = useState(false);

  const { data: editions } = useEditions();
  const { data: characters } = useCharacterList(selectedEdition);
  const { data: scenarios } = useScenarioList(selectedEdition);

  // Fetch full scenario data for preview
  const { data: scenarioData } = useDataApi<ScenarioData>(
    previewScenario ? `${selectedEdition}/scenario/${previewScenario.index}` : '',
    !!previewScenario,
  );

  // Determine unlocked scenarios from completed + initial
  const completedIndices = useMemo(() => {
    const set = new Set<string>();
    for (const s of state.party?.scenarios || []) set.add(s.index);
    return set;
  }, [state.party?.scenarios]);

  // GHS data has excessive `initial: true` flags — use hardcoded starting scenarios
  const EDITION_INITIAL_SCENARIOS: Record<string, string[]> = {
    gh: ['1'],
    fh: ['0'],
    jotl: ['1'],
  };

  const unlockedIndices = useMemo(() => {
    if (!scenarios) return new Set<string>();
    const unlocked = new Set<string>();

    // Add the true starting scenario(s) for this edition
    const initials = EDITION_INITIAL_SCENARIOS[selectedEdition] ?? ['1'];
    for (const idx of initials) unlocked.add(idx);

    // Add scenarios unlocked by completing other scenarios
    for (const s of scenarios as any[]) {
      if (completedIndices.has(s.index) && s.unlocks) {
        for (const u of s.unlocks) unlocked.add(u);
      }
      // Completed scenarios are also "known/unlocked"
      if (completedIndices.has(s.index)) unlocked.add(s.index);
    }

    return unlocked;
  }, [scenarios, completedIndices, selectedEdition]);

  const filteredScenarios = useMemo(() => {
    if (!scenarios) return [];
    return (scenarios as any[]).filter((s: any) => {
      // Search filter
      if (scenarioSearch) {
        const q = scenarioSearch.toLowerCase();
        if (!s.index?.toString().includes(q) &&
            !(s.name && s.name.toLowerCase().includes(q))) return false;
      }
      // Show-all filter: if not showing all, only show unlocked
      if (!showAllScenarios && !unlockedIndices.has(s.index)) return false;
      return true;
    });
  }, [scenarios, scenarioSearch, showAllScenarios, unlockedIndices]);

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
    onClose();
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

  // ── Scenario Preview Step (Enhanced) ──
  if (step === 'scenarioPreview' && previewScenario) {
    const choreLabel: Record<string, string> = {
      monsters: 'Monster Standees',
      map: 'Map Tiles',
      overlays: 'Overlay Tiles',
      decks: 'Stat Cards & Ability Decks',
    };

    const handleAssignChores = () => {
      if (!scenarioData) return;
      const chores = buildChoreAssignments(scenarioData, state.characters, selectedEdition);
      const s = scenarios?.find((sc: any) => sc.index === previewScenario.index);
      commands.prepareScenarioSetup(previewScenario.index, selectedEdition, chores, s?.group);
      onClose();
    };

    return (
      <OverlayBackdrop onClose={onClose} position="right">
        <div class="setup-overlay">
          <div class="scenario-preview__header">
            <button class="btn scenario-preview__back" onClick={() => { setStep('scenario'); setPreviewScenario(null); }}>
              Back
            </button>
            <h2 class="setup-overlay__title">Scenario Preview</h2>
          </div>

          <div class="setup-overlay__section">
            <div class="scenario-preview__title-row">
              <span class="scenario-preview__number">#{previewScenario.index}</span>
              <span class="scenario-preview__name">{previewScenario.name}</span>
            </div>
            <div class="scenario-preview__meta">
              <span>Edition: {selectedEdition.toUpperCase()}</span>
              <span>Level: {state.level}</span>
            </div>
          </div>

          {!scenarioData && <div class="setup-overlay__loading">Loading scenario data...</div>}

          {scenarioData && (
            <>
              {/* Monster types */}
              {scenarioData.monsters && scenarioData.monsters.length > 0 && (
                <div class="setup-overlay__section">
                  <label class="setup-overlay__label">
                    Monster Types ({scenarioData.monsters.length})
                  </label>
                  <div class="scenario-preview__monster-grid">
                    {scenarioData.monsters.map(name => (
                      <MonsterPreviewCard key={name} edition={selectedEdition} name={name} />
                    ))}
                  </div>
                </div>
              )}

              {/* Map tiles */}
              {scenarioData.rooms && scenarioData.rooms.length > 0 && (
                <div class="setup-overlay__section">
                  <label class="setup-overlay__label">
                    Map Tiles ({scenarioData.rooms.length} rooms)
                  </label>
                  <div class="scenario-preview__room-list">
                    {scenarioData.rooms.map(r => (
                      <div key={r.roomNumber} class="scenario-preview__room-item">
                        <span class="scenario-preview__room-ref">{r.ref || `Room ${r.roomNumber}`}</span>
                        {r.initial && <span class="scenario-preview__room-initial">Start</span>}
                        {(r as any).treasures?.length > 0 && (
                          <span class="scenario-preview__room-treasure">
                            Treasure: {(r as any).treasures.join(', ')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Room 1 spawns */}
              {room1Spawns.length > 0 && (
                <div class="setup-overlay__section">
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

              {/* Loot deck config (FH) */}
              {(scenarioData as any).lootDeckConfig && (
                <div class="setup-overlay__section">
                  <label class="setup-overlay__label">Loot Deck</label>
                  <div class="scenario-preview__loot-config">
                    {Object.entries((scenarioData as any).lootDeckConfig)
                      .filter(([, v]) => (v as number) > 0)
                      .map(([type, count]) => (
                        <span key={type} class="scenario-preview__loot-pill">
                          {formatName(type)}: {count as number}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Special rules */}
              {(scenarioData as any).rules && (scenarioData as any).rules.length > 0 ? (
                <div class="setup-overlay__section">
                  <label class="setup-overlay__label">Special Rules</label>
                  <div class="scenario-preview__rules-note">
                    {(scenarioData as any).rules.length} special rule(s) — see Scenario Book
                  </div>
                </div>
              ) : (
                <div class="setup-overlay__section">
                  <label class="setup-overlay__label">Special Rules</label>
                  <div class="scenario-preview__rules-note">
                    See Scenario Book for rules and win conditions
                  </div>
                </div>
              )}

              {/* Derived values */}
              <div class="setup-overlay__section">
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
            </>
          )}

          <div class="scenario-preview__actions">
            <button
              class="btn btn-primary"
              onClick={handleAssignChores}
              disabled={!scenarioData || state.characters.length === 0}
              aria-label="Assign setup chores to players"
            >
              Assign Chores
            </button>
            <button
              class="btn"
              onClick={handleConfirmScenario}
              disabled={!scenarioData}
              aria-label="Skip setup and start scenario"
            >
              Start Scenario (Skip Setup)
            </button>
          </div>
        </div>
      </OverlayBackdrop>
    );
  }

  // ── Edition Step ──
  if (step === 'edition') {
    return (
      <OverlayBackdrop onClose={onClose} position="right">
        <div class="setup-overlay">
          <h2 class="setup-overlay__title">Select Edition</h2>
          <div class="setup-overlay__section">
            <div class="edition-grid">
              {(editions ?? [currentEdition]).map(ed => (
                <button
                  key={ed}
                  class={`edition-card ${selectedEdition === ed ? 'edition-card--active' : ''}`}
                  onClick={() => setSelectedEdition(ed)}
                >
                  <span class="edition-card__name">{ed.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
          <div class="setup-wizard__nav">
            <button class="btn" onClick={onClose}>Cancel</button>
            <button class="btn btn-primary" onClick={() => setStep('party')}
              disabled={!selectedEdition}>
              Next: Add Characters
            </button>
          </div>
        </div>
      </OverlayBackdrop>
    );
  }

  // ── Party Step ──
  if (step === 'party') {
    return (
      <OverlayBackdrop onClose={onClose} position="right">
        <div class="setup-overlay">
          <h2 class="setup-overlay__title">Build Party</h2>

          <div class="setup-overlay__section">
            <label class="setup-overlay__label">
              Party ({state.characters.length} character{state.characters.length !== 1 ? 's' : ''})
            </label>
            {state.characters.map(c => (
              <div key={`${c.edition}-${c.name}`} class="setup-overlay__char-row">
                <span class="setup-overlay__char-name">{formatName(c.name)}</span>
                <span class="setup-overlay__char-level">Lv {c.level}</span>
                <span class="setup-overlay__char-hp">{c.health}/{c.maxHealth} HP</span>
                <button class="btn setup-overlay__remove-btn"
                  onClick={() => commands.removeCharacter(c.name, c.edition)}>
                  &times;
                </button>
              </div>
            ))}
          </div>

          <div class="setup-overlay__section">
            <label class="setup-overlay__label">Add Character</label>
            <div class="setup-overlay__level-row">
              <span class="setup-overlay__level-label">Level:</span>
              {[1,2,3,4,5,6,7,8,9].map(lvl => (
                <button key={lvl}
                  class={`btn setup-overlay__level-pip ${lvl === newCharLevel ? 'btn-primary' : ''}`}
                  onClick={() => setNewCharLevel(lvl)}>
                  {lvl}
                </button>
              ))}
            </div>
            <div class="char-class-grid">
              {availableClasses.map((c: any) => {
                const hpAtLevel = c.stats?.find((s: any) => s.level === newCharLevel)?.health ?? '?';
                return (
                  <button key={c.name} class="char-class-card"
                    style={c.color ? { borderColor: c.color } : undefined}
                    onClick={() => handleAddCharacter(c.name)}>
                    <img src={characterThumbnail(selectedEdition, c.name)}
                      alt={formatName(c.name)} class="char-class-card__thumb" loading="lazy" />
                    <span class="char-class-card__name">{formatName(c.name)}</span>
                    <span class="char-class-card__hp">HP: {hpAtLevel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div class="setup-wizard__nav">
            <button class="btn" onClick={() => setStep('edition')}>Back: Edition</button>
            <button class="btn btn-primary" onClick={() => setStep('scenario')}
              disabled={state.characters.length === 0}>
              Next: Select Scenario
            </button>
          </div>
        </div>
      </OverlayBackdrop>
    );
  }

  // ── Scenario Step ──
  return (
    <OverlayBackdrop onClose={onClose} position="right">
      <div class="setup-overlay">
        <h2 class="setup-overlay__title">Select Scenario</h2>

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
              <button key={l}
                class={`btn ${state.level === l ? 'btn-primary' : ''}`}
                onClick={() => commands.setLevel(l)}>
                {l}
              </button>
            ))}
          </div>
          <div class="difficulty-selector">
            <span class="difficulty-selector__label">Difficulty:</span>
            {[-2, -1, 0, 1, 2, 3, 4].map(adj => {
              const labels: Record<number, string> = {
                [-2]: 'Very Easy', [-1]: 'Easy', [0]: 'Normal',
                [1]: 'Hard', [2]: 'Very Hard', [3]: 'Brutal', [4]: 'Nightmare',
              };
              const isActive = state.levelAdjustment === adj;
              return (
                <button key={adj}
                  class={`difficulty-btn ${isActive ? 'difficulty-btn--active' : ''}`}
                  onClick={() => commands.setLevelAdjustment(adj)}
                  title={labels[adj]}>
                  {isActive ? labels[adj] : (adj > 0 ? `+${adj}` : String(adj))}
                </button>
              );
            })}
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

        <div class="setup-overlay__section">
          <input class="form-input" type="text"
            placeholder="Search by number or name..."
            value={scenarioSearch}
            onInput={e => setScenarioSearch((e.target as HTMLInputElement).value)} />
          <div class="scenario-filters">
            <label class="filter-toggle">
              <input type="checkbox" checked={showAllScenarios}
                onChange={e => setShowAllScenarios((e.target as HTMLInputElement).checked)} />
              Show all scenarios
            </label>
            <span class="scenario-count">
              {filteredScenarios.length} scenario{filteredScenarios.length !== 1 ? 's' : ''}
              {!showAllScenarios && ' (unlocked)'}
            </span>
          </div>
          <div class="setup-overlay__scenario-list">
            {filteredScenarios.slice(0, 50).map((s: any) => {
              const isCompleted = completedIndices.has(s.index);
              return (
                <button key={s.index}
                  class={`setup-overlay__scenario-item ${state.scenario?.index === s.index ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                  onClick={() => handleSelectScenario(s.index, s.name || `Scenario ${s.index}`)}>
                  <span class="setup-overlay__scenario-num">#{s.index}</span>
                  <span class="setup-overlay__scenario-name">{s.name || 'Unnamed'}</span>
                  {isCompleted && <span class="completed-badge">{'\u2713'}</span>}
                  {s.monsters && (
                    <span class="setup-overlay__monster-preview">{s.monsters.length} groups</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div class="setup-wizard__nav">
          <button class="btn" onClick={() => setStep('party')}>Back: Party</button>
        </div>
      </div>
    </OverlayBackdrop>
  );
}
