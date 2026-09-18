import "server-only";
import { upsertCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface SyncableTask {
  id: string;
  task_name: string;
  // Callers of pushTaskToGoogleCalendar always have a due_date in hand by construction (the
  // Sync button's own query range-filters on it; resyncTaskCalendarEvent below branches away
  // before calling this for a task whose due_date is null) — an all-day Google Calendar event
  // has nowhere to go without one.
  due_date: string;
  google_event_id: string | null;
  google_calendar_owner_id?: string | null;
}

// The single outbound write: push one task to one Google Calendar and record that it happened.
// Shared by the Calendar page's Sync action (bulk) and by updateTask (keeping an already-synced
// event in step with its task), so the columns are stamped identically from both.
//
// google_synced_at is OUR push time, not Google's `updated` timestamp. Under one-way sync the
// column only answers "when did we last write this out"; it is never compared against anything
// Google reports (0019).
//
// Uses the caller's RLS-scoped client for the task write on purpose — a push must not be able
// to update a task the caller couldn't otherwise update. Only the token read reaches for the
// service role, inside lib/google/oauth-tokens.ts, which is its one sanctioned access path.
export async function pushTaskToGoogleCalendar(
  supabase: SupabaseClient,
  task: SyncableTask,
  calendarOwnerId: string
): Promise<boolean> {
  const result = await upsertCalendarEvent(calendarOwnerId, {
    eventId: task.google_event_id,
    title: task.task_name,
    date: task.due_date,
  });
  if (!result) return false;

  const { error } = await supabase
    .from("tasks")
    .update({
      google_event_id: result.id,
      google_calendar_owner_id: calendarOwnerId,
      google_synced_at: new Date().toISOString(),
    })
    .eq("id", task.id);

  return !error;
}

// Called after a task edit so an event that already exists on someone's calendar reflects the
// new title/date. Does nothing for a task that was never synced — an edit is not the moment to
// start pushing a task to a calendar nobody asked for; that's what the Sync button is for.
//
// The event is refreshed on whichever account actually holds it, which is not necessarily the
// person doing the editing. Best-effort: a Google outage must not fail an otherwise valid task
// update, so callers ignore the result.
export async function resyncTaskCalendarEvent(supabase: SupabaseClient, taskId: string): Promise<void> {
  const { data: task } = await supabase
    .from("tasks")
    .select("id, task_name, due_date, google_event_id, google_calendar_owner_id")
    .eq("id", taskId)
    .single();

  if (!task?.google_event_id || !task.google_calendar_owner_id) return;

  // due_date is nullable; an all-day event can't exist with no date to anchor it, so clearing
  // the due date on an already-synced task removes the event instead of pushing garbage.
  if (!task.due_date) {
    await deleteCalendarEvent(task.google_calendar_owner_id, task.google_event_id);
    await supabase
      .from("tasks")
      .update({ google_event_id: null, google_calendar_owner_id: null })
      .eq("id", task.id);
    return;
  }

  await pushTaskToGoogleCalendar(supabase, { ...task, due_date: task.due_date }, task.google_calendar_owner_id);
}
