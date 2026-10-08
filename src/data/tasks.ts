import "server-only";
import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { decodeMultiFilterValue } from "@/constants/data-table-filters";
import { isDueWeekPreset } from "@/constants/due-week-filter";
import { clampTaskPageSize } from "@/constants/task-page-size";
import { dueWeekRange } from "@/lib/dates";
import { isUuid } from "@/lib/utils";
import {
  EMPTY_RESULT_ID,
  participantTaskIds,
  taskIdsForProfile,
  type SupabaseClient,
} from "@/data/task-participants";
import { TASK_SEARCH_SELECT, resolveTaskSearchMatcher, type TaskSearchRow } from "@/data/task-search";
import {
  taskGenderValues,
  taskStatusValues,
  taskPriorityValues,
  dpspCategoryValues,
  type TaskInput,
} from "@/app/(app)/tasks/schema";

export interface ListTasksParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
  /** Scopes the list to one person's own work — the My Tasks page's whole premise.
   *  "Theirs" means any of: they created it, they are an owner, or they are People Involved —
   *  in the last two cases whether named directly or through their department (see the
   *  task_participant_profiles view). Role grants no exemption: an admin scoped this way sees
   *  their own tasks, not everyone's.
   *
   *  Resolved in memory rather than as a filter, because neither leg can be an inline
   *  PostgREST clause: participation lives in a join table, and the two legs are a union
   *  (`created_by = me OR id IN (…)`) whose id side can run to hundreds of uuids. */
  scopeToProfileId?: string;
}

const SORTABLE_COLUMNS = new Set(["task_name", "due_date", "status", "priority", "created_at"]);

// Shared by every task query below — the grid, and the calendar's bounded range query —
// so a relation gets added once, not once per query.
const TASK_SELECT = `*, season:seasons(id, season:season_code, color), brand:brands(id, brand_name, color), key_stage:key_stages(id, name), assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url), created_by_profile:profiles!tasks_created_by_fkey(id, full_name, email, avatar_url), last_edited_by_profile:profiles!tasks_last_edited_by_fkey(id, full_name, email, avatar_url), participants:task_participants(role, profile:profiles(id, full_name, email, avatar_url, department:departments(name)), department:departments(id, name, is_external))`;

function isTaskGender(value: string | undefined): value is TaskInput["gender"] {
  return !!value && (taskGenderValues as readonly string[]).includes(value);
}

function isTaskStatus(value: string | undefined): value is TaskInput["status"] {
  return !!value && (taskStatusValues as readonly string[]).includes(value);
}

function isTaskPriority(value: string | undefined): value is TaskInput["priority"] {
  return !!value && (taskPriorityValues as readonly string[]).includes(value);
}

function isDpspCategory(value: string | undefined): value is (typeof dpspCategoryValues)[number] {
  return !!value && (dpspCategoryValues as readonly string[]).includes(value);
}

// Applies a `multiple: true` toolbar filter's decoded values as `.eq` (one value) or `.in`
// (several) — the same clause either way from PostgREST's perspective, just picking the cheaper
// one. Kept generic over the query type so every taskScope() clause below can reassign through
// it without narrowing `query`'s type to whatever this function returns.
function applyMultiEq<Q extends { eq: (column: string, value: string) => Q; in: (column: string, values: string[]) => Q }>(
  query: Q,
  column: string,
  values: string[]
): Q {
  if (values.length === 0) return query;
  return values.length === 1 ? query.eq(column, values[0]) : query.in(column, values);
}

// "Critical" toolbar filter (Tasks, Timeline): "yes" / "no". Anything else is ignored, not an error.
function applyCriticalFilter<Q extends { eq: (column: string, value: boolean) => Q }>(query: Q, value: string | undefined): Q {
  if (value === "yes") return query.eq("is_critical", true);
  if (value === "no") return query.eq("is_critical", false);
  return query;
}

/** Task-id allow-lists that can't be expressed as inline PostgREST filters, resolved once per
 *  call so the two passes below don't look them up twice. `null` = that scope isn't set. */
interface TaskScopeIds {
  participants: string[] | null;
}

async function resolveTaskScopeIds(supabase: SupabaseClient, params: ListTasksParams): Promise<TaskScopeIds> {
  const { filters = {} } = params;
  return {
    // "Owner" / "People Involved" toolbar filters — see participantTaskIds.
    participants: await participantTaskIds(supabase, filters),
  };
}

