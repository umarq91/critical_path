import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { decodeCursor, clampPageSize, encodeCursor } from "@/lib/integration/cursor";
import { listChangesForIntegration, operationForAction, type IntegrationChangeRow } from "@/lib/integration/changes";

// Eleventh data endpoint, and the first not scoped to one entity's own table — it reads
// audit_log instead (see lib/integration/changes.ts for why entity_type is always pinned to
// 'task' underneath regardless of the query param). `record` is the audit row's own `changes`
// payload (the field-level diff / party changes / created-with-owners this table actually
// stores, see types/audit.ts's AuditChanges), not a full current-state snapshot of the task —
// audit_log was never designed to store one, and joining today's tasks row for a historical
// event would misrepresent history for anything but the most recent change on that task.
function toChangeRecord(row: IntegrationChangeRow) {
  return {
    cursor: encodeCursor({ updatedAt: row.created_at, id: row.id }),
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    operation: operationForAction(row.action),
    occurred_at: row.created_at,
    version: null,
    record: { task_id: row.entity_id, task_name: row.entity_label, changes: row.changes },
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireIntegrationApiKey(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const pageSize = clampPageSize(params.get("page_size"));
  const cursor = decodeCursor(params.get("cursor"));
  const entityType = params.get("entity_type");
  const occurredSince = params.get("occurred_since");

  try {
    const { rows, nextCursor } = await listChangesForIntegration({ pageSize, cursor, entityType, occurredSince });

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: rows.map(toChangeRecord),
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
