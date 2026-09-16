import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { getDashboardSummaryForIntegration } from "@/lib/integration/dashboard-summary";

// Ninth data endpoint. Same non-paginated `{ schema_version, as_of }` meta shape as
// /reports/tasks-by-season and /reports/tasks-by-brand — this is a single aggregate object, not
// a row list, so there's nothing to page through. `as_of`/`generated_at` are the same instant:
// there's no separate "materialized at" step behind this query, both stamp the moment the
// response was built.
export async function GET(request: NextRequest) {
  const auth = await requireIntegrationApiKey(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const seasonCode = params.get("season_code");
  const brandCode = params.get("brand_code");
  const ownerId = params.get("owner_id");
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");

  try {
    const summary = await getDashboardSummaryForIntegration({ seasonCode, brandCode, ownerId, dateFrom, dateTo });
    const now = new Date().toISOString();

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: {
          as_of: now,
          generated_at: now,
          metric_definition_version: "v1",
          filters: { season_code: seasonCode, brand_code: brandCode, owner_id: ownerId, date_from: dateFrom, date_to: dateTo },
          totals: summary.totals,
          breakdowns: {
            by_status: summary.byStatus,
            by_season: summary.bySeason,
            by_brand: summary.byBrand,
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
