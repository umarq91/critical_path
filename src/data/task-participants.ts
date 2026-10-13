import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parsePartyKey, type ParticipantRole } from "@/lib/party";
import { sanitiseOrSearchTerm } from "@/lib/utils";
import { decodeMultiFilterValue } from "@/constants/data-table-filters";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Task participation lives in a join table. The toolbar filters match it inside the tasks query
// (applyParticipantFilters); the personal scope and the search box resolve it to task ids here
// and match those in memory. Kept apart from data/tasks.ts because every task query (grid,
// calendar, timeline, overdue panel) needs exactly this and nothing else of it.

/** A syntactically valid uuid that no row can hold, for filters that resolved to an empty set.
 *  Dropping the clause instead would silently widen the query to "no filter at all". */
export const EMPTY_RESULT_ID = "00000000-0000-0000-0000-000000000000";

// Every task this profile participates in, whether named directly or via their department.
// The view already collapses "both" to one row (it's a UNION), so no dedupe is needed here.
export async function taskIdsForProfile(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("task_participant_profiles")
    .select("task_id")
    .eq("profile_id", profileId);
  if (error) throw error;
  return (data ?? []).flatMap((row) => (row.task_id ? [row.task_id] : []));
}

// One `.or()` leg per party kind, matching a task_participants row to any of the given parties.
// Only parsed uuids reach this string — never raw input, where commas and parens are syntax.
function partyLegs(profileIds: string[], departmentIds: string[]) {
  const legs: string[] = [];
  if (profileIds.length > 0) legs.push(`profile_id.in.(${profileIds.join(",")})`);
  if (departmentIds.length > 0) legs.push(`department_id.in.(${departmentIds.join(",")})`);
  return legs.join(",");
}

// Past this many matching people a search term isn't identifying anyone — it's the whole
// directory — and the id list stops being something to put in a URL.
const NAME_MATCH_LIMIT = 100;

/**
 * Task ids whose owner or person-involved NAME matches a free-text term — the participant leg
 * of the search box on both /tasks and /timeline. Resolved in two hops (parties by name, then their participant
 * rows) because the names live on `profiles`/`departments` while the link lives on
 * `task_participants`, and PostgREST can't reach across that in one filter.
 */
export async function taskIdsMatchingPartyName(supabase: SupabaseClient, term: string) {
  // Sanitised because the profiles leg is an .or() string, where commas and parens are syntax.
  const safe = sanitiseOrSearchTerm(term);
  const [departments, profiles] = await Promise.all([
    supabase.from("departments").select("id").is("deleted_at", null).ilike("name", `%${term}%`).limit(NAME_MATCH_LIMIT),
    supabase
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`)
      .limit(NAME_MATCH_LIMIT),
  ]);
  if (departments.error) throw departments.error;
  if (profiles.error) throw profiles.error;

  const departmentIds = (departments.data ?? []).map((row) => row.id);
  const profileIds = (profiles.data ?? []).map((row) => row.id);
  if (departmentIds.length === 0 && profileIds.length === 0) return new Set<string>();

  const { data, error } = await supabase.from("task_participants").select("task_id").or(partyLegs(profileIds, departmentIds));
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.task_id));
}

// The "Owner" and "People Involved" toolbar filters. Matched inside the tasks query itself, as
// an `!inner` embed of task_participants per role — one alias each, so setting both INTERSECTS
// (a task owned by Planning that involves Ayşe, not every task matching either), while several
// parties within one filter are a union ("owned by either"), like every other multi-select.
//
// Never resolved to a task-id list first: a large department (Brand Managers, Product
// Development) sits on 1,000+ participant rows, which overflows the request URL as an
// `.in("id", …)` (~800 ids is the measured limit) and is past PostgREST's row cap besides.
const PARTICIPANT_FILTERS = [
  { filterKey: "owner", role: "owner", alias: "owner_match" },
  { filterKey: "involved", role: "involved", alias: "involved_match" },
] as const satisfies readonly { filterKey: string; role: ParticipantRole; alias: string }[];

function activeParticipantFilters(filters: Record<string, string>) {
  return PARTICIPANT_FILTERS.flatMap((filter) => {
    const values = decodeMultiFilterValue(filters[filter.filterKey]);
    return values.length > 0 ? [{ ...filter, values }] : [];
  });
}

/** `select` plus the embeds applyParticipantFilters() filters on. Empty `()` — they only
 *  constrain which tasks match, and add nothing to the returned rows. */
export function withParticipantFilterSelect(select: string, filters: Record<string, string>) {
  const embeds = activeParticipantFilters(filters).map(({ alias }) => `${alias}:task_participants!inner()`);
  return [select, ...embeds].join(", ");
}

/** Must be paired with withParticipantFilterSelect() on the same query's select. */
export function applyParticipantFilters<
  Q extends {
    eq: (column: string, value: string) => Q;
    or: (filters: string, options: { referencedTable: string }) => Q;
  },
>(query: Q, filters: Record<string, string>): Q {
  for (const { alias, role, values } of activeParticipantFilters(filters)) {
    const profileIds: string[] = [];
    const departmentIds: string[] = [];
    for (const value of values) {
      const party = parsePartyKey(value);
      if (party) (party.kind === "user" ? profileIds : departmentIds).push(party.id);
    }
    // A filter whose parties all failed to parse must yield zero rows, not drop the clause.
    if (profileIds.length === 0 && departmentIds.length === 0) {
      query = query.eq("id", EMPTY_RESULT_ID);
      continue;
    }
    query = query.eq(`${alias}.role`, role).or(partyLegs(profileIds, departmentIds), { referencedTable: alias });
  }
  return query;
}
