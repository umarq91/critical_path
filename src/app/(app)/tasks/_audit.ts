import "server-only";
import { recordAuditEvent, diffFields } from "@/lib/audit";
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@/constants/audit";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_PRIORITY_CONFIG } from "@/constants/task-priority";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { parsePartyKey } from "@/lib/party";
import { formatDate } from "@/lib/dates";
import type { createClient } from "@/lib/supabase/server";
import type { AuditPartyChange } from "@/types/audit";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface AuditActor {
  userId: string;
  email: string | null;
}

// Columns whose value is a uuid the reader can't possibly recognise. Each is resolved to the
// lookup's own display column at write time, so the log row stays readable forever — including
// after that season is renamed, or the brand it named is deleted.
const LOOKUP_COLUMNS = {
  season_id: { table: "seasons", column: "season_name" },
  brand_id: { table: "brands", column: "brand_name" },
  key_stage_id: { table: "key_stages", column: "name" },
} as const;

const DATE_FIELDS = new Set(["due_date", "start_date", "end_date"]);

const BADGE_LABELS: Record<string, Record<string, { label: string }>> = {
  status: TASK_STATUS_CONFIG,
  priority: TASK_PRIORITY_CONFIG,
  gender: TASK_GENDER_CONFIG,
};

function isLookupField(field: string): field is keyof typeof LOOKUP_COLUMNS {
  return field in LOOKUP_COLUMNS;
}

// Turns one raw column value into the string the Logs page shows. Async only because the three
// FK fields need a lookup — and only when they actually changed, which diffFields guarantees,
// so a typical single-field edit still costs zero extra queries.
async function formatTaskValue(supabase: SupabaseClient, field: string, value: unknown): Promise<string | null> {
  if (value === null || value === undefined || value === "" || value === "none") return null;
  if (typeof value !== "string") return String(value);

  if (isLookupField(field)) {
    const { table, column } = LOOKUP_COLUMNS[field];
    const { data } = await supabase.from(table).select(column).eq("id", value).maybeSingle();
    const row = data as Record<string, string> | null;
    return row?.[column] ?? null;
  }

  if (DATE_FIELDS.has(field)) return formatDate(value);
  return BADGE_LABELS[field]?.[value]?.label ?? value;
}

// Party keys (`kind:uuid`) → the names a person reads. Two queries at most regardless of how
// many parties are involved, rather than one per key.
export async function partyLabels(supabase: SupabaseClient, keys: string[]): Promise<string[]> {
  const refs = keys.flatMap((key) => {
    const party = parsePartyKey(key);
    return party ? [party] : [];
  });
  const profileIds = refs.filter((ref) => ref.kind === "user").map((ref) => ref.id);
  const departmentIds = refs.filter((ref) => ref.kind === "department").map((ref) => ref.id);

  const [profiles, departments] = await Promise.all([
    profileIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
      : Promise.resolve({ data: [] }),
    departmentIds.length
      ? supabase.from("departments").select("id, name").in("id", departmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const names = new Map<string, string>();
  for (const row of profiles.data ?? []) names.set(`user:${row.id}`, row.full_name ?? row.email);
  for (const row of departments.data ?? []) names.set(`department:${row.id}`, row.name);

  // An unresolvable key still gets a row rather than silently vanishing from the log — the
  // party it named is gone, which is itself worth seeing.
  return keys.map((key) => names.get(key) ?? "Unknown");
}

function taskEvent(actor: AuditActor, taskId: string, taskName: string | null) {
  return {
    actorId: actor.userId,
    actorEmail: actor.email,
    entityType: AUDIT_ENTITY_TYPE.TASK,
    entityId: taskId,
    entityLabel: taskName,
  };
}

export async function logTaskCreated(
  supabase: SupabaseClient,
  actor: AuditActor,
  task: { id: string; task_name: string },
  ownerKeys: string[]
) {
  await recordAuditEvent(supabase, {
    ...taskEvent(actor, task.id, task.task_name),
    action: AUDIT_ACTION.TASK_CREATE,
    changes: { owners: await partyLabels(supabase, ownerKeys) },
  });
}

export async function logTaskUpdated(
  supabase: SupabaseClient,
  actor: AuditActor,
  before: Record<string, unknown> & { id: string; task_name: string },
  patch: Record<string, unknown>
) {
  const fields = await diffFields(before, patch, (field, value) => formatTaskValue(supabase, field, value));
  // A patch that changed nothing (re-submitting a form untouched, an inline edit confirmed
  // without a keystroke) is not an event — logging it would bury the real ones.
  if (fields.length === 0) return;

  await recordAuditEvent(supabase, {
    // The name the task had BEFORE this edit. A rename then reads "Task Name: old → new" under
    // the label it was known by at the time, which is what makes the entry findable later.
    ...taskEvent(actor, before.id, before.task_name),
    action: AUDIT_ACTION.TASK_UPDATE,
    changes: { fields },
  });
}

export async function logTaskDeleted(
  supabase: SupabaseClient,
  actor: AuditActor,
  task: { id: string; task_name: string | null }
) {
  await recordAuditEvent(supabase, {
    ...taskEvent(actor, task.id, task.task_name),
    action: AUDIT_ACTION.TASK_DELETE,
  });
}

// Owner and People Involved changes are the one part of this that `tasks`' own tracking columns
// can't see at all — they're writes to task_participants, which leaves the task row untouched.
//
// ONE entry per save, covering every role touched. The drawer confirms owners and people
// involved together, so this takes the whole set of role changes rather than being called once
// per role — two rows for one confirmed edit is what made the log unreadable.
export async function logParticipantsChanged(
  supabase: SupabaseClient,
  actor: AuditActor,
  taskId: string,
  parties: AuditPartyChange[]
) {
  const touched = parties.filter((party) => party.added.length > 0 || party.removed.length > 0);
  if (touched.length === 0) return;

  const { data: task } = await supabase.from("tasks").select("task_name").eq("id", taskId).maybeSingle();

  await recordAuditEvent(supabase, {
    ...taskEvent(actor, taskId, task?.task_name ?? null),
    action: AUDIT_ACTION.TASK_PARTICIPANTS_CHANGE,
    changes: { parties: touched },
  });
}
