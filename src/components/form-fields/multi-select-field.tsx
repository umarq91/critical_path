"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";

interface MultiSelectFieldOption {
  label: string;
  value: string;
}

interface MultiSelectFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  options: MultiSelectFieldOption[];
  placeholder?: string;
  description?: string;
}

export const MultiSelectField = <TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  description,
}: MultiSelectFieldProps<TFieldValues>) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const current: string[] = Array.isArray(field.value) ? field.value : [];
        const toggle = (value: string) => {
          field.onChange(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
        };
        const selectedLabels = options.filter((option) => current.includes(option.value)).map((option) => option.label);

        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(buttonVariants({ variant: "outline" }), "w-full min-w-0 justify-start font-normal")}
                aria-invalid={!!fieldState.error}
              >
                <span className="min-w-0 truncate">
                  {selectedLabels.length > 0 ? selectedLabels.join(", ") : (placeholder ?? `Select ${label.toLowerCase()}`)}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-(--anchor-width)">
                {options.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={current.includes(option.value)}
                    onCheckedChange={() => toggle(option.value)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {description ? <FormDescription>{description}</FormDescription> : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};
