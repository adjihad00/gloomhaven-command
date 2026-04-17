import { h } from 'preact';
import { useContext } from 'preact/hooks';
import type { Party } from '@gloomhaven-command/shared';
import { PartySheetContext } from './PartySheetContext';

interface PartySheetHeaderProps {
  party: Party;
  activeCharacterCount: number;
}

/**
 * Phase T0b: Party Sheet header.
 *
 * - Close button (hidden in autoCycle — display has no interactions).
 * - Title: party name or "Unnamed Party" when empty.
 * - Subtitle: edition + scenarios completed + party level chip.
 * - Embossed achievement-count pill on the right side.
 */
export function PartySheetHeader({ party, activeCharacterCount }: PartySheetHeaderProps) {
  const { onClose, autoCycle, edition } = useContext(PartySheetContext);
  const scenariosCompleted = party.scenarios?.length ?? 0;
  const achievementCount = party.achievementsList?.length ?? 0;
  const displayName = party.name?.trim() || 'Unnamed Party';
  const hasName = !!party.name?.trim();

  return (
    <header class="party-sheet__header">
      {!autoCycle && (
        <button
          type="button"
          class="party-sheet__close"
          aria-label="Close party sheet"
          onClick={onClose}
        >
          ←
        </button>
      )}

      <div class="party-sheet__title-block">
        <h1
          id="party-sheet-title"
          class={`party-sheet__title${hasName ? '' : ' party-sheet__title--unset'}`}
        >
          {displayName}
        </h1>
        <div class="party-sheet__subtitle">
          <span class="party-sheet__edition-chip">{edition.toUpperCase()}</span>
          <span class="party-sheet__divider" aria-hidden="true">·</span>
          <span>
            {scenariosCompleted} scenario{scenariosCompleted === 1 ? '' : 's'} completed
          </span>
          <span class="party-sheet__divider" aria-hidden="true">·</span>
          <span>
            {activeCharacterCount} hero{activeCharacterCount === 1 ? '' : 'es'}
          </span>
        </div>
      </div>

      {achievementCount > 0 && (
        <div
          class="party-sheet__achievement-pill"
          aria-label={`${achievementCount} party achievement${achievementCount === 1 ? '' : 's'}`}
        >
          <span class="party-sheet__achievement-pill-count">{achievementCount}</span>
          <span class="party-sheet__achievement-pill-label">Achievements</span>
        </div>
      )}
    </header>
  );
}
