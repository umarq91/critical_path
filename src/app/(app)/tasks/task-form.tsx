"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/form-fields/text-field";
import { TextareaField } from "@/components/form-fields/textarea-field";
import { SelectField } from "@/components/form-fields/select-field";
import { DateField } from "@/components/form-fields/date-field";
import { PeopleInvolvedField } from "@/app/(app)/tasks/people-involved-field";
import type { PersonSummary } from "@/app/(app)/tasks/person-row";
import { taskSchema, taskGenderValues, taskStatusValues, type TaskInput } from "@/app/(app)/tasks/schema";
import { createTask, addTaskPeople } from "@/app/(app)/tasks/_actions";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface TaskFormProps {
  onSuccess: () => void;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  keyStageOptions: DataTableFilterOption[];
  assigneeOptions: DataTableFilterOption[];
}

export const TaskForm = ({ onSuccess, seasonOptions, brandOptions, keyStageOptions, assigneeOptions }: TaskFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // People Involved is buffered locally, not through react-hook-form — the task doesn't
  // exist yet, so there's nothing to associate people with until createTask returns an id.
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const form = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      task_name: "",
      season_id: seasonOptions[0]?.value ?? "",
      brand_id: brandOptions[0]?.value ?? "",
      key_stage_id: "none",
      gender: "unisex",
      due_date: "",
      start_date: "",
      end_date: "",
      assignee_id: assigneeOptions[0]?.value ?? "",
      status: "not_started",
      notes: "",
    },
  });

  async function onSubmit(input: TaskInput) {
    setIsSubmitting(true);
    const result = await createTask(input);

    if (!result.ok) {
      setIsSubmitting(false);
      toast.error(result.error);
      return;
    }

    if (people.length > 0) {
      const peopleResult = await addTaskPeople(
        result.data.id,
        people.map((person) => person.id)
      );
      // The task itself was created successfully either way — a failure here is worth
      // surfacing but shouldn't read as "task creation failed".
      if (!peopleResult.ok) toast.error(`Task created, but people involved couldn't be saved: ${peopleResult.error}`);
    }

    setIsSubmitting(false);
    toast.success(`${input.task_name} created`);
    form.reset();
    setPeople([]);
    onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <TextField control={form.control} name="task_name" label="Task Name" placeholder="Creative Direction & Range Formation" />
        <SelectField control={form.control} name="season_id" label="Season" options={seasonOptions} />
        <SelectField control={form.control} name="brand_id" label="Brand" options={brandOptions} />
        <SelectField
          control={form.control}
          name="key_stage_id"
          label="Key Stage"
          placeholder="No key stage"
          options={[{ value: "none", label: "No key stage" }, ...keyStageOptions]}
        />
        <SelectField
          control={form.control}
          name="gender"
          label="Gender"
          options={taskGenderValues.map((value) => ({ value, label: TASK_GENDER_CONFIG[value].label }))}
        />
        <DateField control={form.control} name="due_date" label="Due Date" />
        <DateField control={form.control} name="start_date" label="Start Date" />
        <DateField control={form.control} name="end_date" label="Expected Finish Date" />
        <SelectField control={form.control} name="assignee_id" label="Owner / Assignee" options={assigneeOptions} />
        <div className="grid gap-1.5">
          <Label>People Involved</Label>
          <PeopleInvolvedField
            people={people}
            onAdd={(person) => setPeople((prev) => [...prev, person])}
            onRemove={(person) => setPeople((prev) => prev.filter((existing) => existing.id !== person.id))}
          />
        </div>
        <SelectField
          control={form.control}
          name="status"
          label="Status"
          options={taskStatusValues.map((value) => ({ value, label: TASK_STATUS_CONFIG[value].label }))}
        />
        <TextareaField control={form.control} name="notes" label="Comments" placeholder="Notes about this task" />
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Creating…" : "Create Task"}
        </Button>
      </form>
    </Form>
  );
};
