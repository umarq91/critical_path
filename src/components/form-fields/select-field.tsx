"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface SelectFieldOption {
  label: string;
  value: string;
}

interface SelectFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  options: SelectFieldOption[];
  placeholder?: string;
  description?: string;
}

export const SelectField = <TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  description,
}: SelectFieldProps<TFieldValues>) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={field.value ?? undefined} onValueChange={field.onChange}>
            <SelectTrigger className="w-full" aria-invalid={!!fieldState.error}>
              <SelectValue placeholder={placeholder ?? `Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
