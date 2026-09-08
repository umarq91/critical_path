"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { taskParticipantsSchema } from "@/app/(app)/tasks/schema";
import { searchParties, type SearchPartiesParams } from "@/data/parties";
import { participantRows, partyKey, type ParticipantRole } from "@/lib/party";
import { logParticipantsChanged, partyLabels } from "@/app/(app)/tasks/_audit";
import type { createClient } from "@/lib/supabase/server";
import type { AuditPartyChange } from "@/types/audit";

// Split out of _actions.ts: same feature, but Owners / People Involved are rows in
// task_participants rather than columns on `tasks`, and keeping both in one file pushed it
// well past the size where it stays readable.

// Powers the Owners / People Involved search dropdown (tasks/party-search-dropdown.tsx) —
// gated on task.assign since that's the same permission the save below requires, and only
// people who can assign have any reason to search.
export async function searchAssignableParties(params: SearchPartiesParams) {
  const auth = await requirePermission("task.assign");
  if (!auth.ok) return auth;

  const result = await searchParties(params);
  return { ok: true as const, data: result.data, truncated: result.truncated };
}

// The ONLY write path for task participants, and it takes the whole set for both roles at
// once. The detail drawer buffers add/remove locally and calls this on Save — there is
// deliberately no per-party action any more: those wrote on every click, so one editing
// session left a trail of log rows instead of the single "here's what changed" entry the log
// is for. Anything new that changes participants goes through here too.
export async function setTaskParticipants(taskId: string, input: unknown) {
  const auth = await requirePermission("task.assign");
  if (!auth.ok) return auth;

  const parsed = taskParticipantsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // The write is a wholesale replace, but the log has to read as what actually changed — so the
  // previous set is captured first and diffed per role. Logging "owners set to X, Y" on every
  // save would make a no-op re-save indistinguishable from a handover.
  const { data: previous } = await auth.supabase
    .from("task_participants")
    .select("role, profile_id, department_id")
    .eq("task_id", taskId);

  const { error: deleteError } = await auth.supabase.from("task_participants").delete().eq("task_id", taskId);
  if (deleteError) return { ok: false as const, error: deleteError.message };

  const rows = [
    ...participantRows(taskId, parsed.data.owners, "owner"),
    ...participantRows(taskId, parsed.data.people_involved, "involved"),
  ];
  const { error } = await auth.supabase.from("task_participants").insert(rows);
  if (error) return { ok: false as const, error: error.message };

  const parties = [
    await diffRole(auth.supabase, "owner", previous, parsed.data.owners),
    await diffRole(auth.supabase, "involved", previous, parsed.data.people_involved),
  ];
  await logParticipantsChanged(auth.supabase, { userId: auth.userId, email: auth.email }, taskId, parties);

  revalidatePath("/tasks");
  return { ok: true as const };
}

type ParticipantRow = { role: ParticipantRole; profile_id: string | null; department_id: string | null };
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function diffRole(
  supabase: SupabaseClient,
  role: ParticipantRole,
  previous: ParticipantRow[] | null,
  nextKeys: string[]
): Promise<AuditPartyChange> {
  const previousKeys: string[] = (previous ?? []).flatMap((row) => {
    if (row.role !== role) return [];
    if (row.profile_id) return [partyKey({ kind: "user", id: row.profile_id })];
    return row.department_id ? [partyKey({ kind: "department", id: row.department_id })] : [];
  });

  const added = nextKeys.filter((key) => !previousKeys.includes(key));
  const removed = previousKeys.filter((key) => !nextKeys.includes(key));

  return {
    role,
    added: await partyLabels(supabase, added),
    removed: await partyLabels(supabase, removed),
  };
}
