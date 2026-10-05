"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { decodeMultiFilterValue, encodeMultiFilterValue } from "@/constants/data-table-filters";
import { cn } from "@/lib/utils";
import type { FilterSelectOption } from "@/components/shared/filter-select";

interface MultiFilterSelectProps {
  /** The selected option values joined with MULTI_FILTER_DELIMITER (constants/data-table-
   *  filters.ts); empty or undefined means "no filter". */
  value: string | undefined;
  /** Receives the re-joined selection, or undefined once nothing is ticked. */
  onValueChange: (value: string | undefined) => void;
  options: FilterSelectOption[];
  /** Names the filter in the menu header and in the "Title (2)" trigger label. */
  title: string;
  /** The "show everything" trigger label, e.g. "All Seasons". */
  allLabel: string;
  className?: string;
}

// The multi-select twin of <FilterSelect>: a checkbox menu whose selection is a union (any of
// the ticked values). One implementation for <DataTableToolbar>'s `multiple` filters and for
// filter UIs with no @tanstack column behind them (the Timeline toolbar).
export const MultiFilterSelect = ({
  value,
  onValueChange,
  options,
  title,
  allLabel,
  className,
}: MultiFilterSelectProps) => {
  const selected = decodeMultiFilterValue(value);
  const toggleOption = (optionValue: string, checked: boolean) => {
    const next = checked ? [...selected, optionValue] : selected.filter((current) => current !== optionValue);
    onValueChange(encodeMultiFilterValue(next));
  };
  const triggerLabel =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (options.find((option) => option.value === selected[0])?.label ?? selected[0])
        : `${title} (${selected.length})`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "outline" }), "h-10 min-w-0 justify-between gap-2 font-normal", className)}
      >
        {triggerLabel}
      </DropdownMenuTrigger>
      {/* min-w-56 overrides the primitive's default w-(--anchor-width) — that ties the
          popup's width to the trigger button's, which shrinks to fit whatever short
          label ("All X" / "X (2)") it currently shows, squeezing genuinely long option
          labels (department/person/season labels) into a too-narrow list. min-width
          doesn't fight the anchor-width class (different CSS property), it just puts a
          floor under it. */}
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{title}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) => toggleOption(option.value, !!checked)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
