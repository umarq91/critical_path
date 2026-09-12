"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { eachDayOfInterval, format, isSameDay, isSameMonth, isToday, isWeekend } from "date-fns";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskDetailDrawer } from "@/app/(app)/tasks/task-detail-drawer";
import { CalendarTaskChip } from "@/app/(app)/calendar/calendar-task-chip";
import { toDateKey, toQueryDate, type CalendarRange } from "@/app/(app)/calendar/calendar-utils";
import type { CalendarView } from "@/app/(app)/calendar/calendar-search-params";
import type { Task } from "@/data/tasks";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function groupByDate<T>(items: T[], dateKeyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dateKeyOf(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

interface CalendarBoardProps {
  view: CalendarView;
  anchorDate: Date;
  range: CalendarRange;
  tasks: Task[];
  canAssignPeople: boolean;
  isPending: boolean;
  hasActiveFilters: boolean;
  onNavigateToDate: (date: Date) => void;
}

export const CalendarBoard = ({
  view,
  anchorDate,
  range,
  tasks,
  canAssignPeople,
  isPending,
  hasActiveFilters,
  onNavigateToDate,
}: CalendarBoardProps) => {
  // No isolated refresh on this surface — a saved reassignment re-runs the page's
  // Server Components so the owners shown here match what was just confirmed.
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // `tasks` comes from listTasksByDueDateRange, which range-filters on due_date, so every task
  // reaching this board already has one — a task with none has nowhere on this grid to sit.
  const tasksByDate = useMemo(
    () => groupByDate(tasks, (task) => toDateKey(task.due_date as string)),
    [tasks]
  );

  // Keying the active grid by its range forces a remount on every Prev/Next/Today/view
  // change, so the fade-in animation on each grid replays instead of only firing once on
  // first mount (a re-render with new props alone wouldn't retrigger a CSS-entry animation).
  const gridKey = `${view}-${toQueryDate(range.start)}`;
  const showEmptyState = tasks.length === 0 && hasActiveFilters;

  return (
    <div className="flex flex-col gap-4">
      {showEmptyState ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
          <p className="text-body-strong text-foreground">No tasks match your filters</p>
          <p className="text-body text-muted-foreground">Try a different season, brand, or status — or clear filters above.</p>
        </div>
      ) : null}
      <div className="relative">
        <div className={cn("transition-opacity duration-200", isPending && "pointer-events-none opacity-50")}>
          {view === "month" ? (
            <MonthGrid
              key={gridKey}
              range={range}
              anchorDate={anchorDate}
              tasksByDate={tasksByDate}
              onSelectTask={setSelectedTask}
              onNavigateToDate={onNavigateToDate}
            />
          ) : null}
          {view === "week" ? (
            <WeekAgenda
              key={gridKey}
              range={range}
              tasksByDate={tasksByDate}
              onSelectTask={setSelectedTask}
              onNavigateToDate={onNavigateToDate}
            />
          ) : null}
          {view === "day" ? (
            <DayAgenda
              key={gridKey}
              anchorDate={anchorDate}
              tasksByDate={tasksByDate}
              onSelectTask={setSelectedTask}
            />
          ) : null}
        </div>
        {isPending ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : null}
      </div>
      <CalendarLegend />
      {selectedTask ? (
        <TaskDetailDrawer
          key={selectedTask.id}
          task={selectedTask}
          open
          onOpenChange={(open) => !open && setSelectedTask(null)}
          canAssignPeople={canAssignPeople}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </div>
  );
};

function DayNumberButton({
  day,
  today,
  dimmed,
  onNavigateToDate,
}: {
  day: Date;
  today: boolean;
  dimmed?: boolean;
  onNavigateToDate: (date: Date) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigateToDate(day)}
      aria-label={`View tasks for ${format(day, "EEEE, MMMM d, yyyy")}`}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-base transition-colors hover:bg-muted lg:text-lg",
        dimmed ? "text-muted-foreground" : "text-foreground",
        today && "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
      )}
    >
      {format(day, "d")}
    </button>
  );
}

