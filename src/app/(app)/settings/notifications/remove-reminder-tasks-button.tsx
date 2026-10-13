"use client";

import { BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { removeReminderTasks } from "@/app/(app)/settings/notifications/_reminder-actions";
import type { Task } from "@/data/tasks";

// Enough names to recognise the selection without turning a full page into a wall of text.
const NAMES_SHOWN = 5;

interface RemoveReminderTasksButtonProps {
  tasks: Task[];
  onRemoved: () => void;
}

// The Scheduled reminders table's bulk action — DataTable's selectionActions slot renders it
// while rows are ticked. Removes the tasks from this person's reminders only; the tasks
// themselves are untouched.
export const RemoveReminderTasksButton = ({ tasks, onRemoved }: RemoveReminderTasksButtonProps) => {
  const count = tasks.length;
  const noun = count === 1 ? "task" : "tasks";
  const hidden = count - NAMES_SHOWN;

  async function handleRemove() {
    const result = await removeReminderTasks({ taskIds: tasks.map((task) => task.id) });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${count} ${noun} removed from reminders`);
    onRemoved();
  }

  return (
    <ConfirmDialog
      title={`Remove ${count} ${noun} from reminders?`}
      description="You'll stop getting reminder emails for them. The tasks themselves aren't changed."
      confirmLabel={`Remove ${count} ${noun}`}
      pendingLabel="Removing…"
      onConfirm={handleRemove}
      trigger={
        <Button variant="destructive" size="sm" className="gap-1.5">
          <BellOff />
          Remove from reminders ({count})
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
