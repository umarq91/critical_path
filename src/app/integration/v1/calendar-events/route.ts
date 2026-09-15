import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { decodeCursor, clampPageSize } from "@/lib/integration/cursor";
import { listCalendarEventsForIntegration, type IntegrationCalendarEventRow } from "@/lib/integration/calendar-events";

// Fifth data endpoint, and the first that isn't a straight one-table mirror or a
// department-level aggregate — it's `tasks` reshaped one-to-one, every task a row whether or
// not it's ever been synced to Google. See lib/integration/calendar-events.ts for the
// sync_status/event_deleted reasoning: this schema can only honestly distinguish "has a
// calendar event" from "doesn't", not synced/pending/failed, so sync_status (and provider,
// and calendar_event_id) are null for a task with no google_event_id rather than some invented
// "not_synced" state.
function toCalendarEventRecord(row: IntegrationCalendarEventRow) {
  return {
    calendar_event_id: row.google_event_id,
    task_id: row.id,
    task_name: row.task_name,
    provider: row.google_event_id ? "google_calendar" : null,
    season_code: row.season?.season_code ?? null,
    brand_name: row.brand?.brand_name ?? null,
    owner_name: row.owner_name,
    due_date: row.due_date,
    sync_status: row.google_event_id ? "synced" : null,
    last_synced_at: row.google_synced_at,
    // Best-effort signal, not a guarantee: deleteTask() (tasks/_actions.ts) attempts to delete
    // the Google event when a task is soft-deleted, but swallows a failed attempt the same way
    // every push does — so a deleted task whose Google event cleanup actually failed still
    // reads as event_deleted: true here. false (not null) for a task never synced in the first
    // place — there was never an event to have deleted, which is a real, known fact, not a gap.
    event_deleted: row.deleted_at !== null,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    version: null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireIntegrationApiKey(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const pageSize = clampPageSize(params.get("page_size"));
  const cursor = decodeCursor(params.get("cursor"));
  const updatedSince = params.get("updated_since");
  const includeDeleted = params.get("include_deleted") === "true";

  try {
    const { rows, nextCursor } = await listCalendarEventsForIntegration({ pageSize, cursor, updatedSince, includeDeleted });

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: rows.map(toCalendarEventRecord),
        meta: {
          schema_version: "v1",
          as_of: new Date().toISOString(),
          next_cursor: nextCursor,
          page_size: pageSize,
        },
      }),
      request
    );
  } catch {
    return integrationError(request, 400, "Invalid query parameters");
  }
}
