import { h } from 'preact';
import { useContext } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { useCommands } from '../hooks/useCommands';
import { useGameState } from '../hooks/useGameState';

export function TownView() {
  const commands = useCommands();
  const { state } = useGameState();

  const isVictory = state?.finish === 'success';
  const edition = state?.edition ?? 'gh';
  const isFH = edition === 'fh';

  return (
    <div class="lobby">
      <div class="lobby__body">
      <h1 class="lobby__title">
        {isVictory ? 'Scenario Complete — Victory!' : state?.finish === 'failure' ? 'Scenario Failed' : 'Town Phase'}
      </h1>

      {/* Town phase steps placeholder */}
      <div class="lobby__section">
        <label class="lobby__label">Town Phase Steps</label>

        {isFH ? (
          <div class="town-steps">
            <div class="town-steps__item">
              <span class="town-steps__num">1</span>
              <span class="town-steps__text">Passage of Time — advance calendar</span>
            </div>
            <div class="town-steps__item">
              <span class="town-steps__num">2</span>
              <span class="town-steps__text">Outpost Event — draw and resolve</span>
            </div>
            <div class="town-steps__item">
              <span class="town-steps__num">3</span>
              <span class="town-steps__text">Building Operations — use buildings</span>
            </div>
            <div class="town-steps__item">
              <span class="town-steps__num">4</span>
              <span class="town-steps__text">Downtime — level up, craft, brew, retire</span>
            </div>
            <div class="town-steps__item">
              <span class="town-steps__num">5</span>
              <span class="town-steps__text">Construction — build new buildings</span>
            </div>
          </div>
        ) : (
          <div class="town-steps">
            <div class="town-steps__item">
              <span class="town-steps__num">1</span>
              <span class="town-steps__text">City Event — draw and resolve</span>
            </div>
            <div class="town-steps__item">
              <span class="town-steps__num">2</span>
              <span class="town-steps__text">Character Management — level up, buy items, enhance</span>
            </div>
            <div class="town-steps__item">
              <span class="town-steps__num">3</span>
              <span class="town-steps__text">Donate to Sanctuary (10g = 2 bless)</span>
            </div>
          </div>
        )}
      </div>

      {/* Travel phase reminder */}
      <div class="lobby__section">
        <label class="lobby__label">Travel Phase</label>
        <div class="town-steps">
          <div class="town-steps__item town-steps__item--reminder">
            <span class="town-steps__text">
              Draw a Road Event (or Boat Event if applicable) before starting the next scenario.
            </span>
          </div>
        </div>
      </div>
      </div>

      <div class="lobby__nav">
        <button class="btn btn-primary" onClick={() => commands.completeTownPhase()}
          aria-label="Complete town phase and select next scenario">
          Town Phase Complete — Select Scenario
        </button>
      </div>
    </div>
  );
}
