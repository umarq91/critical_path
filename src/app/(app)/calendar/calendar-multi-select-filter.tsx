"use client";

import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { DataTableFilterOption } from "@/components/data-table/table-features";
import { cn } from "@/lib/utils";

// Every Calendar filter is multi-select — one component drives all seven (Season/Brand/Status/
// Gender/Owner/People Involved/Holiday Country) rather than a near-duplicate per filter. Unchecked by default, exactly
// like the Tasks grid's own `multiple: true` toolbar filters (data-table-toolbar.tsx): nothing
// selected still means "show everything" in query terms, but the checkboxes themselves only ever
// reflect what was actually clicked — no "empty selection displays as all-checked" trick.
export const CalendarMultiSelectFilter = ({
  icon,
  title,
  /** Trigger label when nothing is selected, e.g. "All Seasons". */
  allLabel,
  selected,
  options,
  onChange,
}: {
  icon?: ReactNode;
  title: string;
  allLabel: string;
  selected: string[];
  options: DataTableFilterOption[];
  onChange: (next: string[]) => void;
}) => {
  if (options.length === 0) return null;

  function toggle(value: string, checked: boolean) {
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value));
  }

  // Same three-state label as data-table-toolbar.tsx's own multi-select filters: the "all"
  // label, the one selected option's own name, or "Title (N)" once there's more than one.
  const triggerLabel =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (options.find((option) => option.value === selected[0])?.label ?? selected[0])
        : `${title} (${selected.length})`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "outline" }), "h-10 gap-2 transition-colors duration-150")}
        aria-label={`Filter by ${title.toLowerCase()}`}
      >
        {icon}
        {triggerLabel}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            onCheckedChange={(checked) => toggle(option.value, !!checked)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
