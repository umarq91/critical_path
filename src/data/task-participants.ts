import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parsePartyKey, type ParticipantRole } from "@/lib/party";
import { sanitiseOrSearchTerm } from "@/lib/utils";
import { decodeMultiFilterValue } from "@/constants/data-table-filters";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Task participation lives in a join table, and PostgREST can't express a join-table subquery
// inline — so every participation-based filter resolves to a task-id list here first, and the
// caller applies it as a plain `.in("id", ...)`. Kept apart from data/tasks.ts because all
// three task queries (grid, timeline, overdue panel) need exactly this and nothing else of it.

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

// `partyKeyValues` is one or more `kind:uuid` party keys — the "Owner"/"People Involved" toolbar
// filter is `multiple: true`, so its raw URL value is a MULTI_FILTER_DELIMITER-joined list (see
// constants/data-table-filters.ts), decoded by the caller. Matching ANY of them is a union, not
// an intersection — selecting two owners means "owned by either", same as every other multi-select
// filter on this grid.
async function taskIdsForAnyParty(supabase: SupabaseClient, partyKeyValues: string[], role: ParticipantRole) {
  const userIds: string[] = [];
  const departmentIds: string[] = [];
  for (const value of partyKeyValues) {
    const party = parsePartyKey(value);
    if (!party) continue;
    (party.kind === "user" ? userIds : departmentIds).push(party.id);
  }
  if (userIds.length === 0 && departmentIds.length === 0) return [];

  const legs: string[] = [];
  if (userIds.length > 0) legs.push(`profile_id.in.(${userIds.join(",")})`);
  if (departmentIds.length > 0) legs.push(`department_id.in.(${departmentIds.join(",")})`);

  const { data, error } = await supabase.from("task_participants").select("task_id").eq("role", role).or(legs.join(","));
  if (error) throw error;
  return (data ?? []).map((row) => row.task_id);
}

// Past this many matching people a search term isn't identifying anyone — it's the whole
// directory — and the id list stops being something to put in a URL. Same reasoning as
// searchParties' SEARCH_RESULT_LIMIT.
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

  // Only ids reach the or-string, never the raw term — a term carrying a comma or a paren would
  // otherwise corrupt the filter syntax.
  const legs: string[] = [];
  if (profileIds.length > 0) legs.push(`profile_id.in.(${profileIds.join(",")})`);
  if (departmentIds.length > 0) legs.push(`department_id.in.(${departmentIds.join(",")})`);

  const { data, error } = await supabase.from("task_participants").select("task_id").or(legs.join(","));
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.task_id));
}

// The "Owner" and "People Involved" toolbar filters, resolved to one task-id allow-list. Both
// are `kind:uuid` party keys, and set together they must INTERSECT — a task owned by Planning
// that involves Ayşe, not every task matching either.
//
// `null` means neither filter is set. An empty array means they matched nothing, which callers
// must translate into zero rows (EMPTY_RESULT_ID), not into "no filter at all".
export async function participantTaskIds(supabase: SupabaseClient, filters: Record<string, string>) {
  const sets: string[][] = [];
  const owners = decodeMultiFilterValue(filters.owner);
  if (owners.length > 0) sets.push(await taskIdsForAnyParty(supabase, owners, "owner"));
  const involved = decodeMultiFilterValue(filters.involved);
  if (involved.length > 0) sets.push(await taskIdsForAnyParty(supabase, involved, "involved"));

  if (sets.length === 0) return null;
  return sets.reduce((intersection, ids) => {
    const allowed = new Set(ids);
    return intersection.filter((id) => allowed.has(id));
  });
}
