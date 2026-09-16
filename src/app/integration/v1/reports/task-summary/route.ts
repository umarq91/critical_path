import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { getTaskSummaryForIntegration } from "@/lib/integration/task-summary";
import { parseTaskStatusFilter } from "@/lib/integration/task-group-facts";

// Tenth data endpoint, sibling of /dashboard-summary — same non-paginated single-object shape,
// but `owner_name` (department-or-person, by display name) instead of `owner_id`
// (profiles.id-only), and a fourth breakdown, by_owner, dashboard-summary doesn't have.
export async function GET(request: NextRequest) {
  const auth = await requireIntegrationApiKey(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");
  const seasonCode = params.get("season_code");
  const brandCode = params.get("brand_code");
  const ownerName = params.get("owner_name");
  const status = parseTaskStatusFilter(params.get("status"));

  try {
    const summary = await getTaskSummaryForIntegration({ dateFrom, dateTo, seasonCode, brandCode, ownerName, status });
    const now = new Date().toISOString();

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: {
          as_of: now,
          generated_at: now,
          metric_definition_version: "v1",
          filters: { date_from: dateFrom, date_to: dateTo, season_code: seasonCode, brand_code: brandCode, owner_name: ownerName, status },
          totals: summary.totals,
          breakdowns: {
            by_status: summary.byStatus,
            by_season: summary.bySeason,
            by_brand: summary.byBrand,
            by_owner: summary.byOwner,
          },
        },
        meta: { schema_version: "v1", as_of: now },
      }),
      request
    );
  } catch {
    return integrationError(request, 400, "Invalid query parameters");
  }
}
