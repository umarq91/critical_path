"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface DateFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  description?: string;
}

export const DateField = <TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
}: DateFieldProps<TFieldValues>) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Input {...field} value={field.value ?? ""} type="date" aria-invalid={!!fieldState.error} />
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
