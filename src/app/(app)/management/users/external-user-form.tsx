"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { SelectField } from "@/components/form-fields/select-field";
import { createExternalUser } from "@/app/(app)/management/users/_actions";
import { externalUserSchema, type ExternalUserInput } from "@/app/(app)/management/users/schema";

const NO_DEPARTMENT = "none";

interface ExternalUserFormProps {
  departmentOptions: { value: string; label: string }[];
  onSuccess: () => void;
}

export const ExternalUserForm = ({ departmentOptions, onSuccess }: ExternalUserFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExternalUserInput>({
    resolver: zodResolver(externalUserSchema),
    defaultValues: { email: "", full_name: "", password: "", department_id: NO_DEPARTMENT },
  });

  async function onSubmit(input: ExternalUserInput) {
    setIsSubmitting(true);
    const result = await createExternalUser(input);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${input.full_name} can now sign in with their email and password`);
    form.reset();
    onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <TextField control={form.control} name="full_name" label="Name" placeholder="Jane Doe" />
        <TextField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          placeholder="jane@partner.com"
          description="Must be outside the company Google Workspace — staff sign in with Google instead."
        />
        <TextField
          control={form.control}
          name="password"
          label="Password"
          type="password"
          description="At least 6 characters. Share it with them directly; there is no invitation email."
        />
        <SelectField
          control={form.control}
          name="department_id"
          label="Department"
          options={[{ value: NO_DEPARTMENT, label: "No department" }, ...departmentOptions]}
          description="Optional. A department also grants access to tasks owned by that department."
        />
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Creating…" : "Create External User"}
        </Button>
      </form>
    </Form>
  );
};
