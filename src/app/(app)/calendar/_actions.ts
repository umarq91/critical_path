"use server";

import { revalidatePath } from "next/cache";
import { addDays, format, isAfter, parseISO, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getGoogleOAuthEnv } from "@/lib/env.server";
import { listCalendarEvents, upsertTaskCalendarEvent, type GoogleCalendarEvent } from "@/lib/google/calendar";
import { hasGoogleCalendarToken } from "@/lib/google/oauth-tokens";
import { can } from "@/lib/permissions";

// Manual, button-triggered two-way sync (see calendar-toolbar.tsx's Sync button) — not a
// background poller. Bounded to a fixed window around today rather than the page's current
// view, so the result doesn't depend on which month the user happened to be looking at.
const SYNC_WINDOW_DAYS_PAST = 90;
const SYNC_WINDOW_DAYS_FUTURE = 180;

function toEventTimestamp(event: GoogleCalendarEvent) {
  if (event.allDay && event.startDate) {
    return { starts_at: `${event.startDate}T00:00:00Z`, ends_at: null as string | null, all_day: true };
  }
  return {
    starts_at: event.startDateTime ?? new Date().toISOString(),
    ends_at: event.endDateTime ?? null,
    all_day: false,
  };
}

export async function syncGoogleCalendar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile) return { ok: false as const, error: "Not authenticated" };

  // TEMPORARY — per-user OAuth (google_oauth_tokens), the dev-friendly stopgap for personal
  // @gmail.com test accounts that domain-wide delegation can't reach. See lib/google/
  // calendar.ts's top comment for the plan to revisit this once real Workspace accounts
  // are in use.
  if (!getGoogleOAuthEnv()) {
    return { ok: false as const, error: "Google Calendar sync isn't configured yet — ask an admin to set it up." };
  }
  if (!(await hasGoogleCalendarToken(profile.id))) {
    return {
      ok: false as const,
      error: "Google Calendar isn't connected yet — sign out and sign back in to grant access.",
    };
  }

  // Task writes below go through the RLS-scoped client, which requires task.update — a
  // viewer's write would just be silently dropped by RLS otherwise, still reporting success.
  // Viewers still get the read-only "everything else" pull further down.
  const canWriteTasks = can(profile.role, "task.update");

  const today = new Date();
  const windowStart = subDays(today, SYNC_WINDOW_DAYS_PAST);
  const windowEnd = addDays(today, SYNC_WINDOW_DAYS_FUTURE);
  const from = format(windowStart, "yyyy-MM-dd");
  const to = format(windowEnd, "yyyy-MM-dd");

  const [{ data: assignedTasks }, googleEvents] = await Promise.all([
    canWriteTasks
      ? supabase
          .from("tasks")
          .select("id, task_name, due_date, google_event_id, google_synced_at")
          .is("deleted_at", null)
          .eq("assignee_id", profile.id)
          .gte("due_date", from)
          .lte("due_date", to)
      : Promise.resolve({ data: [] }),
    listCalendarEvents(profile.id, `${from}T00:00:00Z`, `${to}T23:59:59Z`),
  ]);

  const googleEventsById = new Map(googleEvents.map((event) => [event.id, event]));
  const handledEventIds = new Set<string>();
  let pushedCount = 0;
  let pulledCount = 0;

  // Only the assignee's own tasks are pushed — a task has exactly one Google Calendar event,
  // so it can only live on one person's calendar, and "the person responsible for it" is the
  // one unambiguous choice. Tasks you only created or are involved in still show in the app's
  // calendar (data/tasks.ts's involvesProfileId scope), they just aren't pushed to your
  // personal Google Calendar too — that would double up the same task across everyone's
  // calendars against a single google_event_id column.
  for (const task of assignedTasks ?? []) {
    const remoteEvent = task.google_event_id ? googleEventsById.get(task.google_event_id) : undefined;
    const remoteChangedSinceLastSync =
      remoteEvent && task.google_synced_at && isAfter(parseISO(remoteEvent.updatedAt), parseISO(task.google_synced_at));

    if (remoteChangedSinceLastSync && remoteEvent) {
      handledEventIds.add(remoteEvent.id);
      const nextDueDate = remoteEvent.allDay && remoteEvent.startDate ? remoteEvent.startDate : task.due_date;
      await supabase
        .from("tasks")
        .update({
          task_name: remoteEvent.title,
          due_date: nextDueDate,
          google_synced_at: remoteEvent.updatedAt,
          last_edited_by: profile.id,
        })
        .eq("id", task.id);
      pulledCount++;
      continue;
    }

    const result = await upsertTaskCalendarEvent(profile.id, {
      eventId: task.google_event_id,
      title: task.task_name,
      date: task.due_date,
    });
    if (!result) continue;

    handledEventIds.add(result.id);
    await supabase
      .from("tasks")
      .update({
        google_event_id: result.id,
        google_calendar_owner_id: profile.id,
        google_synced_at: result.updatedAt,
      })
      .eq("id", task.id);
    pushedCount++;
  }

  // Everything else on the calendar (not linked to one of this user's tasks) is a read-only
  // overlay — cached so the app's calendar can show it without calling Google on every page
  // load.
  const externalEvents = googleEvents.filter((event) => !handledEventIds.has(event.id));
  if (externalEvents.length > 0) {
    await supabase.from("external_calendar_events").upsert(
      externalEvents.map((event) => ({
        profile_id: profile.id,
        google_event_id: event.id,
        title: event.title,
        last_synced_at: new Date().toISOString(),
        ...toEventTimestamp(event),
      })),
      { onConflict: "profile_id,google_event_id" }
    );
  }

  // Anything cached in this window that Google no longer returned (and isn't one of this
  // run's task-linked events) was deleted upstream since the last sync — drop it too.
  const freshExternalIds = new Set(externalEvents.map((event) => event.id));
  const { data: cachedInWindow } = await supabase
    .from("external_calendar_events")
    .select("id, google_event_id")
    .eq("profile_id", profile.id)
    .gte("starts_at", `${from}T00:00:00Z`)
    .lte("starts_at", `${to}T23:59:59Z`);
  const staleIds = (cachedInWindow ?? [])
    .filter((row) => !freshExternalIds.has(row.google_event_id) && !handledEventIds.has(row.google_event_id))
    .map((row) => row.id);
  if (staleIds.length > 0) {
    await supabase.from("external_calendar_events").delete().in("id", staleIds);
  }

  revalidatePath("/calendar");
  return {
    ok: true as const,
    pushedCount,
    pulledCount,
    importedCount: externalEvents.length,
  };
}
