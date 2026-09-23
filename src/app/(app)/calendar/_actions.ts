"use server";

import { revalidatePath } from "next/cache";
import { addDays, format, subDays } from "date-fns";
import { requirePermission } from "@/lib/require-permission";
import { getGoogleOAuthEnv } from "@/lib/env.server";
import { hasGoogleCalendarToken } from "@/lib/google/oauth-tokens";
import { pushTaskToGoogleCalendar } from "@/lib/google/task-calendar-sync";
import { pushHolidayToGoogleCalendar } from "@/lib/google/holiday-calendar-sync";
import { deleteCalendarEvent } from "@/lib/google/calendar";
import { isGoogleCalendarEligible } from "@/lib/calendar-eligibility";
import { taskIdsForProfile } from "@/data/task-participants";

// Manual, button-triggered ONE-WAY push (see calendar-toolbar.tsx's Sync button) — not a
// background poller, and not a two-way reconcile. Bounded to a fixed window around today
// rather than the page's current view, so the result doesn't depend on which month the user
// happened to be looking at. Pushes both the caller's tasks and every public holiday in the
// window — two different scoping rules (a task is filtered to what this profile is involved
// in; a holiday has no such concept and goes to everyone who syncs), so they're two separate
// passes below, not one shared query.
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

  // Same scope as the My Tasks page (resolvePersonalScope in data/tasks.ts): created by them,
  // OR a participant in ANY role — owner or involved — named directly or through their
  // department (task_participant_profiles view, 0015). Previously this only looked at
  // role = "owner", which is why an "Involved" task never synced and made it look like only
  // self-created tasks pushed (a self-created task is nearly always also owner-participant).
  // Deliberately not tasks.assignee_id, which 0015 superseded and which is null for the
  // department-owned tasks that make up almost the whole dataset.
  const participantTaskIds = await taskIdsForProfile(auth.supabase, auth.userId);

  const { data: createdRows, error: createdError } = await auth.supabase
    .from("tasks")
    .select("id")
    .eq("created_by", auth.userId)
    .is("deleted_at", null);
  if (createdError) return { ok: false as const, error: createdError.message };

  const scopedIdSet = new Set([...participantTaskIds, ...(createdRows ?? []).map((row) => row.id)]);

  let tasksPushedCount = 0;
  let holidaysPushedCount = 0;
  let skippedCount = 0;
  let removedCount = 0;

  // Removal pass: every task this profile's Google Calendar currently holds an event for
  // (google_calendar_owner_id = them), but that has since dropped out of their scope — deleted,
  // or they were taken off it as owner/involved/creator. Sync is the only trigger for this
  // check (there's no background poller — see the module comment), which is what "hit sync and
  // it should come off my calendar" means for a one-way push: the platform never learns about a
  // removal until the next time it's told to push.
  //
  // Deliberately not restricted to the [from, to] window: an event already on the user's
  // calendar can have any due date, and the question here is scope, not date range.
  const { data: previouslySyncedRows, error: syncedError } = await auth.supabase
    .from("tasks")
    .select("id, google_event_id, deleted_at")
    .eq("google_calendar_owner_id", auth.userId)
    .not("google_event_id", "is", null);
  if (syncedError) return { ok: false as const, error: syncedError.message };

  for (const row of previouslySyncedRows ?? []) {
    const stillInScope = !row.deleted_at && scopedIdSet.has(row.id);
    if (stillInScope) continue;

    // Best-effort — an unreachable/already-gone Google event must not block clearing the
    // stale link on our side (same reasoning as deleteTask's own cleanup call).
    await deleteCalendarEvent(auth.userId, row.google_event_id!).catch(() => undefined);
    const { error: clearError } = await auth.supabase
      .from("tasks")
      .update({ google_event_id: null, google_calendar_owner_id: null })
      .eq("id", row.id);
    if (!clearError) removedCount++;
  }

  if (scopedIdSet.size > 0) {
    const { data: tasks, error: tasksError } = await auth.supabase
      .from("tasks")
      .select(
        "id, task_name, due_date, google_event_id, google_calendar_owner_id, season:seasons(season_name), participants:task_participants(role, profile:profiles(full_name, email), department:departments(name))"
      )
      .in("id", [...scopedIdSet])
      .is("deleted_at", null)
      .gte("due_date", from)
      .lte("due_date", to);
    if (tasksError) return { ok: false as const, error: tasksError.message };

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
      if (pushed) tasksPushedCount++;
    }
  }

  // Holidays have no owner column to skip/claim against (unlike a task) — every eligible user
  // who syncs gets every holiday in the window pushed to their own calendar independently, via
  // holiday_calendar_events (0028). Not scoped by the Calendar page's own country filter: same
  // "sync ignores view state" reasoning as the task window above.
  const { data: holidays, error: holidaysError } = await auth.supabase
    .from("public_holidays")
    .select("id, name, holiday_date")
    .gte("holiday_date", from)
    .lte("holiday_date", to);
  if (holidaysError) return { ok: false as const, error: holidaysError.message };

  if ((holidays ?? []).length > 0) {
    const { data: existingLinks, error: linksError } = await auth.supabase
      .from("holiday_calendar_events")
      .select("holiday_id, google_event_id")
      .eq("profile_id", auth.userId);
    if (linksError) return { ok: false as const, error: linksError.message };

    const existingEventIdByHolidayId = new Map((existingLinks ?? []).map((link) => [link.holiday_id, link.google_event_id]));

    for (const holiday of holidays ?? []) {
      const pushed = await pushHolidayToGoogleCalendar(
        auth.supabase,
        holiday,
        auth.userId,
        existingEventIdByHolidayId.get(holiday.id) ?? null
      );
      if (pushed) holidaysPushedCount++;
    }
  }

  revalidatePath("/calendar");
  return { ok: true as const, tasksPushedCount, holidaysPushedCount, skippedCount, removedCount };
}
