import "server-only";
import { differenceInCalendarDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeCursor, type IntegrationCursor } from "@/lib/integration/cursor";
import { resolveSeasonIdByCode, resolveBrandIdByCode } from "@/lib/integration/lookup-codes";
import { resolveTaskIdsForOwnerName, resolveOwnerNames, resolvePeopleInvolvedNames } from "@/lib/integration/task-owners";
import type { TaskGroupStatus } from "@/lib/integration/task-group-facts";
import { taskPriorityValues } from "@/app/(app)/tasks/schema";
import { parseDateOnly } from "@/lib/dates";

type SupabaseClient = ReturnType<typeof createAdminClient>;
export type TaskPriorityFilter = (typeof taskPriorityValues)[number];

// Same "invalid value degrades to no filter" convention parseTaskStatusFilter
// (task-group-facts.ts) already uses — a bad `?priority=` on a read-only sync feed isn't worth
// a 400 over.
export function parsePriorityFilter(raw: string | null): TaskPriorityFilter | null {
  return raw && (taskPriorityValues as readonly string[]).includes(raw) ? (raw as TaskPriorityFilter) : null;
}

export interface ListTasksForIntegrationParams {
  pageSize: number;
  cursor: IntegrationCursor | null;
  updatedSince: string | null;
  includeDeleted: boolean;
  seasonCode: string | null;
  brandCode: string | null;
  status: TaskGroupStatus | null;
  priority: TaskPriorityFilter | null;
  ownerName: string | null;
  dueFrom: string | null;
  dueTo: string | null;
}

const TASK_SELECT =
  "id, task_name, status, priority, gender, due_date, start_date, end_date, notes, season_id, brand_id, " +
  "google_event_id, google_synced_at, created_at, updated_at, deleted_at, " +
  "season:seasons(season_code, season_name), brand:brands(brand_code, brand_name), key_stage:key_stages(name)";

interface TaskRow {
  id: string;
  task_name: string;
  status: string;
  priority: string;
  gender: string;
  due_date: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  season_id: string;
  brand_id: string | null;
  google_event_id: string | null;
  google_synced_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  season: { season_code: string; season_name: string } | null;
  brand: { brand_code: string; brand_name: string } | null;
  key_stage: { name: string } | null;
}

export interface IntegrationTaskRow extends TaskRow {
  owner_name: string | null;
  people_involved: string[];
}

// duration_days is computed from start_date/end_date — both static, stored columns, not
// "today" — so unlike days_overdue/days_late (see below) this is SAFE on an incremental sync
// feed: it only changes when start_date or end_date changes, which updated_at already captures.
export function computeDurationDays(startDate: string | null, endDate: string | null): number | null {
  if (!startDate || !endDate) return null;
  return differenceInCalendarDays(parseDateOnly(endDate), parseDateOnly(startDate)) + 1;
}

async function attachParticipants(supabase: SupabaseClient, rows: TaskRow[]): Promise<IntegrationTaskRow[]> {
  const taskIds = rows.map((row) => row.id);
  const [ownerNames, peopleInvolved] = await Promise.all([
    resolveOwnerNames(supabase, taskIds),
    resolvePeopleInvolvedNames(supabase, taskIds),
  ]);
  return rows.map((row) => ({ ...row, owner_name: ownerNames.get(row.id) ?? null, people_involved: peopleInvolved.get(row.id) ?? [] }));
}

