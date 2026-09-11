import "server-only";
import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import {
  EMPTY_RESULT_ID,
  participantTaskIds,
  taskIdsForProfile,
  taskIdsMatchingPartyName,
  type SupabaseClient,
} from "@/data/task-participants";
import { listKeyStageIdsMatching } from "@/data/key-stages";
import { taskGenderValues, taskStatusValues, taskPriorityValues, type TaskInput } from "@/app/(app)/tasks/schema";

export interface ListTasksParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
  /** Scopes results to tasks this profile participates in — as an owner or as People
   *  Involved, named directly or via their department (see the task_participant_profiles
   *  view). The Upcoming Tasks page's "relevant to me" scope. Deliberately narrower than
   *  listTasksByDueDateRange's `involvesProfileId`, which also matches created_by (the
   *  calendar's broader "involves" concept). A dedicated param rather than a `filters` key
   *  since it resolves through a join table, not a plain equality match. */
  ownerOrInvolvedProfileId?: string;
  /** Hard floor of `due_date >= today` — not exposed via `filters` since callers shouldn't
   *  be able to relax it; it's the Upcoming Tasks page's core "upcoming" definition. */
  onlyUpcoming?: boolean;
}

const SORTABLE_COLUMNS = new Set(["task_name", "due_date", "status", "priority", "created_at"]);

// Shared by every task query below — the grid, and the calendar's bounded range query —
// so a relation gets added once, not once per query.
const TASK_SELECT = `*, season:seasons(id, season_code, season_name, color), brand:brands(id, brand_name, color), key_stage:key_stages(id, name), assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url), created_by_profile:profiles!tasks_created_by_fkey(id, full_name, email, avatar_url), last_edited_by_profile:profiles!tasks_last_edited_by_fkey(id, full_name, email, avatar_url), participants:task_participants(role, profile:profiles(id, full_name, email, avatar_url, department:departments(name)), department:departments(id, name, description, is_external))`;

function isTaskGender(value: string | undefined): value is TaskInput["gender"] {
  return !!value && (taskGenderValues as readonly string[]).includes(value);
}

function isTaskStatus(value: string | undefined): value is TaskInput["status"] {
  return !!value && (taskStatusValues as readonly string[]).includes(value);
}

function isTaskPriority(value: string | undefined): value is TaskInput["priority"] {
  return !!value && (taskPriorityValues as readonly string[]).includes(value);
}

// The ONE query function behind the task grid, and every future view-specific list (Gantt
// range, calendar range, dashboard aggregates, CSV export) — those extend this, not fork it.
export async function listTasks({
  page = 1,
  pageSize = 15,
  sortBy,
  sortDir,
  filters = {},
  ownerOrInvolvedProfileId,
  onlyUpcoming,
}: ListTasksParams = {}) {
  const supabase = await createClient();
  let query = supabase.from("tasks").select(TASK_SELECT, { count: "exact" }).is("deleted_at", null);

  if (filters.task_name) query = query.ilike("task_name", `%${filters.task_name}%`);
  if (filters.season_id) query = query.eq("season_id", filters.season_id);
  if (filters.brand_id) query = query.eq("brand_id", filters.brand_id);
  if (filters.key_stage_id) query = query.eq("key_stage_id", filters.key_stage_id);
  if (isTaskGender(filters.gender)) query = query.eq("gender", filters.gender);
  if (isTaskStatus(filters.status)) query = query.eq("status", filters.status);
  if (isTaskPriority(filters.priority)) query = query.eq("priority", filters.priority);
  // "Owner" / "People Involved" toolbar filters — see participantTaskIds. An unmatched party
  // must yield zero rows, not every row, hence the impossible-id fallback rather than skipping
  // the clause.
  const participantIds = await participantTaskIds(supabase, filters);
  if (participantIds) {
    query = participantIds.length > 0 ? query.in("id", participantIds) : query.eq("id", EMPTY_RESULT_ID);
  }
  // "Due" toolbar filter (Upcoming Tasks) — a day-count preset ("7"/"30"/"90"), not a literal
  // date; caps due_date at today + N days. Composes with onlyUpcoming's >= today floor below
  // to express "due within the next N days" as a whole.
  if (filters.due_date) {
    const days = Number(filters.due_date);
    if (Number.isInteger(days) && days > 0) {
      query = query.lte("due_date", format(addDays(new Date(), days), "yyyy-MM-dd"));
    }
  }

  if (onlyUpcoming) query = query.gte("due_date", format(new Date(), "yyyy-MM-dd"));

  if (ownerOrInvolvedProfileId) {
    // Reads the task_participant_profiles view (0015_task_participants.sql), which flattens
    // department membership down to individual profiles — so a task owned by Planning counts
    // as "mine" when I'm in Planning, not only when I'm named on it directly. Still resolved
    // as its own lookup first because PostgREST can't express the subquery inline.
    const taskIds = await taskIdsForProfile(supabase, ownerOrInvolvedProfileId);
    query = taskIds.length > 0 ? query.in("id", taskIds) : query.eq("id", EMPTY_RESULT_ID);
  }

  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "due_date";
  query = query.order(orderColumn, { ascending: sortDir !== "desc" });

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  return { data: data ?? [], rowCount: count ?? 0 };
}

