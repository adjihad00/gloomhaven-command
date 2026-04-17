import { h } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import type {
  Character,
  ConditionName,
  ElementModel,
  ElementType,
  ElementState,
  LootDeck,
} from '@gloomhaven-command/shared';
import { useCommands } from '../../hooks/useCommands';
import { useGameState } from '../../hooks/useGameState';
import { getCharacterTheme, withAlpha } from '../../shared/characterThemes';
import { PlayerSheetContext } from './PlayerSheetContext';
import { PlayerSheetHeader } from './PlayerSheetHeader';
import { PlayerSheetTabs, type PlayerSheetTabId } from './PlayerSheetTabs';
import { PlayerSheetIntro } from './PlayerSheetIntro';
import { PlayerSheetMenu } from './PlayerSheetMenu';
import { OverviewTab } from './tabs/OverviewTab';
import { ItemsTabPlaceholder } from './tabs/ItemsTabPlaceholder';
import { ProgressionTabPlaceholder } from './tabs/ProgressionTabPlaceholder';
import { PersonalQuestTabPlaceholder } from './tabs/PersonalQuestTabPlaceholder';
import { NotesTabPlaceholder } from './tabs/NotesTabPlaceholder';
import { HistoryTabPlaceholder } from './tabs/HistoryTabPlaceholder';

interface PlayerSheetProps {
  character: Character;
  edition: string;
  onClose: () => void;

  /** Scenario ambience for the Overview tab's Active Scenario section. */
  elements?: ElementModel[];
  lootDeck?: LootDeck | null;
  isActive?: boolean;
  characterColor?: string;

  /** Overview tab → Active Scenario controls (scenario mode only). */
  onChangeHealth?: (delta: number) => void;
  onSetXP?: (value: number) => void;
  onToggleCondition?: (name: ConditionName) => void;
  onToggleLongRest?: () => void;
  onToggleAbsent?: () => void;
  onToggleExhausted?: () => void;
  onMoveElement?: (element: ElementType, newState: ElementState) => void;
  onSwitchCharacter?: () => void;

  /** Controller read-only mode (see PlayerSheetContext). */
  readOnly?: boolean;
}

/**
 * Phase T0a: Player Sheet container.
 *
 * Mounts as a full-screen modal dialog with a 6-tab strip. Overview is
 * the only tab with real content in T0a; other tabs are placeholders
 * pointing at their implementation batch. On first-open per character,
 * renders `PlayerSheetIntro` which persists `sheetIntroSeen` via
 * `setCharacterProgress` so the intro plays once per campaign.
 *
 * Class accent is set inline on the root as CSS custom properties
 * sourced from the shared `characterThemes` map (avoiding duplication
 * in CSS). Consumers below read `var(--class-accent)` etc.
 */
export function PlayerSheet(props: PlayerSheetProps) {
  const {
    character, edition, onClose,
    elements, lootDeck, isActive, characterColor,
    onChangeHealth, onSetXP, onToggleCondition,
    onToggleLongRest, onToggleAbsent, onToggleExhausted,
    onMoveElement, onSwitchCharacter,
    readOnly = false,
  } = props;

  const commands = useCommands();
  const { state, party } = useGameState();

  const [activeTab, setActiveTab] = useState<PlayerSheetTabId>('overview');
  // Menu state lives at the sheet root so the menu can render as a direct
  // child of `.player-sheet` and escape the header's stacking context.
  // The header itself has `z-index: 1` (from `.player-sheet > *`), which
  // constrains any menu rendered inside it — tabs and content paint over
  // it in DOM order. Hoisting the menu here lets its own z-index: 70 win.
  const [menuOpen, setMenuOpen] = useState(false);

  // One-time intro animation. Derived from persisted flag (first render);
  // once we request the skip/complete transition it flips locally for the
  // same-session replay case. `requestedMarkSeen` prevents duplicate commands.
  const [introSkipped, setIntroSkipped] = useState(false);
  const shouldPlayIntro = !readOnly && !character.progress?.sheetIntroSeen && !introSkipped;
  const requestedMarkSeen = useRef(false);

  const handleIntroComplete = () => {
    setIntroSkipped(true);
    if (requestedMarkSeen.current) return;
    requestedMarkSeen.current = true;
    commands.setCharacterProgress(
      character.name,
      character.edition,
      'sheetIntroSeen',
      true,
    );
  };

  // Class accent vars — derived during render (no effect needed).
  const themeStyle = useMemo(() => {
    const theme = getCharacterTheme(character.name, characterColor);
    return {
      '--class-accent': theme.accent,
      '--class-accent-glow': withAlpha(theme.accent, 0.4),
      '--class-accent-dim': withAlpha(theme.accent, 0.15),
      '--class-bg': theme.bg,
      '--class-flair': theme.flair,
    } as h.JSX.CSSProperties;
  }, [character.name, characterColor]);

  // Focus trap — restore focus on close, trap Tab inside the modal.
  const rootRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusTo.current = document.activeElement;
    // Focus the close button (or root) for keyboard users on open.
    const el = rootRef.current?.querySelector<HTMLElement>('.player-sheet__close')
      ?? rootRef.current;
    el?.focus();
    return () => {
      const toRestore = returnFocusTo.current as HTMLElement | null;
      toRestore?.focus?.();
    };
  }, []);

  // Esc closes; Tab loops within modal.
  useEffect(() => {
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
  }, [onClose, readOnly]);

  const scenariosCompleted = party?.scenarios?.length ?? state?.party?.scenarios?.length ?? 0;

  return (
    <PlayerSheetContext.Provider value={{ readOnly, edition, onClose }}>
      <div
        class="player-sheet"
        data-class={character.name}
        data-mode={state?.mode ?? 'scenario'}
        style={themeStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-sheet-title"
        ref={rootRef}
      >
        <PlayerSheetHeader
          character={character}
          edition={edition}
          scenariosCompleted={scenariosCompleted}
          onClose={onClose}
          readOnly={readOnly}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((o) => !o)}
        />
        <PlayerSheetTabs activeTab={activeTab} onChange={setActiveTab} />

        <div
          class="player-sheet__content"
          id={`player-sheet-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`player-sheet-tab-${activeTab}`}
          data-tab={activeTab}
        >
          {activeTab === 'overview' && (
            <OverviewTab
              character={character}
              edition={edition}
              elements={elements}
              lootDeck={lootDeck ?? null}
              isActive={!!isActive}
              onChangeHealth={onChangeHealth}
              onSetXP={onSetXP}
              onToggleCondition={onToggleCondition}
              onToggleLongRest={onToggleLongRest}
              onToggleAbsent={onToggleAbsent}
              onToggleExhausted={onToggleExhausted}
              onMoveElement={onMoveElement}
            />
          )}
          {activeTab === 'items' && <ItemsTabPlaceholder />}
          {activeTab === 'progression' && <ProgressionTabPlaceholder />}
          {activeTab === 'quest' && <PersonalQuestTabPlaceholder />}
          {activeTab === 'notes' && <NotesTabPlaceholder />}
          {activeTab === 'history' && <HistoryTabPlaceholder />}
        </div>

        {menuOpen && !readOnly && (
          <PlayerSheetMenu
            characterName={character.name}
            onClose={() => setMenuOpen(false)}
            onSwitchCharacter={onSwitchCharacter}
          />
        )}

        {shouldPlayIntro && (
          <PlayerSheetIntro
            character={character}
            edition={edition}
            onComplete={handleIntroComplete}
          />
        )}
      </div>
    </PlayerSheetContext.Provider>
  );
}
