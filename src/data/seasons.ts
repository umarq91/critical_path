import "server-only";
import { createClient } from "@/lib/supabase/server";
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
