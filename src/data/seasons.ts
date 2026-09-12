import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sanitiseOrSearchTerm } from "@/lib/utils";
import { MAX_LOOKUP_EXPORT_ROWS } from "@/lib/export/types";
import { seasonStatusValues, type SeasonInput } from "@/app/(app)/seasons/schema";

export interface ListSeasonsParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
}

const SORTABLE_COLUMNS = new Set(["season_code", "season_name", "status", "start_date"]);

function isSeasonStatus(value: string | undefined): value is SeasonInput["status"] {
  return !!value && (seasonStatusValues as readonly string[]).includes(value);
}

export async function listSeasons({ page = 1, pageSize = 10, sortBy, sortDir, filters = {} }: ListSeasonsParams = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("seasons")
    .select("*, owner:profiles(id, full_name, email, avatar_url)", { count: "exact" })
    .is("deleted_at", null);

  if (filters.season_code) query = query.ilike("season_code", `%${filters.season_code}%`);
  // Validated against the real enum, not just cast — an arbitrary string from the URL would
  // otherwise error the query outright (Postgres enum comparison, not a loose text match).
  if (isSeasonStatus(filters.status)) query = query.eq("status", filters.status);
  if (filters.owner_id) query = query.eq("owner_id", filters.owner_id);
  if (filters.start_date) {
    // The Year filter's value — a bare 4-digit year, translated into a date range since
    // there's no separate `year` column.
    const year = Number(filters.start_date);
    if (Number.isInteger(year)) {
      query = query.gte("start_date", `${year}-01-01`).lt("start_date", `${year + 1}-01-01`);
    }
  }

  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "start_date";
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

// Aggregates for the stat cards + toolbar filter dropdowns — these must reflect the whole
// dataset, not whatever page listSeasons() currently has loaded, so they're a separate,
// narrow-column query rather than derived from the paginated result.
export async function listSeasonSummary() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("status, start_date, owner:profiles(id, full_name, email)")
    .is("deleted_at", null);
  if (error) throw error;

  const rows = data ?? [];
  const statusCounts = Object.fromEntries(seasonStatusValues.map((status) => [status, 0])) as Record<
    (typeof seasonStatusValues)[number],
    number
  >;
  const ownersById = new Map<string, { label: string; value: string }>();
  const years = new Set<string>();

  for (const row of rows) {
    statusCounts[row.status]++;
    if (row.owner) {
      ownersById.set(row.owner.id, { label: row.owner.full_name ?? row.owner.email, value: row.owner.id });
    }
    years.add(new Date(row.start_date).getFullYear().toString());
  }

  return {
    total: rows.length,
    statusCounts,
    owners: [...ownersById.values()].sort((a, b) => a.label.localeCompare(b.label)),
    years: [...years].sort(),
  };
}

// The "Upcoming Seasons" side panel — independent of the main paginated/sorted/filtered
// view (an upcoming season may not even be on the current page).
export async function listUpcomingSeasons(limit = 4) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, season_name, start_date")
    .is("deleted_at", null)
    .eq("status", "upcoming")
    .order("start_date", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export interface SeasonTaskStats {
  brandsCount: number;
  tasksCount: number;
  completedCount: number;
}

// Brands/Tasks/Completion % for the seasons table — scoped to just the season ids on the
// current page (never the whole table), same "narrow, page-scoped query" shape as the rest
// of this file. brand_seasons rows are already unique per (brand_id, season_id), so counting
// rows per season_id directly gives the distinct brand count without a second dedupe step.
export async function listSeasonTaskStats(seasonIds: string[]): Promise<Record<string, SeasonTaskStats>> {
  const stats: Record<string, SeasonTaskStats> = Object.fromEntries(
    seasonIds.map((id) => [id, { brandsCount: 0, tasksCount: 0, completedCount: 0 }])
  );
  if (seasonIds.length === 0) return stats;

  const supabase = await createClient();
  const [{ data: brandSeasonRows, error: brandSeasonError }, { data: taskRows, error: taskError }] = await Promise.all(
    [
      supabase.from("brand_seasons").select("season_id").in("season_id", seasonIds),
      supabase.from("tasks").select("season_id, status").is("deleted_at", null).in("season_id", seasonIds),
    ]
  );
  if (brandSeasonError) throw brandSeasonError;
  if (taskError) throw taskError;

  for (const row of brandSeasonRows ?? []) {
    stats[row.season_id].brandsCount++;
  }
  for (const row of taskRows ?? []) {
    stats[row.season_id].tasksCount++;
    if (row.status === "completed") stats[row.season_id].completedCount++;
  }

  return stats;
}

// The season leg of the task grid's search box: ids whose name OR code matches a free-text
// term, so searching "SS26" reaches every task in that season and not only the ones naming it.
// Both columns, because the client's data uses the code far more than the name.
export async function listSeasonIdsMatching(term: string) {
  const supabase = await createClient();
  const safe = sanitiseOrSearchTerm(term);
  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .is("deleted_at", null)
    // Sanitised because this goes into an .or() string, where commas and parens are syntax.
    .or(`season_name.ilike.%${safe}%,season_code.ilike.%${safe}%`);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.id));
}

// Options for pickers that link another entity to a season (e.g. the brand form's Season
// select) — id/name/color only, every non-deleted season regardless of status.
export async function listSeasonOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, season_name, color")
    .is("deleted_at", null)
    .order("season_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
