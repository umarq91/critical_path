import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { listTasksByBrandForIntegration, type IntegrationBrandGroupRow } from "@/lib/integration/tasks-by-brand";
import { parseTaskStatusFilter } from "@/lib/integration/task-group-facts";

// Eighth data endpoint, sibling of tasks-by-season — same "not paginated, small { schema_version,
// as_of } meta" shape, bounded by brand count rather than task count. See
// lib/integration/tasks-by-brand.ts for why a task with no brand_id contributes to no group here.
function toBrandGroupRecord(row: IntegrationBrandGroupRow) {
  return {
    brand_id: row.brand_id,
    brand_code: row.brand_code,
    brand_name: row.brand_name,
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
  const seasonCode = params.get("season_code");
  const ownerName = params.get("owner_name");
  const status = parseTaskStatusFilter(params.get("status"));

  try {
    const rows = await listTasksByBrandForIntegration({ dateFrom, dateTo, seasonCode, ownerName, status });

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: rows.map(toBrandGroupRecord),
        meta: { schema_version: "v1", as_of: new Date().toISOString() },
      }),
      request
    );
  } catch {
    return integrationError(request, 400, "Invalid query parameters");
  }
}
