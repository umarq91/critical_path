import type { DataTableSearchParamsOptions } from "@/components/data-table/data-table-search-params";

// Shared by seasons/page.tsx (server-side load), seasons-board.tsx (client hook) and
// seasons-export-button.tsx (reads the board's current filters/sort to scope the export).
// All three have to agree on the defaults: nuqs omits values equal to them, so a mismatch
// means a link's params are read against a different baseline than the one that wrote them.
export const SEASONS_QUERY_STATE: DataTableSearchParamsOptions = {
  defaultPageSize: 10,
  defaultSort: { id: "start_date", desc: false },
};
