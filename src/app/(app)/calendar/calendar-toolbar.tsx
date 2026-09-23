"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, PartyPopper, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { calendarViewValues, type CalendarView } from "@/app/(app)/calendar/calendar-search-params";
import { resolveAnchorDate, shiftAnchorDate, toQueryDate } from "@/app/(app)/calendar/calendar-utils";
import { syncGoogleCalendar } from "@/app/(app)/calendar/_actions";
import type { CalendarQueryState } from "@/app/(app)/calendar/calendar-query-state";
import type { DataTableFilterOption } from "@/components/data-table/table-features";
import { cn } from "@/lib/utils";

const VIEW_LABELS: Record<CalendarView, string> = { day: "Day", week: "Week", month: "Month" };

function rangeLabel(view: CalendarView, anchorDate: Date) {
  if (view === "day") return format(anchorDate, "EEEE, d MMMM yyyy");
  return format(anchorDate, "MMMM yyyy");
}

interface CalendarToolbarProps {
  queryState: CalendarQueryState;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  statusOptions: DataTableFilterOption[];
  genderOptions: DataTableFilterOption[];
  holidayCountryOptions: DataTableFilterOption[];
  taskCount: number;
  canSyncGoogleCalendar: boolean;
  isSyncing: boolean;
  onSyncingChange: (isSyncing: boolean) => void;
}

export const CalendarToolbar = ({
  queryState,
  seasonOptions,
  brandOptions,
  statusOptions,
  genderOptions,
  holidayCountryOptions,
  taskCount,
  canSyncGoogleCalendar,
  isSyncing,
  onSyncingChange,
}: CalendarToolbarProps) => {
  const { state, setState, isPending } = queryState;
  const anchorDate = resolveAnchorDate(state.date);

  function goToday() {
    void setState({ date: null });
  }

  function shift(direction: 1 | -1) {
    void setState({ date: toQueryDate(shiftAnchorDate(state.view, anchorDate, direction)) });
  }

  async function handleSync() {
    onSyncingChange(true);
    const result = await syncGoogleCalendar();
    onSyncingChange(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.tasksPushedCount === 0 && result.holidaysPushedCount === 0 && result.removedCount === 0) {
      toast.success("Google Calendar is already up to date");
      return;
    }
    // Skipped tasks aren't a failure: a task already lives on a co-owner's calendar, and one
    // task maps to exactly one event (see _actions.ts). Reported so the count adds up.
    const skipped = result.skippedCount > 0 ? `, ${result.skippedCount} already on a co-owner's calendar` : "";
    const pushedItems = [
      result.tasksPushedCount > 0 ? `${result.tasksPushedCount} ${result.tasksPushedCount === 1 ? "task" : "tasks"}` : "",
      result.holidaysPushedCount > 0
        ? `${result.holidaysPushedCount} ${result.holidaysPushedCount === 1 ? "holiday" : "holidays"}`
        : "",
    ].filter(Boolean);
    const pushed = pushedItems.length > 0 ? `Pushed ${pushedItems.join(" and ")} to Google Calendar${skipped}` : "";
    const removed =
      result.removedCount > 0
        ? `Removed ${result.removedCount} ${result.removedCount === 1 ? "task" : "tasks"} no longer yours from Google Calendar`
        : "";
    toast.success([pushed, removed].filter(Boolean).join(". "));
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border border-border p-0.5">
          {calendarViewValues.map((view) => (
            <Button
              key={view}
              type="button"
              size="sm"
              variant={state.view === view ? "default" : "ghost"}
              className="rounded-md transition-all duration-150"
              aria-pressed={state.view === view}
              onClick={() => void setState({ view })}
            >
              {VIEW_LABELS[view]}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="transition-transform duration-150 hover:-translate-x-0.5"
            onClick={() => shift(-1)}
            aria-label="Previous"
          >
            <ChevronLeft />
          </Button>
          <Button type="button" size="sm" variant="outline" className="transition-colors duration-150" onClick={goToday}>
            Today
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="transition-transform duration-150 hover:translate-x-0.5"
            onClick={() => shift(1)}
            aria-label="Next"
          >
            <ChevronRight />
          </Button>
        </div>
        <div className={cn("flex flex-wrap items-baseline gap-2 transition-opacity duration-200", isPending && "opacity-60")}>
          <span className="text-h2 text-foreground">{rangeLabel(state.view, anchorDate)}</span>
          <span className="text-sm text-muted-foreground">
            {taskCount} {taskCount === 1 ? "task" : "tasks"}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {canSyncGoogleCalendar ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="transition-colors duration-150"
            onClick={handleSync}
            disabled={isSyncing}
            title="Push your tasks to Google Calendar"
          >
            <RefreshCw className={cn("size-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing…" : "Sync to Google"}
          </Button>
        ) : null}
        <CalendarMultiSelectFilter
          title="Season"
          allLabel="All Seasons"
          selected={state.seasonId}
          options={seasonOptions}
          onChange={(next) => void setState({ seasonId: next.length > 0 ? next : null })}
        />
        <CalendarMultiSelectFilter
          title="Brand"
          allLabel="All Brands"
          selected={state.brandId}
          options={brandOptions}
          onChange={(next) => void setState({ brandId: next.length > 0 ? next : null })}
        />
        <CalendarMultiSelectFilter
          title="Status"
          allLabel="All Status"
          selected={state.status}
          options={statusOptions}
          onChange={(next) => void setState({ status: next.length > 0 ? next : null })}
        />
        <CalendarMultiSelectFilter
          title="Gender"
          allLabel="All Genders"
          selected={state.gender}
          options={genderOptions}
          onChange={(next) => void setState({ gender: next.length > 0 ? next : null })}
        />
        <CalendarMultiSelectFilter
          icon={<PartyPopper className="size-4" />}
          title="Country"
          allLabel="All Holidays"
          selected={state.countries}
          options={holidayCountryOptions}
          onChange={(next) => void setState({ countries: next.length > 0 ? next : null })}
        />
        {state.seasonId.length > 0 || state.brandId.length > 0 || state.status.length > 0 || state.gender.length > 0 ? (
          <Button
            type="button"
            variant="link"
            className="px-1 text-primary transition-opacity duration-150 hover:opacity-70"
            onClick={() => void setState({ seasonId: null, brandId: null, status: null, gender: null })}
          >
            Clear Filters
          </Button>
        ) : null}
      </div>
    </div>
  );
};

// Every Calendar filter is multi-select — one component drives all five (Season/Brand/Status/
// Gender/Holiday Country) rather than a near-duplicate per filter. Unchecked by default, exactly
// like the Tasks grid's own `multiple: true` toolbar filters (data-table-toolbar.tsx): nothing
// selected still means "show everything" in query terms, but the checkboxes themselves only ever
// reflect what was actually clicked — no "empty selection displays as all-checked" trick.
function CalendarMultiSelectFilter({
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
}) {
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
}
