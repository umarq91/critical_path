"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { ColorField } from "@/components/form-fields/color-field";
import { seasonSchema, type SeasonInput } from "@/app/(app)/seasons/schema";
import { createSeason } from "@/app/(app)/seasons/_actions";
import { VIZ_COLORS } from "@/constants/chart-colors";

interface SeasonFormProps {
  onSuccess: () => void;
}

export const SeasonForm = ({ onSuccess }: SeasonFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<SeasonInput>({
    resolver: zodResolver(seasonSchema),
    defaultValues: {
      season: "",
      color: VIZ_COLORS[0],
    },
  });

  async function onSubmit(input: SeasonInput) {
    setIsSubmitting(true);
    const result = await createSeason(input);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${input.season} created`);
    form.reset();
    onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <TextField control={form.control} name="season" label="Season" placeholder="RES H2'26" />
        <ColorField control={form.control} name="color" label="Colour" />
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Creating…" : "Create Season"}
        </Button>
      </form>
    </Form>
  );
};
