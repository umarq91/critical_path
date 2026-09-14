import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { decodeCursor, clampPageSize } from "@/lib/integration/cursor";
import { listTeamsForIntegration, type IntegrationTeamRow } from "@/lib/integration/teams";

// Fourth data endpoint, and the first with real aggregates rather than a straight column
// mapping — see lib/integration/teams.ts. "Team" means `departments` in this schema. Two
// fields have no equivalent concept here and are always null: `department` (this schema has no
// two-level team-within-department hierarchy — a department IS the team) and `lead_name` (no
// "department lead" role exists). `status` is derived from `deleted_at` (there's no separate
// status column on departments, unlike brands/seasons) — deliberate, not the same as the
// `version`-style "no data at all" case.
function toTeamRecord(row: IntegrationTeamRow) {
  return {
    team_id: row.id,
    team_name: row.name,
    department: null,
    lead_name: null,
    member_count: row.member_count,
    active_tasks_count: row.active_tasks_count,
    completed_tasks_count: row.completed_tasks_count,
    status: row.deleted_at ? "inactive" : "active",
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
    const { rows, nextCursor } = await listTeamsForIntegration({ pageSize, cursor, updatedSince, includeDeleted });

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: rows.map(toTeamRecord),
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
