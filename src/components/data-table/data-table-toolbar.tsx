"use client";

import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";
import type { ReactTable } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
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

export interface DataTableToolbarConfig {
  filters?: DataTableToolbarFilter[];
  searchColumnId?: string;
  searchPlaceholder?: string;
  actions?: ReactNode;
  enableColumnVisibility?: boolean;
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
  actions,
  enableColumnVisibility = true,
}: DataTableToolbarProps<TData>) => {
  const searchColumn = searchColumnId ? table.getColumn(searchColumnId) : undefined;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {searchColumn ? (
        <Input
          value={(searchColumn.getFilterValue() as string | undefined) ?? ""}
          onChange={(event) => searchColumn.setFilterValue(event.target.value || undefined)}
          placeholder={searchPlaceholder ?? "Search..."}
          className="h-10 w-64"
        />
      ) : null}
      {filters?.map((filter) => {
        const column = table.getColumn(filter.columnId);
        if (!column) return null;
        // Deliberately left `undefined` (not defaulted to ALL_VALUE) when unset — Base UI's
        // SelectValue only resolves a value to a label via SelectItems that have actually
        // mounted, which doesn't happen until the popup opens once. A controlled value that
        // never matches a mounted item falls back to printing the raw string, so passing
        // ALL_VALUE by default would flash "__all__" on first render. Leaving it undefined
        // lets the placeholder prop handle the unset state instead.
        const value = column.getFilterValue() as string | undefined;

        return (
          <Select
            key={filter.columnId}
            value={value}
            onValueChange={(next) => column.setFilterValue(next === ALL_VALUE ? undefined : next)}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder={filter.placeholder ?? `All ${filter.title}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All {filter.title}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
      {actions}
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
