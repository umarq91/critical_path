"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { TaskForm } from "@/app/(app)/tasks/task-form";
import { TasksExportButton } from "@/app/(app)/tasks/tasks-export-button";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface TaskPageActionsProps {
  canCreateTask: boolean;
  canExport: boolean;
  rowCount: number;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  keyStageOptions: DataTableFilterOption[];
}

export const TaskPageActions = ({
  canCreateTask,
  canExport,
  rowCount,
  seasonOptions,
  brandOptions,
  keyStageOptions,
}: TaskPageActionsProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {canExport ? <TasksExportButton rowCount={rowCount} /> : null}
      {canCreateTask ? (
        <FormDialog
          title="Add New Task"
          description="Create a new task to track."
          size="xl"
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button>
              <Plus />
              Add New Task
            </Button>
          }
        >
          <TaskForm
            onSuccess={() => setOpen(false)}
            seasonOptions={seasonOptions}
            brandOptions={brandOptions}
            keyStageOptions={keyStageOptions}
          />
        </FormDialog>
      ) : null}
    </>
  );
};
