import { createContext } from 'preact';

/**
 * Phase T0a: shared context for the Player Sheet family.
 *
 * Consumed by every sub-component (header, tabs, Overview panels, menus).
 * The sheet root sets this once; subtrees read via `useContext`. This avoids
 * prop-drilling `readOnly` / `edition` through every medallion/row/control
 * and keeps the compound-components pattern clean.
 *
 * `readOnly` → controller GM quick-view sets this to `true` so progression
 * tabs disable editable affordances. The Active Scenario section is still
 * interactive when `readOnly` is true (GM retains HP/condition controls —
 * same behaviour as the Phase R controller today).
 */
export interface PlayerSheetContextValue {
  readOnly: boolean;
  /** Character edition for asset lookups + command routing. */
  edition: string;
  /** Called by header menu / future tabs to close the sheet. */
  onClose: () => void;
}

export const PlayerSheetContext = createContext<PlayerSheetContextValue>({
  readOnly: false,
  edition: 'gh',
  onClose: () => {},
});
