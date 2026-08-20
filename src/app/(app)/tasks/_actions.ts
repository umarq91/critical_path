"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { taskSchema, taskUpdateSchema } from "@/app/(app)/tasks/schema";
import { listTasks, type ListTasksParams } from "@/data/tasks";
import { searchProfiles, type SearchProfilesParams } from "@/data/profiles";

// Powers the isolated "Refresh" icon on the tasks table (see useRefreshableData). A plain
// read, not a mutation — router.refresh() can't scope a reload to just this table (it
// re-fetches every Server Component on the route), so a Server Action is the escape hatch:
// re-runs the exact same query the page loaded with, callable straight from the client.
export async function refreshTasks(params: ListTasksParams) {
  return listTasks(params);
}

// The form/inline-edit selects submit "none" as their "no key stage" sentinel (see
// task-form.tsx / tasks/columns.tsx), never "" — normalise that (and any other falsy value)
// to null before it hits the FK column.
function normaliseKeyStageId(value: string | undefined): string | null {
  return value && value !== "none" ? value : null;
}

export async function createTask(input: unknown) {
  const auth = await requirePermission("task.create");
  if (!auth.ok) return auth;

  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data, error } = await auth.supabase
    .from("tasks")
    .insert({
      ...parsed.data,
      key_stage_id: normaliseKeyStageId(parsed.data.key_stage_id),
      created_by: auth.userId,
      last_edited_by: auth.userId,
    })
    .select()
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const, data };
}

export async function updateTask(id: string, patch: unknown) {
  const auth = await requirePermission("task.update");
  if (!auth.ok) return auth;

  const parsed = taskUpdateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Only normalise key_stage_id when this patch actually touches it — it's optional, so an
  // unrelated field edit (e.g. inline-editing task_name) mustn't clear an existing selection.
  const updateData =
    "key_stage_id" in parsed.data
      ? { ...parsed.data, key_stage_id: normaliseKeyStageId(parsed.data.key_stage_id) }
      : parsed.data;

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

  const { error } = await auth.supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.userId })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}

// Powers the "People Involved" search dropdown (tasks/people-search-dropdown.tsx) — gated on
// task.assign since that's the same permission add/remove below require, and only people who
// can add someone have any reason to search.
export async function searchAssignablePeople(params: SearchProfilesParams) {
  const auth = await requirePermission("task.assign");
  if (!auth.ok) return auth;

  const result = await searchProfiles(params);
  return { ok: true as const, data: result.data, hasMore: result.hasMore };
}

export async function addTaskPerson(taskId: string, profileId: string) {
  const auth = await requirePermission("task.assign");
  if (!auth.ok) return auth;

  // upsert + ignoreDuplicates makes this idempotent against the unique(task_id, profile_id)
  // constraint — re-adding someone already involved (e.g. a stale dropdown, a retried click)
  // is a no-op instead of a surfaced error.
  const { error } = await auth.supabase
    .from("task_people")
    .upsert({ task_id: taskId, profile_id: profileId }, { onConflict: "task_id,profile_id", ignoreDuplicates: true });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}

// Bulk variant for the create-task flow (task-form.tsx) — people picked before the task
// exists are buffered client-side, then added in one round trip right after createTask
// returns the new task's id, instead of one request per person.
export async function addTaskPeople(taskId: string, profileIds: string[]) {
  const auth = await requirePermission("task.assign");
  if (!auth.ok) return auth;
  if (profileIds.length === 0) return { ok: true as const };

  const { error } = await auth.supabase
    .from("task_people")
    .upsert(
      profileIds.map((profileId) => ({ task_id: taskId, profile_id: profileId })),
      { onConflict: "task_id,profile_id", ignoreDuplicates: true }
    );
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function removeTaskPerson(taskId: string, profileId: string) {
  const auth = await requirePermission("task.assign");
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("task_people")
    .delete()
    .eq("task_id", taskId)
    .eq("profile_id", profileId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}
