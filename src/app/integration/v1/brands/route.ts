import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { decodeCursor, clampPageSize } from "@/lib/integration/cursor";
import { listBrandsForIntegration, type IntegrationBrandRow } from "@/lib/integration/brands";

// Second data endpoint, same shape as /integration/v1/seasons/route.ts (its sibling, built
// first) — see things-to-know.md's Integrations section for why brands went next: every field
// maps to a real column except `version`, sent as `null` rather than invented.
function toBrandRecord(row: IntegrationBrandRow) {
  return {
    brand_id: row.id,
    brand_code: row.brand_code,
    brand_name: row.brand_name,
    description: row.description,
    status: row.status,
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
    const { rows, nextCursor } = await listBrandsForIntegration({ pageSize, cursor, updatedSince, includeDeleted });

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: rows.map(toBrandRecord),
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
