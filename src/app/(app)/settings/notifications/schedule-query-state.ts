import type { DataTableSearchParamsOptions } from "@/components/data-table/data-table-search-params";

// Shared by page.tsx (server-side load) and scheduled-reminders-table.tsx (client hook) — both
// have to agree on the defaults, same reasoning as every other table's query-state.ts.
export const SCHEDULE_QUERY_STATE: DataTableSearchParamsOptions = {
  defaultPageSize: 10,
  defaultSort: { id: "due_date", desc: false },
};
