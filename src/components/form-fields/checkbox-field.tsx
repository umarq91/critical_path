"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDescription, FormField, FormItem, FormMessage } from "@/components/ui/form";

interface CheckboxFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  description?: string;
}

// The label wraps the checkbox (rather than FormLabel's htmlFor) so clicking the text toggles it:
// Base UI's Checkbox renders a button, which an implicit <label> association activates.
export const CheckboxField = <TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
}: CheckboxFieldProps<TFieldValues>) => (
  <FormField
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <FormItem>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={!!field.value}
            onCheckedChange={(checked) => field.onChange(checked)}
            onBlur={field.onBlur}
            aria-invalid={!!fieldState.error}
          />
          {label}
        </label>
        {description ? <FormDescription>{description}</FormDescription> : null}
        <FormMessage />
      </FormItem>
    )}
  />
);
