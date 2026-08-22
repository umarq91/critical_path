import "server-only";
import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { taskGenderValues, taskStatusValues, taskPriorityValues, type TaskInput } from "@/app/(app)/tasks/schema";

export interface ListTasksParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
  /** Scopes results to tasks this profile owns (assignee_id) OR is a People Involved member
   *  of (task_people) — the Upcoming Tasks page's "relevant to me" scope. Deliberately
   *  narrower than listTasksByDueDateRange's `involvesProfileId` (which also matches
   *  created_by, the calendar's broader "involves" concept). A dedicated param rather than a
   *  `filters` key since it's an OR across two relations, not a plain equality match. */
  ownerOrInvolvedProfileId?: string;
  /** Hard floor of `due_date >= today` — not exposed via `filters` since callers shouldn't
   *  be able to relax it; it's the Upcoming Tasks page's core "upcoming" definition. */
  onlyUpcoming?: boolean;
}

const SORTABLE_COLUMNS = new Set(["task_name", "due_date", "status", "priority", "created_at"]);

// Shared by every task query below — the grid, and the calendar's bounded range query —
// so a relation gets added once, not once per query.
const TASK_SELECT = `*, season:seasons(id, season_code, season_name, color), brand:brands(id, brand_name, color), key_stage:key_stages(id, name), assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url), created_by_profile:profiles!tasks_created_by_fkey(id, full_name, email, avatar_url), last_edited_by_profile:profiles!tasks_last_edited_by_fkey(id, full_name, email, avatar_url), people:task_people(profile:profiles(id, full_name, email, avatar_url, department:departments(name)))`;

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
  if (filters.assignee_id) query = query.eq("assignee_id", filters.assignee_id);
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
    // task_people is a join table — Postgrest can't express "id in (select task_id from
    // task_people where profile_id = x)" inside a single .or() filter, so that half of the
    // condition is resolved as its own lookup first (same technique as
    // listTasksByDueDateRange's involvesProfileId, just without the created_by leg — Upcoming
    // Tasks scopes strictly to "I own it or I'm involved in it", not "I created it").
    const { data: involved, error: involvedError } = await supabase
      .from("task_people")
      .select("task_id")
      .eq("profile_id", ownerOrInvolvedProfileId);
    if (involvedError) throw involvedError;

    const orConditions = [`assignee_id.eq.${ownerOrInvolvedProfileId}`];
    if (involved && involved.length > 0) {
      orConditions.push(`id.in.(${involved.map((row) => row.task_id).join(",")})`);
    }
    query = query.or(orConditions.join(","));
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

  // task_people is a join table — Postgrest can't express "id in (select task_id from
  // task_people where profile_id = x)" inside a single .or() filter, so that half of the
  // "involves this person" condition is resolved as its own lookup first.
  let involvedTaskIds: string[] = [];
  if (involvesProfileId) {
    const { data, error } = await supabase.from("task_people").select("task_id").eq("profile_id", involvesProfileId);
    if (error) throw error;
    involvedTaskIds = (data ?? []).map((row) => row.task_id);
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
    const orConditions = [`assignee_id.eq.${involvesProfileId}`, `created_by.eq.${involvesProfileId}`];
    if (involvedTaskIds.length > 0) orConditions.push(`id.in.(${involvedTaskIds.join(",")})`);
    query = query.or(orConditions.join(","));
  }

  query = query.order("due_date", { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Task[];
}
