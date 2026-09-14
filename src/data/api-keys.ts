import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ListApiKeysParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
}

const SORTABLE_COLUMNS = new Set(["name", "created_at", "last_used_at"]);

const API_KEY_SELECT =
  "id, name, key_prefix, status, created_at, revoked_at, last_used_at, created_by_profile:profiles!api_keys_created_by_fkey(id, full_name, email, avatar_url), revoked_by_profile:profiles!api_keys_revoked_by_fkey(id, full_name, email, avatar_url)";

// Backs /management/integrations. Small and admin-only (RLS in 0025_api_keys.sql already
// restricts every row to an admin caller), so unlike data/tasks.ts there's no filter/search
// vocabulary here yet — just the page/sort shape every DataTable-backed list is required to
// have, per CLAUDE.md's "never fetch-all-then-slice" rule.
export async function listApiKeys({ page = 1, pageSize = 15, sortBy, sortDir }: ListApiKeysParams = {}) {
  const supabase = await createClient();
  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "created_at";
  const from = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from("api_keys")
    .select(API_KEY_SELECT, { count: "exact" })
    .order(orderColumn, { ascending: sortDir === "asc" })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error) throw error;

  return { data: (data ?? []) as unknown as ApiKey[], rowCount: count ?? 0 };
}

// Type witness, never called — same reasoning as data/tasks.ts's taskSelectQuery.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function apiKeySelectQuery(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase.from("api_keys").select(API_KEY_SELECT);
}

export type ApiKey = NonNullable<Awaited<ReturnType<typeof apiKeySelectQuery>>["data"]>[number];
