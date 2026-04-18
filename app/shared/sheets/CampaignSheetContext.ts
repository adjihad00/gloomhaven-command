import { createContext } from 'preact';

/**
 * Phase T0c: shared context for the Campaign Sheet family.
 *
 * Parallels `PartySheetContext`. Duplicated rather than shared because
 * each sheet's context is logically distinct — keeps Context usage clear
 * at call sites and lets each sheet's subtree import its own context
 * without ambiguity.
 */
export interface CampaignSheetContextValue {
  readOnly: boolean;
  /** Party edition — drives GH/FH branching (Outpost tab, Resources chips). */
  edition: string;
  /** Close callback (ignored in autoCycle/display mode). */
  onClose: () => void;
  /** Display decorative mode — no manual tab interaction. */
  autoCycle: boolean;
}

export const CampaignSheetContext = createContext<CampaignSheetContextValue>({
  readOnly: false,
  edition: 'gh',
  onClose: () => {},
  autoCycle: false,
});
