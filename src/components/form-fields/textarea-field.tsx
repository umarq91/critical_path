"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface TextareaFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  description?: string;
}

export const TextareaField = <TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
}: TextareaFieldProps<TFieldValues>) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Textarea {...field} value={field.value ?? ""} placeholder={placeholder} aria-invalid={!!fieldState.error} />
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
