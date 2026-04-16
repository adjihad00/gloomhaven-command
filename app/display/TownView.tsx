import { h } from 'preact';
import { useContext } from 'preact/hooks';
import { AppContext } from '../shared/context';
import { AmbientParticles } from './components/AmbientParticles';

const GH_STEPS = [
  'Resolve City Event',
  'Character Management (items, level up, enhancements)',
  'Select Next Scenario',
];

const FH_STEPS = [
  'Passage of Time',
  'Resolve Outpost Event',
  'Building Operations',
  'Downtime Activities',
  'Construction',
];

export function TownView({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const { state } = useContext(AppContext);
  const edition = state?.edition || 'gh';
  const isFH = edition === 'fh';
  const steps = isFH ? FH_STEPS : GH_STEPS;
  const subtitle = isFH
    ? 'The frozen outpost awaits your return...'
    : 'The streets of Gloomhaven stir with activity...';

  return (
    <div class="display-town">
      <AmbientParticles preset="fog" />
      <div class="display__vignette" />

      <div class="display-town__content">
        <h1 class="display-town__title" onClick={onOpenMenu} style={{ cursor: onOpenMenu ? 'pointer' : undefined }}>Town Phase</h1>
        <p class="display-town__subtitle">{subtitle}</p>

        <div class="display-town__steps">
          {steps.map((step, i) => (
            <div key={i} class="display-town__step">
              <span class="display-town__step-number">{i + 1}.</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
