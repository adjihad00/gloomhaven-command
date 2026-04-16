import { h } from 'preact';
import { useState, useMemo, useContext, useEffect } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { useGameState } from '../hooks/useGameState';
import { useCommands } from '../hooks/useCommands';
import { useEditions, useCharacterList, useScenarioList, useDataApi } from '../hooks/useDataApi';
import type { GameState, ScenarioData, ChoreAssignment, ChoreItem } from '@gloomhaven-command/shared';
import { calculateScenarioLevel, deriveLevelValues } from '@gloomhaven-command/shared';
import { formatName } from '../shared/formatName';
import { characterThumbnail, monsterThumbnail, editionLogo, characterIcon } from '../shared/assets';
import { useScenarioText } from '../hooks/useScenarioText';

// ── Types ──────────────────────────────────────────────────────────────────

type LobbyStep = 'gameMode' | 'edition' | 'party' | 'scenario' | 'preview' | 'chores' | 'rules' | 'goals';

// ── Helpers ────────────────────────────────────────────────────────────────

function MonsterPreviewCard({ edition, name }: { edition: string; name: string }) {
  const { data } = useDataApi<any>(`${edition}/monster/${name}`, true);
  return (
    <div class="lobby__monster-card">
      <img src={monsterThumbnail(edition, name)} alt={formatName(name)}
        class="lobby__monster-img" loading="lazy" />
      <span class="lobby__monster-name">{formatName(name)}</span>
      {data?.count && <span class="lobby__monster-count">{data.count} standees</span>}
    </div>
  );
}

/** Renders special rules text from reference DB, or fallback message */
function ScenarioRulesText({ edition, scenarioIndex, cssClass }: { edition: string; scenarioIndex: string; cssClass: string }) {
  const { specialRules, loading } = useScenarioText(edition, scenarioIndex);
  if (loading) return <p class={cssClass}>Loading rules...</p>;
  if (specialRules.length === 0) return <p class={cssClass}>No special rules for this scenario.</p>;
  return (
    <div>
      {specialRules.map((rule, i) => (
        <p key={i} class={cssClass} dangerouslySetInnerHTML={{ __html: rule }} />
      ))}
    </div>
  );
}

function buildChoreAssignments(
  scenarioData: ScenarioData, characters: GameState['characters'], edition: string,
): ChoreAssignment[] {
  const active = characters.filter(c => !c.absent && !c.exhausted);
  if (active.length === 0) return [];

  const monsterItems: ChoreItem[] = (scenarioData.monsters || []).map(name => ({
    name: formatName(name), dataName: name, imageUrl: monsterThumbnail(edition, name),
  }));
  const mapItems: ChoreItem[] = (scenarioData.rooms || []).map(r => ({
    name: `Tile ${r.ref || `Room ${r.roomNumber}`}`, ref: r.ref, roomNumber: r.roomNumber,
    description: r.initial ? 'Starting room' : undefined,
  }));
  const overlayItems: ChoreItem[] = [{
    name: 'Overlay tiles for all rooms',
    description: 'Set up overlay tiles per Scenario Book. Place Room 1 overlays only during initial setup.',
  }];
  const deckItems: ChoreItem[] = (scenarioData.monsters || []).map(name => ({
    name: `${formatName(name)} ability deck + stat card`, dataName: name,
  }));

  const chores: ChoreAssignment[] = [];
  const mkChore = (i: number, type: ChoreAssignment['choreType'], items: ChoreItem[]) => ({
    characterName: active[i].name, edition: active[i].edition || edition, choreType: type, items,
  });

  if (active.length === 1) {
    chores.push(mkChore(0, 'monsters', [...monsterItems, ...mapItems, ...overlayItems]));
  } else if (active.length === 2) {
    chores.push(mkChore(0, 'monsters', monsterItems));
    chores.push(mkChore(1, 'map', [...mapItems, ...overlayItems]));
  } else if (active.length === 3) {
    chores.push(mkChore(0, 'monsters', monsterItems));
    chores.push(mkChore(1, 'map', mapItems));
    chores.push(mkChore(2, 'overlays', overlayItems));
  } else {
    chores.push(mkChore(0, 'monsters', monsterItems));
    chores.push(mkChore(1, 'map', mapItems));
    chores.push(mkChore(2, 'overlays', overlayItems));
    chores.push(mkChore(3, 'decks', deckItems));
  }
  return chores;
}

