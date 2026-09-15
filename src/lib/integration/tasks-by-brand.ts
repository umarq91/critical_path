import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSeasonIdByCode } from "@/lib/integration/lookup-codes";
import { resolveTaskIdsForOwnerName } from "@/lib/integration/task-owners";
import {
  fetchTaskGroupFacts,
  emptyGroupCounts,
  countInto,
  finalizeCompletionRate,
  type GroupCounts,
  type TaskGroupStatus,
} from "@/lib/integration/task-group-facts";

export interface ListTasksByBrandForIntegrationParams {
  dateFrom: string | null;
  dateTo: string | null;
  seasonCode: string | null;
  ownerName: string | null;
  status: TaskGroupStatus | null;
}

export interface IntegrationBrandGroupRow extends GroupCounts {
  brand_id: string;
  brand_code: string;
  brand_name: string;
}

// Backs GET /integration/v1/reports/tasks-by-brand — unlike season_id, `tasks.brand_id` is
// nullable (see supabase/schema.md: plenty of stage work like trend trips/range reviews isn't
// brand-specific), so a task with no brand contributes to no group here at all. That means
// summing every group's task_count will NOT equal the total task count for whatever
// date/status/owner filters were applied — there is no "unbranded" bucket in the spec to put
// those tasks in, same reasoning data/dashboard.ts's own byBrand breakdown already uses. Only
// brands with at least one matching task after filters are returned, sorted by task_count
// descending.
export async function listTasksByBrandForIntegration({
  dateFrom,
  dateTo,
  seasonCode,
  ownerName,
  status,
}: ListTasksByBrandForIntegrationParams): Promise<IntegrationBrandGroupRow[]> {
  const supabase = createAdminClient();

  let crossSeasonId: string | null = null;
  if (seasonCode) {
    crossSeasonId = await resolveSeasonIdByCode(supabase, seasonCode);
    if (!crossSeasonId) return [];
  }

  let ownerTaskIds: string[] | null = null;
  if (ownerName) {
    ownerTaskIds = await resolveTaskIdsForOwnerName(supabase, ownerName);
    if (ownerTaskIds === null || ownerTaskIds.length === 0) return [];
  }

  const facts = await fetchTaskGroupFacts(supabase, {
    dateFrom,
    dateTo,
    crossSeasonId,
    crossBrandId: null,
    ownerTaskIds,
    status,
  });

  const groups = new Map<string, IntegrationBrandGroupRow>();
  for (const fact of facts) {
    if (!fact.brand) continue;
    const group = groups.get(fact.brand.id) ?? {
      brand_id: fact.brand.id,
      brand_code: fact.brand.brand_code,
      brand_name: fact.brand.brand_name,
      ...emptyGroupCounts(),
    };
    countInto(group, fact.status);
    groups.set(fact.brand.id, group);
  }

  const result = [...groups.values()];
  result.forEach(finalizeCompletionRate);
  return result.sort((a, b) => b.task_count - a.task_count);
}
