"use client";

import type { ReactNode } from "react";
import { RotateCcw, Settings2 } from "lucide-react";
import type { ReactTable } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { dataTableFeatures, DataTableColumnMeta, DataTableFilterOption } from "@/components/data-table/table-features";

export interface DataTableToolbarFilter {
  columnId: string;
  title: string;
  options: DataTableFilterOption[];
  /** Trigger placeholder when no value is selected. Defaults to `All {title}`. */
  placeholder?: string;
}

export interface DataTableToolbarSortOption {
  columnId: string;
  desc: boolean;
  label: string;
}

export interface DataTableToolbarConfig {
  filters?: DataTableToolbarFilter[];
  /** Filter key the search box writes. Usually a column id, and in local (client-filtered)
   *  mode it must be one. A server-paginated table runs `manualFiltering`, so the key is just
   *  a name in the URL's `filters` object that its data/*.ts function interprets — which is how
   *  the tasks grid searches across relations (`"search"`) rather than one column. */
  searchColumnId?: string;
  searchPlaceholder?: string;
  /** A labeled alternative to clicking column headers — same sorting state either way. */
  sortOptions?: DataTableToolbarSortOption[];
  actions?: ReactNode;
  enableColumnVisibility?: boolean;
  /** Defaults to on only once a search value or a filter is actually applied. */
  enableResetFilters?: boolean;
}

function encodeSortValue(option: DataTableToolbarSortOption) {
  return `${option.columnId}:${option.desc ? "desc" : "asc"}`;
}

interface DataTableToolbarProps<TData extends Record<string, unknown>> extends DataTableToolbarConfig {
  table: ReactTable<typeof dataTableFeatures, TData>;
}

const ALL_VALUE = "__all__";

export const DataTableToolbar = <TData extends Record<string, unknown>>({
  table,
  filters,
  searchColumnId,
  searchPlaceholder,
  sortOptions,
  actions,
  enableColumnVisibility = false,
  enableResetFilters,
}: DataTableToolbarProps<TData>) => {
  // Read and written through columnFilters state rather than table.getColumn(), so the key
  // does not have to name a real column — see searchColumnId's note above.
  const columnFilters = table.options.state?.columnFilters ?? [];
  const searchValue = searchColumnId
    ? ((columnFilters.find((filter) => filter.id === searchColumnId)?.value as string | undefined) ?? "")
    : "";
  const setSearchValue = (next: string) => {
    if (!searchColumnId) return;
    table.setColumnFilters([
      ...columnFilters.filter((filter) => filter.id !== searchColumnId),
      ...(next ? [{ id: searchColumnId, value: next }] : []),
    ]);
  };
  const hasSearchValue = !!searchValue;
  const hasFilterValue = !!filters?.some((filter) => table.getColumn(filter.columnId)?.getFilterValue() !== undefined);
  const showResetFilters = enableResetFilters ?? (hasSearchValue || hasFilterValue);

  const currentSort = table.options.state?.sorting?.[0];
  const currentSortValue = currentSort
    ? sortOptions?.find((option) => option.columnId === currentSort.id && option.desc === currentSort.desc)
    : undefined;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {searchColumnId ? (
        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder={searchPlaceholder ?? "Search..."}
          className="h-10 w-64"
        />
      ) : null}
      {filters?.map((filter) => {
        const column = table.getColumn(filter.columnId);
        if (!column) return null;
        // Always defined (never undefined) — a Select's controlled/uncontrolled nature is
        // fixed on first render, so flipping value between undefined and a real string
        // across renders trips Base UI's controlled-state warning. The `children` render-fn
        // on SelectValue (not the `placeholder` prop) supplies the "All X" label instead,
        // since relying on SelectItem registration for that label is what caused the
        // earlier "__all__" flash — this renders it ourselves regardless of registry timing.
        const value = (column.getFilterValue() as string | undefined) ?? ALL_VALUE;
        const allLabel = filter.placeholder ?? `All ${filter.title}`;

        return (
          <Select
            key={filter.columnId}
            value={value}
            onValueChange={(next) => column.setFilterValue(next === ALL_VALUE ? undefined : next)}
          >
            <SelectTrigger className="h-10">
              <SelectValue>
                {(current: string) =>
                  current === ALL_VALUE ? allLabel : (filter.options.find((option) => option.value === current)?.label ?? current)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
      {sortOptions?.length ? (
        <Select
          value={currentSortValue ? encodeSortValue(currentSortValue) : ""}
          onValueChange={(next) => {
            const option = sortOptions.find((candidate) => encodeSortValue(candidate) === next);
            if (option) table.setSorting([{ id: option.columnId, desc: option.desc }]);
          }}
        >
          <SelectTrigger className="h-10">
            <SelectValue>
              {(current: string) =>
                (current ? sortOptions.find((option) => encodeSortValue(option) === current)?.label : undefined) ??
                "Sort by"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={encodeSortValue(option)} value={encodeSortValue(option)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {actions}
      {showResetFilters ? (
        <Button variant="link" className="px-1 text-primary" onClick={() => table.resetColumnFilters()}>
          <RotateCcw />
          Reset Filters
        </Button>
      ) : null}
      {enableColumnVisibility ? (
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }))}>
            <Settings2 />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                const meta = column.columnDef.meta as DataTableColumnMeta | undefined;
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
                  >
                    {meta?.label ?? column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
};
