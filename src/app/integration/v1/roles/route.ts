import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { clampPageSize } from "@/lib/integration/cursor";
import { listRolesForIntegration, type IntegrationRoleRow } from "@/lib/integration/roles";

// Sixth data endpoint, and the first that reads code (constants/roles.ts + lib/permissions.ts)
// instead of a table — see lib/integration/roles.ts for the full reasoning behind every
// deviation from the spec's literal shape (role_id isn't a UUID, access_level is null unless
// provably "full_access", status/updated_at/deleted_at/version are constants, not queries).
function toRoleRecord(row: IntegrationRoleRow) {
  return {
    role_id: row.role_id,
    role_name: row.role_name,
    access_level: row.access_level,
    status: row.status,
    user_count: row.user_count,
    permissions: row.permissions,
    updated_at: null,
    deleted_at: null,
    version: null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireIntegrationApiKey(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const pageSize = clampPageSize(params.get("page_size"));
  const cursor = params.get("cursor");

  try {
    const { rows, nextCursor } = await listRolesForIntegration({ pageSize, cursor });

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: rows.map(toRoleRecord),
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
