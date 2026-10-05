"use client";

import { useMemo, useSyncExternalStore } from "react";

export type TimelineColumn = "name" | "start" | "end";
export type TimelineColumnWidths = Record<TimelineColumn, number>;

// Defaults add up to the old fixed 420px panel, so an untouched Timeline looks as it always did.
export const TIMELINE_COLUMN_DEFAULTS: TimelineColumnWidths = {
  name: 196,
  start: 112,
  end: 112,
};
export const TIMELINE_COLUMN_MIN: TimelineColumnWidths = {
  name: 140,
  start: 90,
  end: 90,
};
export const TIMELINE_COLUMN_MAX = 640;

const STORAGE_KEY = "timeline-column-widths";
const listeners = new Set<() => void>();
// Fallback when localStorage throws (private browsing, blocked storage): widths still resize for
// this session, they just don't survive a reload.
let memoryValue: string | null = null;

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryValue;
  } catch {
    return memoryValue;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function parse(raw: string | null): TimelineColumnWidths {
  if (!raw) return TIMELINE_COLUMN_DEFAULTS;
  try {
    const saved = JSON.parse(raw) as Partial<TimelineColumnWidths>;
    const widths = { ...TIMELINE_COLUMN_DEFAULTS };
    for (const column of Object.keys(widths) as TimelineColumn[]) {
      const value = saved[column];
      if (typeof value === "number" && Number.isFinite(value))
        widths[column] = clampWidth(column, value);
    }
    return widths;
  } catch {
    return TIMELINE_COLUMN_DEFAULTS;
  }
}

export function clampWidth(column: TimelineColumn, width: number) {
  return Math.round(
    Math.min(TIMELINE_COLUMN_MAX, Math.max(TIMELINE_COLUMN_MIN[column], width)),
  );
}

// The Timeline's pinned left columns (Task Name / Start / End), resizable like the Tasks grid and
// saved per browser. Shared by /timeline and the Dashboard's Gantt card, which render the same grid.
//
// useSyncExternalStore with a server snapshot of "nothing saved": the server can't see
// localStorage, so it renders the defaults and the client switches to the saved widths right after
// hydrating. Reading localStorage during the first render instead would make the server and client
// markup disagree (a hydration error).
export function useTimelineColumnWidths() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const widths = useMemo(() => parse(raw), [raw]);

  function setWidth(column: TimelineColumn, width: number) {
    const next = JSON.stringify({
      ...widths,
      [column]: clampWidth(column, width),
    });
    memoryValue = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable — memoryValue above keeps this session working.
    }
    for (const listener of listeners) listener();
  }

  return {
    widths,
    setWidth,
    totalWidth: widths.name + widths.start + widths.end,
  };
}
