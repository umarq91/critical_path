"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { TextareaField } from "@/components/form-fields/textarea-field";
import { externalLinkSchema, type ExternalLinkInput } from "@/app/(app)/external-links/schema";
import { createExternalLink } from "@/app/(app)/external-links/_actions";

interface ExternalLinkFormProps {
  onSuccess: () => void;
}

export const ExternalLinkForm = ({ onSuccess }: ExternalLinkFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<ExternalLinkInput>({
    resolver: zodResolver(externalLinkSchema),
    defaultValues: { title: "", description: "", url: "" },
  });

  async function onSubmit(input: ExternalLinkInput) {
    setIsSubmitting(true);
    const result = await createExternalLink(input);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${input.title} added`);
    form.reset();
    onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <TextField control={form.control} name="title" label="Title" placeholder="Brand Shared Drive" />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          placeholder="What this link is for"
        />
        <TextField control={form.control} name="url" label="Link" placeholder="drive.google.com/…" />
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Adding…" : "Add Link"}
        </Button>
      </form>
    </Form>
  );
};
