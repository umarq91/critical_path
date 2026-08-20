import { useEffect, useState } from "react";

// Delays reacting to a fast-changing value (e.g. search-as-you-type) until it's stable for
// `delayMs` — "u" → "um" → "uma" → "umar" collapses into one downstream update instead of one
// per keystroke.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
