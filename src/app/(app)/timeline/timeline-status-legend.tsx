import { ChartSeriesLegend } from "@/components/charts/chart-series-legend";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_STATUS_VIZ_COLORS } from "@/constants/chart-colors";
import { taskStatusValues } from "@/app/(app)/tasks/schema";

// Built from the status enum, not a hand-written list — a new status appears here automatically.
const LEGEND_ITEMS = taskStatusValues.map((status) => ({
  label: TASK_STATUS_CONFIG[status]?.label ?? status,
  color: TASK_STATUS_VIZ_COLORS[status],
}));

export const TimelineStatusLegend = () => {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <ChartSeriesLegend items={LEGEND_ITEMS} />
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2.5 shrink-0 rounded-xs border border-dashed border-muted-foreground" aria-hidden />
        No start/end set — shown on its due date
      </span>
    </div>
  );
};
