import type { DataTableSearchParamsOptions } from "@/components/data-table/data-table-search-params";

// Shared by external-links/page.tsx (server-side load) and external-links-board.tsx (client
// hook). Both have to agree on the defaults: nuqs omits values equal to them, so a mismatch
// means a link's params are read against a different baseline than the one that wrote them.
export const EXTERNAL_LINKS_QUERY_STATE: DataTableSearchParamsOptions = {
  defaultPageSize: 15,
  defaultSort: { id: "title", desc: false },
};
