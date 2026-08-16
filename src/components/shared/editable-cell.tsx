"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EditableCellOption {
  label: string;
  value: string;
}

interface EditableCellProps {
  /** Currently-committed value, used for read-mode display and as the input's fallback. */
  value: string;
  /** Draft value while the row is being edited — controlled by the row's edit state. */
  draftValue?: string;
  onDraftChange?: (next: string) => void;
  /** Custom read-mode rendering (e.g. a StatusBadge) — falls back to the raw value. */
  display?: ReactNode;
  variant?: "text" | "select" | "date";
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

  const current = draftValue ?? value;

  if (variant === "select") {
    return (
      <Select value={current} onValueChange={(next) => next && onDraftChange?.(next)}>
        <SelectTrigger className="h-8 w-full" onClick={(event) => event.stopPropagation()}>
          <SelectValue />
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
