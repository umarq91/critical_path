import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ListExternalLinksParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
}

const SORTABLE_COLUMNS = new Set(["title", "created_at"]);

// Paginated server-side like every other list in the app, even though the page shows no filter
// bar: the contract is what makes the shared <DataTable> work in manual mode, and a link list
// that grows past a page shouldn't start rendering in full.
export async function listExternalLinks({
  page = 1,
  pageSize = 15,
  sortBy,
  sortDir,
  filters = {},
}: ListExternalLinksParams = {}) {
  const supabase = await createClient();
  let query = supabase.from("external_links").select("*", { count: "exact" }).is("deleted_at", null);

  // No filter UI ships with this page, but the search param contract is shared — a link
  // arriving with ?filters={"title":"…"} still narrows rather than being silently ignored.
  if (filters.title) query = query.ilike("title", `%${filters.title}%`);

  // Title, not created_at: there is no sort_order column (see 0021), so alphabetical is the
  // only stable reading order this table can offer.
  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "title";
  query = query.order(orderColumn, { ascending: sortDir !== "desc" });

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  return { data: data ?? [], rowCount: count ?? 0 };
}

export type ExternalLink = Awaited<ReturnType<typeof listExternalLinks>>["data"][number];
