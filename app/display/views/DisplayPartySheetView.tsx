import { h } from 'preact';
import { useContext } from 'preact/hooks';
import { AppContext } from '../../shared/context';
import { PartySheet } from '../../shared/sheets/PartySheet';
import { AmbientParticles } from '../components/AmbientParticles';

interface DisplayPartySheetViewProps {
  onOpenMenu?: () => void;
}

/**
 * Phase T0b: display decorative mount of the shared Party Sheet.
 *
 * Runs only in idle lobby (no setupPhase) or town mode. Read-only,
 * auto-cycles tabs every 30s, skips the one-time intro. Layout is
 * portrait because the display is a vertical tower.
 *
 * Ambient particle preset matches the display's lobby/town styling so
 * the sheet integrates with the table's ambient atmosphere rather than
 * feeling like a hard modal.
 *
 * @deprecated Phase T0c — replaced by `DisplayIdleSheetsView` which
 * alternates Party Sheet and Campaign Sheet during idle modes. Retained
 * importable for potential debug paths and quick rollback.
 */
export function DisplayPartySheetView({ onOpenMenu }: DisplayPartySheetViewProps) {
  const { state } = useContext(AppContext);
  if (!state) return null;
  const edition = state.edition || state.party.edition || 'gh';

  return (
    <div class="display-party-sheet-view" data-edition={edition}>
      <AmbientParticles preset={edition === 'fh' ? 'snow' : 'embers'} />
      <div class="display__vignette" />
      <PartySheet
        party={state.party}
        characters={state.characters}
        edition={edition}
        onClose={() => { /* display decorative — no close */ }}
        readOnly
        autoCycle
        skipIntro
        layout="portrait"
      />
      {/*
        Phase T0b: escape hatch. The other display modes expose the
        config menu via clickable text in their own chrome (round
        number / edition title / "Town Phase" title). In decorative
        party-sheet mode the sheet fills the screen and has no
        interactive chrome — so we render an invisible tap zone in
        the top-left corner that opens the same DisplayConfigMenu.
        Same affordance, just positional rather than text-labelled.
      */}
      {onOpenMenu && (
        <button
          type="button"
          class="display-party-sheet-view__hot-zone"
          aria-label="Open display settings"
          onClick={onOpenMenu}
        />
      )}
    </div>
  );
}
