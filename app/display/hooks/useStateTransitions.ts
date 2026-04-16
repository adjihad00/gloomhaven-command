import { useRef, useEffect } from 'preact/hooks';

/**
 * Fires a callback when a value changes between renders.
 * Skips the first render (no previous value to compare).
 * Use `suppressUntilReady` to delay tracking (e.g., suppress on reconnect).
 */
export function useStateTransition<T>(
  currentValue: T,
  callback: (prev: T, curr: T) => void,
  suppressUntilReady = true,
) {
  const prevRef = useRef<T | undefined>(undefined);
  const readyRef = useRef(suppressUntilReady);

  useEffect(() => {
    if (!readyRef.current) {
      // First render — store value but don't fire callback
      readyRef.current = true;
      prevRef.current = currentValue;
      return;
    }

    if (prevRef.current !== currentValue) {
      callback(prevRef.current as T, currentValue);
      prevRef.current = currentValue;
    }
  }, [currentValue]);
}

/**
 * Returns the previous value of a changing input (undefined on first render).
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
