"use client";

import { useMemo, type ReactNode } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import type { FilterSelectOption } from "@/components/shared/filter-select";
import { compareLabels } from "@/lib/utils";

interface SearchableFilterSelectProps {
  /** Selected option values; empty means "no filter". Single mode holds at most one. */
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  options: FilterSelectOption[];
  multiple?: boolean;
  /** Names the filter in the search placeholder and the "Title (2)" trigger label. */
  title: string;
  /** The "show everything" label, e.g. "All Seasons". */
  allLabel: string;
  /** Each caller passes the classes of the trigger it replaces, so swapping a filter to
   *  searchable doesn't change how the toolbar looks. */
  triggerClassName: string;
  icon?: ReactNode;
  showChevron?: boolean;
  align?: "start" | "end";
  ariaLabel?: string;
}

// <SelectTrigger>'s look (components/ui/select.tsx), for callers swapping a Select for this.
// Height is left to the caller, matching how each toolbar already sizes its Selects.
export const SELECT_LIKE_TRIGGER_CLASSNAME =
  "flex w-fit min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50";

// Sentinel rather than null — in single mode "All" is a real, pickable row, same as <FilterSelect>.
const ALL_VALUE = "__all__";

// The searchable variant shared by <FilterSelect>, <MultiFilterSelect>, <DataTableToolbar> and
// the Calendar's filters (`searchable` on each): Base UI's Combobox with the input inside the
// popup, since a text box inside a Select or Menu fights their own typeahead/focus handling.
// Options are always listed A–Z, whatever order they arrive in.
export const SearchableFilterSelect = ({
  selected,
  onSelectedChange,
  options,
  multiple = false,
  title,
  allLabel,
  triggerClassName,
  icon,
  showChevron = false,
  align = "start",
  ariaLabel,
}: SearchableFilterSelectProps) => {
  const labels = useMemo(() => new Map(options.map((option) => [option.value, option.label])), [options]);
  const sortedValues = useMemo(
    () => [...options].sort((a, b) => compareLabels(a.label, b.label)).map((option) => option.value),
    [options]
  );
  const labelOf = (value: string) => (value === ALL_VALUE ? allLabel : (labels.get(value) ?? value));
  const filter = (value: string, query: string) =>
    value === ALL_VALUE || labelOf(value).toLowerCase().includes(query.trim().toLowerCase());

  const triggerLabel =
    selected.length === 0 ? allLabel : selected.length === 1 ? labelOf(selected[0]) : `${title} (${selected.length})`;

  const trigger = (
    <Combobox.Trigger className={triggerClassName} aria-label={ariaLabel}>
      {icon}
      <span className="truncate">{triggerLabel}</span>
      {showChevron ? <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" /> : null}
    </Combobox.Trigger>
  );

  const popup = (
    <Combobox.Portal>
      <Combobox.Positioner align={align} sideOffset={4} className="isolate z-50 outline-none">
        <Combobox.Popup className="w-max max-w-sm min-w-56 origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="flex items-center gap-2 border-b border-border px-2.5">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <Combobox.Input
              placeholder={`Search ${title.toLowerCase()}...`}
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Combobox.Empty className="px-2.5 py-2 text-sm text-muted-foreground empty:hidden">No matches</Combobox.Empty>
          <Combobox.List className="max-h-72 overflow-y-auto overscroll-contain p-1 data-empty:hidden">
            {(value: string) => (
              <Combobox.Item
                key={value}
                value={value}
                className="relative flex cursor-default items-center rounded-md py-2 pr-8 pl-2.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
              >
                {labelOf(value)}
                <Combobox.ItemIndicator className="pointer-events-none absolute right-2 flex items-center">
                  <CheckIcon className="size-4" />
                </Combobox.ItemIndicator>
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );

  if (multiple) {
    return (
      <Combobox.Root
        multiple
        items={sortedValues}
        value={selected}
        onValueChange={(next: string[]) => onSelectedChange(next)}
        itemToStringLabel={labelOf}
        filter={filter}
      >
        {trigger}
        {popup}
      </Combobox.Root>
    );
  }

  return (
    <Combobox.Root
      items={[ALL_VALUE, ...sortedValues]}
      value={selected[0] ?? ALL_VALUE}
      onValueChange={(next: string | null) => onSelectedChange(!next || next === ALL_VALUE ? [] : [next])}
      itemToStringLabel={labelOf}
      filter={filter}
    >
      {trigger}
      {popup}
    </Combobox.Root>
  );
};
