"use client";

import { useEffect, useRef, useState } from "react";
import { planGoogleCalendarSync, pushGoogleCalendarBatch } from "@/app/(app)/calendar/_actions";
import type { CalendarSyncFilters } from "@/app/(app)/calendar/calendar-sync-button";
import type { SyncResultItem } from "@/app/(app)/calendar/sync-items";

export type SyncPhase = "idle" | "planning" | "syncing" | "done" | "stopped" | "error";

export interface SyncProgress {
  phase: SyncPhase;
  /** Items that need a Google call — what the progress bar counts. */
  total: number;
  processed: number;
  pushedTasks: number;
  pushedHolidays: number;
  /** Already up to date (found while planning) plus anything that turned out not to need a push. */
  skipped: SyncResultItem[];
  removed: number;
  /** Tasks/holidays that couldn't be synced, with why. */
  failed: SyncResultItem[];
  error: string | null;
  startedAt: number | null;
}

const INITIAL: SyncProgress = {
  phase: "idle",
  total: 0,
  processed: 0,
  pushedTasks: 0,
  pushedHolidays: 0,
  skipped: [],
  removed: 0,
  failed: [],
  error: null,
  startedAt: null,
};

export function isSyncRunning(phase: SyncPhase) {
  return phase === "planning" || phase === "syncing";
}

// Drives a sync from the browser: one plan call, then one Server Action call per batch, so the
// dialog can count up between batches. Keeps going if the dialog is hidden or the user moves to
// another page (the loop isn't tied to the component), but not if the tab closes, hence the
// beforeunload prompt. Re-running after a stop or a closed tab is cheap: anything already
// synced is skipped by the plan.
export function useGoogleCalendarSync() {
  const [progress, setProgress] = useState<SyncProgress>(INITIAL);
  const stopRequested = useRef(false);
  const [stopping, setStopping] = useState(false);
  const running = isSyncRunning(progress.phase);

  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  async function start(filters: CalendarSyncFilters): Promise<SyncProgress> {
    stopRequested.current = false;
    setStopping(false);
    let state: SyncProgress = { ...INITIAL, phase: "planning", startedAt: Date.now() };
    const update = (patch: Partial<SyncProgress>) => {
      state = { ...state, ...patch };
      setProgress(state);
    };
    setProgress(state);

    const plan = await planGoogleCalendarSync(filters).catch(() => null);
    if (!plan?.ok) {
      update({ phase: "error", error: plan?.error ?? "Couldn't reach the server. Check your connection and try again." });
      return state;
    }
    update({
      phase: "syncing",
      total: plan.items.length,
      skipped: plan.skipped,
      removed: plan.removedCount,
      startedAt: Date.now(),
    });

    // The server sets the batch size (it also enforces it), so the browser never has to agree
    // with it on a shared constant.
    const { batchSize } = plan;
    for (let start = 0; start < plan.items.length; start += batchSize) {
      if (stopRequested.current) {
        update({ phase: "stopped" });
        return state;
      }
      const batch = plan.items.slice(start, start + batchSize);
      const result = await pushGoogleCalendarBatch(batch).catch(() => null);
      if (result?.ok) {
        update({
          processed: state.processed + batch.length,
          pushedTasks: state.pushedTasks + result.pushedTasks,
          pushedHolidays: state.pushedHolidays + result.pushedHolidays,
          skipped: [...state.skipped, ...result.skipped],
          failed: [...state.failed, ...result.failed],
        });
        continue;
      }
      // A whole batch failing (lost connection, expired session) usually means the next one
      // will too, so stop here with a clear message instead of failing every remaining item.
      if (result && !result.ok) {
        update({ phase: "error", error: result.error });
        return state;
      }
      update({ phase: "error", error: "Lost connection to the server. Run Sync again to pick up where it stopped." });
      return state;
    }

    update({ phase: "done" });
    return state;
  }

  return {
    progress,
    running,
    stopping: stopping && running,
    start,
    stop: () => {
      stopRequested.current = true;
      setStopping(true);
    },
    reset: () => setProgress(INITIAL),
  };
}
