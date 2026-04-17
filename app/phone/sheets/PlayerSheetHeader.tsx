import { h } from 'preact';
import type { Character } from '@gloomhaven-command/shared';
import { characterIcon } from '../../shared/assets';
import { formatName } from '../../shared/formatName';
import { IlluminatedCapital } from './IlluminatedCapital';

interface PlayerSheetHeaderProps {
  character: Character;
  edition: string;
  scenariosCompleted: number;
  onClose: () => void;
  /** Hide the `⋯` menu affordance for GM read-only controller view. */
  readOnly?: boolean;
  /** Menu open/close is managed at the PlayerSheet root so the menu can
   *  render as a direct child of `.player-sheet` and escape the header's
   *  stacking context. Without this the menu's z-index is trapped inside
   *  z-index: 1 (from `.player-sheet > *`) and siblings (tabs, content)
   *  paint over it in DOM order. */
  menuOpen: boolean;
  onToggleMenu: () => void;
}

/**
 * Phase T0a: Player Sheet header.
 *
 * Close button (left), class sigil centre-ish, ⋯ menu (right). Beneath:
 * illuminated capital + title block with class name / title + subtitle
 * (level + scenarios completed).
 *
 * Class sigil uses the existing `characterIcon()` helper (already wired
 * to the lobby's spoiler-masking icon path). If the icon 404s the browser
 * renders the empty alt; we don't swap in a placeholder per
 * `app/CONVENTIONS.md` (broken asset = real bug).
 */
export function PlayerSheetHeader({
  character,
  edition,
  scenariosCompleted,
  onClose,
  readOnly,
  menuOpen,
  onToggleMenu,
}: PlayerSheetHeaderProps) {
  const displayTitle = character.title || formatName(character.name);
  const firstLetter = displayTitle.trim().charAt(0) || formatName(character.name).charAt(0);

  return (
    <header class="player-sheet__header">
      {/* Close is navigation, not an editable action — always available,
          even in read-only GM quick-view. Without it the controller had no
          way out of the sheet (OverlayBackdrop's X is occluded by the
          fixed-position sheet). */}
      <button
        type="button"
        class="player-sheet__close"
        onClick={onClose}
        aria-label="Close sheet"
      >
        &larr;
      </button>
      <img
        class="player-sheet__class-sigil"
        src={characterIcon(character.edition || edition, character.name)}
        alt=""
      />
      {!readOnly && (
        <button
          type="button"
          class="player-sheet__menu-btn"
          onClick={onToggleMenu}
          aria-label="Sheet menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          &hellip;
        </button>
      )}

      <div class="player-sheet__title-block">
        <IlluminatedCapital letter={firstLetter} ariaLabel={displayTitle} />
        <div class="player-sheet__title-text">
          <h2 id="player-sheet-title" class="player-sheet__title">
            {displayTitle}
          </h2>
          <p class="player-sheet__subtitle">
            Level {character.level}
            <span class="player-sheet__subtitle-sep"> · </span>
            {scenariosCompleted} scenarios
          </p>
          {character.title && character.title !== formatName(character.name) && (
            <p class="player-sheet__class-name">{formatName(character.name)}</p>
          )}
        </div>
      </div>
    </header>
  );
}
