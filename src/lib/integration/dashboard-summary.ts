import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSeasonIdByCode, resolveBrandIdByCode } from "@/lib/integration/lookup-codes";
import { resolveTaskIdsForOwnerProfileId } from "@/lib/integration/task-owners";
import { fetchTaskGroupFacts } from "@/lib/integration/task-group-facts";

export interface DashboardSummaryParams {
  seasonCode: string | null;
  brandCode: string | null;
  ownerId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface DashboardSummaryTotals {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
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

export interface DashboardSummaryResult {
  totals: DashboardSummaryTotals;
  byStatus: StatusCount[];
  bySeason: SeasonCount[];
  byBrand: BrandCount[];
}

function emptyResult(): DashboardSummaryResult {
  return {
    totals: { total_tasks: 0, completed_tasks: 0, in_progress_tasks: 0, overdue_tasks: 0, completion_rate: 0 },
    byStatus: [],
    bySeason: [],
    byBrand: [],
  };
}

function percentOf(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

// Backs GET /integration/v1/dashboard-summary. `overdue_tasks` carries the same known gap as
// every other aggregate in this API: it trusts the stored `tasks.status` column rather than
// deriving "overdue" live from `due_date` — no status-rollover cron exists yet (see
// things-to-know.md's Tasks section, "Is never overdue"), so this number is consistent with
// `/dashboard`'s own Overdue tile, not independently more accurate. `by_status`/`by_season`/
// `by_brand` only list groups that actually have at least one qualifying task (same convention
// as /reports/tasks-by-season and /reports/tasks-by-brand) — a status/season/brand with zero
// matches after filtering is omitted, not sent as a zeroed-out row. `by_brand` under-counts
// relative to `total_tasks` for the same reason /reports/tasks-by-brand does: `tasks.brand_id`
// is nullable, and a task with no brand contributes to no group there.
export async function getDashboardSummaryForIntegration({
  seasonCode,
  brandCode,
  ownerId,
  dateFrom,
  dateTo,
}: DashboardSummaryParams): Promise<DashboardSummaryResult> {
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
  if (ownerId) {
    ownerTaskIds = await resolveTaskIdsForOwnerProfileId(supabase, ownerId);
    if (ownerTaskIds.length === 0) return emptyResult();
  }

  const facts = await fetchTaskGroupFacts(supabase, {
    dateFrom,
    dateTo,
    crossSeasonId,
    crossBrandId,
    ownerTaskIds,
    status: null,
  });

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

  result.totals.completion_rate = percentOf(result.totals.completed_tasks, result.totals.total_tasks);

  result.byStatus = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
  result.bySeason = [...seasonCounts.values()]
    .map((entry) => ({ ...entry, percent: percentOf(entry.count, result.totals.total_tasks) }))
    .sort((a, b) => b.count - a.count);
  result.byBrand = [...brandCounts.values()]
    .map((entry) => ({ ...entry, percent: percentOf(entry.count, result.totals.total_tasks) }))
    .sort((a, b) => b.count - a.count);

  return result;
}
