"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Column } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { dataTableFeatures } from "@/components/data-table/table-features";

interface DataTableColumnHeaderProps<TData extends Record<string, unknown>, TValue> {
  column: Column<typeof dataTableFeatures, TData, TValue>;
  title: string;
  className?: string;
  /** Wraps the title onto up to 3 lines instead of truncating to one. Pass this for a table
   *  rendered with <DataTable enableColumnResizing> (currently only Tasks) — a manually-shrunk
   *  column needs its label to stay legible rather than clip to an ellipsis; the parent
   *  <TableHead> already sets whitespace-normal, but this component's own `truncate` classes
   *  would otherwise win over that for every sortable/titled column using it. */
  wrap?: boolean;
}

export const DataTableColumnHeader = <TData extends Record<string, unknown>, TValue = unknown>({
  column,
  title,
  className,
  wrap = false,
}: DataTableColumnHeaderProps<TData, TValue>) => {
  const titleClassName = wrap ? "line-clamp-3 text-left whitespace-normal" : "truncate";

  if (!column.getCanSort()) {
    return <span className={cn("block text-sm font-medium text-foreground", titleClassName, className)}>{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={column.getToggleSortingHandler()}
      className={cn(
        "-ml-2 max-w-full gap-1 px-2 text-sm font-medium text-foreground hover:bg-muted",
        wrap && "h-auto items-start py-1",
        className
      )}
    >
      {/* The sort arrow keeps its size; a title too long for the column either ellipsises
          (default) or wraps up to 3 lines (wrap) instead. */}
      <span className={titleClassName}>{title}</span>
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5 shrink-0 text-muted-foreground" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      )}
    </Button>
  );
};
