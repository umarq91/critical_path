import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitiseOrSearchTerm } from "@/lib/utils";

type SupabaseClient = ReturnType<typeof createAdminClient>;

interface OwnerRow {
  task_id: string;
  profile: { full_name: string | null; email: string } | null;
  department: { name: string } | null;
}

type Owner = { kind: "department" | "user"; name: string };

function sortOwners(owners: Owner[]) {
  return [...owners].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "department" ? -1 : 1));
}

// Owner is 1..n departments/profiles via `task_participants`, not a column — every
// /integration/v1/* endpoint that needs a single `owner_name` string per task goes through
// here rather than re-deriving it. First consumer was calendar-events.ts; overdue-tasks and the
// tasks-by-* reports are the second/third, which is what promoted this out of that file (CLAUDE.md's
// "generalize once a second, unrelated surface shows up" rule).
//
// Same join-into-one-string idiom as the app's own partyNames() (tasks/export/task-record-columns.ts):
// departments first, then people, alphabetical within each — same ordering task-parties.ts uses
// for the grid, so this reads the same way the app itself does.
// Batched rather than one `.in("task_id", taskIds)` call — a GET request's query string grows
// with every id (36 chars each), and PostgREST/the Supabase edge in front of it rejects a URL
// past a few KB. 250 ids/batch keeps every request comfortably under that regardless of caller;
// `/reports/overdue-tasks` was previously safe by accident (never called with more than one
// page's worth of ids), `/reports/task-summary` calling this over an unfiltered ~800-task result
// set is what surfaced the bug.
const OWNER_LOOKUP_BATCH_SIZE = 250;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

export async function resolveOwnerNames(supabase: SupabaseClient, taskIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (taskIds.length === 0) return names;

  const batches = await Promise.all(
    chunk(taskIds, OWNER_LOOKUP_BATCH_SIZE).map(async (batch) => {
      const { data, error } = await supabase
        .from("task_participants")
        .select("task_id, profile:profiles(full_name, email), department:departments(name)")
        .eq("role", "owner")
        .in("task_id", batch);
      if (error) throw error;
      return (data ?? []) as unknown as OwnerRow[];
    })
  );

  const byTask = new Map<string, Owner[]>();
  for (const row of batches.flat()) {
    const owner: Owner | null = row.department
      ? { kind: "department", name: row.department.name }
      : row.profile
        ? { kind: "user", name: row.profile.full_name ?? row.profile.email }
        : null;
    if (!owner) continue;

    const list = byTask.get(row.task_id) ?? [];
    list.push(owner);
    byTask.set(row.task_id, list);
  }

  for (const [taskId, owners] of byTask) {
    names.set(taskId, sortOwners(owners).map((owner) => owner.name).join(", "));
  }
  return names;
}

// The reverse direction, for the `owner_name` query param `/reports/overdue-tasks` and the
// tasks-by-* reports accept: which tasks does a given owner (department or person) appear on,
// as an `owner` participant. Matches case-insensitively against a department's name or a
// profile's full_name/email — exact-equals rather than substring, so `owner_name=Design` can't
// accidentally also pull in `Design Ops`. Returns `null` when no owner matches at all (a
// distinct outcome from "matched, but zero tasks"), so a caller can short-circuit to an empty
// result instead of running an `.in("id", [])` that PostgREST would otherwise happily accept as
// "no filter."
export async function resolveTaskIdsForOwnerName(supabase: SupabaseClient, ownerName: string): Promise<string[] | null> {
  // `sanitiseOrSearchTerm` strips the characters (`,`/`()`) that would otherwise corrupt or
  // smuggle a condition into the `.or()` filter string built below — same discipline
  // lib/integration/cursor.ts applies to a cursor's own fields, same helper `data/seasons.ts`
  // etc. already use for their own search boxes.
  const term = sanitiseOrSearchTerm(ownerName);

  const [departments, profiles] = await Promise.all([
    supabase.from("departments").select("id").ilike("name", term),
    supabase.from("profiles").select("id").or(`full_name.ilike.${term},email.ilike.${term}`),
  ]);
  if (departments.error) throw departments.error;
  if (profiles.error) throw profiles.error;

  const departmentIds = (departments.data ?? []).map((row) => row.id);
  const profileIds = (profiles.data ?? []).map((row) => row.id);
  if (departmentIds.length === 0 && profileIds.length === 0) return null;

  const orLegs = [
    departmentIds.length > 0 ? `department_id.in.(${departmentIds.join(",")})` : null,
    profileIds.length > 0 ? `profile_id.in.(${profileIds.join(",")})` : null,
  ].filter((leg): leg is string => leg !== null);

  const { data, error } = await supabase.from("task_participants").select("task_id").eq("role", "owner").or(orLegs.join(","));
  if (error) throw error;

  return [...new Set((data ?? []).map((row) => row.task_id))];
}

// /dashboard-summary's `owner_id` param, per the spec, means a `profiles.id` specifically —
// unlike `owner_name` above, this can never match a department-only owner (Vendor, Supplier,
// ...), which is correct given the spec's literal wording ("owner profile id"), not a gap. No
// name resolution needed since the caller already has the id; a direct equality filter on the
// polymorphic `task_participants.profile_id` column.
export async function resolveTaskIdsForOwnerProfileId(supabase: SupabaseClient, ownerId: string): Promise<string[]> {
  const { data, error } = await supabase.from("task_participants").select("task_id").eq("role", "owner").eq("profile_id", ownerId);
  if (error) throw error;

  return [...new Set((data ?? []).map((row) => row.task_id))];
}
