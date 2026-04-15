import { h } from 'preact';
import { useContext } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { AmbientParticles } from './components/AmbientParticles';
import { editionLogo } from '../shared/assets';
import { formatName } from '../shared/formatName';

export function LobbyWaitingView() {
  const { state } = useContext(AppContext);

  const edition = state?.edition || 'gh';
  const setupPhase = state?.setupPhase;
  const scenarioName = state?.setupData
    ? `Scenario ${state.setupData.scenarioIndex}`
    : null;

  const phaseLabel = setupPhase
    ? setupPhase === 'chores' ? 'Setting Up Table'
    : setupPhase === 'rules' ? 'Reviewing Rules'
    : setupPhase === 'goals' ? 'Choosing Battle Goals'
    : 'Setting Up...'
    : null;

  const editionTitle = edition === 'fh' ? 'Frosthaven' : 'Gloomhaven';

  return (
    <div class="display-lobby" data-edition={edition}>
      <AmbientParticles preset={edition === 'fh' ? 'snow' : 'embers'} />

      <div class="display-lobby__fog">
        <div class="display-lobby__fog-layer display-lobby__fog-layer--1" />
        <div class="display-lobby__fog-layer display-lobby__fog-layer--2" />
        <div class="display-lobby__fog-layer display-lobby__fog-layer--3" />
      </div>

      <div class="display__vignette" />

      <div class="display-lobby__content">
        <img
          src={editionLogo(edition)}
          alt={editionTitle}
          class="display-lobby__logo"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <h1 class="display-lobby__title">{editionTitle}</h1>

        {phaseLabel ? (
          <>
            <p class="display-lobby__status">{phaseLabel}</p>
            {scenarioName && <p class="display-lobby__phase">{scenarioName}</p>}
          </>
        ) : (
          <>
            <p class="display-lobby__status">Waiting for GM...</p>
            <p class="display-lobby__hint">The adventure will begin shortly.</p>
          </>
        )}
      </div>
    </div>
  );
}
