"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { taskCreateSchema, taskUpdateSchema, taskParticipantsSchema } from "@/app/(app)/tasks/schema";
import { listTasks, type ListTasksParams } from "@/data/tasks";
import { searchParties, type SearchPartiesParams } from "@/data/parties";
import { parsePartyKey, partyColumns, type ParticipantRole } from "@/lib/party";
import { deleteTaskCalendarEvent } from "@/lib/google/calendar";

// Powers the isolated "Refresh" icon on the tasks table (see useRefreshableData). A plain
// read, not a mutation — router.refresh() can't scope a reload to just this table (it
// re-fetches every Server Component on the route), so a Server Action is the escape hatch:
// re-runs the exact same query the page loaded with, callable straight from the client.
export async function refreshTasks(params: ListTasksParams) {
  return listTasks(params);
}

// The form/inline-edit selects submit "none" as their "not set" sentinel for the optional FKs
// (see task-form.tsx / tasks/columns.tsx), never "" — normalise that (and any other falsy
// value) to null before it hits the column. Shared by brand_id and key_stage_id.
function normaliseOptionalId(value: string | undefined): string | null {
  return value && value !== "none" ? value : null;
}

// start_date/end_date are optional `date` columns, but DateField submits an unset date as ""
// rather than omitting the key — "" fails Postgres's date parsing outright ("invalid input
// syntax for type date: \"\""), so it's normalised to null before the DB write, same
// reasoning as normaliseOptionalId above.
function normaliseDate(value: string | undefined): string | null {
  return value ? value : null;
}

// Turns the form's `kind:uuid` keys into task_participants rows. Unparseable keys are dropped
// rather than failing the whole write — the zod schema already rejected them upstream, so
// anything reaching here is a bug, not user input worth surfacing an error for.
function participantRows(taskId: string, keys: string[], role: ParticipantRole) {
  return keys.flatMap((key) => {
    const party = parsePartyKey(key);
    return party ? [{ task_id: taskId, role, ...partyColumns(party) }] : [];
  });
}

export async function createTask(input: unknown) {
  const auth = await requirePermission("task.create");
  if (!auth.ok) return auth;

  const parsed = taskCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { owners, people_involved, ...taskColumns } = parsed.data;

  const { data, error } = await auth.supabase
    .from("tasks")
    .insert({
      ...taskColumns,
      brand_id: normaliseOptionalId(taskColumns.brand_id),
      key_stage_id: normaliseOptionalId(taskColumns.key_stage_id),
      start_date: normaliseDate(taskColumns.start_date),
      end_date: normaliseDate(taskColumns.end_date),
      // Compatibility shim while tasks.assignee_id still exists (0015 is the expand phase; the
      // column is dropped in a follow-up). Calendar sync and the Upcoming scope still read it,
      // so it's set to the first *individual* owner — null when every owner is a department,
      // which is the common case and is exactly why the column is going away.
      assignee_id: firstIndividualOwnerId(owners),
      created_by: auth.userId,
      last_edited_by: auth.userId,
    })
    .select()
    .single();
  if (error) return { ok: false as const, error: error.message };

  const participants = [
    ...participantRows(data.id, owners, "owner"),
    ...participantRows(data.id, people_involved, "involved"),
  ];
  const { error: participantsError } = await auth.supabase.from("task_participants").insert(participants);
  if (participantsError) {
    // The task row is already committed and a task with no owner is not a valid state, so roll
    // it back rather than leave a half-written task behind. Soft delete, matching deleteTask.
    await auth.supabase.from("tasks").update({ deleted_at: new Date().toISOString(), deleted_by: auth.userId }).eq("id", data.id);
    return { ok: false as const, error: participantsError.message };
  }

  revalidatePath("/tasks");
  return { ok: true as const, data };
}

function firstIndividualOwnerId(owners: string[]) {
  for (const key of owners) {
    const party = parsePartyKey(key);
    if (party?.kind === "user") return party.id;
  }
  return null;
}

