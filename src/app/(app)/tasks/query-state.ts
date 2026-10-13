import type { DataTableSearchParamsOptions } from "@/components/data-table/data-table-search-params";
import { DEFAULT_TASK_PAGE_SIZE } from "@/constants/task-page-size";

// Shared by tasks/page.tsx (server-side load), tasks-board.tsx (client hook) and any link that
// arrives at /tasks pre-filtered. All three have to agree on the defaults: nuqs omits values
// equal to them, so a mismatch means a link's params are read against a different baseline than
// the one that wrote them.
export const TASKS_QUERY_STATE: DataTableSearchParamsOptions = {
  defaultPageSize: DEFAULT_TASK_PAGE_SIZE,
  defaultSort: { id: "due_date", desc: false },
  // Client request: the grid opens on today-onwards work. Clearing the Due filter shows all.
  defaultFilters: { due_week: "today_onwards" },
};
