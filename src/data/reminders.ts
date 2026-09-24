import "server-only";
import { subDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDateOnly } from "@/lib/dates";

// Single fixed org timezone for "notify at hour N" — the client operates out of one region
// (NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN is threebyone.com.au), so there's no per-user timezone
// to reconcile. Revisit if that ever stops being true; until then this is the one place "9am"
// is resolved, not re-derived per call site.
export const REMINDER_ORG_TIMEZONE = "Australia/Sydney";

export interface ReminderRuleTask {
  id: string;
  task_name: string;
  due_date: string;
  season_name: string | null;
}

export interface ReminderRule {
  id: string;
  offsetDays: number[];
  notifyHour: number;
  isEnabled: boolean;
  tasks: ReminderRuleTask[];
}

// The My Tasks page's reminder cards read this once, server-side. `null` means the
// profile has never saved a rule yet — the UI falls back to sensible defaults (empty offsets,
// 9am, enabled) rather than a row existing purely to hold defaults.
export async function getMyReminderRule(profileId: string): Promise<ReminderRule | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminder_rules")
    .select(
      "id, offset_days, notify_hour, is_enabled, reminder_rule_tasks(task:tasks(id, task_name, due_date, season:seasons(season_name)))"
    )
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    offsetDays: data.offset_days,
    notifyHour: data.notify_hour,
    isEnabled: data.is_enabled,
    tasks: data.reminder_rule_tasks
      .map((link) => link.task)
      .filter((task) => task !== null)
      .map((task) => ({
        id: task.id,
        task_name: task.task_name,
        due_date: task.due_date ?? "",
        season_name: task.season?.season_name ?? null,
      }))
      // due_date is nullable on tasks in general, but every candidate offered by the picker
      // already requires one (see listMyReminderCandidateTasks) — sorted here for a stable,
      // soonest-first chip order regardless of insert order.
      .sort((a, b) => a.due_date.localeCompare(b.due_date)),
  };
}

// hour-of-day and calendar-day in REMINDER_ORG_TIMEZONE, from a real instant (`now`) — Intl
// formatting rather than a date library, since this is the only place the app needs a
// timezone-aware hour/day and doesn't justify adding date-fns-tz for it. Deliberately NOT used
// for the due_date arithmetic below: due_date is a plain calendar date with no attached
// timezone, so "due_date minus N days" is pure calendar-date subtraction (see subtractCalendarDays)
// — reformatting it through a *different* IANA zone here would risk shifting it onto the wrong
// day depending on what timezone the Node process itself happens to run in.
function hourInOrgTimezone(instant: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: REMINDER_ORG_TIMEZONE, hour: "numeric", hour12: false }).format(instant));
}

function isoDateInOrgTimezone(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: REMINDER_ORG_TIMEZONE }).format(instant);
}

// due_date arrives as a bare "yyyy-MM-dd" — parseDateOnly's local-midnight Date preserves its
// calendar fields regardless of the Node process's own timezone, and date-fns' subDays/format
// only ever touch those same local fields, so this never needs (or should take) a timezone.
function subtractCalendarDays(dateOnly: string, days: number): string {
  return format(subDays(parseDateOnly(dateOnly), days), "yyyy-MM-dd");
}

export interface DueReminder {
  ruleId: string;
  taskId: string;
  offsetDays: number;
  profileEmail: string;
  taskName: string;
  dueDate: string;
  seasonName: string | null;
}

/** Hard ceiling per cron run — a safety valve, not a target; see things-to-know.md's Reminders
 *  section for why this stays a simple in-memory scan rather than a SQL-side computation. */
const MAX_DUE_REMINDERS_PER_RUN = 500;

// The cron route's one query: every (rule, task, offset) triple that's due to send right now,
// with anything already in notifications_log excluded. Runs on the service-role client — this
// executes with no signed-in user, so RLS (which scopes reminder_rules to profile_id = auth.uid())
// would otherwise return nothing.
export async function listDueReminders(now: Date = new Date()): Promise<DueReminder[]> {
  const supabase = createAdminClient();
  const currentHour = hourInOrgTimezone(now);
  const today = isoDateInOrgTimezone(now);

  const { data: rules, error } = await supabase
    .from("reminder_rules")
    .select(
      "id, offset_days, notify_hour, profile:profiles(email), reminder_rule_tasks(task:tasks(id, task_name, due_date, status, deleted_at, season:seasons(season_name)))"
    )
    .eq("is_enabled", true)
    .eq("notify_hour", currentHour);
  if (error) throw error;

  const candidates: DueReminder[] = [];
  for (const rule of rules ?? []) {
    if (!rule.profile?.email) continue;
    for (const link of rule.reminder_rule_tasks) {
      const task = link.task;
      // Completed or soft-deleted tasks never get reminded about — a reminder about finished
      // work is noise, not signal (things-to-know.md's Reminders section).
      if (!task || !task.due_date || task.status === "completed" || task.deleted_at) continue;

      for (const offsetDays of rule.offset_days) {
        const targetDate = subtractCalendarDays(task.due_date, offsetDays);
        if (targetDate !== today) continue;
        candidates.push({
          ruleId: rule.id,
          taskId: task.id,
          offsetDays,
          profileEmail: rule.profile.email,
          taskName: task.task_name,
          dueDate: task.due_date,
          seasonName: task.season?.season_name ?? null,
        });
        if (candidates.length >= MAX_DUE_REMINDERS_PER_RUN) return dedupeAgainstLog(supabase, candidates);
      }
    }
  }

  return dedupeAgainstLog(supabase, candidates);
}

