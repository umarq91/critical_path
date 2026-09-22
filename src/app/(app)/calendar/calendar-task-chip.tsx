import { isBefore, startOfToday } from "date-fns";
import { parseDateOnly } from "@/lib/dates";
import { ColorTag } from "@/components/shared/color-tag";
import { getVizColorForId } from "@/constants/chart-colors";
import { cn } from "@/lib/utils";
import { PartyStack } from "@/app/(app)/tasks/party-stack";
import { taskOwners } from "@/app/(app)/tasks/task-parties";
import type { Task } from "@/data/tasks";

// The chip's background/border now identify the task's season (see seasonColor below), not its
// status — this is the one place status still shows: a solid dot in TASK_STATUS_CONFIG's base
// tone, read against whatever season tint surrounds it.
const STATUS_DOT_CLASS: Record<string, string> = {
  not_started: "bg-status-notstarted-base",
  in_progress: "bg-status-progress-base",
  completed: "bg-status-complete-base",
  overdue: "bg-status-overdue-base",
};

interface CalendarTaskChipProps {
  task: Task;
  onSelect: (task: Task) => void;
  variant?: "compact" | "full";
}

export const CalendarTaskChip = ({ task, onSelect, variant = "compact" }: CalendarTaskChipProps) => {
  const owners = taskOwners(task);
  // The `overdue` status is only stamped by the nightly status-rollover cron — a task whose
  // due_date has already passed can still read "in_progress" until that job catches up. The
  // calendar shows the actual due date, so it derives overdue from the date directly rather
  // than trusting a status value that may be a day stale. A task with no due_date can never be
  // overdue — this component only ever renders tasks fetched by due-date range in practice, but
  // the check is here regardless since "no date" and "date in the past" aren't the same thing.
  const isOverdue =
    task.status !== "completed" && task.due_date !== null && isBefore(parseDateOnly(task.due_date), startOfToday());
  const effectiveStatus = isOverdue ? "overdue" : task.status;
  const dotClass = STATUS_DOT_CLASS[effectiveStatus] ?? "bg-muted-foreground";
  // The chip's own colour identifies which season a task belongs to at a glance — status is
  // conveyed by the dot alone (see STATUS_DOT_CLASS above), not by the chip's background/border
  // the way it used to be. Same tint-over-border-and-text treatment as ColorTag, since this is
  // an arbitrary user-picked hex with no matching Tailwind utility. Every task requires a season
  // at creation (tasks.season_id is NOT NULL), so the getVizColorForId fallback is purely
  // defensive for a soft-deleted or otherwise unresolved season join — same deterministic
  // hash-to-palette fallback other colourless entities already use (see holidays' Country column).
  const seasonColor = task.season?.color ?? getVizColorForId(task.id);

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => onSelect(task)}
        className="flex w-full items-center gap-2 truncate rounded-md border px-2 py-1.5 text-left text-sm transition-all duration-150 hover:shadow-sm hover:brightness-95 active:scale-[0.98] lg:text-base"
        style={{ borderColor: seasonColor, backgroundColor: `${seasonColor}1a`, color: seasonColor }}
        title={task.task_name}
      >
        <span className={cn("size-2 shrink-0 rounded-full lg:size-2.5", dotClass)} />
        <span className="truncate">{task.task_name}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      className="flex w-full flex-col gap-2 rounded-lg border p-4 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99]"
      style={{ borderColor: seasonColor, backgroundColor: `${seasonColor}14` }}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn("size-2.5 shrink-0 rounded-full lg:size-3", dotClass)} />
        <span className="truncate text-base font-medium text-foreground lg:text-lg">{task.task_name}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {task.season ? <ColorTag label={task.season.season_name} color={task.season.color} /> : null}
        {task.brand ? <ColorTag label={task.brand.brand_name} color={task.brand.color} /> : null}
        {owners.length > 0 ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <PartyStack parties={owners} maxVisible={2} showSoleName />
          </span>
        ) : null}
      </div>
    </button>
  );
};
