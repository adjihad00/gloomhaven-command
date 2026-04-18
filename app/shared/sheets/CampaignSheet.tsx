import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Party } from '@gloomhaven-command/shared';
import { useCommands } from '../../hooks/useCommands';
import { CampaignSheetContext } from './CampaignSheetContext';
import { CampaignSheetHeader } from './CampaignSheetHeader';
import { CampaignSheetTabs, CAMPAIGN_TABS, type CampaignSheetTabId } from './CampaignSheetTabs';
import { CampaignSheetIntro } from './CampaignSheetIntro';
import { ProsperityTab } from './tabs/ProsperityTab';
import { ScenariosTab } from './tabs/ScenariosTab';
import { UnlocksTab } from './tabs/UnlocksTab';
import { DonationsTab } from './tabs/DonationsTab';
import { AchievementsTab } from './tabs/AchievementsTab';
import { OutpostTab } from './tabs/OutpostTab';
import { SettingsTab } from './tabs/SettingsTab';

interface CampaignSheetProps {
  party: Party;
  edition: string;
  onClose: () => void;
  readOnly?: boolean;
  /** When true, tabs auto-cycle every 30s (display decorative mode). */
  autoCycle?: boolean;
  /** Display mode: skip the map-unfurling intro animation. */
  skipIntro?: boolean;
  /** Landscape (controller iPad) vs portrait (display tower). */
  layout?: 'landscape' | 'portrait';
  /** Optional gameCode for Settings tab export affordance. */
  gameCode?: string;
  /**
   * Fires when autoCycle advances past the last visible tab. Display idle
   * rotation uses this to swap sheets at a full-cycle boundary.
   */
  onCycleComplete?: () => void;
}

const CYCLE_MS = 30_000;

const EDITION_CAMPAIGN_TITLES: Record<string, string> = {
  gh: 'Gloomhaven: The Jaws Open Again',
  fh: 'Frosthaven: Year One',
  jotl: 'Jaws of the Lion',
  cs: 'Crimson Scales',
  fc: 'Forgotten Circles',
  toa: 'Trail of Ashes',
};

/**
 * Phase T0c: Campaign Sheet container.
 *
 * Third sheet in the T0 trio. Signature visual: wax-sealed tab headers
 * (each tab content area opens with a wax-seal motif). Darker
 * `--sheet-campaign-bg` leather surface distinguishes from Party Sheet.
 *
 * Consumed by:
 *   - controller (`CampaignSheetOverlay`, `readOnly: false`) — GM edits live
 *   - display (`DisplayIdleSheetsView`, `readOnly + autoCycle + skipIntro`,
 *     alternating with Party Sheet via `onCycleComplete`)
 */
export function CampaignSheet(props: CampaignSheetProps) {
  const {
    party,
    edition,
    onClose,
    readOnly = false,
    autoCycle = false,
    skipIntro = false,
    layout = 'landscape',
    gameCode,
    onCycleComplete,
  } = props;

  const commands = useCommands();

  const visibleTabs = useMemo<CampaignSheetTabId[]>(() => {
    const ids = CAMPAIGN_TABS.map((t) => t.id);
    return edition === 'fh' ? ids : ids.filter((id) => id !== 'outpost');
  }, [edition]);

  const hideTabs = useMemo<CampaignSheetTabId[]>(
    () => (edition === 'fh' ? [] : ['outpost']),
    [edition],
  );

  const [activeTab, setActiveTab] = useState<CampaignSheetTabId>('prosperity');

  // Intro gating. Same pattern as T0a/T0b.
  const [introSkipped, setIntroSkipped] = useState(false);
  const shouldPlayIntro =
    !readOnly && !autoCycle && !skipIntro && !party.campaignSheetIntroSeen && !introSkipped;
  const requestedMarkSeenRef = useRef(false);

  const handleIntroComplete = () => {
    setIntroSkipped(true);
    if (requestedMarkSeenRef.current) return;
    requestedMarkSeenRef.current = true;
    commands.updateCampaign('campaignSheetIntroSeen', true);
  };

  // Focus trap — mirror of T0b.
  const rootRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusTo.current = document.activeElement;
    const el = rootRef.current?.querySelector<HTMLElement>('.campaign-sheet__close')
      ?? rootRef.current;
    el?.focus();
    return () => {
      const toRestore = returnFocusTo.current as HTMLElement | null;
      toRestore?.focus?.();
    };
  }, []);

  // Esc closes + Tab loops (controller only).
  useEffect(() => {
    if (autoCycle) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !readOnly) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = rootRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, readOnly, autoCycle]);

  // Display auto-cycle — advance through visible tabs. Fires onCycleComplete
  // when wrapping (so a parent can swap to a sibling sheet between rotations).
  const [cycling, setCycling] = useState(false);
  useEffect(() => {
    if (!autoCycle) return;
    const interval = window.setInterval(() => {
      setActiveTab((curr) => {
        const idx = visibleTabs.indexOf(curr);
        const nextIdx = (idx + 1) % visibleTabs.length;
        if (nextIdx === 0) onCycleComplete?.();
        return visibleTabs[nextIdx];
      });
      setCycling(true);
      window.setTimeout(() => setCycling(false), 600);
    }, CYCLE_MS);
    return () => window.clearInterval(interval);
  }, [autoCycle, visibleTabs, onCycleComplete]);

  // If the current tab gets hidden (e.g. edition flips), fall back to prosperity.
  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) setActiveTab('prosperity');
  }, [visibleTabs, activeTab]);

  const campaignTitle = EDITION_CAMPAIGN_TITLES[edition] ?? edition.toUpperCase();

  return (
    <CampaignSheetContext.Provider value={{ readOnly, edition, onClose, autoCycle }}>
      <div
        class="campaign-sheet"
        data-edition={edition}
        data-autocycle={autoCycle ? 'true' : 'false'}
        data-layout={layout}
        role="dialog"
        aria-modal={!autoCycle}
        aria-labelledby="campaign-sheet-title"
        ref={rootRef}
        tabIndex={-1}
      >
        <CampaignSheetHeader party={party} />

        <div class={`campaign-sheet__body campaign-sheet__body--${layout}`}>
          <CampaignSheetTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            layout={layout}
            hideTabs={hideTabs}
            disabled={autoCycle}
          />

          <div
            class="campaign-sheet__content"
            id={`campaign-sheet-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`campaign-sheet-tab-${activeTab}`}
            data-tab={activeTab}
            data-cycling={cycling ? 'true' : 'false'}
          >
            {activeTab === 'prosperity' && <ProsperityTab party={party} />}
            {activeTab === 'scenarios' && <ScenariosTab party={party} />}
            {activeTab === 'unlocks' && <UnlocksTab party={party} />}
            {activeTab === 'donations' && <DonationsTab party={party} />}
            {activeTab === 'achievements' && <AchievementsTab party={party} />}
            {activeTab === 'outpost' && edition === 'fh' && <OutpostTab party={party} />}
            {activeTab === 'settings' && <SettingsTab party={party} gameCode={gameCode} />}
          </div>
        </div>

        {shouldPlayIntro && (
          <CampaignSheetIntro title={campaignTitle} onComplete={handleIntroComplete} />
        )}
      </div>
    </CampaignSheetContext.Provider>
  );
}
