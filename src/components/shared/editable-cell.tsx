"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VIZ_COLORS } from "@/constants/chart-colors";
import { cn } from "@/lib/utils";

interface EditableCellOption {
  label: string;
  value: string;
}

interface EditableCellProps {
  /** Currently-committed value, used for read-mode display and as the input's fallback. */
  value: string;
  /** Draft value while the row is being edited — controlled by the row's edit state. A
   *  "multi-select" variant's draft is string[]; every other variant's is string. */
  draftValue?: string | string[];
  onDraftChange?: (next: string | string[]) => void;
  /** Custom read-mode rendering (e.g. a StatusBadge) — falls back to the raw value. */
  display?: ReactNode;
  variant?: "text" | "select" | "date" | "multi-select" | "color";
  options?: EditableCellOption[];
  /** Whether this row is currently in edit mode — toggled by the row's pencil/tick button. */
  isEditing: boolean;
}

export const EditableCell = ({
  value,
  draftValue,
  onDraftChange,
  display,
  variant = "text",
  options,
  isEditing,
}: EditableCellProps) => {
  if (!isEditing) {
    return <>{display ?? value}</>;
  }

  if (variant === "multi-select") {
    const current = Array.isArray(draftValue) ? draftValue : [];
    const toggle = (optionValue: string) => {
      const next = current.includes(optionValue) ? current.filter((v) => v !== optionValue) : [...current, optionValue];
      onDraftChange?.(next);
    };
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "outline" }), "h-8 w-full justify-start font-normal")}
          onClick={(event) => event.stopPropagation()}
        >
          {current.length > 0 ? `${current.length} selected` : "Select…"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
          {options?.map((option) => (
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
    );
  }

  const current = typeof draftValue === "string" ? draftValue : value;

  if (variant === "color") {
    // A single swatch that opens the palette in a popover, rather than laying all 7 swatches
    // out inline — inline, a narrow ("xs") column wraps them onto several lines and balloons
    // the row's height. Same "compact trigger, expands on demand" shape as the select/
    // multi-select variants above.
    return (
      <div onClick={(event) => event.stopPropagation()}>
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label="Choose colour"
                className="size-6 shrink-0 rounded-full ring-2 ring-border ring-offset-1 ring-offset-background transition-shadow hover:ring-foreground"
                style={{ backgroundColor: current || undefined }}
              />
            }
          />
          <PopoverContent align="start" className="w-auto p-2" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-1.5">
              {VIZ_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  onClick={() => onDraftChange?.(color)}
                  className={cn(
                    "size-5 shrink-0 rounded-full ring-2 ring-transparent ring-offset-1 ring-offset-background transition-shadow",
                    current === color && "ring-foreground"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  if (variant === "select") {
    return (
      <Select value={current} onValueChange={(next) => next && onDraftChange?.(next)}>
        <SelectTrigger className="h-8 w-full" onClick={(event) => event.stopPropagation()}>
          {/* children render-fn resolves the label ourselves instead of relying on SelectItem
              registration timing — see select-field.tsx/data-table-toolbar.tsx for the same
              fix; without it, an option whose SelectItem hasn't mounted yet prints its raw
              value (e.g. a season's uuid) instead of its label. */}
          <SelectValue>{(value: string) => options?.find((option) => option.value === value)?.label ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options?.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      type={variant === "date" ? "date" : "text"}
      value={current}
      onChange={(event) => onDraftChange?.(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      className="h-8 w-full"
    />
  );
};