function MonthGrid({
  range,
  anchorDate,
  tasksByDate,
  onSelectTask,
  onNavigateToDate,
}: {
  range: CalendarRange;
  anchorDate: Date;
  tasksByDate: Map<string, Task[]>;
  onSelectTask: (task: Task) => void;
  onNavigateToDate: (date: Date) => void;
}) {
  const days = eachDayOfInterval(range);

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 overflow-x-auto rounded-lg border border-border duration-300">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-7 border-b border-border bg-muted">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-3 py-3 text-sm font-medium text-text-secondary lg:text-base">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dateKey = toDateKey(day);
            const dayTasks = tasksByDate.get(dateKey) ?? [];
            const inCurrentMonth = isSameMonth(day, anchorDate);
            const today = isToday(day);
            const weekend = isWeekend(day);
            const visibleTasks = dayTasks.slice(0, 3);
            const overflowCount = dayTasks.length - visibleTasks.length;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex min-h-40 flex-col gap-1.5 border-b border-r border-border p-2.5 transition-colors duration-150 last:border-r-0 hover:bg-muted/30 lg:min-h-48",
                  !inCurrentMonth && "bg-muted/40",
                  inCurrentMonth && weekend && "bg-muted/15",
                  today && "bg-primary/5"
                )}
              >
                <DayNumberButton day={day} today={today} dimmed={!inCurrentMonth} onNavigateToDate={onNavigateToDate} />
                <div className="flex flex-col gap-1.5">
                  {visibleTasks.map((task) => (
                    <CalendarTaskChip key={task.id} task={task} onSelect={onSelectTask} variant="compact" />
                  ))}
                  {overflowCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => onNavigateToDate(day)}
                      aria-label={`View all ${dayTasks.length} tasks on ${format(day, "MMMM d")}`}
                      className="rounded px-2 text-left text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    >
                      +{overflowCount} more
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekAgenda({
  range,
  tasksByDate,
  onSelectTask,
  onNavigateToDate,
}: {
  range: CalendarRange;
  tasksByDate: Map<string, Task[]>;
  onSelectTask: (task: Task) => void;
  onNavigateToDate: (date: Date) => void;
}) {
  const days = eachDayOfInterval(range);

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 grid grid-cols-1 gap-3 duration-300 md:grid-cols-7">
      {days.map((day) => {
        const dateKey = toDateKey(day);
        const dayTasks = tasksByDate.get(dateKey) ?? [];
        const today = isToday(day);
        const weekend = isWeekend(day);

        return (
          <div
            key={day.toISOString()}
            className={cn(
              "flex flex-col gap-2 rounded-lg border border-border p-3 transition-colors duration-150 hover:bg-muted/30",
              weekend && !today && "bg-muted/15",
              today && "bg-primary/5"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary lg:text-base">{format(day, "EEE")}</span>
              <DayNumberButton day={day} today={today} onNavigateToDate={onNavigateToDate} />
            </div>
            <div className="flex flex-col gap-2">
              {dayTasks.length === 0 ? (
                <span className="text-sm text-muted-foreground">No tasks</span>
              ) : (
                dayTasks.map((task) => (
                  <CalendarTaskChip key={task.id} task={task} onSelect={onSelectTask} variant="full" />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayAgenda({
  anchorDate,
  tasksByDate,
  onSelectTask,
}: {
  anchorDate: Date;
  tasksByDate: Map<string, Task[]>;
  onSelectTask: (task: Task) => void;
}) {
  const dateKey = toDateKey(anchorDate);
  const dayTasks = tasksByDate.get(dateKey) ?? [];

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 flex flex-col gap-3 rounded-lg border border-border p-4 duration-300">
      <span className="text-h3 text-foreground">
        {isSameDay(anchorDate, new Date()) ? "Today" : format(anchorDate, "EEEE")}
      </span>
      {dayTasks.length === 0 ? (
        <p className="text-body text-muted-foreground">No tasks due on this day.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {dayTasks.map((task) => (
            <CalendarTaskChip key={task.id} task={task} onSelect={onSelectTask} variant="full" />
          ))}
        </div>
      )}
    </div>
  );
}

const LEGEND_ITEMS = [
  { status: "not_started", label: "Not Started", dotClass: "bg-status-notstarted-base" },
  { status: "in_progress", label: "In Progress", dotClass: "bg-status-progress-base" },
  { status: "completed", label: "Complete", dotClass: "bg-status-complete-base" },
  { status: "overdue", label: "Overdue", dotClass: "bg-status-overdue-base" },
] as const;

function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-lg border border-border bg-card px-4 py-3.5">
      <span className="text-sm font-medium text-text-secondary lg:text-base">Status Legend:</span>
      {LEGEND_ITEMS.map((item) => (
        <span key={item.status} className="flex items-center gap-2 text-sm text-foreground lg:text-base">
          <span className={cn("size-3 rounded-full", item.dotClass)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
