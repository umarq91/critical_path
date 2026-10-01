import "server-only";
import { dpspCategoryValues, taskGenderValues, type TaskCreateInput } from "@/app/(app)/tasks/schema";
import { parsePartyKey, participantRows } from "@/lib/party";
import { logTaskCreated, logTasksCreated, type AuditActor } from "@/app/(app)/tasks/_audit";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// The form/inline-edit selects submit "none" as their "not set" sentinel for the optional FKs
// (see task-form.tsx / tasks/columns.tsx), never "" — normalise that (and any other falsy
// value) to null before it hits the column. Shared by brand_id, key_stage_id and dpsp_category.
export function normaliseOptionalId(value: string | undefined): string | null {
  return value && value !== "none" ? value : null;
}

// dpsp_category is a Postgres enum, not a uuid FK — normaliseOptionalId's generic "none" -> null
// step still applies, but the surviving value has to be narrowed to the enum's own literal
// union (taskSchema only validates it as a loose string, same "none"-sentinel reasoning as
// brand_id/key_stage_id) before it can reach a typed insert/update.
export function normaliseDpspCategory(value: string | undefined): (typeof dpspCategoryValues)[number] | null {
  const id = normaliseOptionalId(value);
  return id && (dpspCategoryValues as readonly string[]).includes(id)
    ? (id as (typeof dpspCategoryValues)[number])
    : null;
}

// gender has no "none" sentinel — it's a required, not-null column — so unlike
// normaliseDpspCategory this only narrows the type. taskCreateSchema's own refine already
// guarantees `value` is a real taskGenderValues member before this ever runs; the loose string
// type on that field exists purely so the create form can start unselected (see schema.ts).
function narrowGender(value: string): (typeof taskGenderValues)[number] {
  return value as (typeof taskGenderValues)[number];
}

// due_date/start_date/end_date are all optional `date` columns, but DateField submits an unset
// date as "" rather than omitting the key — "" fails Postgres's date parsing outright ("invalid
// input syntax for type date: \"\""), so it's normalised to null before the DB write, same
// reasoning as normaliseOptionalId above.
export function normaliseDate(value: string | undefined): string | null {
  return value ? value : null;
}

type TaskColumns = Omit<TaskCreateInput, "owners" | "people_involved">;

function taskRow(actor: AuditActor, taskColumns: TaskColumns, owners: string[]) {
  return {
    ...taskColumns,
    brand_id: normaliseOptionalId(taskColumns.brand_id),
    key_stage_id: normaliseOptionalId(taskColumns.key_stage_id),
    dpsp_category: normaliseDpspCategory(taskColumns.dpsp_category),
    gender: narrowGender(taskColumns.gender),
    due_date: normaliseDate(taskColumns.due_date),
    start_date: normaliseDate(taskColumns.start_date),
    end_date: normaliseDate(taskColumns.end_date),
    // Compatibility shim while tasks.assignee_id still exists (0015 is the expand phase; the
    // column is dropped in a follow-up). Calendar sync and the Upcoming scope still read it,
    // so it's set to the first *individual* owner — null when every owner is a department,
    // which is the common case and is exactly why the column is going away.
    assignee_id: firstIndividualOwnerId(owners),
    created_by: actor.userId,
    last_edited_by: actor.userId,
  };
}

function taskParticipantRows(taskId: string, owners: string[], peopleInvolved: string[]) {
  return [...participantRows(taskId, owners, "owner"), ...participantRows(taskId, peopleInvolved, "involved")];
}

// The task row is already committed when its participants fail, and a task with no owner is not
// a valid state, so it's rolled back rather than left half-written. Soft delete, matching
// deleteTask.
async function rollBackTasks(supabase: SupabaseClient, actor: AuditActor, taskIds: string[]) {
  await supabase.from("tasks").update({ deleted_at: new Date().toISOString(), deleted_by: actor.userId }).in("id", taskIds);
}

// The one write path for a new task: the task row, its owner/involved participants, and the
// audit event. Shared by createTask (one task from the form) and importTasks (a row it couldn't
// save as part of a batch), so an imported task is stored exactly like a hand-made one. Callers
// have already run taskCreateSchema and checked task.create; revalidation is theirs too.
export async function insertTask(supabase: SupabaseClient, actor: AuditActor, input: TaskCreateInput) {
  const { owners, people_involved, ...taskColumns } = input;
  const { data, error } = await supabase.from("tasks").insert(taskRow(actor, taskColumns, owners)).select().single();
  if (error) return { ok: false as const, error: error.message };

  const { error: participantsError } = await supabase
    .from("task_participants")
    .insert(taskParticipantRows(data.id, owners, people_involved));
  if (participantsError) {
    await rollBackTasks(supabase, actor, [data.id]);
    return { ok: false as const, error: participantsError.message };
  }

  await logTaskCreated(supabase, actor, data, owners);
  return { ok: true as const, data };
}

// insertTask for many tasks at once: one insert for the task rows, one for all their
// participants, one for the audit events — three requests for the whole batch instead of four
// per task, which is what makes a 1000-row import finish in seconds. Ids are generated here so
// each participant row can name its task without depending on the order Postgres returns
// inserted rows in. All-or-nothing: if any row fails, the batch is rolled back and the caller
// retries its rows one by one through insertTask to find out which.
export async function insertTaskBatch(supabase: SupabaseClient, actor: AuditActor, inputs: TaskCreateInput[]) {
  const tasks = inputs.map(({ owners, people_involved, ...taskColumns }) => ({
    id: crypto.randomUUID(),
    taskColumns,
    owners,
    people_involved,
  }));

  const { error } = await supabase
    .from("tasks")
    .insert(tasks.map(({ id, taskColumns, owners }) => ({ id, ...taskRow(actor, taskColumns, owners) })));
  if (error) return { ok: false as const, error: error.message };

  const { error: participantsError } = await supabase
    .from("task_participants")
    .insert(tasks.flatMap(({ id, owners, people_involved }) => taskParticipantRows(id, owners, people_involved)));
  if (participantsError) {
    await rollBackTasks(supabase, actor, tasks.map(({ id }) => id));
    return { ok: false as const, error: participantsError.message };
  }

  await logTasksCreated(
    supabase,
    actor,
    tasks.map(({ id, taskColumns, owners }) => ({ id, task_name: taskColumns.task_name, ownerKeys: owners }))
  );
  return { ok: true as const };
}

function firstIndividualOwnerId(owners: string[]) {
  for (const key of owners) {
    const party = parsePartyKey(key);
    if (party?.kind === "user") return party.id;
  }
  return null;
}
