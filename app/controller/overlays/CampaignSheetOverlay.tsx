import { h } from 'preact';
import { useContext } from 'preact/hooks';
import { AppContext } from '../../shared/context';
import { useGameState } from '../../hooks/useGameState';
import { CampaignSheet } from '../../shared/sheets/CampaignSheet';

interface CampaignSheetOverlayProps {
  onClose: () => void;
}

/**
 * Phase T0c: controller-side mount of the shared Campaign Sheet.
 *
 * Thin wrapper around the shared `CampaignSheet` — `readOnly: false`,
 * landscape layout. Mirrors `PartySheetOverlay`'s pattern.
 */
export function CampaignSheetOverlay({ onClose }: CampaignSheetOverlayProps) {
  const { state } = useGameState();
  const { gameCode } = useContext(AppContext);
  if (!state) return null;
  return (
    <CampaignSheet
      party={state.party}
      edition={state.edition ?? state.party.edition ?? 'gh'}
      onClose={onClose}
      readOnly={false}
      autoCycle={false}
      layout="landscape"
      gameCode={gameCode}
    />
  );
}
