import "server-only";
import { listSeasonIdsMatching } from "@/data/seasons";
import { listBrandIdsMatching } from "@/data/brands";
import { listKeyStageIdsMatching } from "@/data/key-stages";
import { taskIdsMatchingPartyName, type SupabaseClient } from "@/data/task-participants";

/** The narrow projection a free-text search is matched against — no joins, one row per task. */
export interface TaskSearchRow {
  id: string;
  task_name: string;
  season_id: string | null;
  brand_id: string | null;
  key_stage_id: string | null;
}

/** Select string producing exactly `TaskSearchRow`. Keep the two in step. */
export const TASK_SEARCH_SELECT = "id, task_name, season_id, brand_id, key_stage_id";

/**
 * One free-text term against a task AND everything it relates to: its own name, its season
 * (name or code), brand, key stage, and the names of its owners and people involved.
 *
 * Everything but the name resolves to an id set first, because none of those names live on
 * `tasks` — and the owner/people leg lands two tables away, on a join table PostgREST can't
 * reach across in one filter. The sets are resolved once per query and then applied per row, so
 * the returned predicate is pure and cheap.
 *
 * `ilike '%term%'` and `includes()` on a lowercased string are the same case-insensitive
 * substring test, which is what keeps the name leg consistent with the id legs.
 */
export async function resolveTaskSearchMatcher(supabase: SupabaseClient, term: string) {
  const [seasonIds, brandIds, keyStageIds, participantTaskIds] = await Promise.all([
    listSeasonIdsMatching(term),
    listBrandIdsMatching(term),
    listKeyStageIdsMatching(term),
    taskIdsMatchingPartyName(supabase, term),
  ]);
  const needle = term.toLowerCase();

  return (row: TaskSearchRow) =>
    row.task_name.toLowerCase().includes(needle) ||
    (!!row.season_id && seasonIds.has(row.season_id)) ||
    (!!row.brand_id && brandIds.has(row.brand_id)) ||
    (!!row.key_stage_id && keyStageIds.has(row.key_stage_id)) ||
    participantTaskIds.has(row.id);
}
