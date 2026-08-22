"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactTable } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { dataTableFeatures } from "@/components/data-table/table-features";

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [...new Set([1, 2, total - 1, total, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  pages.forEach((page, index) => {
    const prev = pages[index - 1];
    if (prev !== undefined) {
      if (page - prev === 2) result.push(prev + 1);
      else if (page - prev > 2) result.push("ellipsis");
    }
    result.push(page);
  });
  return result;
}

interface DataTablePaginationProps<TData extends Record<string, unknown>> {
  table: ReactTable<typeof dataTableFeatures, TData>;
  totalLabel: string;
  pageSizeOptions?: number[];
}

export const DataTablePagination = <TData extends Record<string, unknown>>({
  table,
  totalLabel,
  pageSizeOptions = [10, 15, 25, 50, 100],
}: DataTablePaginationProps<TData>) => {
  const { pageIndex, pageSize } = table.state.pagination;
  const totalRows = table.getRowCount();
  const pageCount = Math.max(table.getPageCount(), 1);
  const currentPage = pageIndex + 1;
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Showing {from} to {to} of {totalRows} {totalLabel}
      </p>
      <div className="flex items-center gap-3">
        <Select value={String(pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}>
          <SelectTrigger>
            {/* children render-fn resolves the label ourselves instead of relying on
                SelectItem registration timing — see select-field.tsx for the same fix;
                without it this briefly prints the raw value ("10") instead of "10 / page". */}
            <SelectValue>{(value: string) => `${value} / page`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft />
          </Button>
          {getPageNumbers(currentPage, pageCount).map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1.5 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={item}
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(item - 1)}
                className={cn(
                  item === currentPage && "border-ring bg-primary/10 text-primary"
                )}
              >
                {item}
              </Button>
            )
          )}
          <Button variant="outline" size="icon" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
};