interface TaskScopeOptions {
  /** Attaches an exact row count to the response alongside the page of rows. */
  withCount?: boolean;
  /** Skips fetching rows entirely — just the count. For a "how many records match" preview
   *  that has no business paying for the rows it's not going to show. Implies `withCount`. */
  headOnly?: boolean;
}

// Filters, scope and ordering, shared by the plain query and by both passes of a search — so
// the narrow pass that decides WHICH tasks match and the wide pass that fetches them can never
// disagree about anything else.
//
// Synchronous on purpose: a PostgREST builder is itself thenable, so `await`ing an async
// function that returned one would RUN the query instead of handing it back. Hence the
// pre-resolved ids.
function taskScope(
  supabase: SupabaseClient,
  select: string,
  params: ListTasksParams,
  ids: TaskScopeIds,
  options: TaskScopeOptions | boolean = {}
) {
  // The boolean form is legacy shorthand for `{ withCount: bool }`, kept so the three existing
  // call sites below don't all need touching for one new caller's sake.
  const { withCount = false, headOnly = false } = typeof options === "boolean" ? { withCount: options } : options;
  const { filters = {}, sortBy, sortDir } = params;
  let query = supabase
    .from("tasks")
    .select(select, withCount || headOnly ? { count: "exact", head: headOnly } : undefined)
    .is("deleted_at", null);

  if (filters.task_name) query = query.ilike("task_name", `%${filters.task_name}%`);
  // Season/Brand/Key Stage/Gender/Status/Priority/DPSP Category are all `multiple: true`
  // toolbar filters — see data-table-toolbar.tsx and constants/data-table-filters.ts for the
  // comma-joined encoding this decodes.
  query = applyMultiEq(query, "season_id", decodeMultiFilterValue(filters.season_id).filter(isUuid));
  query = applyMultiEq(query, "brand_id", decodeMultiFilterValue(filters.brand_id).filter(isUuid));
  query = applyMultiEq(query, "key_stage_id", decodeMultiFilterValue(filters.key_stage_id).filter(isUuid));
  query = applyMultiEq(query, "gender", decodeMultiFilterValue(filters.gender).filter((value) => isTaskGender(value)));
  query = applyMultiEq(query, "status", decodeMultiFilterValue(filters.status).filter((value) => isTaskStatus(value)));
  query = applyMultiEq(query, "priority", decodeMultiFilterValue(filters.priority).filter((value) => isTaskPriority(value)));
  query = applyMultiEq(
    query,
    "dpsp_category",
    decodeMultiFilterValue(filters.dpsp_category).filter((value) => isDpspCategory(value))
  );
  // "Hide done" toggle (DPSP Flywheel board) — an exclusion, not an equality match, so it's
  // its own filter key rather than overloading `status`.
  if (filters.hide_done === "true") query = query.neq("status", "completed");
  query = applyCriticalFilter(query, filters.is_critical);
  // An unmatched party must yield zero rows, not every row, hence the impossible-id fallback
  // rather than skipping the clause.
  if (ids.participants) {
    query = ids.participants.length > 0 ? query.in("id", ids.participants) : query.eq("id", EMPTY_RESULT_ID);
  }
  // "Due" toolbar filter (My Tasks) — a day-count preset ("7"/"30"/"90"), not a literal
  // date; caps due_date at today + N days.
  if (filters.due_date) {
    const days = Number(filters.due_date);
    if (Number.isInteger(days) && days > 0) {
      query = query.lte("due_date", format(addDays(new Date(), days), "yyyy-MM-dd"));
    }
  }
  // "Due" toolbar filter (Tasks) — a Monday-to-Sunday week preset. Undated tasks never match.
  if (isDueWeekPreset(filters.due_week)) {
    const { from, to } = dueWeekRange(filters.due_week);
    query = query.gte("due_date", from).lte("due_date", to);
  }

  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "due_date";
  // `id` is the tiebreaker and is NOT decorative: due dates (and statuses, and priorities)
  // repeat heavily, and without a total order Postgres may return tied rows in a different
  // sequence per query — which lets a row appear on two pages, or on none, both for ordinary
  // pagination and across the search's two passes.
  //
  // due_date is nullable (some historical tasks have none) — nullsFirst: false pins undated
  // rows to the bottom regardless of sort direction, so they never jump to the top of a
  // "Latest first" sort. Harmless on every other sortable column, none of which are nullable.
  return query
    .order(orderColumn, { ascending: sortDir !== "desc", nullsFirst: false })
    .order("id", { ascending: true });
}

