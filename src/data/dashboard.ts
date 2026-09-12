import "server-only";
import { eachMonthOfInterval, format, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { taskGenderValues, taskStatusValues, type TaskInput } from "@/app/(app)/tasks/schema";

type TaskStatus = TaskInput["status"];
type TaskGender = TaskInput["gender"];

export type TaskStatusCounts = Record<TaskStatus, number>;

export interface TaskBreakdownGroup {
  id: string;
  label: string;
  /** The entity's own stored colour, or null when the dimension has none (gender). */
  color: string | null;
  total: number;
  completed: number;
  statusCounts: TaskStatusCounts;
}

export interface CompletionBucket {
  key: string;
  /** Axis tick — short enough to sit under a bar without collision. */
  label: string;
  /** Tooltip / "best performing period" text. */
  fullLabel: string;
  total: number;
  completed: number;
  overdue: number;
}

export interface DashboardMetrics {
  total: number;
  statusCounts: TaskStatusCounts;
  bySeason: TaskBreakdownGroup[];
  byBrand: TaskBreakdownGroup[];
  byGender: TaskBreakdownGroup[];
  /** Consecutive months spanning the task data, oldest first — see monthlyBuckets(). */
  monthly: CompletionBucket[];
  /** The most recent weeks that have tasks due, oldest first — see weeklyBuckets(). */
  weekly: CompletionBucket[];
}

// Every dashboard number is a count over the WHOLE task table, so this reads a handful of
// narrow columns rather than reusing listTasks() — that returns one page of fully-embedded
// rows, which is the wrong shape (and the wrong volume) for aggregates.
const TASK_FACT_SELECT =
  "status, gender, due_date, season:seasons(id, season_name, color), brand:brands(id, brand_name, color)";

// PostgREST caps a single response at 1000 rows, so aggregates have to page through rather
// than assume one request sees everything. The cap is a runaway guard, not a real limit:
// at 20 pages the dashboard is aggregating 20k tasks and belongs in a SQL view instead.
const FACT_PAGE_SIZE = 1000;
const MAX_FACT_PAGES = 20;

// Runaway guards on the Task Completion axis, not target sizes — see periodWindow() for how
// the window is actually chosen. Past these the axis stops being readable at card width.
const MAX_MONTH_BUCKETS = 18;
const MAX_WEEK_BUCKETS = 16;
// Monday-start weeks, matching how the rest of the app reads a working week.
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

interface TaskFact {
  status: TaskStatus;
  gender: TaskGender;
  due_date: string | null;
  season: { id: string; season_name: string; color: string | null } | null;
  brand: { id: string; brand_name: string; color: string | null } | null;
}

/** A fact with a known due_date — the monthly/weekly trend is bucketed by it, so a task with no
 *  due date has no period to fall into and is excluded from those two charts only. It still
 *  counts everywhere else (status/season/brand/gender tiles), which read off the unfiltered
 *  `facts` array. */
type DatedTaskFact = TaskFact & { due_date: string };

function hasDueDate(fact: TaskFact): fact is DatedTaskFact {
  return fact.due_date !== null;
}

function emptyStatusCounts(): TaskStatusCounts {
  return Object.fromEntries(taskStatusValues.map((status) => [status, 0])) as TaskStatusCounts;
}

async function listTaskFacts(): Promise<TaskFact[]> {
  const supabase = await createClient();
  const rows: TaskFact[] = [];

  for (let page = 0; page < MAX_FACT_PAGES; page++) {
    const from = page * FACT_PAGE_SIZE;
    const { data, error } = await supabase
      .from("tasks")
      .select(TASK_FACT_SELECT)
      .is("deleted_at", null)
      // A stable order across pages — without it PostgREST is free to return overlapping
      // or missing rows between ranges, which would silently skew every count below.
      .order("id", { ascending: true })
      .range(from, from + FACT_PAGE_SIZE - 1);
    if (error) throw error;

    rows.push(...((data ?? []) as TaskFact[]));
    if (!data || data.length < FACT_PAGE_SIZE) break;
  }

  return rows;
}

function emptyGroup(id: string, label: string, color: string | null): TaskBreakdownGroup {
  return { id, label, color, total: 0, completed: 0, statusCounts: emptyStatusCounts() };
}

function countInto(group: TaskBreakdownGroup, status: TaskStatus) {
  group.total++;
  group.statusCounts[status]++;
  if (status === "completed") group.completed++;
}

// Returns the FULL group list, largest first. Trimming to a readable number of slices/bars is
// a presentation decision (see metrics-projection.ts) — the per-card filter dropdowns need
// every group, including the ones a chart folds away.
function groupTaskFacts(
  facts: TaskFact[],
  resolve: (fact: TaskFact) => { id: string; label: string; color: string | null } | null
): TaskBreakdownGroup[] {
  const groups = new Map<string, TaskBreakdownGroup>();

  for (const fact of facts) {
    const entity = resolve(fact);
    if (!entity) continue;

    const group = groups.get(entity.id) ?? emptyGroup(entity.id, entity.label, entity.color);
    countInto(group, fact.status);
    groups.set(entity.id, group);
  }

  return [...groups.values()].sort((a, b) => b.total - a.total);
}

interface BucketDefinition {
  key: string;
  label: string;
  fullLabel: string;
}

// There is no `completed_at` column on tasks (see supabase/schema.md), so a task is counted in
// the period its DUE DATE falls in. "Completion in May" therefore means "of the work due in
// May, this much is done" — which is the question the Task Completion card actually asks.
function bucketFacts(facts: DatedTaskFact[], definitions: BucketDefinition[], keyOf: (date: Date) => string) {
  const buckets = new Map<string, CompletionBucket>(
    definitions.map((definition) => [definition.key, { ...definition, total: 0, completed: 0, overdue: 0 }])
  );

  for (const fact of facts) {
    const bucket = buckets.get(keyOf(new Date(fact.due_date)));
    if (!bucket) continue;
    bucket.total++;
    if (fact.status === "completed") bucket.completed++;
    if (fact.status === "overdue") bucket.overdue++;
  }

  return [...buckets.values()];
}

// Calendar-consecutive months, so a run of quiet months stays visible as a run of quiet
// months. The window ends at the later of "the newest month holding a task" and "this month"
// (so a live board always shows the current period) and reaches back to the oldest month
// holding a task, capped at MAX_MONTH_BUCKETS. A fixed window — year-to-date, or a trailing
// 12 — silently drops whole cohorts whenever the work predates it, taking this card's
// completed/overdue tiles to zero while the all-time tiles at the top of the page read
// non-zero.
function monthlyBuckets(allFacts: TaskFact[], today: Date) {
  const facts = allFacts.filter(hasDueDate);
  const months = facts.map((fact) => startOfMonth(new Date(fact.due_date)));
  const end = months.reduce((latest, month) => (month > latest ? month : latest), startOfMonth(today));
  const floor = subMonths(end, MAX_MONTH_BUCKETS - 1);
  const oldest = months.reduce((earliest, month) => (month < earliest ? month : earliest), end);

  const definitions = eachMonthOfInterval({ start: oldest < floor ? floor : oldest, end }).map((month) => ({
    key: format(month, "yyyy-MM"),
    // Two-digit year on the tick — the window can span a year boundary, so a bare "Aug" would
    // otherwise appear twice on the same axis.
    label: format(month, "MMM yy"),
    fullLabel: format(month, "MMMM yyyy"),
  }));
  return bucketFacts(facts, definitions, (date) => format(startOfMonth(date), "yyyy-MM"));
}

// Weeks that actually have work due — the most recent MAX_WEEK_BUCKETS of them — rather than
// a calendar-consecutive run like monthlyBuckets uses.
//
// A trailing window can't work at this granularity: a readable week axis is ~16 bars, but a
// year of history is 50+ weeks, so any dataset whose work predates the last few months renders
// as a flat row of zeros no matter where the window is placed. Skipping empty weeks is also
// the more truthful reading — a week with nothing due isn't 0% completion, it's no measurement
// at all, which is exactly how the card's average-rate tile already treats it.
function weeklyBuckets(allFacts: TaskFact[], today: Date) {
  const facts = allFacts.filter(hasDueDate);
  const toWeek = (date: Date) => startOfWeek(date, WEEK_OPTIONS);

  const weeksWithWork = new Map<string, Date>();
  for (const fact of facts) {
    const week = toWeek(new Date(fact.due_date));
    weeksWithWork.set(format(week, "yyyy-MM-dd"), week);
  }

  const weeks = [...weeksWithWork.values()]
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(-MAX_WEEK_BUCKETS);
  // No tasks at all — one bucket for the current week keeps the card's empty state on the
  // "nothing due" branch rather than rendering a chart with no axis.
  if (weeks.length === 0) weeks.push(toWeek(today));

  const definitions = weeks.map((week) => ({
    key: format(week, "yyyy-MM-dd"),
    label: format(week, "d MMM yy"),
    fullLabel: `Week of ${format(week, "d MMM yyyy")}`,
  }));
  return bucketFacts(facts, definitions, (date) => format(toWeek(date), "yyyy-MM-dd"));
}

// The one query behind every chart and tile on the Dashboard — each card is a projection of
// this single pass, so the numbers can't disagree with each other and the page costs one
// round trip rather than one per card.
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const facts = await listTaskFacts();
  const today = new Date();

  const statusCounts = emptyStatusCounts();
  const genderGroups = new Map<TaskGender, TaskBreakdownGroup>(
    taskGenderValues.map((gender) => [gender, emptyGroup(gender, gender, null)])
  );

  for (const fact of facts) {
    statusCounts[fact.status]++;
    const genderGroup = genderGroups.get(fact.gender);
    if (genderGroup) countInto(genderGroup, fact.status);
  }

  return {
    total: facts.length,
    statusCounts,
    bySeason: groupTaskFacts(facts, (fact) =>
      fact.season ? { id: fact.season.id, label: fact.season.season_name, color: fact.season.color } : null
    ),
    byBrand: groupTaskFacts(facts, (fact) =>
      fact.brand ? { id: fact.brand.id, label: fact.brand.brand_name, color: fact.brand.color } : null
    ),
    byGender: [...genderGroups.values()],
    monthly: monthlyBuckets(facts, today),
    weekly: weeklyBuckets(facts, today),
  };
}
