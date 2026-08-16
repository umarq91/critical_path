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
}

export const DataTableColumnHeader = <TData extends Record<string, unknown>, TValue = unknown>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) => {
  if (!column.getCanSort()) {
    return <span className={cn("text-sm font-medium text-foreground", className)}>{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={column.getToggleSortingHandler()}
      className={cn("-ml-2 gap-1 px-2 text-sm font-medium text-foreground hover:bg-muted", className)}
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5 text-muted-foreground" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5 text-muted-foreground" />
      ) : (
        <ArrowUpDown className="size-3.5 text-muted-foreground" />
      )}
    </Button>
  );
};
