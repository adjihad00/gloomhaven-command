import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import { useGameState } from '../hooks/useGameState';
import { useCommands } from '../hooks/useCommands';
import { useDataApi } from '../hooks/useDataApi';
import { deriveLevelValues } from '@gloomhaven-command/shared';
import type { ScenarioData } from '@gloomhaven-command/shared';
import { formatName } from '../shared/formatName';
import { monsterThumbnail, characterThumbnail } from '../shared/assets';
import { useScenarioText } from '../hooks/useScenarioText';

interface LobbyViewProps {
  selectedCharacter: string;
}

export function LobbyView({ selectedCharacter }: LobbyViewProps) {
  const { state } = useGameState();
  const commands = useCommands();

  const setupPhase = state?.setupPhase;
  const setupData = state?.setupData;
  const edition = state?.edition ?? 'gh';

  const myChar = state?.characters?.find(c => c.name === selectedCharacter);
  const charEdition = myChar?.edition || edition;

  // Fetch scenario data for rules display
  const scenarioApiPath = setupData
    ? `${setupData.edition}/scenario/${setupData.scenarioIndex}`
    : '';
  const { data: scenarioData } = useDataApi<ScenarioData>(scenarioApiPath, !!setupData);
  const { specialRules: refRules } = useScenarioText(
    setupData?.edition || '', setupData?.scenarioIndex || '',
  );

  const levelValues = useMemo(() => deriveLevelValues(state?.level ?? 0), [state?.level]);

  // Find this character's chore assignment
  const myChore = setupData?.chores.find(c => c.characterName === selectedCharacter);
  const isConfirmed = setupData ? !!setupData.choreConfirmations[selectedCharacter] : false;

  const choreTitle: Record<string, string> = {
    monsters: 'Collect Monster Standees',
    map: 'Collect Map Tiles',
    overlays: 'Collect Overlay Tiles',
    decks: 'Collect Stat Cards & Ability Decks',
  };

  // ── Chore Phase ──
  if (setupPhase === 'chores' && setupData) {
    return (
      <div class="phone-lobby">
        <h2 class="phone-lobby__heading">Your Setup Task</h2>

        {myChore ? (
          <>
            <h3 class="phone-lobby__subheading">{choreTitle[myChore.choreType] || 'Setup Task'}</h3>
            <div class="phone-lobby__items">
              {myChore.items.map((item, i) => (
                <div key={i} class="phone-lobby__item">
                  {myChore.choreType === 'monsters' && item.dataName && (
                    <img src={monsterThumbnail(setupData.edition, item.dataName)}
                      alt={item.name} class="phone-lobby__item-img" loading="lazy" />
                  )}
                  <div class="phone-lobby__item-info">
                    <span class="phone-lobby__item-name">{item.name}</span>
                    {item.count && <span class="phone-lobby__item-detail">{item.count} standees</span>}
                    {item.ref && <span class="phone-lobby__item-detail">Tile: {item.ref}</span>}
                    {item.description && <span class="phone-lobby__item-detail">{item.description}</span>}
                  </div>
                </div>
              ))}
            </div>

            {myChore.choreType === 'monsters' && (
              <div class="phone-lobby__reminder">
                Also collect stat cards and ability decks for each monster type. Shuffle each deck.
              </div>
            )}

            {myChore.choreType === 'overlays' && (
              <div class="phone-lobby__reminder">
                Place overlay tiles for Room 1 only during initial setup.
                Other rooms are revealed when doors are opened.
              </div>
            )}

            <button
              class={`phone-lobby__confirm ${isConfirmed ? 'phone-lobby__confirm--done' : ''}`}
              onClick={() => commands.confirmChore(selectedCharacter, charEdition)}
              disabled={isConfirmed}
              aria-label={isConfirmed ? 'Task confirmed' : 'Confirm task complete'}
            >
              {isConfirmed ? '\u2713  Task Complete' : 'Task Complete'}
            </button>

            {isConfirmed && (
              <div class="phone-lobby__waiting">Waiting for other players...</div>
            )}
          </>
        ) : (
          <div class="phone-lobby__no-task">
            <p>No setup task assigned to you.</p>
            <p>Waiting for other players to finish...</p>
          </div>
        )}
      </div>
    );
  }

  // ── Rules Phase ──
  if (setupPhase === 'rules' && setupData) {
    return (
      <div class="phone-lobby">
        <h2 class="phone-lobby__heading">Scenario Briefing</h2>
        <div class="phone-lobby__scenario-id">
          #{setupData.scenarioIndex}
          {scenarioData?.name && ` — ${scenarioData.name}`}
        </div>

        <div class="phone-lobby__section">
          <h3 class="phone-lobby__section-title">Special Rules</h3>
          {refRules.length > 0 ? (
            refRules.map((rule, i) => (
              <p key={i} class="phone-lobby__text" dangerouslySetInnerHTML={{ __html: rule }} />
            ))
          ) : (
            <p class="phone-lobby__text">No special rules for this scenario.</p>
          )}
        </div>

        <div class="phone-lobby__section">
          <h3 class="phone-lobby__section-title">Win Condition</h3>
          <p class="phone-lobby__text">See Scenario Book.</p>
        </div>

        <div class="phone-lobby__section">
          <h3 class="phone-lobby__section-title">Loss Condition</h3>
          <p class="phone-lobby__text">All characters exhausted.</p>
        </div>

        <div class="phone-lobby__derived">
          <span class="phone-lobby__derived-label">Level {state?.level ?? 0}</span>
          <span class="phone-lobby__derived-pill">Trap: {levelValues.trapDamage}</span>
          <span class="phone-lobby__derived-pill">Gold: {levelValues.goldConversion}x</span>
          <span class="phone-lobby__derived-pill">Hazard: {levelValues.hazardousTerrain}</span>
          <span class="phone-lobby__derived-pill">XP: +{levelValues.bonusXP}</span>
        </div>

        <div class="phone-lobby__waiting">Waiting for GM to proceed...</div>
      </div>
    );
  }

  // Fetch battle goals for dealing
  const { data: battleGoals } = useDataApi<any[]>(
    setupData ? `${setupData.edition}/battle-goals` : '', setupPhase === 'goals',
  );

  // Deal random battle goal cards (stable per session via useMemo)
  const dealtGoals = useMemo(() => {
    if (!battleGoals || battleGoals.length === 0) return [];
    const dealCount = (setupData?.edition === 'fh') ? 3 : 2;
    // Shuffle a copy and take dealCount
    const shuffled = [...battleGoals].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, dealCount);
  }, [battleGoals, setupData?.edition]);

  // ── Battle Goals Phase ──
  if (setupPhase === 'goals' && setupData) {
    const dealCount = setupData.edition === 'fh' ? 3 : 2;

    return (
      <div class="phone-lobby">
        <h2 class="phone-lobby__heading">Choose Your Battle Goal</h2>

        {dealtGoals.length > 0 ? (
          <>
            <div class="phone-lobby__instructions">
              <p class="phone-lobby__rule">Choose <strong>1</strong> to keep. Return the rest.</p>
            </div>
            <div class="phone-lobby__goals-grid">
              {dealtGoals.map((goal: any) => (
                <div key={goal.cardId} class="phone-lobby__goal-card">
                  <span class="phone-lobby__goal-name">{goal.name}</span>
                  <span class="phone-lobby__goal-checks">
                    {Array.from({ length: goal.checks || 1 }, (_, i) => '\u2610').join(' ')}
                    {' '}{goal.checks || 1} check{(goal.checks || 1) > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div class="phone-lobby__instructions">
            <p class="phone-lobby__rule">
              Deal yourself <strong>{dealCount}</strong> battle goal card{dealCount > 1 ? 's' : ''} from the deck.
            </p>
            <p class="phone-lobby__rule">Choose <strong>1</strong> to keep.</p>
          </div>
        )}

        <div class="phone-lobby__edition-note">
          {setupData.edition.toUpperCase()}: Deal {dealCount}, keep 1
        </div>

        <div class="phone-lobby__waiting">Waiting for GM to start scenario...</div>
      </div>
    );
  }

  // ── Default: Waiting for GM ──
  return (
    <div class="phone-lobby phone-lobby--waiting">
      {myChar && (
        <img src={characterThumbnail(charEdition, selectedCharacter)}
          alt={formatName(selectedCharacter)}
          class="phone-lobby__char-portrait" loading="lazy" />
      )}
      <h2 class="phone-lobby__heading">
        {myChar ? formatName(selectedCharacter) : selectedCharacter}
      </h2>
      <p class="phone-lobby__waiting-text">Waiting for GM to set up scenario...</p>
    </div>
  );
}
