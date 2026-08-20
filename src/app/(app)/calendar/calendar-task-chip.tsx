import { isBefore, parseISO, startOfToday } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ColorTag } from "@/components/shared/color-tag";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { cn, initials } from "@/lib/utils";
import type { Task } from "@/data/tasks";

// Mirrors TASK_STATUS_CONFIG's palette but as a solid dot rather than a soft-tinted badge —
// the chip itself already carries the soft tint, so the dot needs the fuller-saturation base
// tone to read as a distinct marker against it.
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
  // The `overdue` status is only stamped by the nightly status-rollover cron — a task whose
  // due_date has already passed can still read "in_progress" until that job catches up. The
  // calendar shows the actual due date, so it derives overdue from the date directly rather
  // than trusting a status value that may be a day stale.
  const isOverdue = task.status !== "completed" && isBefore(parseISO(task.due_date), startOfToday());
  const effectiveStatus = isOverdue ? "overdue" : task.status;
  const statusConfig = TASK_STATUS_CONFIG[effectiveStatus];
  const dotClass = STATUS_DOT_CLASS[effectiveStatus] ?? "bg-muted-foreground";

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => onSelect(task)}
        className={cn(
          "flex w-full items-center gap-2 truncate rounded-md px-2 py-1.5 text-left text-sm transition-all duration-150 hover:shadow-sm hover:brightness-95 active:scale-[0.98] lg:text-base",
          statusConfig?.className
        )}
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
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border p-4 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99]",
        isOverdue
          ? "border-status-overdue-base bg-status-overdue-soft hover:bg-status-overdue-soft/70"
          : "border-border bg-card hover:border-primary/30 hover:bg-muted"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn("size-2.5 shrink-0 rounded-full lg:size-3", dotClass)} />
        <span
          className={cn(
            "truncate text-base font-medium lg:text-lg",
            isOverdue ? "text-status-overdue-text" : "text-foreground"
          )}
        >
          {task.task_name}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {task.season ? <ColorTag label={task.season.season_name} color={task.season.color} /> : null}
        {task.brand ? <ColorTag label={task.brand.brand_name} color={task.brand.color} /> : null}
        {task.assignee ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar className="size-6">
              <AvatarImage src={task.assignee.avatar_url ?? undefined} alt={task.assignee.full_name ?? task.assignee.email} />
              <AvatarFallback className="text-xs">{initials(task.assignee.full_name, task.assignee.email)}</AvatarFallback>
            </Avatar>
            {task.assignee.full_name ?? task.assignee.email}
          </span>
        ) : null}
      </div>
    </button>
  );
};
