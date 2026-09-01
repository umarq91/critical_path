"use client";

import { useTransition } from "react";
import { useQueryStates } from "nuqs";
import { timelineSearchParams } from "@/app/(app)/timeline/timeline-search-params";

// Single hook instance shared by TimelineWorkspace, so the same isPending flag that drives the
// toolbar's Prev/Next/Today/filter changes also drives the grid's dim overlay — same contract
// as calendar-query-state.ts.
export function useTimelineQueryState() {
  const [isPending, startTransition] = useTransition();

  // shallow: false forces a real navigation so the Server Component re-runs
  // listTasksForTimeline with the new window/filters.
  const [state, setState] = useQueryStates(timelineSearchParams(), {
    clearOnDefault: true,
    shallow: false,
    startTransition,
  });

  return { state, setState, isPending };
}

export type TimelineQueryState = ReturnType<typeof useTimelineQueryState>;
