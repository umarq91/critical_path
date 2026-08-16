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
          {/* Always a defined string, never undefined — see data-table-toolbar.tsx for why an
              undefined-then-defined value trips Base UI's controlled-state warning. In
              practice every form here sets a real defaultValue, so this is a defensive
              fallback for the next form that doesn't. */}
          <Select value={field.value ?? ""} onValueChange={field.onChange}>
            <SelectTrigger className="w-full" aria-invalid={!!fieldState.error}>
              {/* children render-fn resolves the label ourselves instead of relying on
                  SelectItem registration timing — see data-table-toolbar.tsx for the same
                  fix; without it, an option whose SelectItem hasn't mounted yet prints its
                  raw value (e.g. a season's uuid) instead of its label. */}
              <SelectValue>
                {(current: string) =>
                  current ? (options.find((option) => option.value === current)?.label ?? current) : (placeholder ?? `Select ${label.toLowerCase()}`)
                }
              </SelectValue>
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
