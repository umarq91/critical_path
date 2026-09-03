import "server-only";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

  const rows = data ?? [];
  const memberCounts = await countMembersFor(
    supabase,
    rows.map((row) => row.id)
  );

  return {
    data: rows.map((row) => ({ ...row, member_count: memberCounts.get(row.id) ?? 0 })),
    rowCount: count ?? 0,
  };
}

// Member counts for one page of departments, as its own narrow query. PostgREST can't return
// a grouped count alongside the rows, and a per-department `head: true` count would be one
// round trip per row — this is a single request selecting one column, tallied in memory.
// Scoped to the page's ids rather than the whole table, so it doesn't grow with the directory.
async function countMembersFor(supabase: SupabaseClient, departmentIds: string[]) {
  const counts = new Map<string, number>();
  if (departmentIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("profiles")
    .select("department_id")
    .in("department_id", departmentIds);
  if (error) throw error;

  for (const row of data ?? []) {
    if (!row.department_id) continue;
    counts.set(row.department_id, (counts.get(row.department_id) ?? 0) + 1);
  }
  return counts;
}

export type Department = Awaited<ReturnType<typeof listDepartments>>["data"][number];

// Everyone currently in a department. A profile carries a single `department_id` (0009), so
// this is a plain FK lookup, not a join table — and a person is in exactly one department at
// a time. Inactive members are included deliberately: they're still on the team, and hiding
// them would make the count on the list disagree with the dialog.
export async function listDepartmentMembers(departmentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role, status")
    .eq("department_id", departmentId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type DepartmentMember = Awaited<ReturnType<typeof listDepartmentMembers>>[number];

export interface DepartmentSummary {
  total: number;
  withMembers: number;
  unassignedUsers: number;
}

// Its own whole-table query — a stat card counts every department, not the page on screen.
export async function getDepartmentSummary(): Promise<DepartmentSummary> {
  const supabase = await createClient();

  const [departments, memberships, unassigned] = await Promise.all([
    supabase.from("departments").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("profiles").select("department_id").not("department_id", "is", null),
    supabase.from("profiles").select("id", { count: "exact", head: true }).is("department_id", null),
  ]);

  if (memberships.error) throw memberships.error;

  const populated = new Set((memberships.data ?? []).flatMap((row) => (row.department_id ? [row.department_id] : [])));

  return {
    total: departments.count ?? 0,
    withMembers: populated.size,
    unassignedUsers: unassigned.count ?? 0,
  };
}

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
