import "server-only";
import { createHash } from "node:crypto";
import { upsertCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar";
import type { ParticipantRole } from "@/lib/party";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface SyncableTaskParticipant {
  role: ParticipantRole;
  profile: { full_name: string | null; email: string } | null;
  department: { name: string } | null;
}

export interface SyncableTask {
  id: string;
  task_name: string;
  // Callers of pushTaskToGoogleCalendar always have a due_date in hand by construction (the
  // Sync button's own query range-filters on it; resyncTaskCalendarEvents below branches away
  // before calling this for a task whose due_date is null) — an all-day Google Calendar event
  // has nowhere to go without one.
  due_date: string;
  season: { season_name: string } | null;
  participants: SyncableTaskParticipant[];
}

// A party's display name for the event description — department name if it's a department,
// else the profile's full name, falling back to email. Same precedence task-parties.ts's
// PartySummary uses for the in-app party picker, kept independent here rather than sharing that
// module: this only ever needs a flat name string, not a full PartySummary (avatar, subtitle, …).
function participantNames(participants: SyncableTaskParticipant[], role: ParticipantRole): string[] {
  return participants
    .filter((participant) => participant.role === role)
    .map((participant) => participant.department?.name ?? participant.profile?.full_name ?? participant.profile?.email)
    .filter((name): name is string => !!name);
}

// "<Season> - <Task Name>" so an event reads identifiably at a glance in a calendar full of
// other teams' events, not just by opening it. Falls back to the bare task name only in the
// structurally-impossible case of an unresolved season join (tasks.season_id is NOT NULL).
function formatEventTitle(task: Pick<SyncableTask, "task_name" | "season">): string {
  return task.season ? `${task.season.season_name} - ${task.task_name}` : task.task_name;
}

// Client-requested format: two labelled lines, comma-joined within each. Always both lines,
// even when a list is empty — a consistently-shaped description is easier to scan across many
// events than one that silently drops a line when nobody's in a role (owners are required at
// task creation, but this is a defensive floor, not an assumption relied on elsewhere).
function formatEventDescription(task: Pick<SyncableTask, "participants">): string {
  const owners = participantNames(task.participants, "owner").join(", ");
  const involved = participantNames(task.participants, "involved").join(", ");
  return `OWNER: ${owners}\nPEOPLE INVOLVED: ${involved}`;
}

// The columns pushTaskToGoogleCalendar needs, for callers that load a task themselves.
export const SYNCABLE_TASK_SELECT =
  "id, task_name, due_date, deleted_at, season:seasons(season_name), participants:task_participants(role, profile:profiles(full_name, email), department:departments(name))";

// One user's copy of one task on Google (task_calendar_events, 0034). Every syncing user gets
// their own copy of every task, so a task can be on many calendars at once.
export interface TaskCalendarLink {
  eventId: string;
  contentHash: string | null;
}

export type TaskPushResult = "pushed" | "unchanged" | "failed";

function toEvent(task: SyncableTask) {
  return { title: formatEventTitle(task), description: formatEventDescription(task), date: task.due_date };
}

function hashEvent(event: ReturnType<typeof toEvent>): string {
  return createHash("sha256").update(JSON.stringify([event.title, event.description, event.date])).digest("hex");
}

// Whether pushing would change anything on Google. Sync's planning step uses this to count only
// the tasks that will actually cost a Google call, so its progress bar measures real work.
export function taskNeedsPush(task: SyncableTask, link: TaskCalendarLink | null): boolean {
  return link?.contentHash !== hashEvent(toEvent(task));
}

// The single outbound write: push one task to one user's Google Calendar and record it in
// task_calendar_events. Shared by the Calendar page's Sync action (bulk) and by task edits
// (keeping every existing copy in step), so both format and record identically.
//
// Skips the Google call when the event would come out identical to what was last pushed. That's
// what keeps a repeat sync of every task on the platform fast. The catch: an event someone
// deleted by hand in Google isn't recreated until the task itself changes.
//
// Uses the caller's RLS-scoped client for the link write. An existing link is UPDATEd, never
// upserted: an editor refreshing someone else's copy may update that row (0034) but not insert
// one, and Postgres checks the insert policy on an upsert even when it ends up updating.
export async function pushTaskToGoogleCalendar(
  supabase: SupabaseClient,
  task: SyncableTask,
  profileId: string,
  link: TaskCalendarLink | null
): Promise<TaskPushResult> {
  const event = toEvent(task);
  const contentHash = hashEvent(event);
  if (link?.contentHash === contentHash) return "unchanged";

  const result = await upsertCalendarEvent(profileId, { eventId: link?.eventId ?? null, ...event });
  if (!result) return "failed";

  const values = { google_event_id: result.id, content_hash: contentHash, synced_at: new Date().toISOString() };
  const { error } = link
    ? await supabase.from("task_calendar_events").update(values).eq("task_id", task.id).eq("profile_id", profileId)
    : await supabase.from("task_calendar_events").insert({ task_id: task.id, profile_id: profileId, ...values });

  return error ? "failed" : "pushed";
}

// Called after a task edit (columns or participants) so every calendar that already holds the
// task reflects it. Does nothing for a task nobody has synced yet; that's what the Sync button
// is for. Clearing the due date, or deleting the task, removes every copy instead.
//
// Best-effort per user: one account's expired token must not stop the others, and a Google
// outage must not fail an otherwise valid task update, so callers ignore the result.
export async function resyncTaskCalendarEvents(supabase: SupabaseClient, taskId: string): Promise<void> {
  const { data: links } = await supabase
    .from("task_calendar_events")
    .select("profile_id, google_event_id, content_hash")
    .eq("task_id", taskId);
  if (!links?.length) return;

  const { data: task } = await supabase.from("tasks").select(SYNCABLE_TASK_SELECT).eq("id", taskId).single();
  if (!task) return;
  if (!task.due_date || task.deleted_at) return deleteTaskCalendarEvents(supabase, taskId);

  const syncable = { ...task, due_date: task.due_date };
  for (const link of links) {
    await pushTaskToGoogleCalendar(supabase, syncable, link.profile_id, {
      eventId: link.google_event_id,
      contentHash: link.content_hash,
    }).catch(() => undefined);
  }
}

// Removes the task from every calendar that holds it, then forgets the links. Called when a
// task is deleted and when its due date is cleared. Best-effort per event, same as above.
export async function deleteTaskCalendarEvents(supabase: SupabaseClient, taskId: string): Promise<void> {
  const { data: links } = await supabase
    .from("task_calendar_events")
    .select("profile_id, google_event_id")
    .eq("task_id", taskId);
  if (!links?.length) return;

  for (const link of links) {
    await deleteCalendarEvent(link.profile_id, link.google_event_id).catch(() => undefined);
  }
  await supabase.from("task_calendar_events").delete().eq("task_id", taskId);
}
