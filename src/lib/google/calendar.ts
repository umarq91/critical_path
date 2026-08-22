import "server-only";
import { google, type calendar_v3 } from "googleapis";
import { addDays, format } from "date-fns";
import { getGoogleOAuthEnv } from "@/lib/env.server";
import { getStoredGoogleTokens, saveGoogleTokens } from "@/lib/google/oauth-tokens";

// Per-user OAuth (not domain-wide delegation — see auth.ts/admin-directory.ts for that
// path, still used for role sync). Works with any Google account, which is what makes it
// usable in dev against personal @gmail.com test accounts as well as a real Workspace
// later. google-button.tsx requests the calendar.events scope + offline access at sign-in;
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

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  /** RFC3339 timestamp of the event's last edit on Google's side — drives sync conflict resolution. */
  updatedAt: string;
  /** yyyy-MM-dd when it's an all-day event. */
  startDate: string | null;
  /** RFC3339 when it's a timed event. */
  startDateTime: string | null;
  endDateTime: string | null;
  allDay: boolean;
}

// Lists events on the user's own primary calendar within [timeMin, timeMax). No sync token —
// this is a manual, button-triggered sync (not a background poller), so a plain bounded list
// call each run is simpler and avoids managing token expiry/invalidation.
export async function listCalendarEvents(profileId: string, timeMin: string, timeMax: string): Promise<GoogleCalendarEvent[]> {
  const calendar = await getCalendarClientForProfile(profileId);
  if (!calendar) return [];

  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const { data } = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      maxResults: 250,
      pageToken,
    });

    for (const item of data.items ?? []) {
      if (!item.id || !item.updated) continue;
      const allDay = !!item.start?.date;
      events.push({
        id: item.id,
        title: item.summary ?? "(No title)",
        updatedAt: item.updated,
        startDate: item.start?.date ?? null,
        startDateTime: item.start?.dateTime ?? null,
        endDateTime: item.end?.dateTime ?? null,
        allDay,
      });
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return events;
}

// Tasks only carry a due_date, no time — a synced task is always pushed as an all-day event.
// Google's all-day convention is an exclusive end date, so `end.date` is one day after start.
export async function upsertTaskCalendarEvent(
  profileId: string,
  { eventId, title, date }: { eventId: string | null; title: string; date: string }
): Promise<{ id: string; updatedAt: string } | null> {
  const calendar = await getCalendarClientForProfile(profileId);
  if (!calendar) return null;

  const requestBody: calendar_v3.Schema$Event = {
    summary: title,
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

export async function deleteTaskCalendarEvent(profileId: string, eventId: string): Promise<void> {
  const calendar = await getCalendarClientForProfile(profileId);
  if (!calendar) return;
  try {
    await calendar.events.delete({ calendarId: "primary", eventId });
  } catch (error) {
    // Best-effort cleanup — already gone / unreachable shouldn't block the task's own delete.
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
