"use server";

import { revalidatePath } from "next/cache";
import { addDays, format, subDays } from "date-fns";
import { requirePermission } from "@/lib/require-permission";
import { getGoogleOAuthEnv } from "@/lib/env.server";
import { hasGoogleCalendarToken } from "@/lib/google/oauth-tokens";
import { pushTaskToGoogleCalendar } from "@/lib/google/task-calendar-sync";
import { isGoogleCalendarEligible } from "@/lib/calendar-eligibility";

// Manual, button-triggered ONE-WAY push (see calendar-toolbar.tsx's Sync button) — not a
// background poller, and not a two-way reconcile. Bounded to a fixed window around today
// rather than the page's current view, so the result doesn't depend on which month the user
// happened to be looking at.
const SYNC_WINDOW_DAYS_PAST = 90;
const SYNC_WINDOW_DAYS_FUTURE = 180;

export async function syncGoogleCalendar() {
  const auth = await requirePermission("calendar.sync_google");
  if (!auth.ok) return auth;

  // Account-level eligibility on top of the capability check: external users have no
  // Workspace Google account at all, so this must never be reachable for them regardless of
  // token state. See lib/calendar-eligibility.ts.
  if (!isGoogleCalendarEligible({ role: auth.role, email: auth.email })) {
    return { ok: false as const, error: "Google Calendar sync is only available for Google Workspace accounts." };
  }

  // TEMPORARY — per-user OAuth (google_oauth_tokens), the dev-friendly stopgap for personal
  // @gmail.com test accounts that domain-wide delegation can't reach. See lib/google/
  // calendar.ts's top comment for the plan to revisit this once real Workspace accounts
  // are in use.
  if (!getGoogleOAuthEnv()) {
    return { ok: false as const, error: "Google Calendar sync isn't configured yet — ask an admin to set it up." };
  }
  if (!(await hasGoogleCalendarToken(auth.userId))) {
    return {
      ok: false as const,
      error: "Google Calendar isn't connected yet — sign out and sign back in to grant access.",
    };
  }

  const today = new Date();
  const from = format(subDays(today, SYNC_WINDOW_DAYS_PAST), "yyyy-MM-dd");
  const to = format(addDays(today, SYNC_WINDOW_DAYS_FUTURE), "yyyy-MM-dd");

  // Tasks this user OWNS, read from task_participants via the task_participant_profiles view
  // (0015) — so a task owned by their department counts, not only one where they're named
  // personally. Deliberately not tasks.assignee_id, which 0015 superseded and which is null
  // for the department-owned tasks that make up almost the whole dataset.
  const { data: ownerRows, error: ownerError } = await auth.supabase
    .from("task_participant_profiles")
    .select("task_id")
    .eq("profile_id", auth.userId)
    .eq("role", "owner");
  if (ownerError) return { ok: false as const, error: ownerError.message };

  const ownedTaskIds = (ownerRows ?? []).flatMap((row) => (row.task_id ? [row.task_id] : []));
  if (ownedTaskIds.length === 0) {
    return { ok: true as const, pushedCount: 0, skippedCount: 0 };
  }

  const { data: tasks, error: tasksError } = await auth.supabase
    .from("tasks")
    .select("id, task_name, due_date, google_event_id, google_calendar_owner_id")
    .in("id", ownedTaskIds)
    .is("deleted_at", null)
    .gte("due_date", from)
    .lte("due_date", to);
  if (tasksError) return { ok: false as const, error: tasksError.message };

  let pushedCount = 0;
  let skippedCount = 0;

  // The gte/lte range above already guarantees due_date is non-null for every matched row —
  // this narrows the type to match, rather than being a runtime filter.
  const datedTasks = (tasks ?? []).filter(
    (task): task is typeof task & { due_date: string } => task.due_date !== null
  );

  for (const task of datedTasks) {
    // A task maps to exactly one google_event_id, so it can only live on one calendar. Joint
    // ownership is the norm here (the client's export has two owners on a third of all rows),
    // so the rule is first-claim-wins: whoever syncs first owns the event, and everyone else
    // skips it rather than minting a duplicate event and orphaning the original.
    if (task.google_calendar_owner_id && task.google_calendar_owner_id !== auth.userId) {
      skippedCount++;
      continue;
    }

    const pushed = await pushTaskToGoogleCalendar(auth.supabase, task, auth.userId);
    if (pushed) pushedCount++;
  }

  revalidatePath("/calendar");
  return { ok: true as const, pushedCount, skippedCount };
}
