import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Character, Party } from '@gloomhaven-command/shared';
import { useCommands } from '../../hooks/useCommands';
import { PartySheetContext } from './PartySheetContext';
import { PartySheetHeader } from './PartySheetHeader';
import { PartySheetTabs, PARTY_TABS, type PartySheetTabId } from './PartySheetTabs';
import { PartySheetIntro } from './PartySheetIntro';
import { RosterTab } from './tabs/RosterTab';
import { StandingTab } from './tabs/StandingTab';
import { LocationTab } from './tabs/LocationTab';
import { ResourcesTab } from './tabs/ResourcesTab';
import { EventsTab } from './tabs/EventsTab';

interface PartySheetProps {
  party: Party;
  characters: Character[];
  edition: string;
  onClose: () => void;
  readOnly?: boolean;
  /** Display mode: auto-cycle tabs every 30s; disable manual interaction. */
  autoCycle?: boolean;
  /** Display mode: skip the leather-book intro animation. */
  skipIntro?: boolean;
  /** Landscape (controller iPad) vs portrait (display tower). Default landscape. */
  layout?: 'landscape' | 'portrait';
  /**
   * Phase T0c: fires when `autoCycle` advances past the last visible tab
   * (full rotation complete). Parent can use this to swap to a sibling
   * sheet. Optional — omitting leaves cycling internal (T0b behavior).
   */
  onCycleComplete?: () => void;
}

const CYCLE_MS = 30_000;

/**
 * Phase T0b: Party Sheet container.
 *
 * Mounts as a full-screen modal dialog with a 5-tab strip (gilt-bound
 * binding — the sheet's signature visual, broken at the active tab via
 * pseudo-elements in `sheets.css`).
 *
 * Consumed by:
 *   - controller (PartySheetOverlay, readOnly=false) — GM edits live
 *   - display (DisplayPartySheetView, readOnly + autoCycle + skipIntro)
 *     — decorative idle-mode ambient render; cycles tabs every 30s
 *
 * Class accent is NOT used here (party has no single character color);
 * accents come from `--gilt-gold` / `--accent-gold`. The root has
 * `data-edition` so GH/FH theming can diverge if needed later, and
 * `data-autocycle` so the CSS candlelight-flicker only animates the
 * display decorative variant.
 */
export function PartySheet(props: PartySheetProps) {
  const {
    party,
    characters,
    edition,
    onClose,
    readOnly = false,
    autoCycle = false,
    skipIntro = false,
    layout = 'landscape',
    onCycleComplete,
  } = props;

  const commands = useCommands();

  const visibleTabs = useMemo<PartySheetTabId[]>(() => {
    const ids = PARTY_TABS.map((t) => t.id);
    return edition === 'fh' ? ids : ids.filter((id) => id !== 'resources');
  }, [edition]);

  const hideTabs = useMemo<PartySheetTabId[]>(
    () => (edition === 'fh' ? [] : ['resources']),
    [edition],
  );

  const [activeTab, setActiveTab] = useState<PartySheetTabId>('roster');

  // Intro gating. Same pattern as T0a PlayerSheet.
  const [introSkipped, setIntroSkipped] = useState(false);
  const shouldPlayIntro =
    !readOnly && !autoCycle && !skipIntro && !party.sheetIntroSeen && !introSkipped;
  const requestedMarkSeenRef = useRef(false);

  const handleIntroComplete = () => {
    setIntroSkipped(true);
    if (requestedMarkSeenRef.current) return;
    requestedMarkSeenRef.current = true;
    commands.updateCampaign('sheetIntroSeen', true);
  };

  // Focus trap — mirror of T0a.
  const rootRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusTo.current = document.activeElement;
    const el = rootRef.current?.querySelector<HTMLElement>('.party-sheet__close')
      ?? rootRef.current;
    el?.focus();
    return () => {
      const toRestore = returnFocusTo.current as HTMLElement | null;
      toRestore?.focus?.();
    };
  }, []);

  // Esc closes (controller only); Tab loops within modal (controller only).
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

  // Display auto-cycle — advance through visible tabs.
  const [cycling, setCycling] = useState(false);
  useEffect(() => {
    if (!autoCycle) return;
    const interval = window.setInterval(() => {
      setActiveTab((curr) => {
        const idx = visibleTabs.indexOf(curr);
        const nextIdx = (idx + 1) % visibleTabs.length;
        // Phase T0c: fire onCycleComplete when wrapping past the last tab.
        if (nextIdx === 0) onCycleComplete?.();
        return visibleTabs[nextIdx];
      });
      setCycling(true);
      window.setTimeout(() => setCycling(false), 600);
    }, CYCLE_MS);
    return () => window.clearInterval(interval);
  }, [autoCycle, visibleTabs, onCycleComplete]);

  // If the current tab gets hidden (e.g. edition flips), fall back to roster.
  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) setActiveTab('roster');
  }, [visibleTabs, activeTab]);

  const activeCharacterCount = characters.filter((c) => !c.absent).length;

  return (
    <PartySheetContext.Provider value={{ readOnly, edition, onClose, autoCycle }}>
      <div
        class="party-sheet"
        data-edition={edition}
        data-autocycle={autoCycle ? 'true' : 'false'}
        data-layout={layout}
        role="dialog"
        aria-modal={!autoCycle}
        aria-labelledby="party-sheet-title"
        ref={rootRef}
        tabIndex={-1}
      >
        <PartySheetHeader party={party} activeCharacterCount={activeCharacterCount} />

        <div class={`party-sheet__body party-sheet__body--${layout}`}>
          <PartySheetTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            layout={layout}
            hideTabs={hideTabs}
            disabled={autoCycle}
          />

          <div
            class="party-sheet__content"
            id={`party-sheet-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`party-sheet-tab-${activeTab}`}
            data-tab={activeTab}
            data-cycling={cycling ? 'true' : 'false'}
          >
            {activeTab === 'roster' && (
              <RosterTab
                characters={characters}
                retirements={party.retirements ?? []}
                edition={edition}
              />
            )}
            {activeTab === 'standing' && <StandingTab party={party} />}
            {activeTab === 'location' && <LocationTab party={party} />}
            {activeTab === 'resources' && edition === 'fh' && (
              <ResourcesTab party={party} edition={edition} />
            )}
            {activeTab === 'events' && <EventsTab party={party} />}
          </div>
        </div>

        {shouldPlayIntro && (
          <PartySheetIntro partyName={party.name} onComplete={handleIntroComplete} />
        )}
      </div>
    </PartySheetContext.Provider>
  );
}
