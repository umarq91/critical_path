"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { functionalUpdate } from "@tanstack/react-table";
import type { ColumnSizingState, OnChangeFn } from "@tanstack/react-table";

const listeners = new Set<() => void>();
// Fallback when localStorage throws (private browsing, blocked storage): widths still resize for
// this session, they just don't survive a reload.
const memoryValues = new Map<string, string>();

function read(storageKey: string): string | null {
  try {
    return window.localStorage.getItem(storageKey) ?? memoryValues.get(storageKey) ?? null;
  } catch {
    return memoryValues.get(storageKey) ?? null;
  }
}

function write(storageKey: string, value: string) {
  memoryValues.set(storageKey, value);
  try {
    window.localStorage.setItem(storageKey, value);
  } catch {
    // Storage unavailable — memoryValues above keeps this session working.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function parse(raw: string | null): ColumnSizingState {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ColumnSizingState;
  } catch {
    return {};
  }
}

// Saved widths are read through useSyncExternalStore, not a useState initializer: the server has
// no localStorage, so seeding state from it on the client renders pixel widths where the server
// rendered percentages — a hydration error for anyone who has ever resized. The server snapshot
// (null → "not resized") is used for hydration, then React re-renders with the saved widths.
// No storageKey: plain in-memory sizing that resets on reload.
export function usePersistedColumnSizing(storageKey: string | undefined) {
  const [localSizing, setLocalSizing] = useState<ColumnSizingState>({});
  const raw = useSyncExternalStore(
    subscribe,
    () => (storageKey ? read(storageKey) : null),
    () => null
  );
  const persistedSizing = useMemo(() => parse(raw), [raw]);

  const setColumnSizing: OnChangeFn<ColumnSizingState> = useCallback(
    (updater) => {
      if (!storageKey) {
        setLocalSizing(updater);
        return;
      }
      write(storageKey, JSON.stringify(functionalUpdate(updater, parse(read(storageKey)))));
    },
    [storageKey]
  );

  return [storageKey ? persistedSizing : localSizing, setColumnSizing] as const;
}
