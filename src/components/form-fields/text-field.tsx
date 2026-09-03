"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";

interface TextFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  description?: string;
  type?: "text" | "email" | "password";
}

export const TextField = <TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  type = "text",
}: TextFieldProps<TFieldValues>) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const isPassword = type === "password";
  // Reveal swaps the input's own type rather than rendering a second field, so react-hook-form
  // keeps one registration and the value survives toggling.
  const resolvedType = isPassword && isRevealed ? "text" : type;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className={cn(isPassword && "relative")}>
            <Input
              {...field}
              value={field.value ?? ""}
              type={resolvedType}
              placeholder={placeholder}
              aria-invalid={!!fieldState.error}
              // Room for the toggle, so a long password doesn't run underneath it.
              className={cn(isPassword && "pr-9")}
            />
            {isPassword ? (
              <button
                type="button"
                onClick={() => setIsRevealed((revealed) => !revealed)}
                // tabIndex -1: the toggle sits between the password field and the submit
                // button, and tabbing into it on the way to submitting is more annoying than
                // the shortcut is worth. Still clickable, still labelled for screen readers.
                tabIndex={-1}
                aria-label={isRevealed ? "Hide password" : "Show password"}
                aria-pressed={isRevealed}
                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                {isRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            ) : null}
          </div>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
