import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { decodeCursor, clampPageSize } from "@/lib/integration/cursor";
import { listSeasonsForIntegration, type IntegrationSeasonRow } from "@/lib/integration/seasons";

// The first real data endpoint — see things-to-know.md's Integrations section for why seasons
// (not tasks) went first: every field below maps to a real column except `version`, which this
// schema doesn't track and is sent as `null` rather than invented (client direction, not an
// oversight — see the "How this works" card on /management/integrations).
function toSeasonRecord(row: IntegrationSeasonRow) {
  return {
    season_id: row.id,
    season_code: row.season_code,
    season_name: row.season_name,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
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
  // An unparseable cursor is treated as "no cursor" (start over), not an error — see
  // decodeCursor's own comment on why that's the safer default for a garbled/hand-edited value.
  const cursor = decodeCursor(params.get("cursor"));
  const updatedSince = params.get("updated_since");
  const includeDeleted = params.get("include_deleted") === "true";

  try {
    const { rows, nextCursor } = await listSeasonsForIntegration({ pageSize, cursor, updatedSince, includeDeleted });

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: rows.map(toSeasonRecord),
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
    // The one way this throws in practice is a malformed `updated_since` (not a valid
    // timestamp) reaching Postgres — a caller input problem, not a server fault.
    return integrationError(request, 400, "Invalid query parameters");
  }
}
