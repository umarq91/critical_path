import "server-only";
import { differenceInCalendarDays, startOfToday } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeCursor, type IntegrationCursor } from "@/lib/integration/cursor";
import { resolveOwnerNames, resolveTaskIdsForOwnerName } from "@/lib/integration/task-owners";
import { resolveSeasonIdByCode, resolveBrandIdByCode } from "@/lib/integration/lookup-codes";
import { parseDateOnly } from "@/lib/dates";

export interface ListOverdueTasksForIntegrationParams {
  pageSize: number;
  cursor: IntegrationCursor | null;
  seasonCode: string | null;
  brandCode: string | null;
  ownerName: string | null;
  dueFrom: string | null;
  dueTo: string | null;
}

const TASK_SELECT = "id, task_name, due_date, status, updated_at, season:seasons(season_code), brand:brands(brand_name)";

interface TaskRow {
  id: string;
  task_name: string;
  due_date: string | null;
  status: string;
  updated_at: string;
  season: { season_code: string } | null;
  brand: { brand_name: string } | null;
}

export interface IntegrationOverdueTaskRow extends TaskRow {
  owner_name: string | null;
}

// Backs GET /integration/v1/reports/overdue-tasks. **Trusts `tasks.status = 'overdue'` rather
// than deriving it live from `due_date` — this is a known, documented gap, not an oversight.**
// Nothing in this codebase actually auto-stamps that status yet (see things-to-know.md's Tasks
// section, "Is never overdue" — the status-rollover cron CLAUDE.md describes doesn't exist as a
// route on disk); the one place that DOES derive it live (`calendar-task-chip.tsx`) does so
// because the calendar view specifically needs same-day accuracy, and says so in its own
// comment. Every aggregate view in this app otherwise trusts the stored column
// (`data/dashboard.ts`'s status tiles, `data/tasks.ts`'s `listOverdueTasks`) — this endpoint
// matches that dominant convention rather than inventing a fourth definition of "overdue" that
// would silently disagree with what `/dashboard` shows. Net effect: a task whose due_date has
// passed but whose status hasn't been manually updated will NOT appear here. If that undercount
// matters for Databricks' reporting, the fix is building the missing status-rollover cron, not
// papering over it in this one endpoint.
export async function listOverdueTasksForIntegration({
  pageSize,
  cursor,
  seasonCode,
  brandCode,
  ownerName,
  dueFrom,
  dueTo,
}: ListOverdueTasksForIntegrationParams): Promise<{ rows: IntegrationOverdueTaskRow[]; nextCursor: string | null }> {
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

  let query = supabase.from("tasks").select(TASK_SELECT).eq("status", "overdue").is("deleted_at", null);
  if (seasonId) query = query.eq("season_id", seasonId);
  if (brandId) query = query.eq("brand_id", brandId);
  if (ownerTaskIds) query = query.in("id", ownerTaskIds);
  if (dueFrom) query = query.gte("due_date", dueFrom);
  if (dueTo) query = query.lte("due_date", dueTo);

  // Keyset pagination — see lib/integration/cursor.ts for why (updated_at, id) and why the
  // cursor is validated before it ever reaches this string.
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

  const ownerNames = await resolveOwnerNames(supabase, page.map((row) => row.id));

  return { rows: page.map((row) => ({ ...row, owner_name: ownerNames.get(row.id) ?? null })), nextCursor };
}

// A task with status='overdue' but no due_date is a data anomaly (a status set by hand, not by
// any date-driven logic — `calendar-task-chip.tsx` treats "no due_date" and "overdue" as
// mutually exclusive for exactly this reason), so days_overdue is null rather than guessed at.
// Calendar-day difference against `startOfToday()`, matching parseDateOnly's own local-midnight
// handling for date-only columns (lib/dates.ts) — never `new Date(due_date)` directly.
export function computeDaysOverdue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  return differenceInCalendarDays(startOfToday(), parseDateOnly(dueDate));
}
