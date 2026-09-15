import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { listTasksBySeasonForIntegration, type IntegrationSeasonGroupRow } from "@/lib/integration/tasks-by-season";
import { parseTaskStatusFilter } from "@/lib/integration/task-group-facts";

// Seventh data endpoint. Not paginated — the spec lists no cursor/page_size for this one, and
// the row count is bounded by the number of seasons (28 today, see supabase/seed-seasons.sql),
// not the number of tasks. `meta` is therefore the smaller { schema_version, as_of } shape the
// spec's /dashboard-summary and /reports/task-summary also use, not the cursor-list shape.
function toSeasonGroupRecord(row: IntegrationSeasonGroupRow) {
  return {
    season_id: row.season_id,
    season_code: row.season_code,
    season_name: row.season_name,
    task_count: row.task_count,
    completed_count: row.completed_count,
    in_progress_count: row.in_progress_count,
    overdue_count: row.overdue_count,
    completion_rate: row.completion_rate,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireIntegrationApiKey(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");
  const brandCode = params.get("brand_code");
  const ownerName = params.get("owner_name");
  const status = parseTaskStatusFilter(params.get("status"));

  try {
    const rows = await listTasksBySeasonForIntegration({ dateFrom, dateTo, brandCode, ownerName, status });

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: rows.map(toSeasonGroupRecord),
        meta: { schema_version: "v1", as_of: new Date().toISOString() },
      }),
      request
    );
  } catch {
    return integrationError(request, 400, "Invalid query parameters");
  }
}
