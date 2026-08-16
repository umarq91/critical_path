"use client";

import { useCallback, useMemo, useTransition } from "react";
import { useQueryStates } from "nuqs";
import { functionalUpdate } from "@tanstack/react-table";
import type { ColumnFiltersState, OnChangeFn, PaginationState, SortingState } from "@tanstack/react-table";
import { dataTableSearchParams, type DataTableSearchParamsOptions } from "@/components/data-table/data-table-search-params";

export function useDataTableQueryState(options: DataTableSearchParamsOptions = {}) {
  // nuqs wraps its non-shallow navigation in startTransition internally, which is exactly
  // why filter/sort/page changes don't flash the route's loading.tsx on every click (React
  // keeps already-rendered content visible during a transition instead of re-suspending).
  // Supplying our own startTransition (nuqs's documented hook for this) surfaces that same
  // transition's pending state back to us, so DataTable can show a lighter-weight "updating"
  // treatment instead of nothing at all.
  const [isPending, startTransition] = useTransition();

  // shallow: false is required — nuqs defaults to shallow (client-only) URL updates, which
  // never re-runs the Server Component that actually calls listX({page, filters, ...}).
  // Without this, the URL bar updates and looks like it worked, but the table's data never
  // changes: sorting, filtering, and pagination all silently no-op.
  const [urlState, setUrlState] = useQueryStates(dataTableSearchParams(options), {
    clearOnDefault: true,
    shallow: false,
    startTransition,
  });

  const sorting = useMemo<SortingState>(
    () => (urlState.sortBy ? [{ id: urlState.sortBy, desc: urlState.sortDir === "desc" }] : []),
    [urlState.sortBy, urlState.sortDir]
  );

  const columnFilters = useMemo<ColumnFiltersState>(
    () => Object.entries(urlState.filters).map(([id, value]) => ({ id, value })),
    [urlState.filters]
  );

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: Math.max(urlState.page - 1, 0), pageSize: urlState.pageSize }),
    [urlState.page, urlState.pageSize]
  );

  const onSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const next = functionalUpdate(updater, sorting);
      const [first] = next;
      void setUrlState({
        sortBy: first?.id ?? null,
        sortDir: first ? (first.desc ? "desc" : "asc") : null,
        page: 1,
      });
    },
    [sorting, setUrlState]
  );

  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = useCallback(
    (updater) => {
      const next = functionalUpdate(updater, columnFilters);
      const nextFilters = Object.fromEntries(
        next
          .filter((filter) => filter.value !== undefined && filter.value !== "")
          .map((filter) => [filter.id, String(filter.value)])
      );
      void setUrlState({ filters: Object.keys(nextFilters).length ? nextFilters : null, page: 1 });
    },
    [columnFilters, setUrlState]
  );

  const onPaginationChange: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      const next = functionalUpdate(updater, pagination);
      void setUrlState({ page: next.pageIndex + 1, pageSize: next.pageSize });
    },
    [pagination, setUrlState]
  );

  return {
    state: { sorting, columnFilters, pagination },
    onSortingChange,
    onColumnFiltersChange,
    onPaginationChange,
    isPending,
  };
}

export type DataTableQueryState = ReturnType<typeof useDataTableQueryState>;