/** The narrow pass's projection: what a search matches against, plus the column the personal
 *  scope needs. */
const TASK_NARROW_SELECT = `${TASK_SEARCH_SELECT}, created_by`;

type TaskNarrowRow = TaskSearchRow & { created_by: string | null };

// "Their tasks": created by them, or owned by them, or involving them — the last two directly
// or through their department. A union of a column check and a join-table id set, which is why
// it is applied here and not as a filter.
async function resolvePersonalScope(supabase: SupabaseClient, profileId: string) {
  const participantIds = new Set(await taskIdsForProfile(supabase, profileId));
  return (row: TaskNarrowRow) => row.created_by === profileId || participantIds.has(row.id);
}

// Ids per request when a page's full rows are fetched by id. A page can be 300 rows
// (MAX_TASK_PAGE_SIZE), and an `in` list that long, plus any participant-id clause the scope
// already carries, approaches the URL length the endpoint rejects (~800 ids measured). Chunks
// are consecutive slices of an already-ordered id list, so concatenating them keeps the order.
const PAGE_ID_CHUNK_SIZE = 100;

async function fetchRowsByIdChunks<T>(ids: string[], fetchChunk: (chunk: string[]) => PromiseLike<{ data: unknown; error: unknown }>) {
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += PAGE_ID_CHUNK_SIZE) chunks.push(ids.slice(start, start + PAGE_ID_CHUNK_SIZE));
  // In parallel: at most three requests for a 300-row page, and Promise.all keeps chunk order.
  const results = await Promise.all(chunks.map((chunk) => fetchChunk(chunk)));
  return results.flatMap(({ data, error }) => {
    if (error) throw error;
    return (data ?? []) as T[];
  });
}

// The ONE query function behind the task grid, and every future view-specific list (Gantt
// range, calendar range, dashboard aggregates, CSV export) — those extend this, not fork it.
//
// Two criteria can't be PostgREST filters — a search term and the personal scope — and either
// one puts this on the two-pass route: match against a narrow projection of the whole scoped
// set, then fetch only the page's rows in full. The alternative, inlining a task-id set into
// the query, builds a URL the endpoint rejects once the set is big enough (measured on this
// project: ~500 ids pass, ~800 fail). With neither, this stays a single query and the ordinary
// page load pays nothing for the feature.
export async function listTasks(params: ListTasksParams = {}): Promise<{ data: Task[]; rowCount: number }> {
  const supabase = await createClient();
  const { page = 1, filters = {}, scopeToProfileId } = params;
  const pageSize = clampTaskPageSize(params.pageSize ?? 15);
  const term = (filters.search ?? "").trim();

  const ids = await resolveTaskScopeIds(supabase, params);
  const from = (page - 1) * pageSize;

  if (!term && !scopeToProfileId) {
    const { data, error, count } = await taskScope(supabase, TASK_SELECT, params, ids, true).range(
      from,
      from + pageSize - 1
    );
    if (error) throw error;
    return { data: (data ?? []) as unknown as Task[], rowCount: count ?? 0 };
  }

  const { data: candidates, error: candidateError } = await taskScope(supabase, TASK_NARROW_SELECT, params, ids, false);
  if (candidateError) throw candidateError;

  let matched = (candidates ?? []) as unknown as TaskNarrowRow[];
  if (scopeToProfileId) matched = matched.filter(await resolvePersonalScope(supabase, scopeToProfileId));
  if (term) matched = matched.filter(await resolveTaskSearchMatcher(supabase, term));

  const pageIds = matched.slice(from, from + pageSize).map((row) => row.id);
  if (pageIds.length === 0) return { data: [], rowCount: matched.length };

  // Re-ordered by the same columns as the narrow pass, so the page reads in the sequence it was
  // sliced in. The scope's filters are redundant here (these ids already passed them) but cost
  // nothing and keep one definition of "how this list is ordered".
  const data = await fetchRowsByIdChunks<Task>(pageIds, (chunk) =>
    taskScope(supabase, TASK_SELECT, params, ids, false).in("id", chunk)
  );

  return { data, rowCount: matched.length };
}

