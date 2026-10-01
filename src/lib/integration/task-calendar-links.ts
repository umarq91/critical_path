import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { chunk, OWNER_LOOKUP_BATCH_SIZE } from "@/lib/integration/task-owners";

type SupabaseClient = ReturnType<typeof createAdminClient>;

export interface TaskCalendarSyncSummary {
  google_event_id: string | null;
  google_synced_at: string | null;
}

// Since 0034 a task can be on many users' calendars, one task_calendar_events row each, but the
// spec gives a task ONE calendar_event_id / last_synced_at. Both come from the most recent push
// of any copy: a real event id and a real time, never a made-up aggregate. tasks.google_event_id
// / google_synced_at are no longer written and must not be read here.
//
// A push doesn't touch tasks.updated_at, so an updated_since feed won't resurface a task just
// because it was synced. That's the trade: stamping tasks on every push would change every
// task's "Last Updated" each time anyone syncs.
export async function resolveCalendarSyncSummaries(
  supabase: SupabaseClient,
  taskIds: string[]
): Promise<Map<string, TaskCalendarSyncSummary>> {
  const summaries = new Map<string, TaskCalendarSyncSummary>();
  const batches = await Promise.all(
    chunk(taskIds, OWNER_LOOKUP_BATCH_SIZE).map(async (batch) => {
      const { data, error } = await supabase
        .from("task_calendar_events")
        .select("task_id, google_event_id, synced_at")
        .in("task_id", batch)
        .order("synced_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    })
  );
  for (const row of batches.flat()) {
    if (summaries.has(row.task_id)) continue;
    summaries.set(row.task_id, { google_event_id: row.google_event_id, google_synced_at: row.synced_at });
  }
  return summaries;
}

export const NO_CALENDAR_SYNC: TaskCalendarSyncSummary = { google_event_id: null, google_synced_at: null };