export async function updateTask(id: string, patch: unknown) {
  const auth = await requirePermission("task.update");
  if (!auth.ok) return auth;

  const parsed = taskUpdateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Only normalise a field when this patch actually touches it — each is optional, so an
  // unrelated field edit (e.g. inline-editing task_name) mustn't clear an existing value.
  // Built via additive spreads (not property assignment) so a deliberate null - clearing an
  // existing brand / key stage / start / end date - actually reaches the DB instead of being
  // widened away by updateData's inferred (string | undefined) shape.
  const updateData = {
    ...parsed.data,
    ...("brand_id" in parsed.data ? { brand_id: normaliseOptionalId(parsed.data.brand_id) } : {}),
    ...("key_stage_id" in parsed.data ? { key_stage_id: normaliseOptionalId(parsed.data.key_stage_id) } : {}),
    ...("start_date" in parsed.data ? { start_date: normaliseDate(parsed.data.start_date) } : {}),
    ...("end_date" in parsed.data ? { end_date: normaliseDate(parsed.data.end_date) } : {}),
  };

  const { error } = await auth.supabase
    .from("tasks")
    .update({ ...updateData, last_edited_by: auth.userId })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function deleteTask(id: string) {
  const auth = await requirePermission("task.delete");
  if (!auth.ok) return auth;

  // Fetched before the delete so the linked Google Calendar event (if any) can be cleaned
  // up on whichever profile's calendar it actually lives on — not necessarily the person
  // deleting the task (see tasks.google_calendar_owner_id).
  const { data: task } = await auth.supabase
    .from("tasks")
    .select("google_event_id, google_calendar_owner_id")
    .eq("id", id)
    .single();

  const { error } = await auth.supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.userId })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  if (task?.google_event_id && task.google_calendar_owner_id) {
    // Best-effort — a failed calendar cleanup shouldn't undo an already-successful task
    // delete, so this is deliberately not awaited into the error path above.
    await deleteTaskCalendarEvent(task.google_calendar_owner_id, task.google_event_id).catch(() => undefined);
  }

  revalidatePath("/tasks");
  revalidatePath("/calendar");
  return { ok: true as const };
}

// Powers the Owners / People Involved search dropdown (tasks/party-search-dropdown.tsx) —
// gated on task.assign since that's the same permission add/remove below require, and only
// people who can assign have any reason to search.
export async function searchAssignableParties(params: SearchPartiesParams) {
  const auth = await requirePermission("task.assign");
  if (!auth.ok) return auth;

  const result = await searchParties(params);
  return { ok: true as const, data: result.data, truncated: result.truncated };
}

export async function addTaskParticipant(taskId: string, partyKey: string, role: ParticipantRole) {
  const auth = await requirePermission("task.assign");
  if (!auth.ok) return auth;

  const party = parsePartyKey(partyKey);
  if (!party) return { ok: false as const, error: "Invalid selection" };

  // The uniqueness guard is two partial indexes rather than one constraint (see
  // 0015_task_participants.sql), so there's no single `onConflict` target to upsert against —
  // idempotency comes from checking first instead. Re-adding someone already on the task (a
  // stale dropdown, a retried click) is a no-op rather than a surfaced error.
  const columns = partyColumns(party);
  const { data: existing } = await auth.supabase
    .from("task_participants")
    .select("id")
    .eq("task_id", taskId)
    .eq("role", role)
    .eq(party.kind === "user" ? "profile_id" : "department_id", party.id)
    .maybeSingle();
  if (existing) return { ok: true as const };

  const { error } = await auth.supabase.from("task_participants").insert({ task_id: taskId, role, ...columns });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function removeTaskParticipant(taskId: string, partyKey: string, role: ParticipantRole) {
  const auth = await requirePermission("task.assign");
  if (!auth.ok) return auth;

  const party = parsePartyKey(partyKey);
  if (!party) return { ok: false as const, error: "Invalid selection" };

  // A task with no owner isn't a valid state — the create form enforces owners.min(1), and the
  // same rule has to hold when removing from an existing task.
  if (role === "owner") {
    const { count } = await auth.supabase
      .from("task_participants")
      .select("id", { count: "exact", head: true })
      .eq("task_id", taskId)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) return { ok: false as const, error: "A task must have at least one owner" };
  }

  const { error } = await auth.supabase
    .from("task_participants")
    .delete()
    .eq("task_id", taskId)
    .eq("role", role)
    .eq(party.kind === "user" ? "profile_id" : "department_id", party.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}

// Replaces a task's entire participant set in one call — the whole-set write the admin forms
// use for brand_seasons, rather than diffing adds and removes.
export async function setTaskParticipants(taskId: string, input: unknown) {
  const auth = await requirePermission("task.assign");
  if (!auth.ok) return auth;

  const parsed = taskParticipantsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error: deleteError } = await auth.supabase.from("task_participants").delete().eq("task_id", taskId);
  if (deleteError) return { ok: false as const, error: deleteError.message };

  const rows = [
    ...participantRows(taskId, parsed.data.owners, "owner"),
    ...participantRows(taskId, parsed.data.people_involved, "involved"),
  ];
  const { error } = await auth.supabase.from("task_participants").insert(rows);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}
