"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { taskCreateSchema, taskUpdateSchema } from "@/app/(app)/tasks/schema";
import { listTasks, type ListTasksParams } from "@/data/tasks";
import { parsePartyKey, participantRows } from "@/lib/party";
import { deleteTaskCalendarEvent } from "@/lib/google/calendar";
import { resyncTaskCalendarEvent } from "@/lib/google/task-calendar-sync";
import { logTaskCreated, logTaskUpdated, logTaskDeleted } from "@/app/(app)/tasks/_audit";

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

  await logTaskCreated(auth.supabase, { userId: auth.userId, email: auth.email }, data, owners);

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

// The columns a task edit is audited on — every user-editable column, and nothing else (the
// google_*/locking/tracking columns are stamped by the system, not chosen by a person).
const AUDITED_TASK_COLUMNS =
  "id, task_name, season_id, brand_id, key_stage_id, gender, due_date, start_date, end_date, status, priority, notes";

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

  // Read before the write, for the audit log's field-level diff — `tasks.last_edited_by`
  // records that someone edited the row, never what it used to say. One extra round trip per
  // task edit, which is the price of "who changed the due date, and from what".
  const { data: before } = await auth.supabase.from("tasks").select(AUDITED_TASK_COLUMNS).eq("id", id).maybeSingle();

  const { error } = await auth.supabase
    .from("tasks")
    .update({ ...updateData, last_edited_by: auth.userId })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  if (before) await logTaskUpdated(auth.supabase, { userId: auth.userId, email: auth.email }, before, updateData);

  // Keeps an already-pushed Google Calendar event in step with the task it came from — on
  // whichever account holds it, which needn't be the editor's. Sync is one-way, so this is
  // the only way an event ever changes: the platform writes, Google never writes back.
  // Best-effort by design; a Google failure must not fail an otherwise valid task edit.
  if ("task_name" in parsed.data || "due_date" in parsed.data) {
    await resyncTaskCalendarEvent(auth.supabase, id).catch(() => undefined);
  }

  revalidatePath("/tasks");
  revalidatePath("/calendar");
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
    .select("task_name, google_event_id, google_calendar_owner_id")
    .eq("id", id)
    .single();

  const { error } = await auth.supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.userId })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  await logTaskDeleted(auth.supabase, { userId: auth.userId, email: auth.email }, { id, task_name: task?.task_name ?? null });

  if (task?.google_event_id && task.google_calendar_owner_id) {
    // Best-effort — a failed calendar cleanup shouldn't undo an already-successful task
    // delete, so this is deliberately not awaited into the error path above.
    await deleteTaskCalendarEvent(task.google_calendar_owner_id, task.google_event_id).catch(() => undefined);
  }

  revalidatePath("/tasks");
  revalidatePath("/calendar");
  return { ok: true as const };
}
