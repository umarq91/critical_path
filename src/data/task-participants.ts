import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parsePartyKey, type ParticipantRole } from "@/lib/party";

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

async function taskIdsForParty(supabase: SupabaseClient, partyKeyValue: string, role: ParticipantRole) {
  const party = parsePartyKey(partyKeyValue);
  if (!party) return [];

  const { data, error } = await supabase
    .from("task_participants")
    .select("task_id")
    .eq("role", role)
    .eq(party.kind === "user" ? "profile_id" : "department_id", party.id);
  if (error) throw error;
  return (data ?? []).map((row) => row.task_id);
}

// Past this many matching people a search term isn't identifying anyone — it's the whole
// directory — and the id list stops being something to put in a URL. Same reasoning as
// searchParties' SEARCH_RESULT_LIMIT.
const NAME_MATCH_LIMIT = 100;

/**
 * Task ids whose owner or person-involved NAME matches a free-text term — the participant leg
 * of the Timeline's search box. Resolved in two hops (parties by name, then their participant
 * rows) because the names live on `profiles`/`departments` while the link lives on
 * `task_participants`, and PostgREST can't reach across that in one filter.
 */
export async function taskIdsMatchingPartyName(supabase: SupabaseClient, term: string) {
  const [departments, profiles] = await Promise.all([
    supabase.from("departments").select("id").is("deleted_at", null).ilike("name", `%${term}%`).limit(NAME_MATCH_LIMIT),
    supabase
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
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
  if (filters.owner) sets.push(await taskIdsForParty(supabase, filters.owner, "owner"));
  if (filters.involved) sets.push(await taskIdsForParty(supabase, filters.involved, "involved"));

  if (sets.length === 0) return null;
  return sets.reduce((intersection, ids) => {
    const allowed = new Set(ids);
    return intersection.filter((id) => allowed.has(id));
  });
}
