import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

interface UseCommitOnPauseOptions {
  value: string;
  onCommit: (next: string) => void;
  /** ms of typing inactivity before auto-committing. Default 1000. */
  pauseMs?: number;
  /** Single-line inputs commit + blur on Enter. Textareas disable this. */
  commitOnEnter?: boolean;
}

interface UseCommitOnPauseResult {
  localValue: string;
  onInput: (e: Event) => void;
  onBlur: () => void;
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

/**
 * Phase T0b: hybrid-commit behaviour for editable text fields.
 *
 * Commits on blur, Enter (single-line), or after `pauseMs` of typing
 * inactivity. Used by Party Sheet's Standing/Location tabs; T0d's Notes
 * tab will reuse it.
 *
 * - External value changes while NOT focused → local value follows
 *   (reflects collaborative edits from other clients).
 * - External value changes WHILE focused → local value is NOT overwritten
 *   (user's in-progress edit wins until blur).
 */
export function useCommitOnPause(
  options: UseCommitOnPauseOptions,
): UseCommitOnPauseResult {
  const { value, onCommit, pauseMs = 1000, commitOnEnter = true } = options;
  const [localValue, setLocalValue] = useState(value);
  const focusedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const lastCommittedRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // External sync — only when not focused.
  useEffect(() => {
    if (!focusedRef.current && value !== lastCommittedRef.current) {
      setLocalValue(value);
      lastCommittedRef.current = value;
    }
  }, [value]);

  const scheduleCommit = useCallback(
    (next: string) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (next !== lastCommittedRef.current) {
          onCommitRef.current(next);
          lastCommittedRef.current = next;
        }
      }, pauseMs);
    },
    [pauseMs],
  );

  const onInput = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const next = target.value;
    setLocalValue(next);
    scheduleCommit(next);
  };

  const onFocus = () => {
    focusedRef.current = true;
  };

  const onBlur = () => {
    focusedRef.current = false;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (localValue !== lastCommittedRef.current) {
      onCommitRef.current(localValue);
      lastCommittedRef.current = localValue;
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!commitOnEnter) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      // Single-line path: blur to trigger commit path above.
      (e.target as HTMLElement).blur?.();
    }
  };

  // Cleanup pending timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { localValue, onInput, onFocus, onBlur, onKeyDown };
}
