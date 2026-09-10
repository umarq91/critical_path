"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { FlexRender, useTable } from "@tanstack/react-table";
import type {
  ColumnDef,
  ColumnFiltersState,
  ColumnVisibilityState,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { RefreshButton } from "@/components/shared/refresh-button";
import { DataTableToolbar, type DataTableToolbarConfig } from "@/components/data-table/data-table-toolbar";
import { DataTableFilterRow } from "@/components/data-table/data-table-filter-row";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { dataTableFeatures, type DataTableColumnMeta } from "@/components/data-table/table-features";
import { getStickyCellClassName } from "@/components/data-table/sticky-column";
import { columnWidthPx } from "@/components/data-table/column-widths";
import { showTitleWhenTruncated } from "@/components/data-table/truncation-title";
import { useTableScrollEdges } from "@/components/data-table/use-table-scroll-edges";
import type { DataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { cn } from "@/lib/utils";

// Every body row carries an opaque background (`bg-card`, or an opaque tint from
// getRowClassName), so a sticky cell can just inherit it and stay in step with per-row
// colouring. Hover/selected live on the row, not the cell, so those are re-stated here.
const STICKY_BODY_BACKGROUND = "bg-inherit group-hover:bg-surface-hover group-data-[state=selected]:bg-muted";

function createSelectionColumn<TData extends Record<string, unknown>>(): ColumnDef<
  typeof dataTableFeatures,
  TData,
  unknown
> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(!!checked)}
        onClick={(event) => event.stopPropagation()}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    enableColumnFilter: false,
    meta: { label: "Select", width: "icon" },
  };
}

interface DataTableProps<TData extends Record<string, unknown>> {
  // `any` here (not `unknown`) is deliberate: v9's ColumnDef is contravariant in TValue through
  // `cell`/`footer`/`accessorFn`, so a single fixed TValue can never accept a heterogeneous
  // columns array — every real per-column TValue must independently narrow past this boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<typeof dataTableFeatures, TData, any>[];
  data: TData[];
  getRowId?: (row: TData, index: number) => string;
  enableRowSelection?: boolean;
  onRowClick?: (row: TData) => void;
  getRowClassName?: (row: TData) => string | undefined;
  emptyState?: ReactNode;
  toolbar?: DataTableToolbarConfig;
  enableColumnFilterRow?: boolean;
  paginationLabel?: string;
  pageSizeOptions?: number[];
  queryState?: DataTableQueryState;
  rowCount?: number;
  /** Isolated "Refresh" icon next to the toolbar — re-fetches just this table's data. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const DataTable = <TData extends Record<string, unknown>>({
  columns,
  data,
  getRowId,
  enableRowSelection = false,
  onRowClick,
  getRowClassName,
  emptyState,
  toolbar,
  enableColumnFilterRow,
  paginationLabel = "results",
  pageSizeOptions,
  queryState,
  rowCount,
  onRefresh,
  isRefreshing,
}: DataTableProps<TData>) => {
  const [localSorting, setLocalSorting] = useState<SortingState>([]);
  const [localColumnFilters, setLocalColumnFilters] = useState<ColumnFiltersState>([]);
  const [localPagination, setLocalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSizeOptions?.[0] ?? 10,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});

  const tableColumns = useMemo(() => {
    if (!enableRowSelection) return columns;
    return [createSelectionColumn<TData>(), ...columns];
  }, [columns, enableRowSelection]);

  const table = useTable({
    features: dataTableFeatures,
    columns: tableColumns,
    data,
    getRowId,
    enableRowSelection,
    state: {
      rowSelection,
      columnVisibility,
      ...(queryState
        ? queryState.state
        : { sorting: localSorting, columnFilters: localColumnFilters, pagination: localPagination }),
    },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    ...(queryState
      ? {
          onSortingChange: queryState.onSortingChange,
          onColumnFiltersChange: queryState.onColumnFiltersChange,
          onPaginationChange: queryState.onPaginationChange,
          manualSorting: true,
          manualFiltering: true,
          manualPagination: true,
          rowCount,
        }
      : {
          onSortingChange: setLocalSorting,
          onColumnFiltersChange: setLocalColumnFilters,
          onPaginationChange: setLocalPagination,
        }),
  });

  const showFilterRow =
    enableColumnFilterRow ??
    tableColumns.some((column) => (column.meta as DataTableColumnMeta | undefined)?.filterVariant);
  const rows = table.getRowModel().rows;
  // Nothing to paginate when everything already fits on one page — a lone "1" button and
  // a page-size select add noise, not utility.
  const showPagination = table.getPageCount() > 1;
  // True while a filter/sort/page change's server round trip is in flight — nuqs wraps that
  // navigation in a transition, so the old rows stay mounted (no loading.tsx flash); this is
  // the lighter-weight "something's updating" treatment for that window instead of nothing.
  const isPending = queryState?.isPending ?? false;
  const isBusy = isPending || !!isRefreshing;
  const [scrollRef, scrollEdges] = useTableScrollEdges<HTMLDivElement>();
  // Widths are declared once, on <col>, rather than repeated on every header and body cell.
  const visibleColumns = table.getVisibleLeafColumns();
  const columnWidths = visibleColumns.map((column) =>
    columnWidthPx((column.columnDef.meta as DataTableColumnMeta | undefined)?.width)
  );
  const tableMinWidth = columnWidths.reduce((total, width) => total + width, 0);

  return (
    <Card className="gap-5 py-6">
      {toolbar || onRefresh ? (
        <div className="flex items-center justify-between gap-3 px-6">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {toolbar ? <DataTableToolbar table={table} {...toolbar} /> : null}
          </div>
          {onRefresh ? <RefreshButton onRefresh={onRefresh} isRefreshing={!!isRefreshing} /> : null}
        </div>
      ) : null}
      <div ref={scrollRef} className="relative">
        <Table
          className={cn("table-fixed transition-opacity", isBusy && "pointer-events-none opacity-50")}
          style={{ minWidth: tableMinWidth }}
        >
          <colgroup>
            {visibleColumns.map((column, index) => (
              <col key={column.id} style={{ width: columnWidths[index] }} />
            ))}
          </colgroup>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-surface-header hover:bg-surface-header">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "truncate px-4 py-3.5",
                      getStickyCellClassName(
                        header.column.columnDef.meta as DataTableColumnMeta | undefined,
                        "bg-surface-header",
                        scrollEdges
                      )
                    )}
                    onMouseEnter={showTitleWhenTruncated}
                  >
                    {header.isPlaceholder ? null : <FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
            {showFilterRow ? <DataTableFilterRow table={table} scrollEdges={scrollEdges} /> : null}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={tableColumns.length} className="p-0">
                  {emptyState ?? <EmptyState title="No results" description="Nothing matches the current filters." />}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    "group bg-card",
                    onRowClick && "cursor-pointer",
                    getRowClassName?.(row.original)
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "truncate px-4 py-3.5",
                        getStickyCellClassName(
                          cell.column.columnDef.meta as DataTableColumnMeta | undefined,
                          STICKY_BODY_BACKGROUND,
                          scrollEdges
                        )
                      )}
                      onMouseEnter={showTitleWhenTruncated}
                    >
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {isBusy ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}
      </div>
      {showPagination ? (
        <div className="px-6">
          <DataTablePagination table={table} totalLabel={paginationLabel} pageSizeOptions={pageSizeOptions} />
        </div>
      ) : null}
    </Card>
  );
};
