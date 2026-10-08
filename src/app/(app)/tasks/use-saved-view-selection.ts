"use client";

import { useQueryState } from "nuqs";
import { functionalUpdate, type ColumnFiltersState, type OnChangeFn } from "@tanstack/react-table";
import { SAVED_VIEW_PARAM } from "@/constants/routes";
import type { DataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import type { SavedView } from "@/data/saved-views";

// Selecting a view goes through nuqs in the same tick as the grid's own filters/sort, so the
// whole switch is one URL update inside the table's transition: the toolbar, the view's name and
// the dimmed table all change together. A <Link> here would be a separate router navigation that
// neither nuqs nor isPending see, so labels lag behind and then jump when the server answers.
export function useSavedViewSelection(queryState: DataTableQueryState) {
  const [viewId, setViewId] = useQueryState(SAVED_VIEW_PARAM);

  const selectView = (view: SavedView | null) => {
    void setViewId(view?.id ?? null);
    void queryState.replaceFiltersAndSort(
      view ? { filters: view.filters, sortBy: view.sortBy, sortDir: view.sortDir } : { filters: {} }
    );
  };

  // Clearing the last filter also drops the view: an unfiltered grid isn't that view any more,
  // and keeping its name on the button reads as if it were still applied.
  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    const next = functionalUpdate(updater, queryState.state.columnFilters);
    if (next.length === 0) void setViewId(null);
    queryState.onColumnFiltersChange(next);
  };

  return { viewId, setViewId, selectView, queryState: { ...queryState, onColumnFiltersChange } };
}
