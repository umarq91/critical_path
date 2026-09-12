"use client";

import { useTransition } from "react";
import { debounce, useQueryStates } from "nuqs";
import {
  DPSP_FLYWHEEL_SEARCH_DEBOUNCE_MS,
  dpspFlywheelSearchParams,
} from "@/app/(app)/dpsp-flywheel/dpsp-flywheel-search-params";

// Mirrors timeline-query-state.ts: shallow: false forces a real navigation so the Server
// Component re-runs listTasksForFlywheel with the new filters/search term.
export function useDpspFlywheelQueryState() {
  const [isPending, startTransition] = useTransition();

  const [state, setState] = useQueryStates(dpspFlywheelSearchParams(), {
    clearOnDefault: true,
    shallow: false,
    startTransition,
  });

  // Patch type forwarded straight from nuqs's own setter rather than hand-rolled — every key
  // here also accepts `null` (nuqs's "reset to default"), which a `Partial<typeof state>`
  // (each key's plain value type) can't express.
  function setFilters(patch: Parameters<typeof setState>[0]) {
    // Only the search box is debounced — that's typing. Every other control (season/department
    // pickers, hide-done) should act on the click, not 400ms later.
    const isTyping = typeof patch === "object" && patch !== null && "q" in patch && Object.keys(patch).length === 1;
    void setState(patch, isTyping ? { limitUrlUpdates: debounce(DPSP_FLYWHEEL_SEARCH_DEBOUNCE_MS) } : {});
  }

  return { state, setFilters, isPending };
}

export type DpspFlywheelQueryState = ReturnType<typeof useDpspFlywheelQueryState>;