// ── Main Component ─────────────────────────────────────────────────────────

export function LobbyView() {
  const { state } = useGameState();
  const commands = useCommands();
  const gameState = useContext(AppContext).state;

  // Determine initial step based on game state
  const initialStep = useMemo<LobbyStep>(() => {
    // If server-driven setup phase is active, jump to it
    if (gameState?.setupPhase === 'chores') return 'chores';
    if (gameState?.setupPhase === 'rules') return 'rules';
    if (gameState?.setupPhase === 'goals') return 'goals';

    const hasChars = (gameState?.characters?.length ?? 0) > 0;
    const isCampaign = gameState?.party?.campaignMode;
    const hasCompletedScenarios = (gameState?.party?.scenarios?.length ?? 0) > 0;
    // Fresh game: no characters ever added and no scenarios ever completed
    const isFirstTime = !hasChars && !hasCompletedScenarios;

    // First connection to this game code: show mode selection
    if (isFirstTime) return 'gameMode';
    // Campaign mode returning: skip to scenario selection
    if (isCampaign && hasChars) return 'scenario';
    // One-off returning with characters: start at edition
    if (!isCampaign && hasChars) return 'edition';
    // Has no characters but has history: go to party setup
    return 'party';
  }, []); // Only compute on mount

  const [step, setStep] = useState<LobbyStep>(initialStep);
  const [selectedEdition, setSelectedEdition] = useState(gameState?.edition || '');
  const [newCharLevel, setNewCharLevel] = useState(1);
  const [previewScenario, setPreviewScenario] = useState<{ index: string; name: string } | null>(null);
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [showAllScenarios, setShowAllScenarios] = useState(false);

  // Sync step with server-driven setupPhase changes
  useEffect(() => {
    if (gameState?.setupPhase === 'chores') setStep('chores');
    else if (gameState?.setupPhase === 'rules') setStep('rules');
    else if (gameState?.setupPhase === 'goals') setStep('goals');
    else if (!gameState?.setupPhase && (step === 'chores' || step === 'rules' || step === 'goals')) {
      // Setup was cancelled — return to scenario selection
      setStep('scenario');
    }
  }, [gameState?.setupPhase]);

  // Data hooks
  const { data: editions } = useEditions();
  const { data: characters } = useCharacterList(selectedEdition);
  const { data: scenarios } = useScenarioList(selectedEdition);
  const { data: scenarioData } = useDataApi<ScenarioData>(
    previewScenario ? `${selectedEdition}/scenario/${previewScenario.index}` : '', !!previewScenario,
  );

  if (!gameState) return <div class="lobby"><p>Loading...</p></div>;

  const currentEdition = selectedEdition || gameState.edition || 'gh';

  // Scenario filtering
  const completedIndices = useMemo(() => {
    const set = new Set<string>();
    for (const s of gameState.party?.scenarios || []) set.add(s.index);
    return set;
  }, [gameState.party?.scenarios]);

  const EDITION_INITIAL_SCENARIOS: Record<string, string[]> = {
    gh: ['1'], fh: ['0'], jotl: ['1'],
  };

  const unlockedIndices = useMemo(() => {
    if (!scenarios) return new Set<string>();
    const unlocked = new Set<string>();
    const initials = EDITION_INITIAL_SCENARIOS[selectedEdition] ?? ['1'];
    for (const idx of initials) unlocked.add(idx);
    for (const s of scenarios as any[]) {
      if (completedIndices.has(s.index) && s.unlocks) for (const u of s.unlocks) unlocked.add(u);
      if (completedIndices.has(s.index)) unlocked.add(s.index);
    }
    return unlocked;
  }, [scenarios, completedIndices, selectedEdition]);

  const filteredScenarios = useMemo(() => {
    if (!scenarios) return [];
    return (scenarios as any[]).filter((s: any) => {
      if (scenarioSearch) {
        const q = scenarioSearch.toLowerCase();
        if (!s.index?.toString().includes(q) && !(s.name && s.name.toLowerCase().includes(q))) return false;
      }
      if (!showAllScenarios && !unlockedIndices.has(s.index)) return false;
      return true;
    });
  }, [scenarios, scenarioSearch, showAllScenarios, unlockedIndices]);

  const existingNames = useMemo(
    () => new Set(gameState.characters.map(c => c.name)), [gameState.characters],
  );
  const availableClasses = useMemo(() => {
    if (!characters) return [];
    return characters.filter((c: any) => !existingNames.has(c.name));
  }, [characters, existingNames]);

  const charLevels = gameState.characters.filter(c => !c.absent).map(c => c.level);
  const autoLevel = charLevels.length > 0
    ? calculateScenarioLevel(charLevels, gameState.levelAdjustment, gameState.solo) : gameState.level;
  const levelValues = deriveLevelValues(gameState.level);
  const playerCount = gameState.characters.filter(c => !c.absent && !c.exhausted).length;

  // Room 1 spawns for preview
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

  const setupData = gameState.setupData;
  const allChoresConfirmed = useMemo(() => {
    if (!setupData) return false;
    const assigned = setupData.chores.map(c => c.characterName);
    return assigned.length > 0 && assigned.every(name => setupData.choreConfirmations[name]);
  }, [setupData]);

  // ── STEP 0: Game Mode ──
  if (step === 'gameMode') {
    return (
      <div class="lobby">
        <div class="lobby__body">
        <h1 class="lobby__title">Gloomhaven Command</h1>
        <p class="lobby__subtitle">Choose Game Mode</p>
        <div class="lobby__mode-cards">
          <button class="lobby__mode-card" onClick={() => {
            commands.updateCampaign('campaignMode', true);
            setStep('edition');
          }}>
            <h2 class="lobby__mode-card-title">Campaign</h2>
            <p class="lobby__mode-card-desc">
              Persistent party and progression. Edition and characters are locked in.
              Reconnect directly to scenario selection.
            </p>
          </button>
          <button class="lobby__mode-card" onClick={() => {
            commands.updateCampaign('campaignMode', false);
            setStep('edition');
          }}>
            <h2 class="lobby__mode-card-title">One-Off</h2>
            <p class="lobby__mode-card-desc">
              Pick your edition and characters each session. Great for casual play
              or trying different setups.
            </p>
          </button>
        </div>
        </div>
      </div>
    );
  }

  // ── STEP 1: Edition ──
  if (step === 'edition') {
    // Only show editions that have logo assets and meaningful content
    const KNOWN_EDITIONS: Record<string, string> = {
      gh: 'Gloomhaven', fh: 'Frosthaven', jotl: 'Jaws of the Lion',
      fc: 'Forgotten Circles', cs: 'Crimson Scales', toa: 'Trail of Ashes',
      gh2e: 'Gloomhaven 2E', bb: 'Button & Blade',
    };
    const displayEditions = (editions ?? []).filter(ed => ed in KNOWN_EDITIONS);

    return (
      <div class="lobby">
        <div class="lobby__body">
          <h1 class="lobby__title">Select Edition</h1>
          <div class="lobby__edition-grid">
            {displayEditions.map(ed => (
              <button key={ed}
                class={`lobby__edition-card ${selectedEdition === ed ? 'lobby__edition-card--active' : ''}`}
                onClick={() => setSelectedEdition(ed)}
                aria-label={KNOWN_EDITIONS[ed]}>
                <img src={editionLogo(ed)} alt={KNOWN_EDITIONS[ed]}
                  class="lobby__edition-logo" loading="lazy" />
                <span class="lobby__edition-name">{KNOWN_EDITIONS[ed]}</span>
              </button>
            ))}
          </div>
        </div>
        <div class="lobby__nav">
          <button class="btn" onClick={() => setStep('gameMode')}>Back</button>
          <button class="btn btn-primary" onClick={() => setStep('party')} disabled={!selectedEdition}>
            Next: Add Characters
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 2: Party ──
  if (step === 'party') {
    return (
      <div class="lobby">
        <div class="lobby__body">
        <h1 class="lobby__title">Build Party</h1>

        <div class="lobby__section">
          <label class="lobby__label">
            Party ({gameState.characters.length} character{gameState.characters.length !== 1 ? 's' : ''})
          </label>
          {gameState.characters.map(c => (
            <div key={`${c.edition}-${c.name}`} class="lobby__char-row">
              <img src={characterThumbnail(c.edition || currentEdition, c.name)}
                alt={formatName(c.name)} class="lobby__char-thumb" loading="lazy" />
              <span class="lobby__char-name">{formatName(c.name)}</span>
              <span class="lobby__char-level">Lv {c.level}</span>
              <button class="btn lobby__remove-btn"
                onClick={() => commands.removeCharacter(c.name, c.edition)}>
                &times;
              </button>
            </div>
          ))}
        </div>

        <div class="lobby__section">
          <label class="lobby__label">Add Character</label>
          <div class="lobby__level-row">
            <span class="lobby__level-label">Level:</span>
            {[1,2,3,4,5,6,7,8,9].map(lvl => (
              <button key={lvl}
                class={`btn lobby__level-pip ${lvl === newCharLevel ? 'btn-primary' : ''}`}
                onClick={() => setNewCharLevel(lvl)}>{lvl}</button>
            ))}
          </div>
          <div class="lobby__class-grid">
            {availableClasses.map((c: any) => {
              const hpAtLevel = c.stats?.find((s: any) => s.level === newCharLevel)?.health ?? '?';
              // Spoiler masking: check if character is locked
              const isSpoiler = c.spoiler === true;
              const unlockedSet = new Set([
                ...(gameState.unlockedCharacters || []),
                ...(gameState.party?.unlockedCharacters || []),
              ]);
              const isUnlocked = !isSpoiler || unlockedSet.has(c.name);

              return (
                <button key={c.name} class={`lobby__class-card ${!isUnlocked ? 'lobby__class-card--locked' : ''}`}
                  style={isUnlocked && c.color ? { borderColor: c.color } : undefined}
                  onClick={() => isUnlocked && commands.addCharacter(c.name, selectedEdition, newCharLevel)}
                  disabled={!isUnlocked}
                  aria-label={isUnlocked ? formatName(c.name) : `Locked: ${formatName(c.name)}`}>
                  {isUnlocked ? (
                    <img src={characterThumbnail(selectedEdition, c.name)}
                      alt={formatName(c.name)} class="lobby__class-thumb" loading="lazy" />
                  ) : (
                    <img src={characterIcon(selectedEdition, c.name)}
                      alt="Locked class" class="lobby__class-icon" loading="lazy" />
                  )}
                  <span class="lobby__class-name">
                    {formatName(c.name)}
                  </span>
                  {isUnlocked && <span class="lobby__class-hp">HP: {hpAtLevel}</span>}
                  {!isUnlocked && <span class="lobby__class-locked">Locked</span>}
                </button>
              );
            })}
          </div>
        </div>
        </div>

        <div class="lobby__nav">
          <button class="btn" onClick={() => setStep('edition')}>Back</button>
          <button class="btn btn-primary" onClick={() => setStep('scenario')}
            disabled={gameState.characters.length === 0}>
            Next: Select Scenario
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 3: Scenario Selection ──
  if (step === 'scenario') {
    return (
      <div class="lobby">
        <div class="lobby__body">
        <h1 class="lobby__title">Select Scenario</h1>

        <div class="lobby__section">
          <label class="lobby__label">Scenario Level</label>
          <div class="lobby__level-info">
            <span>Auto: <strong>{autoLevel}</strong></span>
            <span>Current: <strong>{gameState.level}</strong></span>
          </div>
          <div class="lobby__level-buttons">
            {[0,1,2,3,4,5,6,7].map(l => (
              <button key={l} class={`btn ${gameState.level === l ? 'btn-primary' : ''}`}
                onClick={() => commands.setLevel(l)}>{l}</button>
            ))}
          </div>
          <div class="lobby__derived">
            <span class="lobby__derived-pill"><span class="lobby__derived-label">Trap</span><span class="lobby__derived-value">{levelValues.trapDamage}</span></span>
            <span class="lobby__derived-pill"><span class="lobby__derived-label">Gold</span><span class="lobby__derived-value">{levelValues.goldConversion}</span></span>
            <span class="lobby__derived-pill"><span class="lobby__derived-label">XP</span><span class="lobby__derived-value">{levelValues.bonusXP}</span></span>
            <span class="lobby__derived-pill"><span class="lobby__derived-label">Hazard</span><span class="lobby__derived-value">{levelValues.hazardousTerrain}</span></span>
          </div>
        </div>

        <div class="lobby__section">
          <input class="form-input" type="text" placeholder="Search by number or name..."
            value={scenarioSearch} onInput={e => setScenarioSearch((e.target as HTMLInputElement).value)} />
          <div class="lobby__filters">
            <label class="lobby__filter-toggle">
              <input type="checkbox" checked={showAllScenarios}
                onChange={e => setShowAllScenarios((e.target as HTMLInputElement).checked)} />
              Show all scenarios
            </label>
            <span class="lobby__scenario-count">
              {filteredScenarios.length} scenario{filteredScenarios.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div class="lobby__scenario-list">
            {filteredScenarios.slice(0, 50).map((s: any) => {
              const isCompleted = completedIndices.has(s.index);
              return (
                <button key={s.index}
                  class={`lobby__scenario-item ${isCompleted ? 'lobby__scenario-item--completed' : ''}`}
                  onClick={() => { setPreviewScenario({ index: s.index, name: s.name || `Scenario ${s.index}` }); setStep('preview'); }}>
                  <span class="lobby__scenario-num">#{s.index}</span>
                  <span class="lobby__scenario-name">{s.name || 'Unnamed'}</span>
                  {isCompleted && <span class="lobby__completed-badge">{'\u2713'}</span>}
                  {s.monsters && <span class="lobby__monster-preview">{s.monsters.length} groups</span>}
                </button>
              );
            })}
          </div>
        </div>
        </div>

        <div class="lobby__nav">
          <button class="btn" onClick={() => setStep('party')}>Back</button>
        </div>
      </div>
    );
  }

  // ── STEP 4: Preview ──
  if (step === 'preview' && previewScenario) {
    const handleAssignChores = () => {
      if (!scenarioData) return;
      const chores = buildChoreAssignments(scenarioData, gameState.characters, selectedEdition || currentEdition);
      const s = scenarios?.find((sc: any) => sc.index === previewScenario.index);
      commands.prepareScenarioSetup(previewScenario.index, selectedEdition || currentEdition, chores, s?.group);
    };

    const handleSkipStart = () => {
      if (!previewScenario) return;
      const s = scenarios?.find((sc: any) => sc.index === previewScenario.index);
      commands.startScenario(previewScenario.index, selectedEdition || currentEdition, s?.group);
    };

    return (
      <div class="lobby">
        <div class="lobby__body">
        <h1 class="lobby__title">Scenario Preview</h1>

        <div class="lobby__preview-title">
          <span class="lobby__preview-num">#{previewScenario.index}</span>
          <span class="lobby__preview-name">{previewScenario.name}</span>
        </div>

        {!scenarioData && <div class="lobby__loading">Loading scenario data...</div>}

        {scenarioData && (
          <>
            {scenarioData.monsters?.length > 0 && (
              <div class="lobby__section">
                <label class="lobby__label">Monster Types ({scenarioData.monsters.length})</label>
                <div class="lobby__monster-grid">
                  {scenarioData.monsters.map(name => (
                    <MonsterPreviewCard key={name} edition={selectedEdition || currentEdition} name={name} />
                  ))}
                </div>
              </div>
            )}

            {scenarioData.rooms?.length > 0 && (
              <div class="lobby__section">
                <label class="lobby__label">Map Tiles ({scenarioData.rooms.length} rooms)</label>
                <div class="lobby__room-list">
                  {scenarioData.rooms.map(r => (
                    <div key={r.roomNumber} class="lobby__room-item">
                      <span class="lobby__room-ref">{r.ref || `Room ${r.roomNumber}`}</span>
                      {r.initial && <span class="lobby__room-initial">Start</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {room1Spawns.length > 0 && (
              <div class="lobby__section">
                <label class="lobby__label">Room 1 Spawns ({playerCount}p)</label>
                <div class="lobby__spawn-list">
                  {room1Spawns.map((s, i) => (
                    <span key={i} class={`spawn-badge spawn-badge--${s.type}`}>
                      {formatName(s.monsterName)} ({s.type})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div class="lobby__section">
              <div class="lobby__derived">
                <span class="lobby__derived-pill"><span class="lobby__derived-label">Trap</span><span class="lobby__derived-value">{levelValues.trapDamage}</span></span>
                <span class="lobby__derived-pill"><span class="lobby__derived-label">Gold</span><span class="lobby__derived-value">{levelValues.goldConversion}</span></span>
                <span class="lobby__derived-pill"><span class="lobby__derived-label">XP</span><span class="lobby__derived-value">{levelValues.bonusXP}</span></span>
                <span class="lobby__derived-pill"><span class="lobby__derived-label">Hazard</span><span class="lobby__derived-value">{levelValues.hazardousTerrain}</span></span>
              </div>
            </div>
          </>
        )}

        </div>

        <div class="lobby__nav">
          <button class="btn" onClick={() => { setStep('scenario'); setPreviewScenario(null); }}>Back</button>
          <button class="btn btn-primary" onClick={handleAssignChores}
            disabled={!scenarioData || gameState.characters.length === 0}
            aria-label="Assign setup chores to players">
            Assign Chores
          </button>
          <button class="btn" onClick={handleSkipStart} disabled={!scenarioData}
            aria-label="Skip setup and start scenario">
            Start (Skip Setup)
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 5: Chore Tracking (server-driven) ──
  if (step === 'chores' && setupData) {
    return (
      <div class="lobby">
        <div class="lobby__body">
        <h1 class="lobby__title">
          Scenario Setup — #{setupData.scenarioIndex}
        </h1>

        <div class="lobby__section">
          <label class="lobby__label">Setup Tasks</label>
          {setupData.chores.map(chore => {
            const confirmed = !!setupData.choreConfirmations[chore.characterName];
            return (
              <div key={chore.characterName} class={`lobby__chore-row ${confirmed ? 'lobby__chore-row--confirmed' : ''}`}>
                <span class="lobby__chore-status">{confirmed ? '\u2713' : '\u23F3'}</span>
                <img src={characterThumbnail(chore.edition, chore.characterName)}
                  alt={formatName(chore.characterName)} class="lobby__chore-thumb" loading="lazy" />
                <span class="lobby__chore-name">{formatName(chore.characterName)}</span>
                <span class="lobby__chore-type">
                  {chore.choreType === 'monsters' ? 'Monster Standees' :
                   chore.choreType === 'map' ? 'Map Tiles' :
                   chore.choreType === 'overlays' ? 'Overlay Tiles' : 'Stat Cards & Decks'}
                </span>
                <span class="lobby__chore-detail">{confirmed ? 'Done' : 'Waiting...'}</span>
              </div>
            );
          })}
        </div>
        </div>

        <div class="lobby__nav">
          <button class="btn" onClick={() => commands.cancelScenarioSetup()}>Cancel</button>
          <button class="btn btn-primary" onClick={() => commands.proceedToRules()}>
            Proceed to Rules
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 6: Rules (server-driven) ──
  if (step === 'rules' && setupData) {
    return (
      <div class="lobby">
        <div class="lobby__body">
        <h1 class="lobby__title">#{setupData.scenarioIndex} — Scenario Briefing</h1>

        <div class="lobby__section">
          <label class="lobby__label">Special Rules</label>
          <ScenarioRulesText edition={setupData.edition} scenarioIndex={setupData.scenarioIndex} cssClass="lobby__rules-text" />
        </div>

        <div class="lobby__section">
          <label class="lobby__label">Win Condition</label>
          <p class="lobby__rules-text">See Scenario Book.</p>
        </div>

        <div class="lobby__section">
          <label class="lobby__label">Loss Condition</label>
          <p class="lobby__rules-text">All characters exhausted.</p>
        </div>

        <div class="lobby__section">
          <label class="lobby__label">Scenario Level: {gameState.level}</label>
          <div class="lobby__derived">
            <span class="lobby__derived-pill"><span class="lobby__derived-label">Trap</span><span class="lobby__derived-value">{levelValues.trapDamage}</span></span>
            <span class="lobby__derived-pill"><span class="lobby__derived-label">Gold</span><span class="lobby__derived-value">{levelValues.goldConversion}</span></span>
            <span class="lobby__derived-pill"><span class="lobby__derived-label">XP</span><span class="lobby__derived-value">{levelValues.bonusXP}</span></span>
            <span class="lobby__derived-pill"><span class="lobby__derived-label">Hazard</span><span class="lobby__derived-value">{levelValues.hazardousTerrain}</span></span>
          </div>
        </div>
        </div>

        <div class="lobby__nav">
          <button class="btn" onClick={() => commands.cancelScenarioSetup()}>Cancel</button>
          <button class="btn btn-primary" onClick={() => commands.proceedToBattleGoals()}>
            Proceed to Battle Goals
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 7: Battle Goals (server-driven) ──
  if (step === 'goals' && setupData) {
    const dealCount = setupData.edition === 'fh' ? 3 : 2;

    const handleStartScenario = () => {
      commands.startScenario(setupData.scenarioIndex, setupData.edition, setupData.group);
    };

    return (
      <div class="lobby">
        <div class="lobby__body">
        <h1 class="lobby__title">Battle Goals</h1>

        <div class="lobby__section">
          <p class="lobby__goals-text">Players: choose your battle goals now.</p>
          <p class="lobby__goals-rule">
            {setupData.edition.toUpperCase()}: Deal {dealCount} goals, keep 1.
            Return the rest to the bottom of the deck.
          </p>
        </div>
        </div>

        <div class="lobby__nav">
          <button class="btn" onClick={() => commands.cancelScenarioSetup()}>Cancel</button>
          <button class="btn btn-primary" onClick={handleStartScenario}>
            Start Scenario
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div class="lobby">
      <h1 class="lobby__title">Gloomhaven Command</h1>
      <p>Ready to begin.</p>
      <button class="btn btn-primary" onClick={() => setStep('gameMode')}>Set Up Game</button>
    </div>
  );
}
