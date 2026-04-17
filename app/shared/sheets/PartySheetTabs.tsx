import { h } from 'preact';
import { useRef, useCallback } from 'preact/hooks';

export type PartySheetTabId =
  | 'roster'
  | 'standing'
  | 'location'
  | 'resources'
  | 'events';

interface TabDescriptor {
  id: PartySheetTabId;
  label: string;
}

export const PARTY_TABS: readonly TabDescriptor[] = [
  { id: 'roster', label: 'Roster' },
  { id: 'standing', label: 'Standing' },
  { id: 'location', label: 'Location' },
  { id: 'resources', label: 'Resources' },
  { id: 'events', label: 'Events' },
];

interface PartySheetTabsProps {
  activeTab: PartySheetTabId;
  onChange: (id: PartySheetTabId) => void;
  /** Landscape: vertical strip left. Portrait: horizontal strip top. */
  layout: 'landscape' | 'portrait';
  /** Tabs to hide entirely (e.g. Resources on non-FH). */
  hideTabs?: readonly PartySheetTabId[];
  /** Display autoCycle mode disables manual tab switches. */
  disabled?: boolean;
}

/**
 * Phase T0b: Party Sheet tab strip.
 *
 * Vertical on landscape (controller iPad), horizontal on portrait (display).
 * Signature visual is the gilt-bound binding rule along the strip's inner
 * edge, broken only at the active tab — implemented via pseudo-elements in
 * `sheets.css` (see T0b section: `.party-sheet__tab-strip::after` +
 * `.party-sheet__tab--active::before`).
 *
 * Keyboard: ArrowUp/Down on vertical, ArrowLeft/Right on horizontal,
 * Home/End jumps to first/last. Roving tabindex per WAI-ARIA tabs pattern.
 */
export function PartySheetTabs({
  activeTab,
  onChange,
  layout,
  hideTabs,
  disabled,
}: PartySheetTabsProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const visibleTabs = hideTabs
    ? PARTY_TABS.filter((t) => !hideTabs.includes(t.id))
    : PARTY_TABS;

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
      class={`party-sheet__tab-strip party-sheet__tab-strip--${layout}`}
      role="tablist"
      aria-label="Party sheet sections"
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
            class={`party-sheet__tab${active ? ' party-sheet__tab--active' : ''}`}
            role="tab"
            id={`party-sheet-tab-${tab.id}`}
            data-tab-id={tab.id}
            aria-selected={active}
            aria-controls={`party-sheet-panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            disabled={disabled && !active}
            onClick={() => !disabled && onChange(tab.id)}
          >
            <span class="party-sheet__tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
