"use client";

import { useTransition } from "react";
import { useQueryStates } from "nuqs";
import { calendarSearchParams } from "@/app/(app)/calendar/calendar-search-params";

// Single hook instance shared by CalendarWorkspace, so the same isPending flag that drives
// the toolbar's Prev/Next/Today/filter changes also drives the board's dim+spinner overlay —
// same "isPending" contract as use-data-table-query-state.ts, just without the pagination bits.
export function useCalendarQueryState() {
  const [isPending, startTransition] = useTransition();

  // shallow: false forces a real navigation so the Server Component re-runs
  // listTasksByDueDateRange with the new range/filters.
  const [state, setState] = useQueryStates(calendarSearchParams(), {
    clearOnDefault: true,
    shallow: false,
    startTransition,
  });

  return { state, setState, isPending };
}

export type CalendarQueryState = ReturnType<typeof useCalendarQueryState>;
