"use client";

import Link from "next/link";
import { CircleCheckBig } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_STATUS_VIZ_COLORS } from "@/constants/chart-colors";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Task } from "@/data/tasks";

interface TimelineOverduePanelProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  /** Renders a "View All" footer link. Set by previews of this panel (the Dashboard's Gantt
   *  card, whose list is capped); the Timeline page itself is the destination, so it omits it. */
  viewAllHref?: string;
  /** px cap on the scrolling list — a preview sits next to a shorter chart than the full page's. */
  maxListHeight?: number;
}

// Deliberately not scoped to the visible window — overdue work from an earlier month is
// exactly what shouldn't scroll out of sight (see listOverdueTasks in data/tasks.ts).
export const TimelineOverduePanel = ({
  tasks,
  onSelectTask,
  viewAllHref,
  maxListHeight = 520,
}: TimelineOverduePanelProps) => {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-h3 text-foreground">
          Overdue Tasks
          {tasks.length > 0 ? <Badge className="bg-status-overdue-soft text-status-overdue-text">{tasks.length}</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {tasks.length === 0 ? (
          <EmptyState icon={CircleCheckBig} title="Nothing overdue" description="Every task is on or ahead of schedule." />
        ) : (
          <ul className="flex flex-col overflow-y-auto" style={{ maxHeight: maxListHeight }}>
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onSelectTask(task)}
                  className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: TASK_STATUS_VIZ_COLORS.overdue }}
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">{task.task_name}</span>
                    <span className="text-xs text-status-overdue-text">
                      {TASK_STATUS_CONFIG[task.status]?.label ?? task.status} · {formatDate(task.end_date ?? task.due_date)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {viewAllHref ? (
          <div className="px-4 pt-3">
            <Link
              href={viewAllHref}
              className={cn(buttonVariants({ variant: "outline" }), "w-full text-primary")}
            >
              View All
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