export type Task = Awaited<ReturnType<typeof listTasks>>["data"][number];

// The Upcoming Tasks page's one query — a thin preset over listTasks(), same shape as
// listUpcomingSeasons/listUpcomingBrands elsewhere: still fully paginated/sorted/filterable
// (search, season/brand/status/priority/due-range all layer on top via `params.filters`),
// just with two fixed constraints the caller can't relax: scoped to this profile's own
// tasks (owner or People Involved), and due_date >= today.
export function listUpcomingTasksForProfile(profileId: string, params: ListTasksParams = {}) {
  return listTasks({ ...params, ownerOrInvolvedProfileId: profileId, onlyUpcoming: true });
}

export interface ListTasksByDueDateRangeParams {
  /** Inclusive, `yyyy-MM-dd`. */
  from: string;
  /** Inclusive, `yyyy-MM-dd`. */
  to: string;
  filters?: Record<string, string>;
  /** Scopes results to tasks the profile is assignee/creator/people-involved on. */
  involvesProfileId?: string;
}

// Powers the Calendar view — bounded by the visible date range (a week or a month at most),
// so it deliberately skips listTasks()'s page/pageSize/count shape and returns every matching
// row for that range at once, the same way listUpcomingSeasons is a separate bounded query
// rather than a page of the main list.
export async function listTasksByDueDateRange({
  from,
  to,
  filters = {},
  involvesProfileId,
}: ListTasksByDueDateRangeParams) {
  const supabase = await createClient();

  // Participation is resolved as its own lookup first (PostgREST can't express the subquery
  // inline) via the task_participant_profiles view, so a task owned by this person's
  // department counts as involving them. Unlike listTasks' scope, the calendar's broader
  // "involves" concept also includes tasks they merely created — that leg stays an .or().
  let involvedTaskIds: string[] = [];
  if (involvesProfileId) {
    involvedTaskIds = await taskIdsForProfile(supabase, involvesProfileId);
  }

  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .is("deleted_at", null)
    .gte("due_date", from)
    .lte("due_date", to);

  if (filters.season_id) query = query.eq("season_id", filters.season_id);
  if (filters.brand_id) query = query.eq("brand_id", filters.brand_id);
  if (isTaskStatus(filters.status)) query = query.eq("status", filters.status);

  if (involvesProfileId) {
    const orConditions = [`created_by.eq.${involvesProfileId}`];
    if (involvedTaskIds.length > 0) orConditions.push(`id.in.(${involvedTaskIds.join(",")})`);
    query = query.or(orConditions.join(","));
  }

  query = query.order("due_date", { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Task[];
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

// A task's bar spans [start_date, end_date], but both are nullable while due_date is not (see
// supabase/schema.md). So the Timeline treats due_date as the fallback for whichever end is
// missing — an unscheduled task is a single-day milestone on its due date rather than being
// absent from the chart entirely. `timelineBarRange()` applies the same coalescing client-side;
// these three clauses are its SQL mirror, and the two must stay in step.
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

  if (filters.season_id) query = query.eq("season_id", filters.season_id);
  if (filters.brand_id) query = query.eq("brand_id", filters.brand_id);
  if (filters.key_stage_id) query = query.eq("key_stage_id", filters.key_stage_id);
  if (isTaskStatus(filters.status)) query = query.eq("status", filters.status);

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

// The Timeline's search box. Task name and key stage are matched here; owners and people
// involved arrive as a task-id set, since their names live two tables away (see
// taskIdsMatchingPartyName). `ilike '%term%'` is a case-insensitive substring match, which is
// exactly what `includes` on a lowercased string does — the two legs stay consistent.
async function matchesSearchTerm(supabase: SupabaseClient, term: string) {
  const [keyStageIds, participantTaskIdSet] = await Promise.all([
    listKeyStageIdsMatching(term),
    taskIdsMatchingPartyName(supabase, term),
  ]);
  const needle = term.toLowerCase();

  return (row: { id: string; task_name: string; key_stage_id: string | null }) =>
    row.task_name.toLowerCase().includes(needle) ||
    (!!row.key_stage_id && keyStageIds.has(row.key_stage_id)) ||
    participantTaskIdSet.has(row.id);
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
  const { filters = {}, page = 1, pageSize } = params;
  const term = (filters.search ?? "").trim();

  // No search and no pagination: one query, the whole window. The Dashboard preview's path.
  if (!term && pageSize === undefined) {
    const { data, error } = await timelineScope(supabase, TASK_SELECT, params);
    if (error) throw error;
    return { data: (data ?? []) as unknown as Task[], rowCount: data?.length ?? 0 };
  }

  const { data: candidates, error: candidateError } = await timelineScope(
    supabase,
    "id, task_name, key_stage_id",
    params
  );
  if (candidateError) throw candidateError;

  const rows = (candidates ?? []) as unknown as { id: string; task_name: string; key_stage_id: string | null }[];
  const matched = term ? rows.filter(await matchesSearchTerm(supabase, term)) : rows;

  const start = pageSize === undefined ? 0 : (page - 1) * pageSize;
  const pageIds = (pageSize === undefined ? matched : matched.slice(start, start + pageSize)).map((row) => row.id);
  if (pageIds.length === 0) return { data: [] as Task[], rowCount: matched.length };

  // Re-ordered by the same three columns as the narrow pass, so the page reads in the sequence
  // it was sliced in.
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .in("id", pageIds)
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("due_date", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;

  return { data: (data ?? []) as Task[], rowCount: matched.length };
}

// The Timeline's Overdue panel. Deliberately NOT bounded by the visible window — overdue work
// from an earlier month is exactly what shouldn't scroll out of sight — but it does respect
// every one of the page's filters so the panel agrees with the chart beside it.
export async function listOverdueTasks({ filters = {}, limit = 50 }: { filters?: Record<string, string>; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase.from("tasks").select(TASK_SELECT).is("deleted_at", null).eq("status", "overdue");

  if (filters.season_id) query = query.eq("season_id", filters.season_id);
  if (filters.brand_id) query = query.eq("brand_id", filters.brand_id);
  if (filters.key_stage_id) query = query.eq("key_stage_id", filters.key_stage_id);

  const participantIds = await participantTaskIds(supabase, filters);
  if (participantIds) {
    query = participantIds.length > 0 ? query.in("id", participantIds) : query.eq("id", EMPTY_RESULT_ID);
  }

  const { data, error } = await query.order("due_date", { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []) as Task[];
}
