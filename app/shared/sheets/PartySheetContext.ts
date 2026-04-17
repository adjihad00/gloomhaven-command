import { createContext } from 'preact';

/**
 * Phase T0b: shared context for the Party Sheet family.
 *
 * Consumed by every sub-component (header, tabs, gauges, editable rows).
 * The sheet root sets this once; subtrees read via `useContext`. Keeps the
 * compound-components pattern established by T0a's PlayerSheetContext.
 *
 * `readOnly` → display sets this to `true` for decorative mode; controller
 * sets it to `false` for full editing.
 *
 * `autoCycle` → display sets this to `true` so manual tab switches are
 * disabled and the CSS knows to apply the gilt candlelight flicker.
 */
export interface PartySheetContextValue {
  readOnly: boolean;
  /** Party edition for asset lookups + GH/FH branching. */
  edition: string;
  /** Called by header / future keystrokes to close the sheet. */
  onClose: () => void;
  /** Display decorative mode — no manual tab interaction. */
  autoCycle: boolean;
}

export const PartySheetContext = createContext<PartySheetContextValue>({
  readOnly: false,
  edition: 'gh',
  onClose: () => {},
  autoCycle: false,
});
