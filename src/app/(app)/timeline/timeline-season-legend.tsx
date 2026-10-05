import { ChartSeriesLegend } from "@/components/charts/chart-series-legend";
import { taskSeasonColor } from "@/app/(app)/tasks/task-season-color";
import type { Task } from "@/data/tasks";

// The Timeline's bars are coloured by season, and seasons share a 7-colour palette, so this
// names the seasons actually on screen: built from the visible tasks, not every season, so it
// stays short and only explains colours you can see.
export const TimelineSeasonLegend = ({ tasks }: { tasks: Task[] }) => {
  const seasons = new Map<string, { label: string; color: string }>();
  for (const task of tasks) {
    if (task.season && !seasons.has(task.season.id)) {
      seasons.set(task.season.id, { label: task.season.season, color: taskSeasonColor(task) });
    }
  }
  const items = [...seasons.values()].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {items.length > 0 ? <ChartSeriesLegend items={items} /> : null}
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2.5 shrink-0 rounded-xs border border-dashed border-muted-foreground" aria-hidden />
        No start/end set — shown on its due date
      </span>
    </div>
  );
};
