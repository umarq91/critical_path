"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { listTasksForProfile, type ListTasksParams } from "@/data/tasks";
import { reminderTimingSchema, reminderTasksSchema } from "@/app/(app)/settings/notifications/reminder-schema";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Every action here is gated on "profile.update_own" — reminders are a personal preference
// (like the profile itself), not a distinct capability decision, and that action is already
// granted to every role including external. There is no admin override: a rule always belongs
// to exactly the profile that owns it, enforced again by RLS (reminder_rules_own_row).

// Powers the task picker dialog's season/owner filters and search — a read, but triggered by
// client interaction (opening the dialog, changing a filter) rather than page load, same
// reasoning as refreshTasks(). Same "created/owned/involved" scope as the My Tasks page itself
// (listTasksForProfile), with no due-date floor — a task with no due date, or one already
// overdue, can still be picked; listDueReminders() (data/reminders.ts) simply never fires for
// one that has no due_date, so selecting it is harmless rather than invalid.
export async function listMyReminderCandidateTasks(params: ListTasksParams) {
  const auth = await requirePermission("profile.update_own");
  if (!auth.ok) return auth;

  const result = await listTasksForProfile(auth.userId, params);
  return { ok: true as const, data: result.data, rowCount: result.rowCount };
}

async function ensureReminderRuleId(supabase: SupabaseClient, profileId: string) {
  const { data: existing } = await supabase.from("reminder_rules").select("id").eq("profile_id", profileId).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("reminder_rules")
    .insert({ profile_id: profileId })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export async function updateReminderTiming(input: unknown) {
  const auth = await requirePermission("profile.update_own");
  if (!auth.ok) return auth;

  const parsed = reminderTimingSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ruleId = await ensureReminderRuleId(auth.supabase, auth.userId);
  const { error } = await auth.supabase
    .from("reminder_rules")
    .update({
      offset_days: parsed.data.offsetDays,
      notify_hour: parsed.data.notifyHour,
      is_enabled: parsed.data.isEnabled,
    })
    .eq("id", ruleId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/settings/notifications");
  return { ok: true as const };
}

export async function updateReminderTasks(input: unknown) {
  const auth = await requirePermission("profile.update_own");
  if (!auth.ok) return auth;

  const parsed = reminderTasksSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ruleId = await ensureReminderRuleId(auth.supabase, auth.userId);

  // Replace the whole set rather than diffing add/remove — same pattern brands/_actions.ts
  // uses for brand_seasons; this is a low-frequency settings edit, not a hot write path.
  const { error: deleteError } = await auth.supabase.from("reminder_rule_tasks").delete().eq("rule_id", ruleId);
  if (deleteError) return { ok: false as const, error: deleteError.message };

  if (parsed.data.taskIds.length > 0) {
    const { error: insertError } = await auth.supabase
      .from("reminder_rule_tasks")
      .insert(parsed.data.taskIds.map((taskId) => ({ rule_id: ruleId, task_id: taskId })));
    if (insertError) return { ok: false as const, error: insertError.message };
  }

  revalidatePath("/settings/notifications");
  return { ok: true as const };
}
