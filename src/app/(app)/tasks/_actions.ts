"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { taskCreateSchema, taskUpdateSchema } from "@/app/(app)/tasks/schema";
import { insertTask, normaliseDate, normaliseDpspCategory, normaliseOptionalId } from "@/app/(app)/tasks/_insert-task";
import { listTasks, type ListTasksParams } from "@/data/tasks";
import { deleteTaskCalendarEvents, resyncTaskCalendarEvents } from "@/lib/google/task-calendar-sync";
import { logTaskUpdated, logTaskDeleted, logTaskRestored } from "@/app/(app)/tasks/_audit";

// Powers the isolated "Refresh" icon on the tasks table (see useRefreshableData). A plain
// read, not a mutation — router.refresh() can't scope a reload to just this table (it
// re-fetches every Server Component on the route), so a Server Action is the escape hatch:
// re-runs the exact same query the page loaded with, callable straight from the client.
export async function refreshTasks(params: ListTasksParams) {
  return listTasks(params);
}

export async function createTask(input: unknown) {
  const auth = await requirePermission("task.create");
  if (!auth.ok) return auth;

  const parsed = taskCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const result = await insertTask(auth.supabase, { userId: auth.userId, email: auth.email }, parsed.data);
  if (!result.ok) return result;

  revalidatePath("/tasks");
  return result;
}

// The columns a task edit is audited on — every user-editable column, and nothing else (the
// google_*/locking/tracking columns are stamped by the system, not chosen by a person).
const AUDITED_TASK_COLUMNS =
  "id, task_name, season_id, brand_id, key_stage_id, dpsp_category, gender, due_date, start_date, end_date, status, priority, notes, is_critical";

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
  //
  // dpsp_category is destructured out of the base spread (unlike brand_id/key_stage_id, which
  // stay in it) because it's the one column typed as a Postgres enum literal union rather than
  // a plain string — left in the base spread, its loosely-typed `string | undefined` from
  // taskUpdateSchema would win the merge over normaliseDpspCategory's narrowed return type.
  const { dpsp_category: rawDpspCategory, ...restParsed } = parsed.data;
  const updateData = {
    ...restParsed,
    ...("brand_id" in parsed.data ? { brand_id: normaliseOptionalId(parsed.data.brand_id) } : {}),
    ...("key_stage_id" in parsed.data ? { key_stage_id: normaliseOptionalId(parsed.data.key_stage_id) } : {}),
    ...("dpsp_category" in parsed.data ? { dpsp_category: normaliseDpspCategory(rawDpspCategory) } : {}),
    ...("due_date" in parsed.data ? { due_date: normaliseDate(parsed.data.due_date) } : {}),
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

  // Keeps every already-pushed copy of this task in step, on every user's calendar that holds
  // one. Sync is one-way, so this is the only way an event ever changes besides the next Sync.
  // Runs after the response (one Google call per copy, and there can be one per user), and is
  // best-effort: a Google failure must not fail an otherwise valid task edit.
  if (["task_name", "due_date", "season_id", "brand_id", "gender"].some((field) => field in parsed.data)) {
    after(() => resyncTaskCalendarEvents(auth.supabase, id).catch(() => undefined));
  }

  revalidatePath("/tasks");
  revalidatePath("/calendar");
  return { ok: true as const };
}

export async function deleteTask(id: string) {
  const auth = await requirePermission("task.delete");
  if (!auth.ok) return auth;

  const { data: task } = await auth.supabase.from("tasks").select("task_name").eq("id", id).single();

  const { error } = await auth.supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.userId })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  await logTaskDeleted(auth.supabase, { userId: auth.userId, email: auth.email }, { id, task_name: task?.task_name ?? null });

  // Removes the task from every user's calendar that holds it. After the response and
  // best-effort: a failed calendar cleanup shouldn't undo an already-successful delete.
  after(() => deleteTaskCalendarEvents(auth.supabase, id).catch(() => undefined));

  revalidatePath("/tasks");
  revalidatePath("/calendar");
  return { ok: true as const };
}

// The Trash view's one write. Same permission as deleteTask (task.delete) — the people who can
// remove a task are the people who can bring it back, rather than a separate grant. Clears
// deleted_by too, not just deleted_at: a restored task with a stale deleted_by would read as
// "deleted by so-and-so" everywhere that column is joined, for a task that's no longer deleted.
//
// Deliberately does NOT touch Google Calendar: deleteTask already removed every copy and its
// task_calendar_events link, so the restored task simply goes out again on each user's next
// Sync.
export async function restoreTask(id: string) {
  const auth = await requirePermission("task.delete");
  if (!auth.ok) return auth;

  const { data: task } = await auth.supabase
    .from("tasks")
    .select("task_name, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!task?.deleted_at) return { ok: false as const, error: "This task isn't in the trash" };

  const { error } = await auth.supabase
    .from("tasks")
    .update({ deleted_at: null, deleted_by: null, last_edited_by: auth.userId })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  await logTaskRestored(auth.supabase, { userId: auth.userId, email: auth.email }, { id, task_name: task.task_name });

  revalidatePath("/tasks");
  revalidatePath("/tasks/trash");
  return { ok: true as const };
}
