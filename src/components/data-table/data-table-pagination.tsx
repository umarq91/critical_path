"use client";

import type { ReactTable } from "@tanstack/react-table";
import { PaginationControls } from "@/components/shared/pagination-controls";
import type { dataTableFeatures } from "@/components/data-table/table-features";

interface DataTablePaginationProps<TData extends Record<string, unknown>> {
  table: ReactTable<typeof dataTableFeatures, TData>;
  totalLabel: string;
  pageSizeOptions?: number[];
}

// A @tanstack adapter over <PaginationControls> — the table instance is the only thing this
// knows that the shared control doesn't.
export const DataTablePagination = <TData extends Record<string, unknown>>({
  table,
  totalLabel,
  pageSizeOptions,
}: DataTablePaginationProps<TData>) => {
  const { pageIndex, pageSize } = table.state.pagination;

  return (
    <PaginationControls
      page={pageIndex + 1}
      pageSize={pageSize}
      rowCount={table.getRowCount()}
      totalLabel={totalLabel}
      onPageChange={(page) => table.setPageIndex(page - 1)}
      onPageSizeChange={(size) => table.setPageSize(size)}
      pageSizeOptions={pageSizeOptions}
    />
  );
};
