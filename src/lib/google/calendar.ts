import "server-only";
import { google, type calendar_v3 } from "googleapis";
import { addDays, format } from "date-fns";
import { getGoogleOAuthEnv } from "@/lib/env.server";
import { getStoredGoogleTokens, saveGoogleTokens } from "@/lib/google/oauth-tokens";

// ONE-WAY: platform task → Google Calendar. This module writes events and deletes them; it
// deliberately has no read path. Nothing here may return calendar data into the app, because
// the platform database is the sole source of truth for a task — an event edited on someone's
// phone must never travel back and rewrite a task's name or due date (0019).
//
// Per-user OAuth (not domain-wide delegation — see auth.ts/admin-directory.ts for that path,
// still used for role sync). Works with any Google account, which is what makes it usable in
// dev against personal @gmail.com test accounts as well as a real Workspace later.
// google-button.tsx requests the calendar.events scope + offline access at sign-in;
// auth/callback/route.ts stores the resulting tokens; this module reads and refreshes them.
async function getCalendarClientForProfile(profileId: string) {
  const env = getGoogleOAuthEnv();
  if (!env) return null;

  const tokens = await getStoredGoogleTokens(profileId);
  if (!tokens) return null; // user hasn't granted Calendar access yet (signed in before this scope existed)

  const oauth2Client = new google.auth.OAuth2(env.GOOGLE_OAUTH_CLIENT_ID, env.GOOGLE_OAUTH_CLIENT_SECRET);
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? undefined,
    expiry_date: new Date(tokens.expiresAt).getTime(),
  });

  // googleapis transparently refreshes an expired access_token before the next API call
  // when a refresh_token is set, and fires this event with the new credentials — persist
  // them so the next sync doesn't have to refresh again.
  oauth2Client.on("tokens", (newTokens) => {
    if (!newTokens.access_token || !newTokens.expiry_date) return;
    void saveGoogleTokens(profileId, {
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token,
      expiresAt: new Date(newTokens.expiry_date).toISOString(),
    });
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

// Generic all-day event push — shared by tasks (task-calendar-sync.ts) and holidays
// (holiday-calendar-sync.ts), neither of which carries a time of day. Google's all-day
// convention is an exclusive end date, so `end.date` is one day after start.
//
// Returns the event id and Google's `updated` timestamp; the caller stores the id to find
// this event again and stamps its own "last pushed" column. Neither value is ever compared
// against the source row to decide who "wins" — there is no conflict to resolve when only one
// side can write (0019).
export async function upsertCalendarEvent(
  profileId: string,
  { eventId, title, date, description }: { eventId: string | null; title: string; date: string; description?: string }
): Promise<{ id: string; updatedAt: string } | null> {
  const calendar = await getCalendarClientForProfile(profileId);
  if (!calendar) return null;

  const requestBody: calendar_v3.Schema$Event = {
    summary: title,
    description,
    start: { date },
    end: { date: format(addDays(new Date(`${date}T00:00:00`), 1), "yyyy-MM-dd") },
  };

  const data = await upsertEvent(calendar, eventId, requestBody);
  if (!data?.id || !data.updated) return null;
  return { id: data.id, updatedAt: data.updated };
}

// Falls back to creating a new event if the stored eventId was deleted on Google's side
// (manually removed from the user's calendar between syncs) instead of failing the whole
// sync run — self-heals the link on the next push.
async function upsertEvent(calendar: calendar_v3.Calendar, eventId: string | null, requestBody: calendar_v3.Schema$Event) {
  if (!eventId) {
    const { data } = await calendar.events.insert({ calendarId: "primary", requestBody });
    return data;
  }
  try {
    const { data } = await calendar.events.update({ calendarId: "primary", eventId, requestBody });
    return data;
  } catch (error) {
    if (!isGoneOrNotFound(error)) throw error;
    const { data } = await calendar.events.insert({ calendarId: "primary", requestBody });
    return data;
  }
}

export async function deleteCalendarEvent(profileId: string, eventId: string): Promise<void> {
  const calendar = await getCalendarClientForProfile(profileId);
  if (!calendar) return;
  try {
    await calendar.events.delete({ calendarId: "primary", eventId });
  } catch (error) {
    // Best-effort cleanup — already gone / unreachable shouldn't block the source row's own delete.
    if (!isGoneOrNotFound(error)) throw error;
  }
}

function isGoneOrNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    [404, 410].includes((error as { code?: number }).code as number)
  );
}
