"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { NotifyTaskPickerDialog } from "@/app/(app)/settings/notifications/notify-task-picker-dialog";
import { updateReminderTasks } from "@/app/(app)/settings/notifications/_reminder-actions";
import { formatDate } from "@/lib/dates";
import type { FilterSelectOption } from "@/components/shared/filter-select";
import type { ReminderRuleTask } from "@/data/reminders";

interface NotifyTasksCardProps {
  initialTasks: ReminderRuleTask[];
  seasonOptions: FilterSelectOption[];
  ownerOptions: FilterSelectOption[];
}

// "Which tasks?" — v1's one and only scope mechanism: specific tasks the user picks, from the
// same set My Tasks shows them (see listMyReminderCandidateTasks). Season/owner are filters
// *inside* the picker dialog, not a second scope type to keep in step with this one (see
// reminder_rule_tasks in schema.md).
export const NotifyTasksCard = ({ initialTasks, seasonOptions, ownerOptions }: NotifyTasksCardProps) => {
  const [selected, setSelected] = useState<Map<string, ReminderRuleTask>>(
    () => new Map(initialTasks.map((task) => [task.id, task]))
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function toggleTask(task: ReminderRuleTask) {
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(task.id)) next.delete(task.id);
      else next.set(task.id, task);
      return next;
    });
  }

  function selectAllTasks(tasks: ReminderRuleTask[]) {
    setSelected((previous) => {
      const next = new Map(previous);
      for (const task of tasks) next.set(task.id, task);
      return next;
    });
  }

  function clearAllTasks() {
    setSelected(new Map());
  }

  async function handleSave() {
    setIsSaving(true);
    const result = await updateReminderTasks({ taskIds: [...selected.keys()] });
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Reminder tasks saved");
  }

  // Undated tasks (due_date === "") sink to the bottom rather than sorting first — same
  // convention as the main grid's nullsFirst: false, so a reminder pick without a date doesn't
  // jump ahead of ones that actually have one.
  const selectedTasks = [...selected.values()].sort((a, b) => {
    if (!a.due_date) return b.due_date ? 1 : 0;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Which tasks?</CardTitle>
        <CardDescription>Pick which of your own tasks you want reminded about.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FormDialog
          title="Select tasks"
          description="Only your own tasks — created by, owned by, or involving you — are shown."
          size="lg"
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          trigger={
            <Button variant="outline" className="w-fit gap-1.5">
              <Plus />
              Select tasks...
            </Button>
          }
        >
          <NotifyTaskPickerDialog
            seasonOptions={seasonOptions}
            ownerOptions={ownerOptions}
            selectedIds={new Set(selected.keys())}
            onToggle={toggleTask}
            onSelectAll={selectAllTasks}
            onClearAll={clearAllTasks}
          />
        </FormDialog>

        {selectedTasks.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {selectedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-foreground">{task.task_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {task.season_name ? `${task.season_name} · ` : ""}
                  {task.due_date ? formatDate(task.due_date) : "No due date"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected((previous) => {
                    const next = new Map(previous);
                    next.delete(task.id);
                    return next;
                  })}
                  aria-label={`Remove ${task.task_name}`}
                >
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No tasks selected yet — you won&apos;t get any reminder emails.</p>
        )}

        <Button onClick={handleSave} disabled={isSaving} className="self-start">
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
};
