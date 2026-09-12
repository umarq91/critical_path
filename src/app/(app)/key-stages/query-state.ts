import type { DataTableSearchParamsOptions } from "@/components/data-table/data-table-search-params";

// Shared by key-stages/page.tsx (server-side load), key-stages-board.tsx (client hook) and
// key-stages-export-button.tsx (reads the board's current filters/sort to scope the export).
// All three have to agree on the defaults: nuqs omits values equal to them, so a mismatch
// means a link's params are read against a different baseline than the one that wrote them.
export const KEY_STAGES_QUERY_STATE: DataTableSearchParamsOptions = {
  defaultPageSize: 15,
  defaultSort: { id: "name", desc: false },
};
