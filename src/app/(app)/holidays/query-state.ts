import type { DataTableSearchParamsOptions } from "@/components/data-table/data-table-search-params";

// Shared by holidays/page.tsx (server-side load) and holidays-board.tsx (client hook) — both
// have to agree on the defaults, same reasoning as every other lookup's query-state.ts.
export const HOLIDAYS_QUERY_STATE: DataTableSearchParamsOptions = {
  defaultPageSize: 10,
  defaultSort: { id: "holiday_date", desc: false },
};
