import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeCursor, type IntegrationCursor } from "@/lib/integration/cursor";

type SupabaseClient = ReturnType<typeof createAdminClient>;

export interface ListCalendarEventsForIntegrationParams {
  pageSize: number;
  cursor: IntegrationCursor | null;
  updatedSince: string | null;
  includeDeleted: boolean;
}

const TASK_SELECT =
  "id, task_name, due_date, google_event_id, google_synced_at, updated_at, deleted_at, season:seasons(season_code), brand:brands(brand_name)";

interface TaskRow {
  id: string;
  task_name: string;
  due_date: string | null;
  google_event_id: string | null;
  google_synced_at: string | null;
  updated_at: string;
  deleted_at: string | null;
  season: { season_code: string } | null;
  brand: { brand_name: string } | null;
}

export interface IntegrationCalendarEventRow extends TaskRow {
  owner_name: string | null;
}

// Backs GET /integration/v1/calendar-events — one row per task (client direction: every field
// in the spec's shape is always present, null where genuinely not tracked; extended here to
// rows too, not just fields — see things-to-know.md's Integrations section for the full
// reasoning). A task that's never been synced to Google still gets a row, with
// calendar_event_id/provider/sync_status/last_synced_at all null: sync_status is never
// "pending" or "failed" for such a task because this schema can't honestly distinguish those
// from "never tried" — a failed push leaves the columns untouched exactly like an unattempted
// one (lib/google/calendar.ts swallows the error), so there's no signal to report a third
// state from.
export async function listCalendarEventsForIntegration({
  pageSize,
  cursor,
  updatedSince,
  includeDeleted,
}: ListCalendarEventsForIntegrationParams): Promise<{ rows: IntegrationCalendarEventRow[]; nextCursor: string | null }> {
  const supabase = createAdminClient();

  let query = supabase.from("tasks").select(TASK_SELECT);
  if (!includeDeleted) query = query.is("deleted_at", null);
  if (updatedSince) query = query.gte("updated_at", updatedSince);

  // Keyset pagination — see lib/integration/cursor.ts for why (updated_at, id) and why the
  // cursor is validated before it ever reaches this string.
  if (cursor) {
    query = query.or(`updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(pageSize + 1);
  if (error) throw error;

  const rows = (data ?? []) as unknown as TaskRow[];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ updatedAt: last.updated_at, id: last.id }) : null;

  const ownerNames = await resolveOwnerNames(supabase, page.map((row) => row.id));

  return { rows: page.map((row) => ({ ...row, owner_name: ownerNames.get(row.id) ?? null })), nextCursor };
}

// Same join-into-one-string idiom as the app's own partyNames()
// (tasks/export/task-record-columns.ts) — owner is 1..n departments/profiles
// (task_participants), not a column, so the spec's single owner_name string is a display join,
// not raw data. Departments first, then people, alphabetical within each — same ordering
// task-parties.ts uses for the grid, so this reads the same way the app itself does.
async function resolveOwnerNames(supabase: SupabaseClient, taskIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (taskIds.length === 0) return names;

  const { data, error } = await supabase
    .from("task_participants")
    .select("task_id, profile:profiles(full_name, email), department:departments(name)")
    .eq("role", "owner")
    .in("task_id", taskIds);
  if (error) throw error;

  const byTask = new Map<string, { kind: "department" | "user"; name: string }[]>();
  for (const row of (data ?? []) as unknown as {
    task_id: string;
    profile: { full_name: string | null; email: string } | null;
    department: { name: string } | null;
  }[]) {
    const owner = row.department
      ? { kind: "department" as const, name: row.department.name }
      : row.profile
        ? { kind: "user" as const, name: row.profile.full_name ?? row.profile.email }
        : null;
    if (!owner) continue;

    const list = byTask.get(row.task_id) ?? [];
    list.push(owner);
    byTask.set(row.task_id, list);
  }

  for (const [taskId, owners] of byTask) {
    owners.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "department" ? -1 : 1));
    names.set(taskId, owners.map((owner) => owner.name).join(", "));
  }
  return names;
}
