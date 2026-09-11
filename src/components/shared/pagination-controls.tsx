"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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

interface PaginationControlsProps {
  /** 1-based. */
  page: number;
  pageSize: number;
  rowCount: number;
  /** Plural noun for the "of N" summary, e.g. "tasks". */
  totalLabel: string;
  onPageChange: (page: number) => void;
  /** Omit to hide the page-size selector — for a surface whose size isn't the user's to pick. */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

// The page numbers, ellipses, size selector and range summary, with no idea what it is paging.
// <DataTablePagination> adapts a @tanstack table onto it; the Timeline drives it from its own
// client-side slice. Neither owns a second copy of this layout.
export const PaginationControls = ({
  page,
  pageSize,
  rowCount,
  totalLabel,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 25, 50, 100],
  className,
}: PaginationControlsProps) => {
  const pageCount = Math.max(Math.ceil(rowCount / pageSize), 1);
  const from = rowCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, rowCount);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <p className="text-sm text-muted-foreground">
        Showing {from} to {to} of {rowCount} {totalLabel}
      </p>
      <div className="flex items-center gap-3">
        {onPageSizeChange ? (
          <Select
            value={String(pageSize)}
            onValueChange={(value: string | null) => value && onPageSizeChange(Number(value))}
          >
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
        ) : null}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft />
          </Button>
          {getPageNumbers(page, pageCount).map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1.5 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={item}
                variant="outline"
                size="icon"
                onClick={() => onPageChange(item)}
                className={cn(item === page && "border-ring bg-primary/10 text-primary")}
              >
                {item}
              </Button>
            )
          )}
          <Button variant="outline" size="icon" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
};
