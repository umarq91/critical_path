import "server-only";
import { google, type calendar_v3 } from "googleapis";
import { addDays, format } from "date-fns";
import { getGoogleOAuthEnv } from "@/lib/env.server";
import { getStoredGoogleTokens, saveGoogleCalendarId, saveGoogleTokens } from "@/lib/google/oauth-tokens";
import { GOOGLE_CALENDAR_NAME } from "@/constants/google-calendar";

// ONE-WAY: platform task → Google Calendar. This module writes events and deletes them; it
// deliberately has no read path. Nothing here may return calendar data into the app, because
// the platform database is the sole source of truth for a task — an event edited on someone's
// phone must never travel back and rewrite a task's name or due date (0019).
//
// Per-user OAuth (not domain-wide delegation — see auth.ts/admin-directory.ts for that path,
// still used for role sync). Works with any Google account, which is what makes it usable in
// dev against personal @gmail.com test accounts as well as a real Workspace later.
// google-button.tsx requests the GOOGLE_CALENDAR_OAUTH_SCOPES + offline access at sign-in;
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

  return { calendar: google.calendar({ version: "v3", auth: oauth2Client }), cachedCalendarId: tokens.calendarId };
}

export const CALENDAR_DELETED_ERROR =
  "Your Critical Path Calendar was deleted in Google Calendar during this sync. Press Sync again to re-create it with every task and holiday.";

type CalendarClient = NonNullable<Awaited<ReturnType<typeof getCalendarClientForProfile>>>;

// Every push goes to the user's "Critical Path Calendar" secondary calendar, never "primary". Events that
// were pushed to primary before this change are left there. A stored google_event_id that points
// at one of them 404s against the secondary calendar. upsertEvent then re-inserts it there and
// deleteCalendarEvent treats it as already gone. So old links move over the next time they are
// pushed, and the primary copies are never touched.
//
// Listing the user's calendars reads calendar metadata only (name, id, access role). No event
// data comes back into the app, so this keeps the one-way rule above.
//
// The resolved id is cached in google_oauth_tokens.calendar_id (0031), so only the first push
// for a user lists their calendars. The in-flight map is not a cache. It only makes concurrent
// first pushes in one process share a single find-or-create, so they can't create two calendars.
const pendingResolutions = new Map<string, Promise<ResolvedCalendar>>();

interface ResolvedCalendar {
  calendarId: string;
  /** True only when this call created a brand-new, empty calendar on Google. */
  created: boolean;
}

async function resolveCalendarId(profileId: string, client: CalendarClient): Promise<ResolvedCalendar> {
  if (client.cachedCalendarId) return { calendarId: client.cachedCalendarId, created: false };

  const inFlight = pendingResolutions.get(profileId);
  if (inFlight) return inFlight;

  const pending = findOrCreateCriticalPathCalendar(client.calendar).then(async (resolved) => {
    await saveGoogleCalendarId(profileId, resolved.calendarId);
    client.cachedCalendarId = resolved.calendarId;
    return resolved;
  });
  pendingResolutions.set(profileId, pending);
  try {
    return await pending;
  } finally {
    pendingResolutions.delete(profileId);
  }
}

// Reads one calendar-list entry (metadata only, no events), so this keeps the one-way rule.
async function calendarStillExists(calendar: calendar_v3.Calendar, calendarId: string): Promise<boolean> {
  try {
    const { data } = await withRateLimitRetry(() => calendar.calendarList.get({ calendarId }));
    return !data.deleted;
  } catch (error) {
    if (isGoneOrNotFound(error)) return false;
    throw error;
  }
}