// A type witness, never called. `Task` has to come from a `.select(TASK_SELECT)` where the
// string's LITERAL type survives — supabase-js parses it to build the row shape, and passing
// TASK_SELECT through taskScope's `select: string` parameter erases exactly that. Deriving from
// listTasks() instead would be circular, since it now annotates its own return type.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function taskSelectQuery(supabase: SupabaseClient) {
  return supabase.from("tasks").select(TASK_SELECT);
}

export type Task = NonNullable<Awaited<ReturnType<typeof taskSelectQuery>>["data"]>[number];

export interface ListTasksForExportParams {
  /** Same vocabulary as `ListTasksParams.filters` (season_id/brand_id/key_stage_id/gender/
   *  status/priority/owner/involved/search) — an export scope is the grid's own filter shape,
   *  not a new one; the Task Management export dialog forwards its page's current filters here
   *  verbatim. Still deliberately does NOT accept `scopeToProfileId`: that's the My Tasks
   *  page's "my work" scoping, and no export dialog sits on that page yet. */
  filters?: Record<string, string>;
  sortBy?: string;
  sortDir?: string;
}

/** Hard ceiling on a single export — a safety valve, not a target. Past this, an export belongs
 *  behind a background job with an emailed download link, not a synchronous HTTP response; see
 *  the note on `listTasksForExport` for the reasoning. */
export const MAX_EXPORT_ROWS = 5000;

// PostgREST caps one response at 1000 rows (see data/dashboard.ts's own MAX_FACT_PAGES note),
// so a bulk export has to page through internally just like the dashboard's aggregate fetch
// does — the two are the same problem (read every row of a filtered scope) at a different
// projection width.
const EXPORT_PAGE_SIZE = 1000;

// The bulk-export counterpart to listTasks(): every row matching a filter scope (not a UI page
// of them), fetched server-side and handed back as one in-memory array for a Route Handler to
// turn into a file. Unlike the first version of this function, it DOES follow listTasks() onto
// the two-pass route when `filters.search` is set — the Task Management export dialog is meant
// to export what the grid is currently showing, and a search term is part of that — see
// exportSearchMatches() below. Owner/People Involved participant filters resolve through the
// same resolveTaskScopeIds() the grid itself uses, for the same reason.
//
// Bounded at MAX_EXPORT_ROWS rather than exporting an unbounded table: past a few thousand
// rows, a synchronous request/response export stops being a reasonable architecture regardless
// of format — the browser is holding the whole file in memory to trigger a download, and a
// Vercel Route Handler has its own execution time ceiling. `truncated` tells the caller (and
// the caller must tell the user) that the file is a prefix of the matching set, not all of it.
export async function listTasksForExport(
  params: ListTasksForExportParams = {}
): Promise<{ data: Task[]; rowCount: number; truncated: boolean }> {
  const supabase = await createClient();
  const ids = await resolveTaskScopeIds(supabase, params);
  const term = (params.filters?.search ?? "").trim();
  if (term) return exportSearchMatches(supabase, params, ids, term);

  const { count, error: countError } = await taskScope(supabase, "id", params, ids, { headOnly: true });
  if (countError) throw countError;
  const rowCount = count ?? 0;
  if (rowCount === 0) return { data: [], rowCount: 0, truncated: false };

  const fetchCount = Math.min(rowCount, MAX_EXPORT_ROWS);
  const rows: Task[] = [];
  for (let from = 0; from < fetchCount; from += EXPORT_PAGE_SIZE) {
    const to = Math.min(from + EXPORT_PAGE_SIZE, fetchCount) - 1;
    const { data, error } = await taskScope(supabase, TASK_SELECT, params, ids, {}).range(from, to);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Task[]));
    // A page short of a full EXPORT_PAGE_SIZE means the table had fewer rows than the count
    // implied (a concurrent delete) — stop rather than requesting an empty page next.
    if (!data || data.length < to - from + 1) break;
  }

  return { data: rows, rowCount, truncated: rowCount > MAX_EXPORT_ROWS };
}

