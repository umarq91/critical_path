"use server";

import { addYears, format, subYears } from "date-fns";
import { z } from "zod";
import {
  pushTaskToGoogleCalendar,
  SYNCABLE_TASK_SELECT,
  taskNeedsPush,
  type TaskCalendarLink,
} from "@/lib/google/task-calendar-sync";
import { pushHolidayToGoogleCalendar } from "@/lib/google/holiday-calendar-sync";
import { deleteCalendarEvent, ensureCriticalPathCalendar } from "@/lib/google/calendar";
import { listTasksByDueDateRange } from "@/data/tasks";
import { listHolidaysByDateRange } from "@/data/holidays";
import { toTaskRangeFilters } from "@/app/(app)/calendar/calendar-utils";
import { NOT_CONNECTED_ERROR, requireCalendarSyncAccess } from "@/app/(app)/calendar/_sync-access";
import { SYNC_BATCH_SIZE, type SyncItem, type SyncResultItem } from "@/app/(app)/calendar/sync-items";

// Manual, button-triggered ONE-WAY push (see calendar-toolbar.tsx's Sync button) — not a
// background poller, and not a two-way reconcile. Two steps, driven from the browser
// (use-google-calendar-sync.ts) so it can show progress: planGoogleCalendarSync works out what
// needs pushing, then pushGoogleCalendarBatch is called once per SYNC_BATCH_SIZE items. Bounded to a fixed window around today
// rather than the page's current view, so the result doesn't depend on which month the user
// happened to be looking at. Pushes both the caller's tasks and the public holidays in the
// window. Both go to everyone who syncs: every task on the platform (client request, not just
// the caller's My Tasks) and every holiday, each user getting their own copy of each.
//
// The Calendar's active filters narrow both passes ("what you see is what syncs"): the task
// filters go through the same toTaskRangeFilters/listTasksByDueDateRange pair the page renders
// from, and the country filter through listHolidaysByDateRange. Filters only narrow what gets
// pushed; they never remove an event already on Google (see the removal pass below).
const SYNC_WINDOW_YEARS_PAST = 2;
const SYNC_WINDOW_YEARS_FUTURE = 3;

// Bounds, not business rules: a filter value is an id, an enum value or a country name, and no
// real selection comes close to 500 of them. Anything past that is a malformed request.
const filterValues = z.array(z.string().trim().min(1).max(200)).max(500).default([]);
const syncFiltersSchema = z.object({
  seasonId: filterValues,
  brandId: filterValues,
  status: filterValues,
  gender: filterValues,
  owner: filterValues,
  involved: filterValues,
  countries: filterValues,
});

