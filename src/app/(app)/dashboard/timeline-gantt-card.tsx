"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChartCard } from "@/components/charts/chart-card";
import { TaskDetailDrawer } from "@/app/(app)/tasks/task-detail-drawer";
import { TimelineGrid } from "@/app/(app)/timeline/timeline-grid";
import { TimelineOverduePanel } from "@/app/(app)/timeline/timeline-overdue-panel";
import { TimelineStatusLegend } from "@/app/(app)/timeline/timeline-status-legend";
import {
  TimelineToolbar,
  type TimelineControls,
  type TimelineControlsPatch,
} from "@/app/(app)/timeline/timeline-toolbar";
import { getTimelineRange, overlapsTimelineRange, resolveAnchorDate } from "@/app/(app)/timeline/timeline-utils";
import {
  TIMELINE_PREVIEW_OVERDUE_HEIGHT,
  TIMELINE_PREVIEW_ROW_COUNT,
  getTimelinePreviewBand,
} from "@/app/(app)/dashboard/timeline-preview-range";
import type { FilterSelectOption } from "@/components/shared/filter-select";
import type { Task } from "@/data/tasks";

const TIMELINE_HREF = "/timeline";

const INITIAL_CONTROLS: TimelineControls = { view: "month", date: "", seasonId: "", brandId: "" };

interface TimelineGanttCardProps {
  /** Every task overlapping the preview band — see getTimelinePreviewBand(). Narrowed to the
   *  visible period and the chosen filters here, in the browser. */
  tasks: Task[];
  overdueTasks: Task[];
  seasonOptions: FilterSelectOption[];
  brandOptions: FilterSelectOption[];
  canAssignPeople: boolean;
}

// A `null` in a patch means "back to default", which for these three is the empty string —
// `undefined` means the patch didn't touch the value at all. The two are not the same thing.
function resolveControl(next: string | null | undefined, current: string) {
  if (next === undefined) return current;
  return next ?? "";
}

// The /timeline page in miniature: the same grid, bars, legend and overdue panel components,
// driven by component state instead of the URL. That difference is the whole point — this card
// sits on a page whose other cards all filter already-loaded data in the browser, so routing its
// controls through nuqs would re-run getDashboardMetrics() on every filter click.
export const TimelineGanttCard = ({
  tasks,
  overdueTasks,
  seasonOptions,
  brandOptions,
  canAssignPeople,
}: TimelineGanttCardProps) => {
  // No isolated refresh on this surface — a saved reassignment re-runs the page's
  // Server Components so the owners shown here match what was just confirmed.
  const router = useRouter();
  const [controls, setControls] = useState<TimelineControls>(INITIAL_CONTROLS);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  function patchControls(patch: TimelineControlsPatch) {
    setControls((current) => ({
      view: patch.view ?? current.view,
      date: resolveControl(patch.date, current.date),
      seasonId: resolveControl(patch.seasonId, current.seasonId),
      brandId: resolveControl(patch.brandId, current.brandId),
    }));
  }

  const band = useMemo(() => getTimelinePreviewBand(), []);
  const range = useMemo(
    () => getTimelineRange(controls.view, resolveAnchorDate(controls.date)),
    [controls.view, controls.date]
  );

  const { rows, matchCount, overdue } = useMemo(() => {
    const matchesFilters = (task: Task) =>
      (!controls.seasonId || task.season_id === controls.seasonId) &&
      (!controls.brandId || task.brand_id === controls.brandId);

    // Off-window tasks are dropped rather than left to TimelineGrid, which would give each one
    // an empty row: the band holds three months of work and the window may be a single week.
    const visible = tasks.filter((task) => matchesFilters(task) && overlapsTimelineRange(task, range));

    return {
      rows: visible.slice(0, TIMELINE_PREVIEW_ROW_COUNT),
      matchCount: visible.length,
      overdue: overdueTasks.filter(matchesFilters),
    };
  }, [tasks, overdueTasks, controls.seasonId, controls.brandId, range]);

  // Carries the card's current state into the full page, so "View All" continues the view the
  // user is looking at rather than resetting it. Keys match timelineSearchParams().
  const timelineHref = useMemo(() => {
    const params = new URLSearchParams();
    if (controls.view !== INITIAL_CONTROLS.view) params.set("view", controls.view);
    if (controls.date) params.set("date", controls.date);
    if (controls.seasonId) params.set("seasonId", controls.seasonId);
    if (controls.brandId) params.set("brandId", controls.brandId);

    const query = params.toString();
    return query ? `${TIMELINE_HREF}?${query}` : TIMELINE_HREF;
  }, [controls]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <ChartCard
          title="GANTT Chart / Timeline View"
          description="Track your project timeline and task progress"
        >
          <TimelineToolbar
            state={controls}
            setState={patchControls}
            band={band}
            compact
            seasonOptions={seasonOptions}
            brandOptions={brandOptions}
            taskCount={matchCount}
          />

          <TimelineGrid tasks={rows} range={range} view={controls.view} onSelectTask={setSelectedTask} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <TimelineStatusLegend />
            {matchCount > rows.length ? (
              <Link
                href={timelineHref}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-primary hover:bg-muted"
              >
                Showing {rows.length} of {matchCount} — view all on Timeline
              </Link>
            ) : (
              <span className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground">
                Click on any task bar to view details
              </span>
            )}
          </div>
        </ChartCard>

        <TimelineOverduePanel
          tasks={overdue}
          onSelectTask={setSelectedTask}
          viewAllHref={timelineHref}
          maxListHeight={TIMELINE_PREVIEW_OVERDUE_HEIGHT}
        />
      </div>

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
    </>
  );
};
