"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TextField } from "@/components/form-fields/text-field";
import { TextareaField } from "@/components/form-fields/textarea-field";
import { SelectField } from "@/components/form-fields/select-field";
import { DateField } from "@/components/form-fields/date-field";
import { PartyListField } from "@/app/(app)/tasks/party-list-field";
import type { PartySummary } from "@/lib/party";
import {
  taskCreateSchema,
  taskGenderValues,
  taskStatusValues,
  dpspCategoryValues,
  type TaskCreateInput,
} from "@/app/(app)/tasks/schema";
import { createTask } from "@/app/(app)/tasks/_actions";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { DPSP_CATEGORY_CONFIG } from "@/constants/dpsp-category";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface TaskFormProps {
  onSuccess: () => void;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  keyStageOptions: DataTableFilterOption[];
}

export const TaskForm = ({ onSuccess, seasonOptions, brandOptions, keyStageOptions }: TaskFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The full PartySummary objects behind the `owners`/`people_involved` form values — the form
  // itself holds only `kind:uuid` keys (that's all the Server Action needs), but the list UI
  // needs names and avatars to render what's been picked without re-fetching.
  const [owners, setOwners] = useState<PartySummary[]>([]);
  const [peopleInvolved, setPeopleInvolved] = useState<PartySummary[]>([]);
  const form = useForm<TaskCreateInput>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues: {
      task_name: "",
      season_id: seasonOptions[0]?.value ?? "",
      brand_id: brandOptions[0]?.value ?? "",
      key_stage_id: keyStageOptions[0]?.value ?? "",
      dpsp_category: dpspCategoryValues[0],
      gender: "unisex",
      due_date: "",
      start_date: "",
      end_date: "",
      owners: [],
      people_involved: [],
      status: "not_started",
      // Priority is temporarily hidden from the form (client request) but the schema still
      // requires a value — "med" matches the DB column's own default.
      priority: "med",
      notes: "",
    },
  });

  // Both party lists are mirrored into react-hook-form so `owners.min(1)` participates in
  // validation like any other field, instead of being checked separately at submit time.
  function updateParties(
    field: "owners" | "people_involved",
    setLocal: (next: PartySummary[]) => void,
    next: PartySummary[]
  ) {
    setLocal(next);
    form.setValue(
      field,
      next.map((party) => party.key),
      { shouldValidate: form.formState.isSubmitted }
    );
  }

  async function onSubmit(input: TaskCreateInput) {
    setIsSubmitting(true);
    const result = await createTask(input);

    if (!result.ok) {
      setIsSubmitting(false);
      toast.error(result.error);
      return;
    }

    setIsSubmitting(false);
    toast.success(`${input.task_name} created`);
    form.reset();
    setOwners([]);
    setPeopleInvolved([]);
    onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
        <div className="flex flex-col gap-5">
          <FormSection title="Details">
            <TextField control={form.control} name="task_name" label="Task Name" placeholder="Creative Direction & Range Formation" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField control={form.control} name="season_id" label="Season" options={seasonOptions} />
              <SelectField control={form.control} name="brand_id" label="Brand" options={brandOptions} />
              <SelectField control={form.control} name="key_stage_id" label="Key Stage" options={keyStageOptions} />
              <SelectField
                control={form.control}
                name="gender"
                label="Gender"
                options={taskGenderValues.map((value) => ({ value, label: TASK_GENDER_CONFIG[value].label }))}
              />
              <SelectField
                control={form.control}
                name="dpsp_category"
                label="DPSP Category"
                options={dpspCategoryValues.map((value) => ({ value, label: DPSP_CATEGORY_CONFIG[value].label }))}
              />
            </div>
          </FormSection>

          <Separator />

          <FormSection title="Timeline">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DateField control={form.control} name="due_date" label="Due Date" />
              <DateField control={form.control} name="start_date" label="Start Date" />
              <DateField control={form.control} name="end_date" label="Expected Finish Date" />
            </div>
          </FormSection>

          <Separator />

          <FormSection title="Assignment">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="status"
                label="Status"
                options={taskStatusValues.map((value) => ({ value, label: TASK_STATUS_CONFIG[value].label }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Owners</Label>
              <PartyListField
                parties={owners}
                onAdd={(party) => updateParties("owners", setOwners, [...owners, party])}
                onRemove={(party) =>
                  updateParties("owners", setOwners, owners.filter((existing) => existing.key !== party.key))
                }
                emptyLabel="No owners yet — add a department or a person"
                placeholder="Search departments and people..."
              />
              {form.formState.errors.owners ? (
                <p className="text-sm text-destructive">{form.formState.errors.owners.message}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>People Involved</Label>
              <PartyListField
                parties={peopleInvolved}
                onAdd={(party) => updateParties("people_involved", setPeopleInvolved, [...peopleInvolved, party])}
                onRemove={(party) =>
                  updateParties(
                    "people_involved",
                    setPeopleInvolved,
                    peopleInvolved.filter((existing) => existing.key !== party.key)
                  )
                }
                emptyLabel="No one involved yet"
                placeholder="Search departments and people..."
              />
              {form.formState.errors.people_involved ? (
                <p className="text-sm text-destructive">{form.formState.errors.people_involved.message}</p>
              ) : null}
            </div>
          </FormSection>

          <Separator />

          <FormSection title="Notes">
            <TextareaField control={form.control} name="notes" label="Comments" placeholder="Notes about this task" />
          </FormSection>
        </div>

        <div className="sticky bottom-0 -mx-5 mt-6 border-t bg-popover px-5 pt-4 pb-1">
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Creating…" : "Create Task"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-overline text-muted-foreground">{title}</span>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}
