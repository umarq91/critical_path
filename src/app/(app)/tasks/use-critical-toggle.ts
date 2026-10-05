"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { updateTask } from "@/app/(app)/tasks/_actions";
import type { Task } from "@/data/tasks";

// The grid's "Critical" checkbox saves on click, outside the row's pencil/tick edit mode: it's a
// one-bit flag, and making someone open a row to flip it is friction for nothing. Shared by Tasks
// and My Tasks, which render the same columns.
//
// A click shows its new value at once (an override), and every override is dropped the moment a
// new set of rows arrives — the refresh after a save, or any other reload — so the cell never lags
// behind the click and never masks a later change someone else made. Same render-time reset
// pattern as useRefreshableData.
export function useCriticalToggle(tasks: Task[], refresh: () => void) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  // useRefreshableData's `refresh` is a new function every render, closing over the CURRENT
  // filters. Read through a ref at click time, so a memoised toggle never reloads with stale ones.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setOverrides({});
  }

  // Memoised on `overrides` so the grid's column defs (which close over this) only rebuild when
  // a checkbox actually changes, not on every render of the board.
  return useMemo(() => {
    async function toggle(task: Task, next: boolean) {
      setOverrides((current) => ({ ...current, [task.id]: next }));
      const result = await updateTask(task.id, { is_critical: next });
      if (!result.ok) {
        setOverrides((current) => {
          const next = { ...current };
          delete next[task.id];
          return next;
        });
        toast.error(result.error);
        return;
      }
      toast.success(next ? `${task.task_name} marked as critical` : `${task.task_name} unmarked as critical`);
      refreshRef.current();
    }

    return {
      isCritical: (task: Task) => overrides[task.id] ?? task.is_critical,
      isPending: (task: Task) => task.id in overrides,
      toggle,
    };
  }, [overrides]);
}

export type CriticalToggleState = ReturnType<typeof useCriticalToggle>;
