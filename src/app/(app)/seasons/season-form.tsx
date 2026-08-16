"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { SelectField } from "@/components/form-fields/select-field";
import { DateField } from "@/components/form-fields/date-field";
import { ColorField } from "@/components/form-fields/color-field";
import { seasonSchema, seasonStatusValues, type SeasonInput } from "@/app/(app)/seasons/schema";
import { createSeason } from "@/app/(app)/seasons/_actions";
import { SEASON_STATUS_CONFIG } from "@/constants/season-status";
import { VIZ_COLORS } from "@/constants/chart-colors";

interface SeasonFormProps {
  onSuccess: () => void;
}

export const SeasonForm = ({ onSuccess }: SeasonFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<SeasonInput>({
    resolver: zodResolver(seasonSchema),
    defaultValues: {
      season_code: "",
      season_name: "",
      status: "planning",
      start_date: "",
      end_date: "",
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

    toast.success(`${input.season_name} created`);
    form.reset();
    onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <TextField control={form.control} name="season_code" label="Season Code" placeholder="RES H2'26" />
        <TextField control={form.control} name="season_name" label="Season Name" placeholder="Winter 2026" />
        <div className="grid grid-cols-2 gap-3">
          <DateField control={form.control} name="start_date" label="Start Date" />
          <DateField control={form.control} name="end_date" label="End Date" />
        </div>
        <SelectField
          control={form.control}
          name="status"
          label="Status"
          options={seasonStatusValues.map((value) => ({ value, label: SEASON_STATUS_CONFIG[value].label }))}
        />
        <ColorField control={form.control} name="color" label="Colour" />
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Creating…" : "Create Season"}
        </Button>
      </form>
    </Form>
  );
};