export async function planGoogleCalendarSync(input: unknown) {
  const auth = await requireCalendarSyncAccess();
  if (!auth.ok) return auth;

  const parsedFilters = syncFiltersSchema.safeParse(input ?? {});
  if (!parsedFilters.success) return { ok: false as const, error: "Invalid calendar filters." };
  const { countries, ...taskFilterState } = parsedFilters.data;

  // Finds or creates the "Critical Path Calendar" calendar before anything is pushed. A token
  // granted before the calendar-list/create scopes were added fails here once, with a clear
  // message, instead of every push failing on its own.
  const calendarStatus = await ensureCriticalPathCalendar(auth.userId);
  if (calendarStatus === "not_connected") return { ok: false as const, error: NOT_CONNECTED_ERROR };
  if (calendarStatus === "missing_scope") {
    return {
      ok: false as const,
      error: "Google Calendar needs an updated permission — sign out and sign back in, and allow all Calendar access.",
    };
  }

  const today = new Date();
  const from = format(subYears(today, SYNC_WINDOW_YEARS_PAST), "yyyy-MM-dd");
  const to = format(addYears(today, SYNC_WINDOW_YEARS_FUTURE), "yyyy-MM-dd");

  // Removal pass: every task this user's calendar holds a copy of that has since been deleted
  // or lost its due date. deleteTask already removes every copy at delete time; this catches
  // anything that slipped through. Not windowed to [from, to], and filters never remove: the
  // question is whether the task still exists, not whether this sync matched it. A task the
  // caller can no longer see comes back with no `task` and counts as gone. Usually a handful,
  // so it runs here rather than as progress-bar items.
  const { data: links, error: taskLinksError } = await auth.supabase
    .from("task_calendar_events")
    .select("task_id, google_event_id, content_hash, task:tasks(deleted_at, due_date)")
    .eq("profile_id", auth.userId);
  if (taskLinksError) return { ok: false as const, error: taskLinksError.message };

  const linkByTaskId = new Map<string, TaskCalendarLink>();
  const staleLinks: { task_id: string; google_event_id: string }[] = [];
  for (const link of links ?? []) {
    if (!link.task || link.task.deleted_at || !link.task.due_date) staleLinks.push(link);
    else linkByTaskId.set(link.task_id, { eventId: link.google_event_id, contentHash: link.content_hash });
  }

  let removedCount = 0;
  await inParallel(staleLinks, async (link) => {
    // Best-effort on Google's side: an already-gone event must not block forgetting the link.
    await deleteCalendarEvent(auth.userId, link.google_event_id).catch(() => undefined);
    const { error } = await auth.supabase
      .from("task_calendar_events")
      .delete()
      .eq("task_id", link.task_id)
      .eq("profile_id", auth.userId);
    if (!error) removedCount++;
  });

  // Every task on the platform in the window (client request, not just the caller's My Tasks),
  // narrowed by the same filters as the Calendar grid itself. Each syncing user gets their own
  // copy of each task (task_calendar_events, 0034). Tasks whose event would come out identical
  // are counted as skipped and never sent to a batch.
  const tasks = await listTasksByDueDateRange({ from, to, filters: toTaskRangeFilters(taskFilterState) });
  const items: SyncItem[] = [];
  const skipped: SyncResultItem[] = [];
  for (const task of tasks) {
    // The range filter already guarantees a due date; this narrows the type.
    if (!task.due_date) continue;
    if (taskNeedsPush({ ...task, due_date: task.due_date }, linkByTaskId.get(task.id) ?? null)) {
      items.push({ kind: "task", id: task.id });
    } else {
      skipped.push({ name: task.task_name, reason: ALREADY_UP_TO_DATE });
    }
  }

  // Every holiday in the window (narrowed by the country filter) goes to every user's own
  // calendar via holiday_calendar_events (0028). One already there is skipped: an admin's edit
  // to a holiday already updates every copy (resyncHolidayCalendarEvents).
  const holidays = await listHolidaysByDateRange({ from, to, countries });
  const { data: holidayLinks, error: holidayLinksError } = await auth.supabase
    .from("holiday_calendar_events")
    .select("holiday_id")
    .eq("profile_id", auth.userId);
  if (holidayLinksError) return { ok: false as const, error: holidayLinksError.message };
  const syncedHolidayIds = new Set((holidayLinks ?? []).map((link) => link.holiday_id));
  for (const holiday of holidays) {
    if (syncedHolidayIds.has(holiday.id)) skipped.push({ name: holidayLabel(holiday), reason: ALREADY_ON_CALENDAR });
    else items.push({ kind: "holiday", id: holiday.id });
  }

  return { ok: true as const, items, skipped, removedCount, batchSize: SYNC_BATCH_SIZE };
}

const batchSchema = z
  .array(z.object({ kind: z.enum(["task", "holiday"]), id: z.string().uuid() }))
  .min(1)
  .max(SYNC_BATCH_SIZE);

