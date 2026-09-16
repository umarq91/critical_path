import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeCursor, type IntegrationCursor } from "@/lib/integration/cursor";
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@/constants/audit";

export interface ListChangesForIntegrationParams {
  pageSize: number;
  cursor: IntegrationCursor | null;
  entityType: string | null;
  occurredSince: string | null;
}

export interface IntegrationChangeRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  changes: unknown;
  created_at: string;
}

const SELECT = "id, action, entity_type, entity_id, entity_label, changes, created_at";

// One entry per real action string (constants/audit.ts), not a generic "anything not create/
// delete is updated" fallback — so a new action added there is a deliberate mapping decision,
// not something that silently inherits a guess. An action this map hasn't been taught about
// yet still degrades to "updated" rather than throwing: a change row with an approximate
// operation is worth more to a sync consumer than one missing entirely.
const OPERATION_BY_ACTION: Record<string, "created" | "updated" | "deleted"> = {
  [AUDIT_ACTION.TASK_CREATE]: "created",
  [AUDIT_ACTION.TASK_UPDATE]: "updated",
  [AUDIT_ACTION.TASK_DELETE]: "deleted",
  [AUDIT_ACTION.TASK_RESTORE]: "updated",
  [AUDIT_ACTION.TASK_PARTICIPANTS_CHANGE]: "updated",
};

export function operationForAction(action: string): "created" | "updated" | "deleted" {
  return OPERATION_BY_ACTION[action] ?? "updated";
}

// Backs GET /integration/v1/changes. `audit_log` is the only change-tracking this schema has,
// and it only ever writes `entity_type = 'task'` rows for real operational data — the table
// also carries `entity_type = 'api_key'` rows for the integration feature's own key lifecycle
// (see things-to-know.md's Integrations section), which are deliberately excluded here:
// `api_key` isn't one of the spec's Core Entities, and it's an administrative event about this
// integration layer itself, not business data Databricks should ingest through it. This
// endpoint always scopes its query to `entity_type = 'task'` regardless of what's asked for; an
// `entity_type` filter for anything else in the spec's Core Entities list (season, brand, ...)
// returns an empty page honestly — those entities are real, they just have no change tracking
// in this schema yet — rather than erroring or fabricating rows.
export async function listChangesForIntegration({
  pageSize,
  cursor,
  entityType,
  occurredSince,
}: ListChangesForIntegrationParams): Promise<{ rows: IntegrationChangeRow[]; nextCursor: string | null }> {
  if (entityType && entityType !== AUDIT_ENTITY_TYPE.TASK) {
    return { rows: [], nextCursor: null };
  }

  const supabase = createAdminClient();

  let query = supabase.from("audit_log").select(SELECT).eq("entity_type", AUDIT_ENTITY_TYPE.TASK);
  if (occurredSince) query = query.gte("created_at", occurredSince);

  // Same keyset shape as every other list endpoint's (updated_at, id) cursor
  // (lib/integration/cursor.ts), reused as-is even though `audit_log` is append-only and the
  // field it actually orders on is `created_at` — the cursor's own field name is just its
  // opaque internal shape, never interpreted as anything but "resume after this."
  if (cursor) {
    query = query.or(`created_at.gt.${cursor.updatedAt},and(created_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`);
  }

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(pageSize + 1);
  if (error) throw error;

  const rows = (data ?? []) as unknown as IntegrationChangeRow[];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ updatedAt: last.created_at, id: last.id }) : null;

  return { rows: page, nextCursor };
}
