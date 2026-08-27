"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  /** null means "no filter" — the `allLabel` entry is selected. */
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: FilterSelectOption[];
  /** The "show everything" entry, e.g. "All Seasons". */
  allLabel: string;
  className?: string;
}

// A sentinel rather than "" — Base UI's Select treats an empty value as "nothing selected",
// which would leave the trigger blank instead of showing the "All X" entry.
const ALL_VALUE = "__all__";

// The same dropdown <DataTableToolbar> renders for a table column, minus the table: for
// filter UIs that aren't backed by a @tanstack column — the Dashboard's per-card scopes,
// which narrow already-loaded data in the browser rather than re-querying.
export const FilterSelect = ({ value, onValueChange, options, allLabel, className }: FilterSelectProps) => {
  return (
    <Select
      value={value ?? ALL_VALUE}
      onValueChange={(next: string | null) => onValueChange(!next || next === ALL_VALUE ? null : next)}
    >
      <SelectTrigger size="sm" className={cn("h-8", className)}>
        {/* children render-fn rather than the `placeholder` prop — relying on SelectItem
            registration timing prints an option's raw value (a uuid) before it mounts. */}
        <SelectValue>
          {(current: string) =>
            current === ALL_VALUE
              ? allLabel
              : (options.find((option) => option.value === current)?.label ?? current)
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
