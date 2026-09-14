import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeCursor, type IntegrationCursor } from "@/lib/integration/cursor";

type SupabaseClient = ReturnType<typeof createAdminClient>;

export interface ListTeamsForIntegrationParams {
  pageSize: number;
  cursor: IntegrationCursor | null;
  updatedSince: string | null;
  includeDeleted: boolean;
}

const TEAM_SELECT = "id, name, updated_at, deleted_at";

export interface IntegrationTeamRow {
  id: string;
  name: string;
  updated_at: string;
  deleted_at: string | null;
  member_count: number;
  active_tasks_count: number;
  completed_tasks_count: number;
}

// Backs GET /integration/v1/teams — "team" in the spec means `departments` here, same mapping
// things-to-know.md's Departments section already uses for the admin Teams page. Unlike
// seasons/brands/users, three of the spec's fields (member_count, active_tasks_count,
// completed_tasks_count) are real, computable data — not a missing column, so they're NOT sent
// as null the way `version` is. See countMembers/countTaskStatusesByDepartment below for how.
export async function listTeamsForIntegration({
  pageSize,
  cursor,
  updatedSince,
  includeDeleted,
}: ListTeamsForIntegrationParams): Promise<{ rows: IntegrationTeamRow[]; nextCursor: string | null }> {
  const supabase = createAdminClient();

  let query = supabase.from("departments").select(TEAM_SELECT);
  if (!includeDeleted) query = query.is("deleted_at", null);
  if (updatedSince) query = query.gte("updated_at", updatedSince);

  // Keyset pagination — see lib/integration/cursor.ts for why (updated_at, id) and why the
  // cursor is validated before it ever reaches this string.
  if (cursor) {
    query = query.or(`updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(pageSize + 1);
  if (error) throw error;

  const rows = (data ?? []) as { id: string; name: string; updated_at: string; deleted_at: string | null }[];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ updatedAt: last.updated_at, id: last.id }) : null;

  const departmentIds = page.map((row) => row.id);
  const [memberCounts, taskCounts] = await Promise.all([
    countMembers(supabase, departmentIds),
    countTaskStatusesByDepartment(supabase, departmentIds),
  ]);

  const enriched = page.map((row) => ({
    ...row,
    member_count: memberCounts.get(row.id) ?? 0,
    active_tasks_count: taskCounts.get(row.id)?.active ?? 0,
    completed_tasks_count: taskCounts.get(row.id)?.completed ?? 0,
  }));

  return { rows: enriched, nextCursor };
}

// Same shape and same reasoning as data/departments.ts's own countMembersFor: PostgREST can't
// return a grouped count alongside the page's rows, and a per-department `head: true` count
// would be one round trip per row. One request selecting `department_id` for just this page's
// ids, tallied in memory — scoped to the page, not the whole `profiles` table.
async function countMembers(supabase: SupabaseClient, departmentIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (departmentIds.length === 0) return counts;

  const { data, error } = await supabase.from("profiles").select("department_id").in("department_id", departmentIds);
  if (error) throw error;

  for (const row of data ?? []) {
    if (!row.department_id) continue;
    counts.set(row.department_id, (counts.get(row.department_id) ?? 0) + 1);
  }
  return counts;
}

// A department can be both `owner` and `involved` on the same task (two task_participants
// rows), so this counts DISTINCT tasks per department, not participant rows — one department
// with two roles on one task must not count that task twice. "Active" = not completed
// (not_started/in_progress/overdue combined, since the spec only wants two buckets, not four);
// "completed" = status = 'completed', same check `data/dashboard.ts` uses everywhere else in
// this app. Soft-deleted tasks are excluded, matching every other view of task counts.
async function countTaskStatusesByDepartment(
  supabase: SupabaseClient,
  departmentIds: string[]
): Promise<Map<string, { active: number; completed: number }>> {
  const counts = new Map<string, { active: number; completed: number }>();
  if (departmentIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("task_participants")
    .select("department_id, task_id, task:tasks(status, deleted_at)")
    .in("department_id", departmentIds);
  if (error) throw error;

  const seenTasks = new Set<string>();
  for (const row of (data ?? []) as { department_id: string | null; task_id: string; task: { status: string; deleted_at: string | null } | null }[]) {
    if (!row.department_id || !row.task || row.task.deleted_at) continue;

    const dedupeKey = `${row.department_id}:${row.task_id}`;
    if (seenTasks.has(dedupeKey)) continue;
    seenTasks.add(dedupeKey);

    const bucket = counts.get(row.department_id) ?? { active: 0, completed: 0 };
    if (row.task.status === "completed") bucket.completed++;
    else bucket.active++;
    counts.set(row.department_id, bucket);
  }
  return counts;
}
