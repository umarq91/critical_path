import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { decodeCursor, clampPageSize } from "@/lib/integration/cursor";
import { listOverdueTasksForIntegration, computeDaysOverdue, type IntegrationOverdueTaskRow } from "@/lib/integration/overdue-tasks";

// Sixth data endpoint, first under /reports/*. Unlike the sync-feed endpoints above it, this
// one has no `updated_since`/`include_deleted` params in the spec — it's a point-in-time report
// meant to be re-pulled fresh, not incrementally synced, which is exactly why days_overdue (a
// value that changes daily even when the row itself doesn't) is safe to compute live here in a
// way it wouldn't be on a cursor-keyed sync feed. See lib/integration/overdue-tasks.ts for why
// `status = 'overdue'` is trusted rather than derived from due_date directly — a real,
// documented gap (things-to-know.md), not an oversight.
function toOverdueTaskRecord(row: IntegrationOverdueTaskRow) {
  return {
    task_id: row.id,
    task_name: row.task_name,
    season_code: row.season?.season_code ?? null,
    brand_name: row.brand?.brand_name ?? null,
    owner_name: row.owner_name,
    due_date: row.due_date,
    status: row.status,
    days_overdue: computeDaysOverdue(row.due_date),
    updated_at: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireIntegrationApiKey(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const pageSize = clampPageSize(params.get("page_size"));
  const cursor = decodeCursor(params.get("cursor"));
  const seasonCode = params.get("season_code");
  const brandCode = params.get("brand_code");
  const ownerName = params.get("owner_name");
  const dueFrom = params.get("due_from");
  const dueTo = params.get("due_to");

  try {
    const { rows, nextCursor } = await listOverdueTasksForIntegration({
      pageSize,
      cursor,
      seasonCode,
      brandCode,
      ownerName,
      dueFrom,
      dueTo,
    });

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: rows.map(toOverdueTaskRecord),
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
