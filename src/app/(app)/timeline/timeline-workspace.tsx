"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { TaskDetailDrawer } from "@/app/(app)/tasks/task-detail-drawer";
import { TimelineToolbar } from "@/app/(app)/timeline/timeline-toolbar";
import { TimelineGrid } from "@/app/(app)/timeline/timeline-grid";
import { TimelineOverduePanel } from "@/app/(app)/timeline/timeline-overdue-panel";
import { TimelineStatusLegend } from "@/app/(app)/timeline/timeline-status-legend";
import { useTimelineQueryState } from "@/app/(app)/timeline/timeline-query-state";
import { getTimelineRange, resolveAnchorDate } from "@/app/(app)/timeline/timeline-utils";
import type { FilterSelectOption } from "@/components/shared/filter-select";
import { cn } from "@/lib/utils";
import type { Task } from "@/data/tasks";

interface TimelineWorkspaceProps {
  tasks: Task[];
  overdueTasks: Task[];
  canAssignPeople: boolean;
  seasonOptions: FilterSelectOption[];
  brandOptions: FilterSelectOption[];
}

export const TimelineWorkspace = ({
  tasks,
  overdueTasks,
  canAssignPeople,
  seasonOptions,
  brandOptions,
}: TimelineWorkspaceProps) => {
  // The timeline has no isolated refresh action of its own (unlike the grid's refresh button),
  // so a saved reassignment re-runs the page's Server Components to pick up the new owners.
  const router = useRouter();
  const queryState = useTimelineQueryState();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // The window is derived from URL state on the client too, so the header and bar geometry
  // agree with the range the server just queried for.
  const range = useMemo(
    () => getTimelineRange(queryState.state.view, resolveAnchorDate(queryState.state.date)),
    [queryState.state.view, queryState.state.date]
  );

  return (
    <div className="flex flex-col gap-4">
      <TimelineToolbar
        state={queryState.state}
        setState={(patch) => void queryState.setState(patch)}
        isPending={queryState.isPending}
        seasonOptions={seasonOptions}
        brandOptions={brandOptions}
        taskCount={tasks.length}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className={cn("relative flex flex-col gap-3 transition-opacity duration-200", queryState.isPending && "opacity-60")}>
          {queryState.isPending ? (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-start justify-center pt-24">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}
          <TimelineGrid tasks={tasks} range={range} view={queryState.state.view} onSelectTask={setSelectedTask} />
          <TimelineStatusLegend />
        </div>

        <TimelineOverduePanel tasks={overdueTasks} onSelectTask={setSelectedTask} />
      </div>

      {/* The shared drawer — same component the Tasks grid, Calendar and Upcoming pages open,
          receiving the same full Task shape, so there is exactly one task-detail implementation. */}
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