// listTasksForExport's search-term branch — mirrors listTasks()'s own two-pass route (narrow
// projection across the WHOLE scope, filtered in memory, since a search term can't be a
// PostgREST clause) except the slice it hydrates to full rows is the export's MAX_EXPORT_ROWS
// prefix of matches rather than one UI page.
async function exportSearchMatches(
  supabase: SupabaseClient,
  params: ListTasksForExportParams,
  ids: TaskScopeIds,
  term: string
): Promise<{ data: Task[]; rowCount: number; truncated: boolean }> {
  const { data: candidates, error: candidateError } = await taskScope(supabase, TASK_NARROW_SELECT, params, ids, false);
  if (candidateError) throw candidateError;

  const matcher = await resolveTaskSearchMatcher(supabase, term);
  const matched = ((candidates ?? []) as unknown as TaskNarrowRow[]).filter(matcher);
  const rowCount = matched.length;
  if (rowCount === 0) return { data: [], rowCount: 0, truncated: false };

  const exportIds = matched.slice(0, MAX_EXPORT_ROWS).map((row) => row.id);
  const rows: Task[] = [];
  for (let from = 0; from < exportIds.length; from += EXPORT_PAGE_SIZE) {
    const chunk = exportIds.slice(from, from + EXPORT_PAGE_SIZE);
    const { data, error } = await taskScope(supabase, TASK_SELECT, params, ids, false).in("id", chunk);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Task[]));
  }

  return { data: rows, rowCount, truncated: rowCount > MAX_EXPORT_ROWS };
}

/** Cheap "how many rows would this export contain" — the live count the export dialog shows
 *  while the user is still choosing filters, without paying for the rows themselves. Follows
 *  the same search/participant-scope rules as listTasksForExport, since it exists to preview
 *  that same call. */
export async function countTasksForExport(filters: Record<string, string> = {}): Promise<number> {
  const supabase = await createClient();
  const params: ListTasksForExportParams = { filters };
  const ids = await resolveTaskScopeIds(supabase, params);
  const term = (filters.search ?? "").trim();

  if (term) {
    const { data: candidates, error } = await taskScope(supabase, TASK_NARROW_SELECT, params, ids, false);
    if (error) throw error;
    const matcher = await resolveTaskSearchMatcher(supabase, term);
    return ((candidates ?? []) as unknown as TaskNarrowRow[]).filter(matcher).length;
  }

  const { count, error } = await taskScope(supabase, "id", params, ids, { headOnly: true });
  if (error) throw error;
  return count ?? 0;
}

/** Hard ceiling on the DPSP Flywheel board's single fetch — a safety valve, not a target. The
 *  client's live dataset (~800 tasks total, per things-to-know.md) sits well under this, so
 *  unlike listTasksForExport there's no need for a chunked-page loop; see listTasksForFlywheel. */
const MAX_FLYWHEEL_ROWS = 1000;

// The DPSP Flywheel board's one query: every dpsp_category'd task matching the toolbar's
// filters (season/owner/search/hide_done — the same `filters` vocabulary listTasks() takes),
// fetched once and grouped into its four columns in the browser rather than as four separate
// paginated calls — same "bounded fetch, narrow client-side" shape as listTasksByDueDateRange,
// chosen because a shared search term and the four column counts all have to agree with the
// same result set. `scopeToProfileId`/pagination don't apply here — the board
// shows the organisation's whole flywheel, not one page of it.
export async function listTasksForFlywheel(filters: Record<string, string> = {}): Promise<Task[]> {
  const supabase = await createClient();
  const params: ListTasksParams = { filters };
  const ids = await resolveTaskScopeIds(supabase, params);
  const term = (filters.search ?? "").trim();

  if (!term) {
    const { data, error } = await taskScope(supabase, TASK_SELECT, params, ids, false)
      .not("dpsp_category", "is", null)
      .range(0, MAX_FLYWHEEL_ROWS - 1);
    if (error) throw error;
    return (data ?? []) as unknown as Task[];
  }

  const { data: candidates, error: candidateError } = await taskScope(supabase, TASK_NARROW_SELECT, params, ids, false).not(
    "dpsp_category",
    "is",
    null
  );
  if (candidateError) throw candidateError;

  const matcher = await resolveTaskSearchMatcher(supabase, term);
  const matchedIds = ((candidates ?? []) as unknown as TaskNarrowRow[])
    .filter(matcher)
    .slice(0, MAX_FLYWHEEL_ROWS)
    .map((row) => row.id);
  if (matchedIds.length === 0) return [];

  const { data, error } = await taskScope(supabase, TASK_SELECT, params, ids, false).in("id", matchedIds);
  if (error) throw error;
  return (data ?? []) as unknown as Task[];
}

