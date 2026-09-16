import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { decodeCursor, clampPageSize } from "@/lib/integration/cursor";
import { listTasksForIntegration, parsePriorityFilter, toIntegrationTaskRecord } from "@/lib/integration/tasks";
import { parseTaskStatusFilter } from "@/lib/integration/task-group-facts";

// Twelfth data endpoint, and the biggest one — see lib/integration/tasks.ts for the full
// accounting of which spec fields are real columns vs. always-null gaps.
export async function GET(request: NextRequest) {
  const auth = await requireIntegrationApiKey(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const pageSize = clampPageSize(params.get("page_size"));
  const cursor = decodeCursor(params.get("cursor"));
  const updatedSince = params.get("updated_since");
  const includeDeleted = params.get("include_deleted") === "true";
  const seasonCode = params.get("season_code");
  const brandCode = params.get("brand_code");
  const status = parseTaskStatusFilter(params.get("status"));
  const priority = parsePriorityFilter(params.get("priority"));
  const ownerName = params.get("owner_name");
  const dueFrom = params.get("due_from");
  const dueTo = params.get("due_to");
  // blocked_status, escalation_owner_name, delay_reason_code, is_milestone are accepted per the
  // spec's query param list but are no-ops — nothing in this schema backs any of them yet.

  try {
    const { rows, nextCursor } = await listTasksForIntegration({
      pageSize,
      cursor,
      updatedSince,
      includeDeleted,
      seasonCode,
      brandCode,
      status,
      priority,
      ownerName,
      dueFrom,
      dueTo,
    });

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: rows.map(toIntegrationTaskRecord),
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
