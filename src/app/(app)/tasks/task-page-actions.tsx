"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { TaskForm } from "@/app/(app)/tasks/task-form";
import { TasksExportButton } from "@/app/(app)/tasks/tasks-export-button";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface TaskPageActionsProps {
  canCreateTask: boolean;
  canDelete: boolean;
  canExport: boolean;
  rowCount: number;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  keyStageOptions: DataTableFilterOption[];
}

export const TaskPageActions = ({
  canCreateTask,
  canDelete,
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
      {canDelete ? (
        // Same gate as the Trash page itself (task.delete) — restoring is part of the
        // delete capability, not a separate grant, so there's no point showing this link to
        // someone requirePageAccess would bounce straight back out.
        <Button variant="outline" nativeButton={false} render={<Link href="/tasks/trash" />}>
          <Trash2 />
          Trash
        </Button>
      ) : null}
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