// The My Tasks page's one query — a thin preset over listTasks(), same shape as
// listUpcomingTasks: still fully paginated/sorted/filterable
// (search, season/brand/status/priority/due-range all layer on top via `params.filters`), just
// with one fixed constraint the caller can't relax: scoped to this person's own tasks (see
// scopeToProfileId). Deliberately no due_date floor — created/owned/involved tasks show up
// whether their due date is in the future, in the past, or unset; the "Due" toolbar filter lets
// a user narrow that themselves.
export function listTasksForProfile(profileId: string, params: ListTasksParams = {}) {
  return listTasks({ ...params, scopeToProfileId: profileId });
}

// One task by id, for a `?task=` deep link. RLS decides visibility, same as every list here —
// null covers "no such task", "soft-deleted" and "not yours to see" alike.
export async function getTaskById(taskId: string): Promise<Task | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data as Task | null;
}

// Full rows for ids another query already chose and ordered (the Notifications page's reminder
// schedule pages through reminder_rule_tasks, then reads the rows here so it can render the
// Tasks grid's own columns). Returned in the order the ids were given.
export async function listTasksByIds(ids: string[]): Promise<Task[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select(TASK_SELECT).in("id", ids).is("deleted_at", null);
  if (error) throw error;
  const byId = new Map((data ?? []).map((task) => [task.id, task as Task]));
  return ids.map((id) => byId.get(id)).filter((task): task is Task => !!task);
}

export interface ListTasksByDueDateRangeParams {
  /** Inclusive, `yyyy-MM-dd`. */
  from: string;
  /** Inclusive, `yyyy-MM-dd`. */
  to: string;
  filters?: Record<string, string>;
}

// PostgREST answers at most this many rows per request, silently dropping the rest.
const RANGE_FETCH_PAGE_SIZE = 1000;

// Powers the Calendar view and Google Calendar Sync. Every task on the platform the caller can
// see (RLS narrows external users to their own), not just their My Tasks: client request, so
// the page shows what Sync sends. Skips listTasks()'s page/pageSize/count shape and returns
// every matching row at once. The view asks for a month, but Sync asks for a five-year window
// that can pass PostgREST's per-request cap, so rows are fetched in pages until one comes back
// short.
export async function listTasksByDueDateRange({ from, to, filters = {} }: ListTasksByDueDateRangeParams) {
  const supabase = await createClient();

  // Owner / People Involved toolbar filters, same matching as the Tasks grid's taskScope().
  const participantIds = await participantTaskIds(supabase, filters);

  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .is("deleted_at", null)
    .gte("due_date", from)
    .lte("due_date", to);

  // Multi-select, same encoding (and same applyMultiEq/decodeMultiFilterValue helpers) as the
  // Tasks grid's own toolbar filters — see taskScope() above, which this deliberately mirrors.
  query = applyMultiEq(query, "season_id", decodeMultiFilterValue(filters.season_id));
  query = applyMultiEq(query, "brand_id", decodeMultiFilterValue(filters.brand_id));
  query = applyMultiEq(query, "status", decodeMultiFilterValue(filters.status).filter((value) => isTaskStatus(value)));
  query = applyMultiEq(query, "gender", decodeMultiFilterValue(filters.gender).filter((value) => isTaskGender(value)));
  if (participantIds) {
    query = participantIds.length > 0 ? query.in("id", participantIds) : query.eq("id", EMPTY_RESULT_ID);
  }

  // id as a tiebreaker, so a page boundary can't split rows that share a due date unstably.
  query = query.order("due_date", { ascending: true }).order("id", { ascending: true });

  const tasks: Task[] = [];
  for (let start = 0; ; start += RANGE_FETCH_PAGE_SIZE) {
    const { data, error } = await query.range(start, start + RANGE_FETCH_PAGE_SIZE - 1);
    if (error) throw error;
    tasks.push(...((data ?? []) as Task[]));
    if (!data || data.length < RANGE_FETCH_PAGE_SIZE) return tasks;
  }
}

export interface ListTasksForTimelineParams {
  /** Inclusive, `yyyy-MM-dd`. */
  from: string;
  /** Inclusive, `yyyy-MM-dd`. */
  to: string;
  filters?: Record<string, string>;
  /** 1-based. Omit `pageSize` to get the whole window — what the Dashboard preview does. */
  page?: number;
  pageSize?: number;
}

