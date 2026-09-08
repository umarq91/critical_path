"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { useRowEditing } from "@/components/data-table/use-row-editing";
import { useRefreshableData } from "@/components/shared/use-refreshable-data";
import { createTaskColumns } from "@/app/(app)/tasks/columns";
import { updateTask, refreshTasks } from "@/app/(app)/tasks/_actions";
import { TaskDetailDrawer } from "@/app/(app)/tasks/task-detail-drawer";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { TASK_PRIORITY_CONFIG } from "@/constants/task-priority";
import type { Task } from "@/data/tasks";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface TasksBoardProps {
  tasks: Task[];
  rowCount: number;
  canManage: boolean;
  canDelete: boolean;
  canAssignPeople: boolean;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  keyStageOptions: DataTableFilterOption[];
  ownerOptions: DataTableFilterOption[];
}

export const TasksBoard = ({
  tasks,
  rowCount,
  canManage,
  canDelete,
  canAssignPeople,
  seasonOptions,
  brandOptions,
  keyStageOptions,
  ownerOptions,
}: TasksBoardProps) => {
  const queryState = useDataTableQueryState({ defaultPageSize: 15, defaultSort: { id: "due_date", desc: false } });
  const rowEditing = useRowEditing();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Stable reference unless the server actually sent a new tasks/rowCount pair (real
  // pagination/sort/filter navigation) — see useRefreshableData's contract.
  const initialTasks = useMemo(() => ({ data: tasks, rowCount }), [tasks, rowCount]);
  const { data: taskData, refresh, isRefreshing } = useRefreshableData(initialTasks, () => refreshTasks(queryState.params));

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
      ownerOptions,
    ]
  );

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
        paginationLabel="tasks"
        onRowClick={(task) => {
          if (!rowEditing.isEditing(task.id)) setSelectedTask(task);
        }}
        getRowClassName={(task) => (task.status === "overdue" ? "bg-status-overdue-soft/40" : undefined)}
        toolbar={{
          filters: [
            { columnId: "season_id", title: "Season", placeholder: "All Seasons", options: seasonOptions },
            { columnId: "brand_id", title: "Brand", placeholder: "All Brands", options: brandOptions },
            { columnId: "key_stage_id", title: "Key Stage", placeholder: "All Key Stages", options: keyStageOptions },
            {
              columnId: "gender",
              title: "Gender",
              placeholder: "All Genders",
              options: Object.entries(TASK_GENDER_CONFIG).map(([value, { label }]) => ({ value, label })),
            },
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
            { columnId: "owner", title: "Owner", placeholder: "All Owners", options: ownerOptions },
          ],
          sortOptions: [
            { columnId: "task_name", desc: false, label: "Task Name (A-Z)" },
            { columnId: "task_name", desc: true, label: "Task Name (Z-A)" },
            { columnId: "due_date", desc: false, label: "Due Date (Earliest)" },
            { columnId: "due_date", desc: true, label: "Due Date (Latest)" },
          ],
          searchColumnId: "task_name",
          searchPlaceholder: "Search in tasks...",
        }}
      />
      {/* Mounted per selected task, so the drawer's participants draft starts from that
          task's own owners without a reset-on-prop-change path. */}
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
