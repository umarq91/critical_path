"use client";

import { useMemo, useState, type ReactNode } from "react";
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
import { DataTableToolbar, type DataTableToolbarConfig } from "@/components/data-table/data-table-toolbar";
import { DataTableFilterRow } from "@/components/data-table/data-table-filter-row";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { dataTableFeatures, type DataTableColumnMeta } from "@/components/data-table/table-features";
import type { DataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { cn } from "@/lib/utils";

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

  return (
    <Card className="gap-5 py-6">
      {toolbar ? (
        <div className="px-6">
          <DataTableToolbar table={table} {...toolbar} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="px-4 py-3.5">
                  {header.isPlaceholder ? null : <FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
          {showFilterRow ? <DataTableFilterRow table={table} /> : null}
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
                className={cn(onRowClick && "cursor-pointer", getRowClassName?.(row.original))}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-3.5">
                    <FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {showPagination ? (
        <div className="px-6">
          <DataTablePagination table={table} totalLabel={paginationLabel} pageSizeOptions={pageSizeOptions} />
        </div>
      ) : null}
    </Card>
  );
};