// Drops anything notifications_log already has a row for — a rule/task/offset already sent
// must never send twice, whether because a run overlapped the previous one or was retried.
async function dedupeAgainstLog(
  supabase: ReturnType<typeof createAdminClient>,
  candidates: DueReminder[]
): Promise<DueReminder[]> {
  if (candidates.length === 0) return candidates;

  const ruleIds = [...new Set(candidates.map((candidate) => candidate.ruleId))];
  const { data: sent, error } = await supabase.from("notifications_log").select("rule_id, task_id, offset_days").in("rule_id", ruleIds);
  if (error) throw error;

  const sentKeys = new Set((sent ?? []).map((row) => `${row.rule_id}:${row.task_id}:${row.offset_days}`));
  return candidates.filter((candidate) => !sentKeys.has(`${candidate.ruleId}:${candidate.taskId}:${candidate.offsetDays}`));
}

// Logged right after a successful send — `ignoreDuplicates` is the actual dedupe guarantee
// (the in-memory filter above is an optimisation to avoid re-sending within one run; this
// unique-constraint-backed upsert is what makes a second, overlapping run safe too).
export async function recordReminderSent(ruleId: string, taskId: string, offsetDays: number): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("notifications_log")
    .upsert({ rule_id: ruleId, task_id: taskId, offset_days: offsetDays }, { onConflict: "rule_id,task_id,offset_days", ignoreDuplicates: true });
  if (error) throw error;
}

export type ReminderSendStatus = "upcoming" | "passed" | "paused" | "cancelled";

export interface ScheduledReminderSend {
  offsetDays: number;
  /** yyyy-MM-dd, in REMINDER_ORG_TIMEZONE; the send goes out at the rule's notifyHour that day. */
  sendDate: string;
  status: ReminderSendStatus;
}

// A `type`, not an interface: DataTable rows must be assignable to Record<string, unknown>.
export type ScheduledReminderRow = {
  id: string;
  task_name: string;
  due_date: string | null;
  season_name: string | null;
  sends: ScheduledReminderSend[];
};

export interface ListMyScheduledRemindersParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
}

const SCHEDULE_SORTABLE_COLUMNS = new Set(["task_name", "due_date"]);

// "Passed" is judged only by the clock, never by notifications_log, which has no RLS policies
// and is readable only by the service-role cron client — so this can't say a reminder WAS
// sent, only that its time has gone by. The send hour itself still counts as upcoming, since
// the cron runs every 15 minutes through it.
function sendStatus(sendDate: string, notifyHour: number, now: Date, taskCompleted: boolean, ruleEnabled: boolean): ReminderSendStatus {
  const today = isoDateInOrgTimezone(now);
  const passed = sendDate < today || (sendDate === today && hourInOrgTimezone(now) > notifyHour);
  if (passed) return "passed";
  if (taskCompleted) return "cancelled";
  return ruleEnabled ? "upcoming" : "paused";
}

// The Notifications page's schedule table: one row per task on this person's rule, with every
// date a reminder goes out for it. Queried from `tasks` (inner-joined to reminder_rule_tasks)
// rather than from the rule, so search, sort and pagination are real PostgREST clauses.
export async function listMyScheduledReminders(
  profileId: string,
  { page = 1, pageSize = 10, sortBy, sortDir, filters = {} }: ListMyScheduledRemindersParams = {}
) {
  const supabase = await createClient();
  const { data: rule, error: ruleError } = await supabase
    .from("reminder_rules")
    .select("id, offset_days, notify_hour, is_enabled")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (ruleError) throw ruleError;
  if (!rule) return { data: [] as ScheduledReminderRow[], rowCount: 0, notifyHour: null };

  let query = supabase
    .from("tasks")
    .select("id, task_name, due_date, status, season:seasons(season_name), reminder_rule_tasks!inner(rule_id)", {
      count: "exact",
    })
    .eq("reminder_rule_tasks.rule_id", rule.id)
    // A soft-deleted task stays linked to the rule but can never be reminded about.
    .is("deleted_at", null);
  if (filters.task_name) query = query.ilike("task_name", `%${filters.task_name}%`);

  const orderColumn = sortBy && SCHEDULE_SORTABLE_COLUMNS.has(sortBy) ? sortBy : "due_date";
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order(orderColumn, { ascending: sortDir !== "desc", nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error) throw error;

  const now = new Date();
  const offsets = [...rule.offset_days].sort((a, b) => b - a);
  const rows: ScheduledReminderRow[] = (data ?? []).map((task) => {
    const dueDate = task.due_date;
    const sends = dueDate
      ? offsets.map((offsetDays) => {
          const sendDate = subtractCalendarDays(dueDate, offsetDays);
          const status = sendStatus(sendDate, rule.notify_hour, now, task.status === "completed", rule.is_enabled);
          return { offsetDays, sendDate, status };
        })
      : [];
    return { id: task.id, task_name: task.task_name, due_date: dueDate, season_name: task.season?.season_name ?? null, sends };
  });

  return { data: rows, rowCount: count ?? 0, notifyHour: rule.notify_hour };
}