// Backs GET /integration/v1/tasks — the big one. About a third of the spec's field list has no
// backing column at all (blocked_status, escalation_owner_name, is_milestone, milestone_flag,
// delay_reason_code/text, planned_*/actual_* dates, due_date_zapier, comments_count,
// attachments_count, link_url, assignee_name) and is sent as `null` per the standing
// [[integration-api-null-policy]] rule, not omitted. Filters for those same absent concepts
// (blocked_status, escalation_owner_name, delay_reason_code, is_milestone) are accepted per the
// spec's query param list but are no-ops — there is nothing in this schema for them to filter
// on. **`days_late`/`days_at_risk` are ALWAYS null here, unlike /reports/overdue-tasks'
// days_overdue** — this endpoint has a real `updated_since` incremental-sync contract, and a
// value that silently changes day-to-day without the row's own `updated_at` moving would make a
// consumer miss it on an incremental pull (see things-to-know.md's Tasks section). `duration_days`
// IS computed live — see computeDurationDays above for why that one is safe.
export async function listTasksForIntegration({
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
}: ListTasksForIntegrationParams): Promise<{ rows: IntegrationTaskRow[]; nextCursor: string | null }> {
  const supabase = createAdminClient();

  let seasonId: string | null = null;
  if (seasonCode) {
    seasonId = await resolveSeasonIdByCode(supabase, seasonCode);
    if (!seasonId) return { rows: [], nextCursor: null };
  }
  let brandId: string | null = null;
  if (brandCode) {
    brandId = await resolveBrandIdByCode(supabase, brandCode);
    if (!brandId) return { rows: [], nextCursor: null };
  }
  let ownerTaskIds: string[] | null = null;
  if (ownerName) {
    ownerTaskIds = await resolveTaskIdsForOwnerName(supabase, ownerName);
    if (ownerTaskIds === null || ownerTaskIds.length === 0) return { rows: [], nextCursor: null };
  }

  let query = supabase.from("tasks").select(TASK_SELECT);
  if (!includeDeleted) query = query.is("deleted_at", null);
  if (updatedSince) query = query.gte("updated_at", updatedSince);
  if (seasonId) query = query.eq("season_id", seasonId);
  if (brandId) query = query.eq("brand_id", brandId);
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (ownerTaskIds) query = query.in("id", ownerTaskIds);
  if (dueFrom) query = query.gte("due_date", dueFrom);
  if (dueTo) query = query.lte("due_date", dueTo);

  if (cursor) {
    query = query.or(`updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(pageSize + 1);
  if (error) throw error;

  const rows = (data ?? []) as unknown as TaskRow[];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ updatedAt: last.updated_at, id: last.id }) : null;

  return { rows: await attachParticipants(supabase, page), nextCursor };
}

// Backs GET /integration/v1/tasks/{task_id}. No deleted_at filter — a consumer fetching a
// specific id (e.g. one it just saw in /changes) should get the row back with its real
// deleted_at, not a 404 that hides the fact it existed and was later deleted.
export async function getTaskByIdForIntegration(taskId: string): Promise<IntegrationTaskRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("tasks").select(TASK_SELECT).eq("id", taskId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [row] = await attachParticipants(supabase, [data as unknown as TaskRow]);
  return row;
}

// Shared by both /tasks and /tasks/{task_id} — the spec sketches a narrower field set for the
// single-item shape than the list shape (no season_id/season_name/brand_id/gender/notes/
// calendar_*/comments_count/attachments_count/link_url), an inconsistency the spec's own header
// calls a "rough sketch." Returning the SAME full row shape from both endpoints — a superset of
// the single-item example — is deliberate: maintaining two different field sets for the same
// underlying entity would drift, and the null-policy already requires every field always
// present regardless.
export function toIntegrationTaskRecord(row: IntegrationTaskRow) {
  return {
    task_id: row.id,
    task_name: row.task_name,
    key_stage: row.key_stage?.name ?? null,
    status: row.status,
    blocked_status: null,
    priority: row.priority,
    season_id: row.season_id,
    season_code: row.season?.season_code ?? null,
    season_name: row.season?.season_name ?? null,
    brand_id: row.brand_id,
    brand_code: row.brand?.brand_code ?? null,
    brand_name: row.brand?.brand_name ?? null,
    gender: row.gender,
    owner_name: row.owner_name,
    assignee_name: null,
    escalation_owner_name: null,
    people_involved: row.people_involved,
    planned_start_date: null,
    planned_end_date: null,
    working_timeline_start_date: row.start_date,
    working_timeline_end_date: row.end_date,
    actual_start_date: null,
    actual_end_date: null,
    duration_days: computeDurationDays(row.start_date, row.end_date),
    due_date_zapier: null,
    due_date: row.due_date,
    days_at_risk: null,
    days_late: null,
    is_milestone: null,
    milestone_flag: null,
    delay_reason_code: null,
    delay_reason_text: null,
    comments_count: null,
    attachments_count: null,
    notes: row.notes,
    link_url: null,
    calendar_event_id: row.google_event_id,
    calendar_sync_status: row.google_event_id ? "synced" : null,
    calendar_last_synced_at: row.google_synced_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    version: null,
  };
}
