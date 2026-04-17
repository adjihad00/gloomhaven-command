import { h } from 'preact';
import { useGameState } from '../../hooks/useGameState';
import { PartySheet } from '../../shared/sheets/PartySheet';

interface PartySheetOverlayProps {
  onClose: () => void;
}

/**
 * Phase T0b: controller-side mount of the shared Party Sheet.
 *
 * Mirrors T0a's `PlayerSheetQuickView` pattern: thin wrapper pulls state
 * from the game store and renders the shared `PartySheet` with
 * `readOnly={false}` so the GM gets full editing. `autoCycle` and
 * `skipIntro` are off — controllers see the intro once and navigate tabs
 * manually.
 */
export function PartySheetOverlay({ onClose }: PartySheetOverlayProps) {
  const { state } = useGameState();
  if (!state) return null;
  return (
    <PartySheet
      party={state.party}
      characters={state.characters}
      edition={state.edition ?? state.party.edition ?? 'gh'}
      onClose={onClose}
      readOnly={false}
      autoCycle={false}
      layout="landscape"
    />
  );
}
