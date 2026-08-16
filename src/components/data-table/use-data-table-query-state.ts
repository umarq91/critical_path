"use client";

import { useCallback, useMemo } from "react";
import { parseAsInteger, parseAsJson, parseAsString, useQueryStates } from "nuqs";
import { z } from "zod";
import { functionalUpdate } from "@tanstack/react-table";
import type { ColumnFiltersState, OnChangeFn, PaginationState, SortingState } from "@tanstack/react-table";

const filtersSchema = z.record(z.string(), z.string());

function parseFilters(value: unknown): Record<string, string> | null {
  const result = filtersSchema.safeParse(value);
  return result.success ? result.data : null;
}

export interface UseDataTableQueryStateOptions {
  defaultPageSize?: number;
  defaultSort?: { id: string; desc: boolean };
}

export function useDataTableQueryState({
  defaultPageSize = 10,
  defaultSort,
}: UseDataTableQueryStateOptions = {}) {
  const [urlState, setUrlState] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(defaultPageSize),
      sortBy: parseAsString.withDefault(defaultSort?.id ?? ""),
      sortDir: parseAsString.withDefault(defaultSort?.desc ? "desc" : "asc"),
      filters: parseAsJson(parseFilters).withDefault({}),
    },
    { clearOnDefault: true }
  );

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
  };
}

export type DataTableQueryState = ReturnType<typeof useDataTableQueryState>;
