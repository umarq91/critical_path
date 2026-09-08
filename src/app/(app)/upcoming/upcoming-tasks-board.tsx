"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { useRowEditing } from "@/components/data-table/use-row-editing";
import { useRefreshableData } from "@/components/shared/use-refreshable-data";
import { EmptyState } from "@/components/shared/empty-state";
import { createTaskColumns } from "@/app/(app)/tasks/columns";
import { updateTask } from "@/app/(app)/tasks/_actions";
import { refreshUpcomingTasks } from "@/app/(app)/upcoming/_actions";
import { TaskDetailDrawer } from "@/app/(app)/tasks/task-detail-drawer";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_PRIORITY_CONFIG } from "@/constants/task-priority";
import type { Task } from "@/data/tasks";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

// "Due" toolbar filter's option values are day-count presets that data/tasks.ts's listTasks()
// interprets as `due_date <= today + N` — see that file's `filters.due_date` handling.
const DUE_OPTIONS: DataTableFilterOption[] = [
  { value: "7", label: "Next 7 Days" },
  { value: "30", label: "Next 30 Days" },
  { value: "90", label: "Next 90 Days" },
];

interface UpcomingTasksBoardProps {
  tasks: Task[];
  rowCount: number;
  canManage: boolean;
  canDelete: boolean;
  canAssignPeople: boolean;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  keyStageOptions: DataTableFilterOption[];
}

// Deliberately not a re-skin of TasksBoard — same underlying DataTable/columns machinery
// (reusing createTaskColumns, not forking a second column set), but scoped by the server to
// "tasks I own or am involved in, due from today on" (see data/tasks.ts's
// listUpcomingTasksForProfile) and with a narrower, purpose-fit filter set: no Key
// Stage/Gender/Owner filters (the whole page is already scoped to the current user, so those
// add little triage value here), plus a "Due" range preset that has no equivalent on the main
// Tasks grid.
export const UpcomingTasksBoard = ({
  tasks,
  rowCount,
  canManage,
  canDelete,
  canAssignPeople,
  seasonOptions,
  brandOptions,
  keyStageOptions,
}: UpcomingTasksBoardProps) => {
  const queryState = useDataTableQueryState({ defaultPageSize: 15, defaultSort: { id: "due_date", desc: false } });
  const rowEditing = useRowEditing();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Stable reference unless the server actually sent a new tasks/rowCount pair (real
  // pagination/sort/filter navigation) — see useRefreshableData's contract.
  const initialTasks = useMemo(() => ({ data: tasks, rowCount }), [tasks, rowCount]);
  const {
    data: taskData,
    refresh,
    isRefreshing,
  } = useRefreshableData(initialTasks, () => refreshUpcomingTasks(queryState.params));

  async function handleConfirmEdit(task: Task) {
    setIsSaving(true);
    const result = await updateTask(task.id, rowEditing.draft);
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${task.task_name} updated`);
    rowEditing.stopEditing();
  }

  const taskColumns = useMemo(
    () =>
      createTaskColumns({
        canManage,
        canDelete,
        rowEditing,
        isSaving,
        onConfirmEdit: handleConfirmEdit,
        seasonOptions,
        brandOptions,
        keyStageOptions,
      }),
    // rowEditing's methods are stable across renders (from useState setters); only its
    // values (editingId/draft) actually need to trigger a column rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      canManage,
      canDelete,
      rowEditing.editingId,
      rowEditing.draft,
      isSaving,
      seasonOptions,
      brandOptions,
      keyStageOptions,
    ]
  );

  const hasActiveFilters = Object.keys(queryState.params.filters).length > 0;

  return (
    <>
      <DataTable
        columns={taskColumns}
        data={taskData.data}
        queryState={queryState}
        rowCount={taskData.rowCount}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
        enableRowSelection
        enableColumnFilterRow={false}
        paginationLabel="upcoming tasks"
        onRowClick={(task) => {
          if (!rowEditing.isEditing(task.id)) setSelectedTask(task);
        }}
        emptyState={
          hasActiveFilters ? (
            <EmptyState
              icon={CalendarClock}
              title="No upcoming tasks match your filters"
              description="Try a different season, brand, status, or due-date range — or clear filters above."
            />
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="You're all caught up"
              description="You have no upcoming tasks as the owner or a person involved."
            />
          )
        }
        toolbar={{
          filters: [
            { columnId: "season_id", title: "Season", placeholder: "All Seasons", options: seasonOptions },
            { columnId: "brand_id", title: "Brand", placeholder: "All Brands", options: brandOptions },
            {
              columnId: "status",
              title: "Status",
              placeholder: "All Status",
              options: Object.entries(TASK_STATUS_CONFIG).map(([value, { label }]) => ({ value, label })),
            },
            {
              columnId: "priority",
              title: "Priority",
              placeholder: "All Priorities",
              options: Object.entries(TASK_PRIORITY_CONFIG).map(([value, { label }]) => ({ value, label })),
            },
            { columnId: "due_date", title: "Due", placeholder: "All Upcoming", options: DUE_OPTIONS },
          ],
          sortOptions: [
            { columnId: "due_date", desc: false, label: "Due Date (Earliest)" },
            { columnId: "due_date", desc: true, label: "Due Date (Latest)" },
            { columnId: "task_name", desc: false, label: "Task Name (A-Z)" },
            { columnId: "task_name", desc: true, label: "Task Name (Z-A)" },
          ],
          searchColumnId: "task_name",
          searchPlaceholder: "Search in upcoming tasks...",
        }}
      />
      {selectedTask ? (
        <TaskDetailDrawer
          key={selectedTask.id}
          task={selectedTask}
          open
          onOpenChange={(open) => !open && setSelectedTask(null)}
          canAssignPeople={canAssignPeople}
          onSaved={refresh}
        />
      ) : null}
    </>
  );
};
