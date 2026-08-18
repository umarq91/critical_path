import "server-only";
import { createClient } from "@/lib/supabase/server";
import { taskGenderValues, taskStatusValues, type TaskInput } from "@/app/(app)/tasks/schema";

export interface ListTasksParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
}

const SORTABLE_COLUMNS = new Set(["task_name", "due_date", "status", "created_at"]);

function isTaskGender(value: string | undefined): value is TaskInput["gender"] {
  return !!value && (taskGenderValues as readonly string[]).includes(value);
}

function isTaskStatus(value: string | undefined): value is TaskInput["status"] {
  return !!value && (taskStatusValues as readonly string[]).includes(value);
}

// The ONE query function behind the task grid, and every future view-specific list (Gantt
// range, calendar range, dashboard aggregates, CSV export) — those extend this, not fork it.
export async function listTasks({ page = 1, pageSize = 15, sortBy, sortDir, filters = {} }: ListTasksParams = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(
      `*, season:seasons(id, season_code, season_name, color), brand:brands(id, brand_name), assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url), created_by_profile:profiles!tasks_created_by_fkey(id, full_name, email, avatar_url), last_edited_by_profile:profiles!tasks_last_edited_by_fkey(id, full_name, email, avatar_url)`,
      { count: "exact" }
    )
    .is("deleted_at", null);

  if (filters.task_name) query = query.ilike("task_name", `%${filters.task_name}%`);
  if (filters.season_id) query = query.eq("season_id", filters.season_id);
  if (filters.brand_id) query = query.eq("brand_id", filters.brand_id);
  if (isTaskGender(filters.gender)) query = query.eq("gender", filters.gender);
  if (isTaskStatus(filters.status)) query = query.eq("status", filters.status);
  if (filters.assignee_id) query = query.eq("assignee_id", filters.assignee_id);

  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "due_date";
  query = query.order(orderColumn, { ascending: sortDir !== "desc" });

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  return { data: data ?? [], rowCount: count ?? 0 };
}

export type Task = Awaited<ReturnType<typeof listTasks>>["data"][number];
