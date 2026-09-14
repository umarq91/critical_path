import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { decodeCursor, clampPageSize } from "@/lib/integration/cursor";
import { listUsersForIntegration, roleLabel, type IntegrationUserRow } from "@/lib/integration/users";

// Third data endpoint. Two fields have no real answer in this schema and are always null —
// see lib/integration/users.ts for why `last_active_at`/`deleted_at` aren't derived from
// something adjacent. `include_deleted` is accepted (matches the spec's query param) but has
// no effect: profiles are never soft-deleted, so there is nothing for it to toggle.
function toUserRecord(row: IntegrationUserRow) {
  return {
    user_id: row.id,
    display_name: row.full_name ?? row.email,
    email: row.email,
    department: row.department?.name ?? null,
    role_name: roleLabel(row.role),
    status: row.status,
    last_active_at: null,
    updated_at: row.updated_at,
    deleted_at: null,
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

  try {
    const { rows, nextCursor } = await listUsersForIntegration({ pageSize, cursor, updatedSince });

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: rows.map(toUserRecord),
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