export async function pushGoogleCalendarBatch(input: unknown) {
  const auth = await requireCalendarSyncAccess();
  if (!auth.ok) return auth;

  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid sync batch." };

  const taskIds = parsed.data.filter((item) => item.kind === "task").map((item) => item.id);
  const holidayIds = parsed.data.filter((item) => item.kind === "holiday").map((item) => item.id);

  // Re-read here rather than trusting the plan: a task can be edited or deleted between the
  // plan and its batch. Anything that's gone, or no longer needs pushing, counts as skipped.
  const [tasks, taskLinks, holidays, holidayLinks] = await Promise.all([
    taskIds.length
      ? auth.supabase.from("tasks").select(SYNCABLE_TASK_SELECT).in("id", taskIds).is("deleted_at", null)
      : null,
    taskIds.length
      ? auth.supabase
          .from("task_calendar_events")
          .select("task_id, google_event_id, content_hash")
          .eq("profile_id", auth.userId)
          .in("task_id", taskIds)
      : null,
    holidayIds.length
      ? auth.supabase.from("public_holidays").select("id, name, country, holiday_date").in("id", holidayIds)
      : null,
    holidayIds.length
      ? auth.supabase
          .from("holiday_calendar_events")
          .select("holiday_id, google_event_id")
          .eq("profile_id", auth.userId)
          .in("holiday_id", holidayIds)
      : null,
  ]);
  const readError = tasks?.error ?? taskLinks?.error ?? holidays?.error ?? holidayLinks?.error;
  if (readError) return { ok: false as const, error: readError.message };

  const linkByTaskId = new Map<string, TaskCalendarLink>(
    (taskLinks?.data ?? []).map((link) => [link.task_id, { eventId: link.google_event_id, contentHash: link.content_hash }])
  );
  const eventIdByHolidayId = new Map((holidayLinks?.data ?? []).map((link) => [link.holiday_id, link.google_event_id]));

  let pushedTasks = 0;
  let pushedHolidays = 0;
  const skipped: SyncResultItem[] = [];
  const failed: SyncResultItem[] = [];

  await inParallel(tasks?.data ?? [], async (task) => {
    if (!task.due_date) {
      skipped.push({ name: task.task_name, reason: "Due date was removed" });
      return;
    }
    try {
      const result = await pushTaskToGoogleCalendar(
        auth.supabase,
        { ...task, due_date: task.due_date },
        auth.userId,
        linkByTaskId.get(task.id) ?? null
      );
      if (result === "pushed") pushedTasks++;
      if (result === "unchanged") skipped.push({ name: task.task_name, reason: ALREADY_UP_TO_DATE });
      if (result === "failed") failed.push({ name: task.task_name, reason: SAVE_FAILED });
    } catch (error) {
      failed.push({ name: task.task_name, reason: describeSyncError(error) });
    }
  });

  await inParallel(holidays?.data ?? [], async (holiday) => {
    try {
      const pushed = await pushHolidayToGoogleCalendar(
        auth.supabase,
        holiday,
        auth.userId,
        eventIdByHolidayId.get(holiday.id) ?? null
      );
      if (pushed) pushedHolidays++;
      else failed.push({ name: holidayLabel(holiday), reason: SAVE_FAILED });
    } catch (error) {
      failed.push({ name: holidayLabel(holiday), reason: describeSyncError(error) });
    }
  });

  // A task in the plan that's since been deleted never comes back from the read above.
  const returned = (tasks?.data?.length ?? 0) + (holidays?.data?.length ?? 0);
  for (let missing = parsed.data.length - returned; missing > 0; missing--) {
    skipped.push({ name: "A task deleted during the sync", reason: "Deleted" });
  }

  return { ok: true as const, pushedTasks, pushedHolidays, skipped, failed };
}

const ALREADY_UP_TO_DATE = "Already up to date";
const ALREADY_ON_CALENDAR = "Already on your calendar";
const SAVE_FAILED = "Couldn't save it to Google Calendar";

function holidayLabel(holiday: { name: string; country: string }) {
  return `${holiday.name} · ${holiday.country} holiday`;
}

// Google's API errors carry a readable message (e.g. "Rate Limit Exceeded"); anything else is
// summarised rather than shown raw.
function describeSyncError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message.slice(0, 200);
  return SAVE_FAILED;
}

// A few Google calls at a time keeps a batch quick without tripping Google's per-user rate
// limit (which calendar.ts also backs off from).
const GOOGLE_CONCURRENCY = 4;

async function inParallel<T>(items: T[], run: (item: T) => Promise<void>): Promise<void> {
  for (let start = 0; start < items.length; start += GOOGLE_CONCURRENCY) {
    await Promise.all(items.slice(start, start + GOOGLE_CONCURRENCY).map(run));
  }
}
