import { h } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { AppContext } from '../../shared/context';
import { PartySheet } from '../../shared/sheets/PartySheet';
import { CampaignSheet } from '../../shared/sheets/CampaignSheet';
import { AmbientParticles } from '../components/AmbientParticles';

interface DisplayIdleSheetsViewProps {
  onOpenMenu?: () => void;
}

type WhichSheet = 'party' | 'campaign';

/**
 * Phase T0c: display decorative idle view — alternates Party Sheet and
 * Campaign Sheet during idle lobby (no setupPhase) and town mode.
 *
 * Each sheet runs its internal 30s-per-tab auto-cycle. The sheet's
 * `onCycleComplete` callback fires when the last tab wraps back to the
 * first — at that boundary we swap to the sibling sheet with a brief
 * fade transition. This keeps each sheet visible long enough to read
 * while still surfacing both campaign-state canvases during idle.
 *
 * Replaces the direct `DisplayPartySheetView` mount in `app/display/App.tsx`.
 */
export function DisplayIdleSheetsView({ onOpenMenu }: DisplayIdleSheetsViewProps) {
  const { state } = useContext(AppContext);
  const [whichSheet, setWhichSheet] = useState<WhichSheet>('party');
  const [fading, setFading] = useState(false);

  const handleCycleComplete = useCallback(() => {
    setFading(true);
    window.setTimeout(() => {
      setWhichSheet((curr) => (curr === 'party' ? 'campaign' : 'party'));
      setFading(false);
    }, 300);
  }, []);

  // Guard: clear fading if unmounted mid-swap.
  useEffect(() => () => setFading(false), []);

  if (!state) return null;

  const edition = state.edition || state.party.edition || 'gh';

  return (
    <div
      class={`display-idle-sheets${fading ? ' display-idle-sheets--fading' : ''}`}
      data-edition={edition}
      data-which={whichSheet}
    >
      <AmbientParticles preset={edition === 'fh' ? 'snow' : 'embers'} />
      <div class="display__vignette" />

      {whichSheet === 'party' ? (
        <PartySheet
          party={state.party}
          characters={state.characters}
          edition={edition}
          onClose={() => { /* decorative */ }}
          readOnly
          autoCycle
          skipIntro
          layout="portrait"
          onCycleComplete={handleCycleComplete}
        />
      ) : (
        <CampaignSheet
          party={state.party}
          edition={edition}
          onClose={() => { /* decorative */ }}
          readOnly
          autoCycle
          skipIntro
          layout="portrait"
          onCycleComplete={handleCycleComplete}
        />
      )}

      {onOpenMenu && (
        <button
          type="button"
          class="display-idle-sheets__hot-zone"
          aria-label="Open display settings"
          onClick={onOpenMenu}
        />
      )}
    </div>
  );
}
