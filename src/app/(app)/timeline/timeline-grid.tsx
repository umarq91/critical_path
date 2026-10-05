"use client";

import { useMemo } from "react";
import { CalendarRange } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { TimelineTaskBar } from "@/app/(app)/timeline/timeline-task-bar";
import { TimelineColumnResizeHandle } from "@/app/(app)/timeline/timeline-column-resize-handle";
import { useTimelineColumnWidths } from "@/app/(app)/timeline/use-timeline-column-widths";
import { getTimelineHeader } from "@/app/(app)/timeline/timeline-header";
import {
  DAY_WIDTH,
  ROW_HEIGHT,
  getBarGeometry,
  getTodayOffset,
  type TimelineRange,
} from "@/app/(app)/timeline/timeline-utils";
import type { TimelineView } from "@/app/(app)/timeline/timeline-search-params";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Task } from "@/data/tasks";

interface TimelineGridProps {
  /** Exactly the rows to draw. Searching and paging happen in the caller (TimelineWorkspace);
   *  the Dashboard preview hands over its own 12-row slice the same way. */
  tasks: Task[];
  range: TimelineRange;
  view: TimelineView;
  onSelectTask: (task: Task) => void;
  emptyDescription?: string;
}

// One scroll container holds both halves, and the left column is `sticky left-0` inside it.
// That is what keeps task rows and bars locked together: they are literally the same DOM row,
// so vertical alignment can't drift, and horizontal scrolling moves only the timeline.
export const TimelineGrid = ({
  tasks,
  range,
  view,
  onSelectTask,
  emptyDescription = "Try a different period, or clear the filters above.",
}: TimelineGridProps) => {
  const dayWidth = DAY_WIDTH[view];
  const {
    widths,
    setWidth,
    totalWidth: panelWidth,
  } = useTimelineColumnWidths();

  const { groups, columns, gridlines, timelineWidth, todayOffset } =
    useMemo(() => {
      const header = getTimelineHeader(view, range);
      return {
        ...header,
        timelineWidth: header.totalDays * dayWidth,
        todayOffset: getTodayOffset(range, dayWidth),
      };
    }, [range, view, dayWidth]);

  // Geometry recomputes only when the window or the task set actually changes — not on scroll,
  // and not when an unrelated bit of workspace state moves.
  const rows = useMemo(
    () =>
      tasks.map((task) => ({
        task,
        geometry: getBarGeometry(task, range, dayWidth),
      })),
    [tasks, range, dayWidth],
  );

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-border">
        <EmptyState
          icon={CalendarRange}
          title="No tasks in this period"
          description={emptyDescription}
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div style={{ width: panelWidth + timelineWidth, minWidth: "100%" }}>
        <div className="sticky top-0 z-20 flex border-b border-border bg-muted/40">
          <div
            className="sticky left-0 z-30 flex shrink-0 items-center border-r border-border bg-muted/40 backdrop-blur"
            style={{ width: panelWidth, height: ROW_HEIGHT * 2 }}
          >
            {/* Each header cell carries a drag handle on its right edge, like the Tasks grid. */}
            <span
              className="relative flex h-full shrink-0 items-center px-3 text-xs font-semibold text-muted-foreground"
              style={{ width: widths.name }}
            >
              Task Name
              <TimelineColumnResizeHandle
                width={widths.name}
                onResize={(next) => setWidth("name", next)}
                label="Task Name"
              />
            </span>
            <span
              className="relative flex h-full shrink-0 items-center px-2 text-xs font-semibold text-muted-foreground"
              style={{ width: widths.start }}
            >
              Start Date
              <TimelineColumnResizeHandle
                width={widths.start}
                onResize={(next) => setWidth("start", next)}
                label="Start Date"
              />
            </span>
            <span
              className="relative flex h-full shrink-0 items-center px-2 text-xs font-semibold text-muted-foreground"
              style={{ width: widths.end }}
            >
              End Date
              <TimelineColumnResizeHandle
                width={widths.end}
                onResize={(next) => setWidth("end", next)}
                label="End Date"
              />
            </span>
          </div>

          <div style={{ width: timelineWidth }}>
            <div className="flex" style={{ height: ROW_HEIGHT }}>
              {groups.map((group) => (
                <div
                  key={group.key}
                  className="flex flex-col justify-center overflow-hidden border-r border-border px-2 last:border-r-0"
                  style={{ width: group.dayCount * dayWidth }}
                >
                  <span className="truncate text-xs font-semibold text-foreground">
                    {group.label}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {group.rangeLabel}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="flex border-t border-border"
              style={{ height: ROW_HEIGHT }}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  className={cn(
                    "flex flex-col items-center justify-center overflow-hidden border-r border-border/60 last:border-r-0",
                    column.isWeekend && "bg-muted/50",
                    column.isToday && "bg-primary-tint",
                  )}
                  style={{ width: column.dayCount * dayWidth }}
                >
                  <span
                    className={cn(
                      "truncate text-[11px] leading-tight",
                      column.isToday
                        ? "font-semibold text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {column.label}
                  </span>
                  {column.subLabel ? (
                    <span
                      className={cn(
                        "truncate text-xs leading-tight",
                        column.isToday
                          ? "font-semibold text-primary"
                          : "text-foreground",
                      )}
                    >
                      {column.subLabel}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          {todayOffset !== null ? (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-primary"
              style={{ left: panelWidth + todayOffset + dayWidth / 2 }}
              aria-hidden
            />
          ) : null}

          {rows.map(({ task, geometry }) => (
            <div
              key={task.id}
              className="flex border-b border-border/60 last:border-b-0 hover:bg-muted/30"
            >
              <button
                type="button"
                onClick={() => onSelectTask(task)}
                className="sticky left-0 z-10 flex shrink-0 items-center border-r border-border bg-card text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                style={{ width: panelWidth, minHeight: ROW_HEIGHT }}
              >
                {/* Wraps rather than truncating (client request, like the Tasks grid): a long
                    name makes the row taller, and the bar re-centres in it. */}
                <span
                  className="shrink-0 px-3 py-2 text-sm font-medium break-words whitespace-normal text-foreground"
                  style={{ width: widths.name }}
                >
                  {task.task_name}
                </span>
                <span
                  className="shrink-0 px-2 text-xs break-words text-muted-foreground"
                  style={{ width: widths.start }}
                >
                  {task.start_date ? formatDate(task.start_date) : "—"}
                </span>
                <span
                  className="shrink-0 px-2 text-xs break-words text-muted-foreground"
                  style={{ width: widths.end }}
                >
                  {task.end_date ? formatDate(task.end_date) : "—"}
                </span>
              </button>

              <div
                className="relative"
                style={{
                  width: timelineWidth,
                  minHeight: ROW_HEIGHT,
                  // Column gridlines as a gradient rather than one node per column — a 42-day
                  // month across many rows is a lot of DOM to pay for a 1px line.
                  backgroundImage: gridlines,
                }}
              >
                {geometry ? (
                  <TimelineTaskBar
                    task={task}
                    geometry={geometry}
                    onSelect={onSelectTask}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
