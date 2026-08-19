"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { TextareaField } from "@/components/form-fields/textarea-field";
import { departmentSchema, type DepartmentInput } from "@/app/(app)/departments/schema";
import { createDepartment } from "@/app/(app)/departments/_actions";

interface DepartmentFormProps {
  onSuccess: () => void;
}

export const DepartmentForm = ({ onSuccess }: DepartmentFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<DepartmentInput>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: "", description: "" },
  });

  async function onSubmit(input: DepartmentInput) {
    setIsSubmitting(true);
    const result = await createDepartment(input);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${input.name} created`);
    form.reset();
    onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <TextField control={form.control} name="name" label="Name" placeholder="Design & Development" />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          placeholder="What this department is responsible for"
        />
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Creating…" : "Create Department"}
        </Button>
      </form>
    </Form>
  );
};