// A task's bar spans [start_date, end_date], both nullable, with due_date (also nullable since
// 0022) as the fallback for whichever end is missing — an unscheduled-but-dated task is a
// single-day milestone on its due date rather than being absent from the chart entirely. A task
// with none of the three dates set has nothing to plot and simply matches no clause below.
// `timelineBarRange()` applies the same coalescing client-side; these three clauses are its SQL
// mirror, and the two must stay in step.
function timelineOverlapFilter(from: string, to: string) {
  return [
    // Fully scheduled: [start, end] intersects the window.
    `and(start_date.not.is.null,end_date.not.is.null,start_date.lte.${to},end_date.gte.${from})`,
    // Start but no end: due_date closes the bar.
    `and(start_date.not.is.null,end_date.is.null,start_date.lte.${to},due_date.gte.${from})`,
    // No start: a milestone sitting on due_date.
    `and(start_date.is.null,due_date.gte.${from},due_date.lte.${to})`,
  ].join(",");
}

// Window + dropdown filters + ordering, shared by both passes below so the narrow pass that
// decides WHICH tasks match and the wide pass that fetches them can never disagree.
async function timelineScope(supabase: SupabaseClient, select: string, { from, to, filters = {} }: ListTasksForTimelineParams) {
  let query = supabase.from("tasks").select(select).is("deleted_at", null);

  query = applyMultiEq(query, "season_id", decodeMultiFilterValue(filters.season_id));
  query = applyMultiEq(query, "brand_id", decodeMultiFilterValue(filters.brand_id));
  query = applyMultiEq(query, "key_stage_id", decodeMultiFilterValue(filters.key_stage_id));
  if (isTaskStatus(filters.status)) query = query.eq("status", filters.status);
  query = applyCriticalFilter(query, filters.is_critical);

  const participantIds = await participantTaskIds(supabase, filters);
  if (participantIds) {
    query = participantIds.length > 0 ? query.in("id", participantIds) : query.eq("id", EMPTY_RESULT_ID);
  }

  query = query.or(timelineOverlapFilter(from, to));
  // Earliest bar first, so rows read top-left to bottom-right like a schedule. `id` is the
  // tiebreaker and is NOT decorative: plenty of tasks share a start and due date, and without a
  // total order Postgres may return tied rows in a different sequence per query — which, across
  // the two passes below, would let a row land on two pages or on none.
  return query
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("due_date", { ascending: true })
    .order("id", { ascending: true });
}

// Powers the Timeline/Gantt view. Bounded by the visible window like listTasksByDueDateRange,
// and returns the full TASK_SELECT shape so a clicked bar can open the shared task detail
// drawer without a second fetch.
//
// Searching and paging are BOTH resolved here, server-side, over the whole window — the browser
// only ever receives the page it draws. It runs as two passes rather than one query because the
// participant leg is a task-id set that can be hundreds of uuids long: matching happens against
// a narrow id/name projection, and only the page's ~25 ids are then fetched in full. Inlining
// that set into the main query's filter instead would build a URL long enough to be rejected.
export async function listTasksForTimeline(params: ListTasksForTimelineParams) {
  const supabase = await createClient();
  const { filters = {}, page = 1 } = params;
  const pageSize = params.pageSize === undefined ? undefined : clampTaskPageSize(params.pageSize);
  const term = (filters.search ?? "").trim();

  // No search and no pagination: one query, the whole window. The Dashboard preview's path.
  if (!term && pageSize === undefined) {
    const { data, error } = await timelineScope(supabase, TASK_SELECT, params);
    if (error) throw error;
    return { data: (data ?? []) as unknown as Task[], rowCount: data?.length ?? 0 };
  }

  const { data: candidates, error: candidateError } = await timelineScope(supabase, TASK_SEARCH_SELECT, params);
  if (candidateError) throw candidateError;

  const rows = (candidates ?? []) as unknown as TaskSearchRow[];
  const matched = term ? rows.filter(await resolveTaskSearchMatcher(supabase, term)) : rows;

  const start = pageSize === undefined ? 0 : (page - 1) * pageSize;
  const pageIds = (pageSize === undefined ? matched : matched.slice(start, start + pageSize)).map((row) => row.id);
  if (pageIds.length === 0) return { data: [] as Task[], rowCount: matched.length };

  // Re-ordered by the same three columns as the narrow pass, so the page reads in the sequence
  // it was sliced in.
  const data = await fetchRowsByIdChunks<Task>(pageIds, (chunk) =>
    supabase
      .from("tasks")
      .select(TASK_SELECT)
      .in("id", chunk)
      .order("start_date", { ascending: true, nullsFirst: false })
      .order("due_date", { ascending: true })
      .order("id", { ascending: true })
  );

  return { data, rowCount: matched.length };
}

