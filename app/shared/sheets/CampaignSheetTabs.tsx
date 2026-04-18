import { h } from 'preact';
import { useRef, useCallback } from 'preact/hooks';

export type CampaignSheetTabId =
  | 'prosperity'
  | 'scenarios'
  | 'unlocks'
  | 'donations'
  | 'achievements'
  | 'outpost'
  | 'settings';

interface TabDescriptor {
  id: CampaignSheetTabId;
  label: string;
}

export const CAMPAIGN_TABS: readonly TabDescriptor[] = [
  { id: 'prosperity', label: 'Prosperity' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'unlocks', label: 'Unlocks' },
  { id: 'donations', label: 'Donations' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'outpost', label: 'Outpost' },
  { id: 'settings', label: 'Settings' },
];

interface CampaignSheetTabsProps {
  activeTab: CampaignSheetTabId;
  onChange: (id: CampaignSheetTabId) => void;
  /** Landscape: vertical strip left. Portrait: horizontal strip top. */
  layout: 'landscape' | 'portrait';
  /** Tabs to hide entirely (e.g. Outpost on non-FH). */
  hideTabs?: readonly CampaignSheetTabId[];
  /** Display autoCycle mode disables manual tab switches. */
  disabled?: boolean;
}

/**
 * Phase T0c: Campaign Sheet tab strip.
 *
 * Parallels `PartySheetTabs` structure. The visual signature differs —
 * Campaign tabs don't use the gilt-bound binding; instead, each tab
 * content area opens with a wax-sealed header (see `WaxSealHeader`).
 *
 * Keyboard: arrow-key nav per WAI-ARIA tabs pattern, Home/End jumps.
 */
export function CampaignSheetTabs({
  activeTab,
  onChange,
  layout,
  hideTabs,
  disabled,
}: CampaignSheetTabsProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const visibleTabs = hideTabs
    ? CAMPAIGN_TABS.filter((t) => !hideTabs.includes(t.id))
    : CAMPAIGN_TABS;

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;
      const idx = visibleTabs.findIndex((t) => t.id === activeTab);
      if (idx < 0) return;
      const nextKey = layout === 'portrait' ? 'ArrowRight' : 'ArrowDown';
      const prevKey = layout === 'portrait' ? 'ArrowLeft' : 'ArrowUp';
      let nextIdx = idx;
      switch (e.key) {
        case nextKey:
          nextIdx = (idx + 1) % visibleTabs.length;
          break;
        case prevKey:
          nextIdx = (idx - 1 + visibleTabs.length) % visibleTabs.length;
          break;
        case 'Home':
          nextIdx = 0;
          break;
        case 'End':
          nextIdx = visibleTabs.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      const next = visibleTabs[nextIdx];
      onChange(next.id);
      const btn = stripRef.current?.querySelector<HTMLButtonElement>(
        `[data-tab-id="${next.id}"]`,
      );
      btn?.focus();
    },
    [activeTab, onChange, layout, visibleTabs, disabled],
  );

  return (
    <div
      class={`campaign-sheet__tab-strip campaign-sheet__tab-strip--${layout}`}
      role="tablist"
      aria-label="Campaign sheet sections"
      aria-orientation={layout === 'portrait' ? 'horizontal' : 'vertical'}
      ref={stripRef}
      onKeyDown={handleKey}
    >
      {visibleTabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            class={`campaign-sheet__tab${active ? ' campaign-sheet__tab--active' : ''}`}
            role="tab"
            id={`campaign-sheet-tab-${tab.id}`}
            data-tab-id={tab.id}
            aria-selected={active}
            aria-controls={`campaign-sheet-panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            disabled={disabled && !active}
            onClick={() => !disabled && onChange(tab.id)}
          >
            <span class="campaign-sheet__tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
