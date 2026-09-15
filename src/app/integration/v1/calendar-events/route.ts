import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { decodeCursor, clampPageSize } from "@/lib/integration/cursor";
import { listCalendarEventsForIntegration, type IntegrationCalendarEventRow } from "@/lib/integration/calendar-events";

// Fifth data endpoint, and the first that isn't a straight one-table mirror or a
// department-level aggregate — it's a filtered view of `tasks` (rows where google_event_id is
// set), not one row per task. See lib/integration/calendar-events.ts for the sync_status and
// event_deleted reasoning: this schema can only honestly distinguish "has a calendar event" from
// "doesn't", not synced/pending/failed, so sync_status is always "synced" here and provider is
// always "google_calendar" — the only provider this platform integrates with.
function toCalendarEventRecord(row: IntegrationCalendarEventRow) {
  return {
    calendar_event_id: row.google_event_id,
    task_id: row.id,
    task_name: row.task_name,
    provider: "google_calendar",
    season_code: row.season?.season_code ?? null,
    brand_name: row.brand?.brand_name ?? null,
    owner_name: row.owner_name,
    due_date: row.due_date,
    sync_status: "synced",
    last_synced_at: row.google_synced_at,
    // Best-effort signal, not a guarantee: deleteTask() (tasks/_actions.ts) attempts to delete
    // the Google event when a task is soft-deleted, but swallows a failed attempt the same way
    // every push does — so a deleted task whose Google event cleanup actually failed still
    // reads as event_deleted: true here.
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
