"use client";

import { TASK_STATUS_VIZ_COLORS } from "@/constants/chart-colors";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { formatDate } from "@/lib/dates";
import { ROW_HEIGHT, type BarGeometry } from "@/app/(app)/timeline/timeline-utils";
import { cn } from "@/lib/utils";
import type { Task } from "@/data/tasks";

// Below this the caption would be clipped mid-word, so the bar carries colour only and the
// name is read from the pinned left column (and the tooltip).
const MIN_WIDTH_FOR_LABEL = 72;
const BAR_HEIGHT = 24;

interface TimelineTaskBarProps {
  task: Task;
  geometry: BarGeometry;
  onSelect: (task: Task) => void;
}

export const TimelineTaskBar = ({ task, geometry, onSelect }: TimelineTaskBarProps) => {
  const color = TASK_STATUS_VIZ_COLORS[task.status];
  const statusLabel = TASK_STATUS_CONFIG[task.status]?.label ?? task.status;
  const schedule = geometry.isMilestone
    ? `Due ${formatDate(task.due_date)} — no start/end set`
    : `${formatDate(task.start_date ?? task.due_date)} → ${formatDate(task.end_date ?? task.due_date)}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      title={`${task.task_name} · ${statusLabel} · ${schedule}`}
      aria-label={`${task.task_name}, ${statusLabel}, ${schedule}`}
      style={{
        left: geometry.left,
        width: geometry.width,
        height: BAR_HEIGHT,
        top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
        backgroundColor: geometry.isMilestone ? `color-mix(in oklch, ${color}, transparent 78%)` : color,
        borderColor: color,
        // Square off whichever end runs past the window, so a clipped bar reads as continuing
        // rather than as a task that genuinely starts or ends at the screen edge.
        borderTopLeftRadius: geometry.continuesBefore ? 0 : undefined,
        borderBottomLeftRadius: geometry.continuesBefore ? 0 : undefined,
        borderTopRightRadius: geometry.continuesAfter ? 0 : undefined,
        borderBottomRightRadius: geometry.continuesAfter ? 0 : undefined,
      }}
      className={cn(
        "absolute flex items-center overflow-hidden rounded-sm px-2 text-left text-xs font-medium transition-[filter,box-shadow] duration-150",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none hover:brightness-95",
        // A milestone is a due-date marker, not a scheduled span — the dashed outline says the
        // bar's width is a default, not real data.
        geometry.isMilestone ? "border border-dashed text-foreground" : "border text-text-inverse"
      )}
    >
      {geometry.width >= MIN_WIDTH_FOR_LABEL ? <span className="truncate">{task.task_name}</span> : null}
    </button>
  );
};
