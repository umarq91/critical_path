import {
  columnFilteringFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_arrIncludesSome,
  filterFn_includesString,
  filterFn_weakEquals,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
} from "@tanstack/react-table";
import type { DataTableColumnWidth } from "@/components/data-table/column-widths";

export type DataTableFilterVariant = "text" | "select" | "date";

export interface DataTableFilterOption {
  label: string;
  value: string;
}

export interface DataTableColumnMeta {
  label?: string;
  filterVariant?: DataTableFilterVariant;
  filterOptions?: DataTableFilterOption[];
  filterPlaceholder?: string;
  align?: "left" | "center" | "right";
  /** Pins the column to the given edge during horizontal scroll (e.g. an Actions column). */
  sticky?: "left" | "right";
  /** Relative width weight for the column; defaults to "md". See column-widths.ts. */
  width?: DataTableColumnWidth;
}

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
    weakEquals: filterFn_weakEquals,
    arrIncludesSome: filterFn_arrIncludesSome,
  },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowSelectionFeature,
  columnVisibilityFeature,
  // Inert unless a table explicitly opts in via <DataTable enableColumnResizing> (currently
  // only tasks-board.tsx) — every other table keeps using column-widths.ts's weighted
  // percentage system and never calls getSize()/getResizeHandler(), so composing these features
  // here has no effect on them.
  columnResizingFeature,
  columnSizingFeature,
  columnMeta: metaHelper<DataTableColumnMeta>(),
});
