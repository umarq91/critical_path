"use client";

import { useCallback, useTransition } from "react";
import { debounce, useQueryStates } from "nuqs";
import { TIMELINE_SEARCH_DEBOUNCE_MS, timelineSearchParams } from "@/app/(app)/timeline/timeline-search-params";
import type { TimelineControls, TimelineControlsPatch } from "@/app/(app)/timeline/timeline-toolbar";

// Single hook instance shared by TimelineWorkspace, so the same isPending flag that drives the
// toolbar's Prev/Next/Today/filter changes also drives the grid's dim overlay — same contract
// as calendar-query-state.ts.
export function useTimelineQueryState() {
  const [isPending, startTransition] = useTransition();

  // shallow: false forces a real navigation so the Server Component re-runs
  // listTasksForTimeline with the new window, filters, search term and page. Every param on
  // this page is answered by the query; none of it is narrowed in the browser.
  const [state, setState] = useQueryStates(timelineSearchParams(), {
    clearOnDefault: true,
    shallow: false,
    startTransition,
  });

  const setControls = useCallback(
    ({ search, ...patch }: TimelineControlsPatch) => {
      // Any change to the window, the filters or the term re-slices the list, so the page the
      // user was on no longer refers to the same rows — start again at the first page.
      // `search` is the toolbar's name for it; `q` is the URL's.
      const values = { ...patch, page: null, ...(search === undefined ? {} : { q: search || null }) };
      // Only a lone search change is debounced — that's typing. Clear also carries a term, but
      // it arrives with the other filters and should act on the click, not 400ms later.
      const isTyping = search !== undefined && Object.keys(patch).length === 0;
      void setState(values, isTyping ? { limitUrlUpdates: debounce(TIMELINE_SEARCH_DEBOUNCE_MS) } : {});
    },
    [setState]
  );

  const setPage = useCallback((page: number) => void setState({ page: page <= 1 ? null : page }), [setState]);
  const setPageSize = useCallback(
    (pageSize: number) => void setState({ pageSize, page: null }),
    [setState]
  );

  const controls: TimelineControls = {
    view: state.view,
    date: state.date,
    seasonId: state.seasonId,
    brandId: state.brandId,
    keyStageId: state.keyStageId,
    owner: state.owner,
    involved: state.involved,
    search: state.q,
  };

  return {
    state: controls,
    setState: setControls,
    isPending,
    page: state.page,
    pageSize: state.pageSize,
    setPage,
    setPageSize,
  };
}

export type TimelineQueryState = ReturnType<typeof useTimelineQueryState>;
