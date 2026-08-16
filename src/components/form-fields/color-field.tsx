"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { VIZ_COLORS } from "@/constants/chart-colors";
import { cn } from "@/lib/utils";

interface ColorFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
}

export const ColorField = <TFieldValues extends FieldValues>({ control, name, label }: ColorFieldProps<TFieldValues>) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex flex-wrap items-center gap-2">
            {VIZ_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => field.onChange(color)}
                className={cn(
                  "size-7 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-background transition-shadow",
                  field.value === color && "ring-foreground"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
