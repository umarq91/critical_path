import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSeasonIdByCode, resolveBrandIdByCode } from "@/lib/integration/lookup-codes";
import { resolveTaskIdsForOwnerName, resolveOwnerNames } from "@/lib/integration/task-owners";
import { fetchTaskGroupFacts, type TaskGroupStatus } from "@/lib/integration/task-group-facts";

export interface TaskSummaryParams {
  dateFrom: string | null;
  dateTo: string | null;
  seasonCode: string | null;
  brandCode: string | null;
  ownerName: string | null;
  status: TaskGroupStatus | null;
}

export interface TaskSummaryTotals {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface SeasonCount {
  season_code: string;
  count: number;
  percent: number;
}

export interface BrandCount {
  brand_name: string;
  count: number;
  percent: number;
}

export interface OwnerCount {
  owner_name: string;
  count: number;
  percent: number;
}

export interface TaskSummaryResult {
  totals: TaskSummaryTotals;
  byStatus: StatusCount[];
  bySeason: SeasonCount[];
  byBrand: BrandCount[];
  byOwner: OwnerCount[];
}

function emptyResult(): TaskSummaryResult {
  return {
    totals: { total_tasks: 0, completed_tasks: 0, in_progress_tasks: 0, overdue_tasks: 0 },
    byStatus: [],
    bySeason: [],
    byBrand: [],
    byOwner: [],
  };
}

function percentOf(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

// Backs GET /integration/v1/reports/task-summary. Same non-paginated single-object shape as
// /dashboard-summary and the same fetchTaskGroupFacts whole-table fetch the tasks-by-* reports
// use, plus a fourth breakdown, by_owner, none of those have. `overdue_tasks` carries the same
// trusted-stored-status gap as every other aggregate in this API; `by_brand` under-counts
// against `totals.total_tasks` for the same reason /reports/tasks-by-brand does
// (tasks.brand_id is nullable). Unlike /dashboard-summary's `owner_id` (a profiles.id only),
// this endpoint's `owner_name` is the spec's OTHER owner filter shape — department or person,
// matched by display name via the same lib/integration/task-owners.ts helper
// /reports/overdue-tasks and the tasks-by-* reports already use.
export async function getTaskSummaryForIntegration({
  dateFrom,
  dateTo,
  seasonCode,
  brandCode,
  ownerName,
  status,
}: TaskSummaryParams): Promise<TaskSummaryResult> {
  const supabase = createAdminClient();

  let crossSeasonId: string | null = null;
  if (seasonCode) {
    crossSeasonId = await resolveSeasonIdByCode(supabase, seasonCode);
    if (!crossSeasonId) return emptyResult();
  }

  let crossBrandId: string | null = null;
  if (brandCode) {
    crossBrandId = await resolveBrandIdByCode(supabase, brandCode);
    if (!crossBrandId) return emptyResult();
  }

  let ownerTaskIds: string[] | null = null;
  if (ownerName) {
    ownerTaskIds = await resolveTaskIdsForOwnerName(supabase, ownerName);
    if (ownerTaskIds === null || ownerTaskIds.length === 0) return emptyResult();
  }

  const facts = await fetchTaskGroupFacts(supabase, { dateFrom, dateTo, crossSeasonId, crossBrandId, ownerTaskIds, status });

  const result = emptyResult();
  const statusCounts = new Map<string, number>();
  const seasonCounts = new Map<string, { season_code: string; count: number }>();
  const brandCounts = new Map<string, { brand_name: string; count: number }>();

  for (const fact of facts) {
    result.totals.total_tasks++;
    if (fact.status === "completed") result.totals.completed_tasks++;
    else if (fact.status === "in_progress") result.totals.in_progress_tasks++;
    else if (fact.status === "overdue") result.totals.overdue_tasks++;

    statusCounts.set(fact.status, (statusCounts.get(fact.status) ?? 0) + 1);

    if (fact.season) {
      const entry = seasonCounts.get(fact.season.id) ?? { season_code: fact.season.season_code, count: 0 };
      entry.count++;
      seasonCounts.set(fact.season.id, entry);
    }
    if (fact.brand) {
      const entry = brandCounts.get(fact.brand.id) ?? { brand_name: fact.brand.brand_name, count: 0 };
      entry.count++;
      brandCounts.set(fact.brand.id, entry);
    }
  }

  // by_owner groups on the exact same joined owner_name string /reports/overdue-tasks and
  // /calendar-events already surface per task (departments first, then people, alphabetical,
  // comma-joined for multi-owner tasks) — consistent with how "owner_name" reads everywhere
  // else in this API, rather than splitting a joint "Product Development, Vendor" ownership
  // into two separate buckets. A task with no owner participant at all is skipped, same
  // "omit rather than zero-fill" convention by_brand already applies for a task with no brand.
  const ownerNames = facts.length > 0 ? await resolveOwnerNames(supabase, facts.map((fact) => fact.id)) : new Map<string, string>();
  const ownerCounts = new Map<string, number>();
  for (const fact of facts) {
    const name = ownerNames.get(fact.id);
    if (!name) continue;
    ownerCounts.set(name, (ownerCounts.get(name) ?? 0) + 1);
  }

  result.byStatus = [...statusCounts.entries()].map(([taskStatus, count]) => ({ status: taskStatus, count })).sort((a, b) => b.count - a.count);
  result.bySeason = [...seasonCounts.values()]
    .map((entry) => ({ ...entry, percent: percentOf(entry.count, result.totals.total_tasks) }))
    .sort((a, b) => b.count - a.count);
  result.byBrand = [...brandCounts.values()]
    .map((entry) => ({ ...entry, percent: percentOf(entry.count, result.totals.total_tasks) }))
    .sort((a, b) => b.count - a.count);
  result.byOwner = [...ownerCounts.entries()]
    .map(([owner_name, count]) => ({ owner_name, count, percent: percentOf(count, result.totals.total_tasks) }))
    .sort((a, b) => b.count - a.count);

  return result;
}
