"use client";

import type { ReactTable } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import type { dataTableFeatures, DataTableColumnMeta } from "@/components/data-table/table-features";

const ALL_VALUE = "__all__";

interface DataTableFilterRowProps<TData extends Record<string, unknown>> {
  table: ReactTable<typeof dataTableFeatures, TData>;
}

export const DataTableFilterRow = <TData extends Record<string, unknown>>({
  table,
}: DataTableFilterRowProps<TData>) => {
  const headerGroups = table.getHeaderGroups();
  const leafHeaders = headerGroups[headerGroups.length - 1]?.headers ?? [];

  return (
    <TableRow className="hover:bg-transparent">
      {leafHeaders.map((header) => {
        const column = header.column;
        const meta = column.columnDef.meta as DataTableColumnMeta | undefined;
        const variant = meta?.filterVariant;

        if (header.isPlaceholder || !column.getCanFilter() || !variant) {
          return <TableCell key={header.id} className="py-1.5" />;
        }

        if (variant === "select") {
          const value = (column.getFilterValue() as string | undefined) ?? ALL_VALUE;
          return (
            <TableCell key={header.id} className="py-1.5">
              <Select
                value={value}
                onValueChange={(next) => column.setFilterValue(next === ALL_VALUE ? undefined : next)}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder={meta?.filterPlaceholder ?? "Select"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{meta?.filterPlaceholder ?? "All"}</SelectItem>
                  {meta?.filterOptions?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
          );
        }

        return (
          <TableCell key={header.id} className="py-1.5">
            <Input
              type={variant === "date" ? "date" : "text"}
              value={(column.getFilterValue() as string | undefined) ?? ""}
              onChange={(event) => column.setFilterValue(event.target.value || undefined)}
              placeholder={meta?.filterPlaceholder ?? "Search..."}
              className="h-8 w-full"
            />
          </TableCell>
        );
      })}
    </TableRow>
  );
};
