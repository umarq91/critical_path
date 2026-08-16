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
import { ColorField } from "@/components/form-fields/color-field";
import { brandSchema, brandStatusValues, type BrandInput } from "@/app/(app)/brands/schema";
import { createBrand } from "@/app/(app)/brands/_actions";
import { BRAND_STATUS_CONFIG } from "@/constants/brand-status";
import { VIZ_COLORS } from "@/constants/chart-colors";
import type { listSeasonOptions } from "@/data/seasons";

interface BrandFormProps {
  onSuccess: () => void;
  seasonOptions: Awaited<ReturnType<typeof listSeasonOptions>>;
}

export const BrandForm = ({ onSuccess, seasonOptions }: BrandFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<BrandInput>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      brand_code: "",
      brand_name: "",
      description: "",
      status: "active",
      color: VIZ_COLORS[0],
      season_id: seasonOptions[0]?.id ?? "",
    },
  });

  async function onSubmit(input: BrandInput) {
    setIsSubmitting(true);
    const result = await createBrand(input);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${input.brand_name} created`);
    form.reset();
    onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <TextField control={form.control} name="brand_name" label="Brand Name" placeholder="Brand A" />
        <TextField control={form.control} name="brand_code" label="Code" placeholder="BR-A" />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          placeholder="Premium lifestyle brand"
        />
        <SelectField
          control={form.control}
          name="status"
          label="Status"
          options={brandStatusValues.map((value) => ({ value, label: BRAND_STATUS_CONFIG[value].label }))}
        />
        <ColorField control={form.control} name="color" label="Colour" />
        <SelectField
          control={form.control}
          name="season_id"
          label="Season"
          options={seasonOptions.map((season) => ({ value: season.id, label: season.season_name }))}
        />
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Creating…" : "Create Brand"}
        </Button>
      </form>
    </Form>
  );
};
