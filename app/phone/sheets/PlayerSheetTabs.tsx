import { h } from 'preact';
import { useRef, useCallback } from 'preact/hooks';

export type PlayerSheetTabId =
  | 'overview'
  | 'items'
  | 'progression'
  | 'quest'
  | 'notes'
  | 'history';

interface TabDescriptor {
  id: PlayerSheetTabId;
  label: string;
}

const TABS: readonly TabDescriptor[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'items', label: 'Items' },
  { id: 'progression', label: 'Progression' },
  { id: 'quest', label: 'Quest' },
  { id: 'notes', label: 'Notes' },
  { id: 'history', label: 'History' },
];

interface PlayerSheetTabsProps {
  activeTab: PlayerSheetTabId;
  onChange: (id: PlayerSheetTabId) => void;
}

/**
 * Phase T0a: horizontal bookmark-shape tab strip.
 *
 * Roving-tabindex keyboard navigation per WAI-ARIA tabs pattern:
 *   Left / Right — move selection
 *   Home / End   — jump to first / last
 *   Space / Enter — activate focused tab (no-op here; change-on-focus)
 *
 * The entire strip is horizontally scrollable so a future 7th tab
 * wouldn't overflow the phone width.
 */
export function PlayerSheetTabs({ activeTab, onChange }: PlayerSheetTabsProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  const handleKey = useCallback((e: KeyboardEvent) => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    if (idx < 0) return;
    let nextIdx = idx;
    switch (e.key) {
      case 'ArrowRight': nextIdx = (idx + 1) % TABS.length; break;
      case 'ArrowLeft':  nextIdx = (idx - 1 + TABS.length) % TABS.length; break;
      case 'Home':       nextIdx = 0; break;
      case 'End':        nextIdx = TABS.length - 1; break;
      default: return;
    }
    e.preventDefault();
    onChange(TABS[nextIdx].id);
    // Move keyboard focus to the newly active tab
    const stripEl = stripRef.current;
    if (stripEl) {
      const btn = stripEl.querySelector<HTMLButtonElement>(
        `[data-tab-id="${TABS[nextIdx].id}"]`,
      );
      btn?.focus();
    }
  }, [activeTab, onChange]);

  return (
    <div
      class="player-sheet__tabs"
      role="tablist"
      aria-label="Character sheet sections"
      ref={stripRef}
      onKeyDown={handleKey}
    >
      {TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            class={`player-sheet__tab${active ? ' player-sheet__tab--active' : ''}`}
            role="tab"
            id={`player-sheet-tab-${tab.id}`}
            data-tab-id={tab.id}
            aria-selected={active}
            aria-controls={`player-sheet-panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
