import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBrandIdByCode } from "@/lib/integration/lookup-codes";
import { resolveTaskIdsForOwnerName } from "@/lib/integration/task-owners";
import {
  fetchTaskGroupFacts,
  emptyGroupCounts,
  countInto,
  finalizeCompletionRate,
  type GroupCounts,
  type TaskGroupStatus,
} from "@/lib/integration/task-group-facts";

export interface ListTasksBySeasonForIntegrationParams {
  dateFrom: string | null;
  dateTo: string | null;
  brandCode: string | null;
  ownerName: string | null;
  status: TaskGroupStatus | null;
}

export interface IntegrationSeasonGroupRow extends GroupCounts {
  season_id: string;
  season_code: string;
  season_name: string;
}

// Backs GET /integration/v1/reports/tasks-by-season — season_id is a not-null FK on `tasks`
// (see supabase/schema.md), so unlike tasks-by-brand there is no "no season" bucket to skip;
// every qualifying task lands in exactly one group. Only seasons with at least one matching
// task after filters are returned (empty groups aren't invented), sorted by task_count
// descending, same convention data/dashboard.ts's groupTaskFacts uses for its own breakdowns.
export async function listTasksBySeasonForIntegration({
  dateFrom,
  dateTo,
  brandCode,
  ownerName,
  status,
}: ListTasksBySeasonForIntegrationParams): Promise<IntegrationSeasonGroupRow[]> {
  const supabase = createAdminClient();

  let crossBrandId: string | null = null;
  if (brandCode) {
    crossBrandId = await resolveBrandIdByCode(supabase, brandCode);
    if (!crossBrandId) return [];
  }

  let ownerTaskIds: string[] | null = null;
  if (ownerName) {
    ownerTaskIds = await resolveTaskIdsForOwnerName(supabase, ownerName);
    if (ownerTaskIds === null || ownerTaskIds.length === 0) return [];
  }

  const facts = await fetchTaskGroupFacts(supabase, {
    dateFrom,
    dateTo,
    crossSeasonId: null,
    crossBrandId,
    ownerTaskIds,
    status,
  });

  const groups = new Map<string, IntegrationSeasonGroupRow>();
  for (const fact of facts) {
    if (!fact.season) continue;
    const group = groups.get(fact.season.id) ?? {
      season_id: fact.season.id,
      season_code: fact.season.season_code,
      season_name: fact.season.season_name,
      ...emptyGroupCounts(),
    };
    countInto(group, fact.status);
    groups.set(fact.season.id, group);
  }

  const result = [...groups.values()];
  result.forEach(finalizeCompletionRate);
  return result.sort((a, b) => b.task_count - a.task_count);
}
