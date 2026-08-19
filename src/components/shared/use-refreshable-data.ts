"use client";

import { useState, useTransition } from "react";

// Powers every isolated "Refresh" icon in the app (table sections via DataTable's
// onRefresh, stat-card/summary sections via RefreshableSection). A manual refresh needs a
// plain server round trip triggered from a client event handler, scoped to just this
// section — router.refresh() can't do that: per Next.js's own docs it always re-fetches
// every Server Component on the current route, which would also reload sibling sections
// that didn't change. refreshAction is a thin Server Action (see each entity's
// _actions.ts) that just re-runs the same read the page already does on load.
//
// propValue must be a reference that's stable across incidental re-renders and only
// changes when the server actually sent new data (e.g. wrap it in useMemo keyed on the
// real props if constructing it inline) — that's what lets the "adjust state during
// render" comparison below tell a genuine prop update apart from an unrelated re-render.
export function useRefreshableData<T>(propValue: T, refreshAction: () => Promise<T>) {
  const [data, setData] = useState(propValue);
  const [prevPropValue, setPrevPropValue] = useState(propValue);
  const [isRefreshing, startTransition] = useTransition();

  if (propValue !== prevPropValue) {
    setPrevPropValue(propValue);
    setData(propValue);
  }

  function refresh() {
    startTransition(async () => {
      const next = await refreshAction();
      setData(next);
    });
  }

  return { data, refresh, isRefreshing };
}
