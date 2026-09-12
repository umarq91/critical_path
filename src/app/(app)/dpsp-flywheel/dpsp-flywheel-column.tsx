"use client";

import { useState } from "react";
import { DPSP_CATEGORY_CONFIG, DPSP_CATEGORY_SOLID_CLASSNAME } from "@/constants/dpsp-category";
import { DpspFlywheelCard } from "@/app/(app)/dpsp-flywheel/dpsp-flywheel-card";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { cn } from "@/lib/utils";
import type { dpspCategoryValues } from "@/app/(app)/tasks/schema";
import type { Task } from "@/data/tasks";

/** Cards rendered per column before it pages, so a category with hundreds of deliverables
 *  (Demand, typically) never outgrows the columns next to it — the page doesn't fetch more
 *  than this at once either; see listTasksForFlywheel/pagination below. */
export const DPSP_FLYWHEEL_COLUMN_PAGE_SIZE = 25;

interface DpspFlywheelColumnProps {
  category: (typeof dpspCategoryValues)[number];
  /** Every task in this category matching the toolbar's filters — the whole set, not one page
   *  of it (see listTasksForFlywheel). Paginated client-side below since it's already in memory. */
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

// One Kanban-style column — a solid-colored header bar (the category's TOTAL count, not just
// this page's) over a paginated card list, capped at DPSP_FLYWHEEL_COLUMN_PAGE_SIZE per page
// rather than rendering every matching task at once.
export function DpspFlywheelColumn({ category, tasks, onSelectTask }: DpspFlywheelColumnProps) {
  const config = DPSP_CATEGORY_CONFIG[category];
  const [page, setPage] = useState(1);
  // Resets `page` when a new filter/search/hide-done round trip hands this column a different
  // tasks array — setState-during-render (React's documented pattern for "reset state when a
  // prop changes"), not a useEffect, so the stale page never even paints for one frame.
  const [tasksForPage, setTasksForPage] = useState(tasks);
  if (tasks !== tasksForPage) {
    setTasksForPage(tasks);
    setPage(1);
  }

  const pageCount = Math.max(Math.ceil(tasks.length / DPSP_FLYWHEEL_COLUMN_PAGE_SIZE), 1);
  const currentPage = Math.min(page, pageCount);
  const from = (currentPage - 1) * DPSP_FLYWHEEL_COLUMN_PAGE_SIZE;
  const pageTasks = tasks.slice(from, from + DPSP_FLYWHEEL_COLUMN_PAGE_SIZE);

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border">
      <div className={cn("px-3 py-2 text-sm font-semibold text-white uppercase", DPSP_CATEGORY_SOLID_CLASSNAME[category])}>
        {config.label} · {tasks.length}
      </div>
      <div className="flex max-h-[500px] flex-col gap-2 overflow-y-auto bg-muted/20 p-2">
        {pageTasks.length === 0 ? (
          <span className="px-1 py-2 text-sm text-muted-foreground">—</span>
        ) : (
          pageTasks.map((task) => <DpspFlywheelCard key={task.id} task={task} onClick={() => onSelectTask(task)} />)
        )}
      </div>
      {tasks.length > DPSP_FLYWHEEL_COLUMN_PAGE_SIZE ? (
        <div className="border-t border-border p-2">
          <PaginationControls
            page={currentPage}
            pageSize={DPSP_FLYWHEEL_COLUMN_PAGE_SIZE}
            rowCount={tasks.length}
            totalLabel="tasks"
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
