import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { taskStatusValues } from "@/app/(app)/tasks/schema";

type SupabaseClient = ReturnType<typeof createAdminClient>;
export type TaskGroupStatus = (typeof taskStatusValues)[number];

// An invalid `?status=` value is silently ignored (treated as "no filter"), same degrade-
// gracefully choice clampPageSize/decodeCursor make elsewhere in this API for a bad optional
// param — not worth a 400 over a read-only report filter.
export function parseTaskStatusFilter(raw: string | null): TaskGroupStatus | null {
  return raw && (taskStatusValues as readonly string[]).includes(raw) ? (raw as TaskGroupStatus) : null;
}

export interface TaskGroupFact {
  id: string;
  status: string;
  due_date: string | null;
  season: { id: string; season_code: string; season_name: string } | null;
  brand: { id: string; brand_code: string; brand_name: string } | null;
}

export interface TaskGroupFiltersInput {
  dateFrom: string | null;
  dateTo: string | null;
  crossSeasonId: string | null;
  crossBrandId: string | null;
  ownerTaskIds: string[] | null;
  status: TaskGroupStatus | null;
}

const FACT_SELECT = "id, status, due_date, season:seasons(id, season_code, season_name), brand:brands(id, brand_code, brand_name)";

// Same "page through, don't assume one request sees everything" shape as
// data/dashboard.ts's listTaskFacts — PostgREST caps a single response at 1000 rows, and both
// tasks-by-season and tasks-by-brand are whole-table aggregates, not one page of a grid.
const FACT_PAGE_SIZE = 1000;
const MAX_FACT_PAGES = 20;

// Shared fact-fetch behind both /reports/tasks-by-season and /reports/tasks-by-brand — same
// filtered task set, grouped two different ways by each endpoint's own route handler. Every
// filter here narrows the SOURCE rows before grouping; skipping the date range (as spec-planned
// dashboard-summary/task-summary readers may) returns every non-deleted task regardless of
// due_date, matching data/dashboard.ts's own season/brand/status tiles (which are NOT
// due-date-windowed, unlike its Completion Trend chart).
export async function fetchTaskGroupFacts(supabase: SupabaseClient, filters: TaskGroupFiltersInput): Promise<TaskGroupFact[]> {
  const rows: TaskGroupFact[] = [];

  for (let page = 0; page < MAX_FACT_PAGES; page++) {
    let query = supabase.from("tasks").select(FACT_SELECT).is("deleted_at", null);
    if (filters.dateFrom) query = query.gte("due_date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("due_date", filters.dateTo);
    if (filters.crossSeasonId) query = query.eq("season_id", filters.crossSeasonId);
    if (filters.crossBrandId) query = query.eq("brand_id", filters.crossBrandId);
    if (filters.ownerTaskIds) query = query.in("id", filters.ownerTaskIds);
    if (filters.status) query = query.eq("status", filters.status);

    const from = page * FACT_PAGE_SIZE;
    // Stable order across pages — without it PostgREST is free to return overlapping or
    // missing rows between ranges, silently skewing every count below (same reasoning
    // data/dashboard.ts's own listTaskFacts gives for the same .order("id")).
    const { data, error } = await query.order("id", { ascending: true }).range(from, from + FACT_PAGE_SIZE - 1);
    if (error) throw error;

    rows.push(...((data ?? []) as unknown as TaskGroupFact[]));
    if (!data || data.length < FACT_PAGE_SIZE) break;
  }

  return rows;
}

export interface GroupCounts {
  task_count: number;
  completed_count: number;
  in_progress_count: number;
  overdue_count: number;
  completion_rate: number;
}

export function emptyGroupCounts(): GroupCounts {
  return { task_count: 0, completed_count: 0, in_progress_count: 0, overdue_count: 0, completion_rate: 0 };
}

// `overdue_count` inherits the same known gap as /reports/overdue-tasks: it trusts the stored
// `status = 'overdue'` value rather than deriving it live from due_date, because nothing in
// this codebase auto-stamps that status yet (things-to-know.md's Tasks section). Consistent
// with data/dashboard.ts's own status tiles, which make the same trade for the same reason.
export function countInto(counts: GroupCounts, status: string) {
  counts.task_count++;
  if (status === "completed") counts.completed_count++;
  else if (status === "in_progress") counts.in_progress_count++;
  else if (status === "overdue") counts.overdue_count++;
}

export function finalizeCompletionRate(counts: GroupCounts) {
  counts.completion_rate = counts.task_count > 0 ? Math.round((counts.completed_count / counts.task_count) * 1000) / 10 : 0;
}
