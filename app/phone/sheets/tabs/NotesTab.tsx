import { h } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import type { Character } from '@gloomhaven-command/shared';
import { PlayerSheetContext } from '../PlayerSheetContext';
import { useCommands } from '../../../hooks/useCommands';
import { useCommitOnPause } from '../../../shared/hooks/useCommitOnPause';

interface NotesTabProps {
  character: Character;
}

const NOTES_MAX_CHARS = 4000;
const SAVED_CHIP_MS = 1600;

/**
 * Phase T0d: Notes tab — freeform per-character journal.
 *
 * Editable textarea backed by `CharacterProgress.notes`. Hybrid-commit
 * via `useCommitOnPause` (1 s typing pause + blur; Enter inserts a
 * newline). Character count turns copper at the limit. "Saved" chip
 * flashes briefly on each commit, then fades.
 */
export function NotesTab({ character }: NotesTabProps) {
  const { readOnly } = useContext(PlayerSheetContext);
  const commands = useCommands();

  const persisted = character.progress?.notes ?? '';
  const [savedTick, setSavedTick] = useState(0);
  const savedFadeTimer = useRef<number | null>(null);
  const [chipVisible, setChipVisible] = useState(false);

  const { localValue, onInput, onFocus, onBlur, onKeyDown } = useCommitOnPause({
    value: persisted,
    onCommit: (next) => {
      commands.setCharacterProgress(
        character.name,
        character.edition,
        'notes',
        next,
      );
      setSavedTick((t) => t + 1);
    },
    pauseMs: 1000,
    commitOnEnter: false,
  });

  // "Saved" chip lifecycle — flash on each commit, fade after SAVED_CHIP_MS.
  useEffect(() => {
    if (savedTick === 0) return;
    setChipVisible(true);
    if (savedFadeTimer.current !== null) {
      window.clearTimeout(savedFadeTimer.current);
    }
    savedFadeTimer.current = window.setTimeout(() => {
      setChipVisible(false);
      savedFadeTimer.current = null;
    }, SAVED_CHIP_MS);
    return () => {
      if (savedFadeTimer.current !== null) {
        window.clearTimeout(savedFadeTimer.current);
        savedFadeTimer.current = null;
      }
    };
  }, [savedTick]);

  const charCount = localValue.length;
  const atLimit = charCount >= NOTES_MAX_CHARS;

  const handleInput = (e: Event) => {
    const target = e.currentTarget as HTMLTextAreaElement | null;
    if (target && target.value.length > NOTES_MAX_CHARS) {
      target.value = target.value.slice(0, NOTES_MAX_CHARS);
    }
    onInput(e);
  };

  const displayName = character.title?.trim() || character.name;

  return (
    <section class="notes-tab" role="region" aria-labelledby="notes-tab-heading">
      <header class="notes-tab__header">
        <h3 id="notes-tab-heading" class="notes-tab__heading">Notes</h3>
        <p class="notes-tab__subheading">
          Your hero's journal. Track NPCs, hooks, plans, and anything worth remembering.
        </p>
      </header>

      <div class="notes-tab__field-wrapper">
        <textarea
          class="notes-tab__textarea"
          value={localValue}
          onInput={handleInput}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          readOnly={readOnly}
          maxLength={NOTES_MAX_CHARS}
          placeholder={readOnly ? 'No notes.' : 'Begin your journal…'}
          aria-label={`Notes for ${displayName}`}
          rows={14}
        />

        <div class="notes-tab__meta">
          <span
            class={`notes-tab__char-count${atLimit ? ' notes-tab__char-count--limit' : ''}`}
            aria-live="polite"
          >
            {charCount} / {NOTES_MAX_CHARS}
          </span>
          <span
            class={`notes-tab__saved${chipVisible ? ' notes-tab__saved--visible' : ''}`}
            aria-live="polite"
          >
            Saved
          </span>
        </div>
      </div>
    </section>
  );
}
