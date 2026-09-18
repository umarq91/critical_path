import "server-only";
import { upsertCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface SyncableHoliday {
  id: string;
  name: string;
  holiday_date: string;
}

// The holiday equivalent of pushTaskToGoogleCalendar (task-calendar-sync.ts) — but a holiday
// has no single owner column to stamp, since it can be pushed to MANY users' calendars
// independently. holiday_calendar_events (0028) is the per-(holiday, profile) slot a task
// gets for free from its own google_event_id/google_calendar_owner_id columns.
export async function pushHolidayToGoogleCalendar(
  supabase: SupabaseClient,
  holiday: SyncableHoliday,
  profileId: string,
  existingEventId: string | null
): Promise<boolean> {
  const result = await upsertCalendarEvent(profileId, {
    eventId: existingEventId,
    title: holiday.name,
    date: holiday.holiday_date,
  });
  if (!result) return false;

  const { error } = await supabase
    .from("holiday_calendar_events")
    .upsert({ holiday_id: holiday.id, profile_id: profileId, google_event_id: result.id }, { onConflict: "holiday_id,profile_id" });

  return !error;
}

// Called after an admin edits a holiday, so every calendar that already has it reflects the new
// name/date — mirrors resyncTaskCalendarEvent, just fanned out over every profile that had
// synced this one holiday instead of a single owner. Best-effort per profile: one account's
// stale token must not stop the others from updating.
export async function resyncHolidayCalendarEvents(supabase: SupabaseClient, holiday: SyncableHoliday): Promise<void> {
  const { data: links } = await supabase
    .from("holiday_calendar_events")
    .select("profile_id, google_event_id")
    .eq("holiday_id", holiday.id);

  for (const link of links ?? []) {
    await pushHolidayToGoogleCalendar(supabase, holiday, link.profile_id, link.google_event_id).catch(() => undefined);
  }
}

// Called before an admin deletes a holiday — holiday_calendar_events rows cascade-delete with
// it (0028), so the (profile, event id) pairs have to be read and cleaned up on the Google side
// first, or the link needed to find and remove each event is gone the moment the row is.
// Best-effort per profile, same reasoning as deleteTask's own cleanup call.
export async function deleteHolidayCalendarEvents(supabase: SupabaseClient, holidayId: string): Promise<void> {
  const { data: links } = await supabase
    .from("holiday_calendar_events")
    .select("profile_id, google_event_id")
    .eq("holiday_id", holidayId);

  for (const link of links ?? []) {
    await deleteCalendarEvent(link.profile_id, link.google_event_id).catch(() => undefined);
  }
}
