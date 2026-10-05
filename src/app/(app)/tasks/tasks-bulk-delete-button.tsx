"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteTasks } from "@/app/(app)/tasks/_actions";
import type { Task } from "@/data/tasks";

// Enough names to recognise the selection without turning a 300-row delete into a wall of text.
const NAMES_SHOWN = 5;

interface TasksBulkDeleteButtonProps {
  tasks: Task[];
  onDeleted: () => void;
}

// The task grids' "Delete selected" — DataTable's selectionActions slot renders it while rows
// are ticked. Soft delete, same as a row's own Delete: everything can come back from Trash.
export const TasksBulkDeleteButton = ({ tasks, onDeleted }: TasksBulkDeleteButtonProps) => {
  const count = tasks.length;
  const noun = count === 1 ? "task" : "tasks";
  const hidden = count - NAMES_SHOWN;

  async function handleDelete() {
    const result = await deleteTasks(tasks.map((task) => task.id));
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const skipped = count - result.deletedCount;
    toast.success(
      skipped > 0
        ? `${result.deletedCount} of ${count} tasks deleted — ${skipped} could not be deleted`
        : `${result.deletedCount} ${result.deletedCount === 1 ? "task" : "tasks"} deleted`
    );
    onDeleted();
  }

  return (
    <ConfirmDialog
      title={`Delete ${count} ${noun}?`}
      description={`${count === 1 ? "It" : "They"} can be restored from Trash at any time.`}
      confirmLabel={`Delete ${count} ${noun}`}
      onConfirm={handleDelete}
      trigger={
        <Button variant="destructive" size="sm" className="gap-1.5">
          <Trash2 />
          Delete selected ({count})
        </Button>
      }
    >
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
        {tasks.slice(0, NAMES_SHOWN).map((task) => (
          <li key={task.id} className="break-words">
            {task.task_name}
          </li>
        ))}
        {hidden > 0 ? <li className="list-none text-muted-foreground">and {hidden} more</li> : null}
      </ul>
    </ConfirmDialog>
  );
};