async function findOrCreateCriticalPathCalendar(calendar: calendar_v3.Calendar): Promise<ResolvedCalendar> {
  let pageToken: string | undefined;
  do {
    // minAccessRole "writer" leaves out a same-named calendar that was only shared read-only with
    // this user. We can't push to it, so it doesn't count as "already exists".
    const { data } = await calendar.calendarList.list({ minAccessRole: "writer", showDeleted: false, pageToken });
    const match = data.items?.find(
      (entry) => entry.id && (entry.summaryOverride ?? entry.summary) === GOOGLE_CALENDAR_NAME
    );
    if (match?.id) return { calendarId: match.id, created: false };
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  const { data: created } = await calendar.calendars.insert({ requestBody: { summary: GOOGLE_CALENDAR_NAME } });
  if (!created.id) throw new Error("Google Calendar did not return an id for the new calendar");
  return { calendarId: created.id, created: true };
}

// Called by planGoogleCalendarSync before any push, so a missing permission shows up as one clear
// error instead of every push failing on its own. Also creates the calendar on the first sync.
// Returns "missing_scope" for an account whose stored token was granted before the extra
// calendar scopes were added (or where the user unticked them on Google's consent screen).
//
// The cached calendar id is checked against Google first (one call per Sync). If the user deleted
// "Critical Path Calendar", this replaces it and returns "replaced": every event this user had was
// in the old calendar, so the caller must forget their task/holiday event links or Sync would
// skip them all as "already on your calendar" and leave the new calendar empty. "replaced" also
// covers a first-ever calendar being created, where there are no links to forget anyway.
export async function ensureCriticalPathCalendar(
  profileId: string
): Promise<"ok" | "replaced" | "not_connected" | "missing_scope"> {
  const client = await getCalendarClientForProfile(profileId);
  if (!client) return "not_connected";
  try {
    let lostCachedCalendar = false;
    if (client.cachedCalendarId && !(await calendarStillExists(client.calendar, client.cachedCalendarId))) {
      await saveGoogleCalendarId(profileId, null);
      client.cachedCalendarId = null;
      lostCachedCalendar = true;
    }
    const { created } = await resolveCalendarId(profileId, client);
    return lostCachedCalendar || created ? "replaced" : "ok";
  } catch (error) {
    if (errorCode(error) === 403) return "missing_scope";
    throw error;
  }
}

// Generic all-day event push. Shared by tasks (task-calendar-sync.ts) and holidays
// (holiday-calendar-sync.ts), neither of which has a time of day. Google's all-day convention
// uses an exclusive end date, so `end.date` is one day after start.
//
// Returns the event id and Google's `updated` timestamp; the caller stores the id to find
// this event again and stamps its own "last pushed" column. Neither value is ever compared
// against the source row to decide who "wins" — there is no conflict to resolve when only one
// side can write (0019).
export async function upsertCalendarEvent(
  profileId: string,
  {
    eventId,
    title,
    date,
    description,
    colorId,
  }: { eventId: string | null; title: string; date: string; description?: string; colorId?: string | null }
): Promise<{ id: string; updatedAt: string } | null> {
  const client = await getCalendarClientForProfile(profileId);
  if (!client) return null;

  const requestBody: calendar_v3.Schema$Event = {
    summary: title,
    description,
    start: { date },
    end: { date: format(addDays(new Date(`${date}T00:00:00`), 1), "yyyy-MM-dd") },
    // Client request: no Google reminders on pushed events. Without this, each event inherits
    // the calendar's default all-day notification. Set on every push, so the next sync also
    // strips reminders from events pushed before this existed (events.update replaces the event).
    reminders: { useDefault: false, overrides: [] },
    // Google's fixed palette id (lib/google/event-color.ts) matching the in-app colour. Null falls
    // back to the calendar's own colour. events.update replaces the event, so an existing event
    // takes the new colour on its next push.
    colorId: colorId ?? null,
  };

  const { calendarId } = await resolveCalendarId(profileId, client);
  let data: calendar_v3.Schema$Event;
  try {
    data = await upsertEvent(client.calendar, calendarId, eventId, requestBody);
  } catch (error) {
    // A 404 on insert means the calendar itself was deleted on Google's side. Don't quietly
    // create a new one here: this push can't forget the user's other event links, so the new
    // calendar would stay missing every task and holiday that Sync skips as already there. The
    // cached id is kept on purpose, so the next Sync's ensureCriticalPathCalendar finds it gone,
    // replaces it and re-pushes everything.
    if (!isGoneOrNotFound(error)) throw error;
    throw new Error(CALENDAR_DELETED_ERROR);
  }

  if (!data.id || !data.updated) return null;
  return { id: data.id, updatedAt: data.updated };
}

// Falls back to creating a new event if the stored eventId was deleted on Google's side
// (manually removed from the user's calendar between syncs) instead of failing the whole
// sync run — self-heals the link on the next push.
async function upsertEvent(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  eventId: string | null,
  requestBody: calendar_v3.Schema$Event
) {
  const insert = async () => (await withRateLimitRetry(() => calendar.events.insert({ calendarId, requestBody }))).data;
  if (!eventId) return insert();
  try {
    return (await withRateLimitRetry(() => calendar.events.update({ calendarId, eventId, requestBody }))).data;
  } catch (error) {
    if (!isGoneOrNotFound(error)) throw error;
    return insert();
  }
}

export async function deleteCalendarEvent(profileId: string, eventId: string): Promise<void> {
  const client = await getCalendarClientForProfile(profileId);
  if (!client) return;
  try {
    const { calendarId } = await resolveCalendarId(profileId, client);
    await withRateLimitRetry(() => client.calendar.events.delete({ calendarId, eventId }));
  } catch (error) {
    // Best-effort cleanup — already gone / unreachable shouldn't block the source row's own delete.
    if (!isGoneOrNotFound(error)) throw error;
  }
}

function errorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return Number((error as { code?: unknown }).code);
}

// A first sync pushes every task on the platform (hundreds of events) to one calendar, which can
// trip Google's per-user rate limit. Google answers 429, or 403 with a rateLimitExceeded /
// userRateLimitExceeded reason, and asks for exponential backoff.
const RATE_LIMIT_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

async function withRateLimitRetry<T>(request: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      const delay = RATE_LIMIT_RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isRateLimited(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function isRateLimited(error: unknown): boolean {
  const code = errorCode(error);
  if (code === 429) return true;
  if (code !== 403 || typeof error !== "object" || error === null) return false;
  const reasons = ((error as { errors?: { reason?: string }[] }).errors ?? []).map((entry) => entry.reason);
  return reasons.includes("rateLimitExceeded") || reasons.includes("userRateLimitExceeded");
}

function isGoneOrNotFound(error: unknown): boolean {
  const code = errorCode(error);
  return code === 404 || code === 410;
}
