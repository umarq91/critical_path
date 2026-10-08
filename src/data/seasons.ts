import "server-only";
import { createClient } from "@/lib/supabase/server";
import { compareLabels } from "@/lib/utils";
import { MAX_LOOKUP_EXPORT_ROWS } from "@/lib/export/types";

export interface ListSeasonsParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
}

// `season` is the app's name for the `season_code` column; `season_name` is never read here
// (it only exists for the integration API).
const SEASON_SELECT =
  "id, season:season_code, color, created_at, updated_at, deleted_at";
const SORT_COLUMNS: Record<string, string> = { season: "season_code" };

export async function listSeasons({ page = 1, pageSize = 10, sortBy, sortDir, filters = {} }: ListSeasonsParams = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("seasons")
    .select(SEASON_SELECT, { count: "exact" })
    .is("deleted_at", null);

  if (filters.season) query = query.ilike("season_code", `%${filters.season}%`);
  const orderColumn = (sortBy && SORT_COLUMNS[sortBy]) ?? "season_code";
  query = query.order(orderColumn, { ascending: sortDir !== "desc" });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return { data: data ?? [], rowCount: count ?? 0 };
}

export type Season = Awaited<ReturnType<typeof listSeasons>>["data"][number];

// The Seasons admin page's export — same filters/sort as the board (never re-derived), the
// whole matching scope rather than one page. Delegates to listSeasons() itself instead of
// duplicating its filter-building: Seasons is a small admin lookup table, so a single
// MAX_LOOKUP_EXPORT_ROWS-sized page (not tasks.ts's chunked-fetch loop) is enough to cover it.
export async function listSeasonsForExport(params: Omit<ListSeasonsParams, "page" | "pageSize"> = {}) {
  const { data, rowCount } = await listSeasons({ ...params, page: 1, pageSize: MAX_LOOKUP_EXPORT_ROWS });
  return { data, rowCount, truncated: rowCount > MAX_LOOKUP_EXPORT_ROWS };
}

export interface SeasonTaskStats {
  tasksCount: number;
  completedCount: number;
}

// Tasks/Completion % for the seasons table — scoped to just the season ids on the current page
// (never the whole table), same "narrow, page-scoped query" shape as the rest of this file.
export async function listSeasonTaskStats(seasonIds: string[]): Promise<Record<string, SeasonTaskStats>> {
  const stats: Record<string, SeasonTaskStats> = Object.fromEntries(
    seasonIds.map((id) => [id, { tasksCount: 0, completedCount: 0 }])
  );
  if (seasonIds.length === 0) return stats;

  const supabase = await createClient();
  const { data: taskRows, error } = await supabase
    .from("tasks")
    .select("season_id, status")
    .is("deleted_at", null)
    .in("season_id", seasonIds);
  if (error) throw error;

  for (const row of taskRows ?? []) {
    stats[row.season_id].tasksCount++;
    if (row.status === "completed") stats[row.season_id].completedCount++;
  }

  return stats;
}

// The season leg of the task grid's search box: ids whose season matches a free-text term, so
// searching "SS26" reaches every task in that season and not only the ones naming it.
export async function listSeasonIdsMatching(term: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .is("deleted_at", null)
    .ilike("season_code", `%${term}%`);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.id));
}

// Options for pickers that link another entity to a season (e.g. the brand form's Season
// select) — id/season/color only, every non-deleted season regardless of status.
export async function listSeasonOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, season:season_code, color")
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []).sort((a, b) => compareLabels(a.season, b.season));
}
