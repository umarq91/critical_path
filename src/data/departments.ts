import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ListDepartmentsParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
}

const SORTABLE_COLUMNS = new Set(["name", "created_at"]);

export async function listDepartments({
  page = 1,
  pageSize = 15,
  sortBy,
  sortDir,
  filters = {},
}: ListDepartmentsParams = {}) {
  const supabase = await createClient();
  let query = supabase.from("departments").select("*", { count: "exact" }).is("deleted_at", null);

  if (filters.name) query = query.ilike("name", `%${filters.name}%`);

  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "name";
  query = query.order(orderColumn, { ascending: sortDir !== "desc" });

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  return { data: data ?? [], rowCount: count ?? 0 };
}

export type Department = Awaited<ReturnType<typeof listDepartments>>["data"][number];

// Options for pickers that link another entity to a department (task form/filters, and any
// future user-facing department picker) — id/name only, every non-deleted department.
export async function listDepartmentOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
