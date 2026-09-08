import "server-only";
import { startOfDay, subDays } from "date-fns";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_ACTION, AUDIT_PERIOD } from "@/constants/audit";
import type { AuditChanges } from "@/types/audit";

export interface ListAuditEventsParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
}

const SORTABLE_COLUMNS = new Set(["created_at", "action"]);

// The actor is embedded rather than read from actor_email alone so the row renders a name and
// avatar like every other person cell in the app. actor_email is still selected: it's the
// snapshot that survives the profile being deleted, and the fallback when the embed is null.
// One string literal, not a concatenation — supabase-js infers the row type from the literal
// itself, and `"a" + "b"` widens it to string, which collapses the result type to an error.
const AUDIT_SELECT =
  "id, action, entity_type, entity_id, entity_label, changes, created_at, actor_id, actor_email, actor:profiles(id, full_name, email, avatar_url)";

const auditChangesSchema = z.object({
  fields: z
    .array(z.object({ field: z.string(), from: z.string().nullable(), to: z.string().nullable() }))
    .optional(),
  parties: z
    .array(
      z.object({
        role: z.enum(["owner", "involved"]),
        added: z.array(z.string()),
        removed: z.array(z.string()),
      })
    )
    .optional(),
  owners: z.array(z.string()).optional(),
  backfilled: z.boolean().optional(),
});

// `changes` is jsonb, so it arrives as unstructured Json — validated here, at the single read
// boundary, so every consumer downstream gets a typed AuditChanges. An unrecognised shape (an
// entry written by an older version of a Server Action) degrades to "no detail" rather than
// throwing: a log row that can't render its diff is still worth showing for who/what/when.
function parseChanges(value: unknown): AuditChanges {
  const result = auditChangesSchema.safeParse(value);
  return result.success ? result.data : {};
}

// PostgREST's `.or()` uses commas to separate conditions and parentheses to group — a raw term
// containing either would corrupt the filter, so strip them. Same guard as data/users.ts.
function sanitiseOrSearchTerm(value: string) {
  return value.replace(/[,()]/g, "").trim();
}

function periodCutoff(period: string | undefined) {
  if (period === AUDIT_PERIOD.TODAY) return startOfDay(new Date());
  if (period === AUDIT_PERIOD.WEEK) return subDays(new Date(), 7);
  if (period === AUDIT_PERIOD.MONTH) return subDays(new Date(), 30);
  return null;
}

// Management → Logs. Server-paginated like every other DataTable-backed list.
//
// The `created_at` filter carries a period keyword (today / 7d / 30d), not a date — it's
// resolved to a cutoff here so the URL stays shareable and doesn't go stale the way a baked-in
// timestamp would.
export async function listAuditEvents({
  page = 1,
  pageSize = 15,
  sortBy,
  sortDir,
  filters = {},
}: ListAuditEventsParams = {}) {
  const supabase = await createClient();
  let query = supabase.from("audit_log").select(AUDIT_SELECT, { count: "exact" });

  const term = filters.entity_label ? sanitiseOrSearchTerm(filters.entity_label) : "";
  if (term) query = query.or(`entity_label.ilike.%${term}%,actor_email.ilike.%${term}%`);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.actor) query = query.eq("actor_id", filters.actor);

  const cutoff = periodCutoff(filters.created_at);
  if (cutoff) query = query.gte("created_at", cutoff.toISOString());

  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "created_at";
  query = query.order(orderColumn, { ascending: sortDir === "asc" });

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  return {
    data: (data ?? []).map((row) => ({ ...row, changes: parseChanges(row.changes) })),
    rowCount: count ?? 0,
  };
}

export type AuditEvent = Awaited<ReturnType<typeof listAuditEvents>>["data"][number];

export interface AuditLogSummary {
  total: number;
  created: number;
  updated: number;
  deleted: number;
}

// Its own narrow head-count queries, never derived from a page of listAuditEvents() — these
// count the whole log, not the fifteen rows on screen.
export async function getAuditLogSummary(): Promise<AuditLogSummary> {
  const supabase = await createClient();
  const countOf = (action?: string) => {
    const query = supabase.from("audit_log").select("id", { count: "exact", head: true });
    return action ? query.eq("action", action) : query;
  };

  const [total, created, updated, deleted] = await Promise.all([
    countOf(),
    countOf(AUDIT_ACTION.TASK_CREATE),
    countOf(AUDIT_ACTION.TASK_UPDATE),
    countOf(AUDIT_ACTION.TASK_DELETE),
  ]);

  return {
    total: total.count ?? 0,
    created: created.count ?? 0,
    updated: updated.count ?? 0,
    deleted: deleted.count ?? 0,
  };
}

// Options for the "Person" filter. Built from `profiles`, not from the distinct actors present
// in the log: PostgREST has no DISTINCT, so the alternative is pulling every log row back and
// deduping in memory — a query that grows without bound to populate a dropdown. A person with
// no entries yet simply filters to an empty list, which reads fine.
export async function listAuditActorOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((profile) => ({ value: profile.id, label: profile.full_name ?? profile.email }));
}