export interface ListDeletedTasksParams {
  page?: number;
  pageSize?: number;
  /** Task-name search plus the same season/brand/key_stage equality filters as the grid —
   *  deliberately NOT the grid's full filter vocabulary (status/gender/priority/owner/search
   *  across relations): a trash is small and browsed rarely, so it doesn't need the two-pass
   *  search machinery listTasks() carries for a 794-row active grid. */
  filters?: Record<string, string>;
}

// A type witness, never called — same reasoning as taskSelectQuery above: Task/DeletedTask
// have to come from a `.select(...)` call where the string's LITERAL type survives.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function deletedTaskSelectQuery(supabase: SupabaseClient) {
  return supabase
    .from("tasks")
    .select(`${TASK_SELECT}, deleted_by_profile:profiles!tasks_deleted_by_fkey(id, full_name, email, avatar_url)`);
}

export type DeletedTask = NonNullable<Awaited<ReturnType<typeof deletedTaskSelectQuery>>["data"]>[number];

// The Trash view (/tasks/trash) — the one place in this file querying `deleted_at is not
// null` instead of `is null`. Deliberately its own small query rather than a taskScope()
// branch: routing the grid's shared scope function through an "include deleted" flag would
// put a parameter whose only real value is "false" on every one of its other nine call sites,
// for the sake of one low-traffic screen. Ordered by deleted_at (most recently removed first)
// rather than due_date — "what did I just delete" is the question this page answers.
export async function listDeletedTasks({ page = 1, pageSize = 15, filters = {} }: ListDeletedTasksParams = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(`${TASK_SELECT}, deleted_by_profile:profiles!tasks_deleted_by_fkey(id, full_name, email, avatar_url)`, {
      count: "exact",
    })
    .not("deleted_at", "is", null);

  if (filters.task_name) query = query.ilike("task_name", `%${filters.task_name}%`);
  if (filters.season_id) query = query.eq("season_id", filters.season_id);
  if (filters.brand_id) query = query.eq("brand_id", filters.brand_id);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order("deleted_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error) throw error;

  return { data: (data ?? []) as unknown as DeletedTask[], rowCount: count ?? 0 };
}

// The Timeline's Overdue panel. Deliberately NOT bounded by the visible window — overdue work
// from an earlier month is exactly what shouldn't scroll out of sight — but it does respect
// every one of the page's filters so the panel agrees with the chart beside it.
export async function listOverdueTasks({ filters = {}, limit = 50 }: { filters?: Record<string, string>; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase.from("tasks").select(TASK_SELECT).is("deleted_at", null).eq("status", "overdue");

  query = applyMultiEq(query, "season_id", decodeMultiFilterValue(filters.season_id));
  query = applyMultiEq(query, "brand_id", decodeMultiFilterValue(filters.brand_id));
  query = applyMultiEq(query, "key_stage_id", decodeMultiFilterValue(filters.key_stage_id));
  query = applyCriticalFilter(query, filters.is_critical);

  const participantIds = await participantTaskIds(supabase, filters);
  if (participantIds) {
    query = participantIds.length > 0 ? query.in("id", participantIds) : query.eq("id", EMPTY_RESULT_ID);
  }

  const { data, error } = await query.order("due_date", { ascending: true, nullsFirst: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as Task[];
}

// PostgREST's per-request row ceiling — a bigger season set is fetched in pages of this size.
const TASK_IDENTITY_PAGE_SIZE = 1000;

// Name + season + brand of every live task in the given seasons: what a task import checks a row
// against to skip one that already exists. Narrow columns only, paged, because a season's whole
// critical path can run to hundreds of rows and an import can span several seasons.
export async function listTaskIdentities(seasonIds: string[]) {
  if (seasonIds.length === 0) return [];
  const supabase = await createClient();
  const rows: { task_name: string; season_id: string; brand_id: string | null }[] = [];

  for (let from = 0; ; from += TASK_IDENTITY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("tasks")
      .select("task_name, season_id, brand_id")
      .is("deleted_at", null)
      .in("season_id", seasonIds)
      .order("id", { ascending: true })
      .range(from, from + TASK_IDENTITY_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < TASK_IDENTITY_PAGE_SIZE) return rows;
  }
}
