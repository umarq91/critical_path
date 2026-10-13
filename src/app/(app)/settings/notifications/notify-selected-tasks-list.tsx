"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/dates";
import type { ReminderRuleTask } from "@/data/reminders";

interface NotifySelectedTasksListProps {
  tasks: ReminderRuleTask[];
  onRemove: (taskIds: string[]) => void;
}

// Step 1's list of picked tasks. Ticking is separate from the picks themselves: a tick only marks
// rows for "Remove selected", and removal is buffered like the per-row ✕ until Step 1's Save.
// The list is unpaginated, so "Select all" really is every picked task.
export const NotifySelectedTasksList = ({ tasks, onRemove }: NotifySelectedTasksListProps) => {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  // A removed task can't stay ticked; filtering at read time keeps the count honest without
  // a sync effect.
  const tickedIds = tasks.filter((task) => ticked.has(task.id)).map((task) => task.id);
  const allTicked = tickedIds.length === tasks.length;
  const someTicked = tickedIds.length > 0 && !allTicked;

  function toggle(taskId: string, checked: boolean) {
    setTicked((previous) => {
      const next = new Set(previous);
      if (checked) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  function removeTicked() {
    onRemove(tickedIds);
    setTicked(new Set());
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-8 items-center gap-2 px-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={allTicked}
            indeterminate={someTicked}
            onCheckedChange={(checked) => setTicked(checked ? new Set(tasks.map((task) => task.id)) : new Set())}
            aria-label={allTicked ? "Deselect all" : "Select all"}
          />
          {allTicked ? "Deselect all" : "Select all"}
        </label>
        <span className="text-xs text-muted-foreground">
          {tickedIds.length > 0 ? `${tickedIds.length} of ${tasks.length} selected` : `${tasks.length} tasks`}
        </span>
        {tickedIds.length > 0 ? (
          <Button variant="destructive" size="sm" className="ml-auto gap-1.5" onClick={removeTicked}>
            <Trash2 />
            Remove selected ({tickedIds.length})
          </Button>
        ) : null}
      </div>
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
        >
          <Checkbox
            checked={ticked.has(task.id)}
            onCheckedChange={(checked) => toggle(task.id, !!checked)}
            aria-label={`Select ${task.task_name}`}
          />
          <span className="min-w-0 flex-1 truncate text-foreground">{task.task_name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {task.season ? `${task.season} · ` : ""}
            {task.due_date ? formatDate(task.due_date) : "No due date"}
          </span>
          <button type="button" onClick={() => onRemove([task.id])} aria-label={`Remove ${task.task_name}`}>
            <X className="size-3.5 text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  );
};
