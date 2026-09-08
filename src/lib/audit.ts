import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { AuditChanges, AuditFieldChange } from "@/types/audit";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface AuditEventInput {
  actorId: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  changes?: AuditChanges;
}

// The single write path into `audit_log`, called from inside the Server Action that performed
// the thing being recorded — never from a component, never duplicated per entity.
//
// Best-effort on purpose: a failed log entry must not fail (or roll back) an otherwise valid
// mutation the user already saw succeed. The trade is that the log can under-record, never
// over-record — and since the insert goes through the caller's own RLS-scoped client, a row
// can only ever be attributed to the person who actually made the change (0020's insert policy
// pins actor_id to auth.uid()).
export async function recordAuditEvent(
  supabase: SupabaseClient,
  { actorId, actorEmail, action, entityType, entityId, entityLabel, changes = {} }: AuditEventInput
) {
  try {
    await supabase.from("audit_log").insert({
      actor_id: actorId,
      // Snapshot, not a substitute for the FK: the join to profiles is what renders a name and
      // avatar, this is what keeps the row attributable after that profile is deleted.
      actor_email: actorEmail,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel,
      changes,
    });
  } catch {
    // Swallowed deliberately — see above.
  }
}

// Field-level diff for an update. Driven by the keys of `patch` (what the caller actually
// submitted), not by every column on `before` — an inline edit of one cell should log one
// field, not eleven unchanged ones.
//
// `format` turns a raw column value into what the UI shows; that's where an FK id becomes the
// season's name. Values are compared before formatting so two different ids never collapse
// into one label and look unchanged.
export async function diffFields<T extends Record<string, unknown>>(
  before: T,
  patch: Partial<T>,
  format: (field: string, value: unknown) => string | null | Promise<string | null>
): Promise<AuditFieldChange[]> {
  const changed = Object.keys(patch).filter((field) => !isSameValue(before[field], patch[field]));

  return Promise.all(
    changed.map(async (field) => ({
      field,
      from: await format(field, before[field]),
      to: await format(field, patch[field]),
    }))
  );
}

// null and "" both mean "not set" across this schema (form fields submit "", columns store
// null — see normaliseDate/normaliseOptionalId in tasks/_actions.ts), so clearing an already
// empty field is not a change worth a log row.
function isSameValue(before: unknown, after: unknown) {
  const normalise = (value: unknown) => (value === null || value === undefined || value === "" ? null : value);
  return normalise(before) === normalise(after);
}
