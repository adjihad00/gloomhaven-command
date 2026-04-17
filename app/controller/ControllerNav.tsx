import { h } from 'preact';
import { useState } from 'preact/hooks';
import { MenuOverlay } from './overlays/MenuOverlay';

interface ControllerNavProps {
  gameCode: string;
  hasScenario: boolean;
  onDisconnect: () => void;
  onOpenPartySheet: () => void;
}

/**
 * Phase T0b: persistent controller nav button.
 *
 * A small floating `⋯` in the top-right corner of every controller mode
 * (Lobby / Scenario / Town). Opens `MenuOverlay` with cross-mode items
 * (Undo, Party Sheet, Export, Disconnect). Scenario-specific items
 * (Scenario Setup, Scenario End) remain on ScenarioView's own menu
 * mount — this nav does NOT override that. It's an additional entry
 * point so Party/Campaign sheets are reachable outside scenario play.
 */
export function ControllerNav({
  gameCode,
  hasScenario,
  onDisconnect,
  onOpenPartySheet,
}: ControllerNavProps) {
  const [open, setOpen] = useState(false);
  return (
    <div class="controller-nav">
      <button
        type="button"
        class="controller-nav__toggle"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <MenuOverlay
          gameCode={gameCode}
          hasScenario={hasScenario}
          onClose={() => setOpen(false)}
          onDisconnect={onDisconnect}
          onOpenPartySheet={onOpenPartySheet}
        />
      )}
    </div>
  );
}
