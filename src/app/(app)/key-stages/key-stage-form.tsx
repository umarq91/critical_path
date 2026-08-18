"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { TextareaField } from "@/components/form-fields/textarea-field";
import { keyStageSchema, type KeyStageInput } from "@/app/(app)/key-stages/schema";
import { createKeyStage } from "@/app/(app)/key-stages/_actions";

interface KeyStageFormProps {
  onSuccess: () => void;
}

export const KeyStageForm = ({ onSuccess }: KeyStageFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<KeyStageInput>({
    resolver: zodResolver(keyStageSchema),
    defaultValues: { name: "", description: "" },
  });

  async function onSubmit(input: KeyStageInput) {
    setIsSubmitting(true);
    const result = await createKeyStage(input);
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
          placeholder="What happens during this stage"
        />
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Creating…" : "Create Key Stage"}
        </Button>
      </form>
    </Form>
  );
};
