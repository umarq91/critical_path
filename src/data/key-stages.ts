import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ListKeyStagesParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
}

const SORTABLE_COLUMNS = new Set(["name", "created_at"]);

export async function listKeyStages({
  page = 1,
  pageSize = 15,
  sortBy,
  sortDir,
  filters = {},
}: ListKeyStagesParams = {}) {
  const supabase = await createClient();
  let query = supabase.from("key_stages").select("*", { count: "exact" }).is("deleted_at", null);

  if (filters.name) query = query.ilike("name", `%${filters.name}%`);

  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "name";
  query = query.order(orderColumn, { ascending: sortDir !== "desc" });

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  return { data: data ?? [], rowCount: count ?? 0 };
}

export type KeyStage = Awaited<ReturnType<typeof listKeyStages>>["data"][number];

// Options for pickers that link another entity to a key stage (e.g. the task form/filters) —
// id/name only, every non-deleted key stage.
export async function listKeyStageOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("key_stages")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
