import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ListExternalCalendarEventsParams {
  profileId: string;
  /** Inclusive, yyyy-MM-dd. */
  from: string;
  /** Inclusive, yyyy-MM-dd. */
  to: string;
}

// Read-only overlay of a user's other Google Calendar events (meetings, personal events —
// anything not created from a task by syncGoogleCalendar). Scoped by RLS to the caller's own
// rows regardless of profileId, since external_calendar_events has no org-wide read policy
// like tasks does.
export async function listExternalCalendarEvents({ profileId, from, to }: ListExternalCalendarEventsParams) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("external_calendar_events")
    .select("*")
    .eq("profile_id", profileId)
    .gte("starts_at", `${from}T00:00:00Z`)
    .lte("starts_at", `${to}T23:59:59Z`)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type ExternalCalendarEvent = Awaited<ReturnType<typeof listExternalCalendarEvents>>[number];
