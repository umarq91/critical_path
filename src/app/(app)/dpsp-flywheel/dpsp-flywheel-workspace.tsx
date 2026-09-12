"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { TaskDetailDrawer } from "@/app/(app)/tasks/task-detail-drawer";
import { DpspFlywheelToolbar } from "@/app/(app)/dpsp-flywheel/dpsp-flywheel-toolbar";
import { DpspFlywheelDiagram } from "@/app/(app)/dpsp-flywheel/dpsp-flywheel-diagram";
import { DpspFlywheelColumn } from "@/app/(app)/dpsp-flywheel/dpsp-flywheel-column";
import { useDpspFlywheelQueryState } from "@/app/(app)/dpsp-flywheel/dpsp-flywheel-query-state";
import { dpspCategoryValues } from "@/app/(app)/tasks/schema";
import { cn } from "@/lib/utils";
import type { FilterSelectOption } from "@/components/shared/filter-select";
import type { Task } from "@/data/tasks";

type DpspCategory = (typeof dpspCategoryValues)[number];

interface DpspFlywheelWorkspaceProps {
  /** Every dpsp_category'd task matching the toolbar's current filters — the whole set, not
   *  one page of it (see listTasksForFlywheel). */
  tasks: Task[];
  canAssignPeople: boolean;
  seasonOptions: FilterSelectOption[];
  departmentOptions: FilterSelectOption[];
}

export const DpspFlywheelWorkspace = ({
  tasks,
  canAssignPeople,
  seasonOptions,
  departmentOptions,
}: DpspFlywheelWorkspaceProps) => {
  // No isolated refresh action here (this board has none of its own, like Timeline) — a saved
  // reassignment or a status change made from the drawer re-runs the page's Server Components.
  const router = useRouter();
  const queryState = useDpspFlywheelQueryState();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [visibleCategories, setVisibleCategories] = useState<ReadonlySet<DpspCategory>>(
    () => new Set(dpspCategoryValues)
  );

  const tasksByCategory = useMemo(() => {
    const grouped = Object.fromEntries(dpspCategoryValues.map((category) => [category, [] as Task[]])) as Record<
      DpspCategory,
      Task[]
    >;
    for (const task of tasks) {
      if (task.dpsp_category) grouped[task.dpsp_category].push(task);
    }
    return grouped;
  }, [tasks]);

  const categoryCounts = useMemo(
    () =>
      Object.fromEntries(dpspCategoryValues.map((category) => [category, tasksByCategory[category].length])) as Record<
        DpspCategory,
        number
      >,
    [tasksByCategory]
  );

  const seasonCount = useMemo(() => new Set(tasks.map((task) => task.season_id)).size, [tasks]);

  function toggleCategory(category: DpspCategory) {
    setVisibleCategories((previous) => {
      const next = new Set(previous);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <DpspFlywheelToolbar
        queryState={queryState}
        seasonOptions={seasonOptions}
        departmentOptions={departmentOptions}
        visibleCategories={visibleCategories}
        onToggleCategory={toggleCategory}
        shownCount={tasks.length}
      />

      <div
        className={cn(
          "relative grid grid-cols-1 gap-4 transition-opacity duration-200 xl:grid-cols-[260px_minmax(0,1fr)]",
          queryState.isPending && "opacity-60"
        )}
      >
        {queryState.isPending ? (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-start justify-center pt-24">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        <DpspFlywheelDiagram totalCount={tasks.length} seasonCount={seasonCount} categoryCounts={categoryCounts} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {dpspCategoryValues
            .filter((category) => visibleCategories.has(category))
            .map((category) => (
              <DpspFlywheelColumn
                key={category}
                category={category}
                tasks={tasksByCategory[category]}
                onSelectTask={setSelectedTask}
              />
            ))}
        </div>
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
    </div>
  );
};
