"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { TextareaField } from "@/components/form-fields/textarea-field";
import { SelectField } from "@/components/form-fields/select-field";
import { DateField } from "@/components/form-fields/date-field";
import { taskSchema, taskGenderValues, taskStatusValues, type TaskInput } from "@/app/(app)/tasks/schema";
import { createTask } from "@/app/(app)/tasks/_actions";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface TaskFormProps {
  onSuccess: () => void;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  assigneeOptions: DataTableFilterOption[];
}

export const TaskForm = ({ onSuccess, seasonOptions, brandOptions, assigneeOptions }: TaskFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      task_name: "",
      season_id: seasonOptions[0]?.value ?? "",
      brand_id: brandOptions[0]?.value ?? "",
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
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${input.task_name} created`);
    form.reset();
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
          name="gender"
          label="Gender"
          options={taskGenderValues.map((value) => ({ value, label: TASK_GENDER_CONFIG[value].label }))}
        />
        <DateField control={form.control} name="due_date" label="Due Date" />
        <DateField control={form.control} name="start_date" label="Start Date" />
        <DateField control={form.control} name="end_date" label="Expected Finish Date" />
        <SelectField control={form.control} name="assignee_id" label="Owner / Assignee" options={assigneeOptions} />
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
