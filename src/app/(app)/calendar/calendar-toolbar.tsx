"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calendarViewValues, type CalendarView } from "@/app/(app)/calendar/calendar-search-params";
import {
  hasActiveTaskFilters,
  resolveAnchorDate,
  shiftAnchorDate,
  toQueryDate,
} from "@/app/(app)/calendar/calendar-utils";
import { CalendarMultiSelectFilter } from "@/app/(app)/calendar/calendar-multi-select-filter";
import { CalendarSyncButton } from "@/app/(app)/calendar/calendar-sync-button";
import type { CalendarQueryState } from "@/app/(app)/calendar/calendar-query-state";
import type { DataTableFilterOption } from "@/components/data-table/table-features";
import { cn } from "@/lib/utils";

const VIEW_LABELS: Record<CalendarView, string> = { day: "Day", week: "Week", month: "Month" };

// "Season: SS27, AW27" — the option labels, not the raw ids in the URL, for the Sync
// confirmation's list of what's being narrowed.
function filterLine(title: string, selected: string[], options: DataTableFilterOption[]) {
  if (selected.length === 0) return null;
  const labels = selected.map((value) => options.find((option) => option.value === value)?.label ?? value);
  return `${title}: ${labels.join(", ")}`;
}

function rangeLabel(view: CalendarView, anchorDate: Date) {
  if (view === "day") return format(anchorDate, "EEEE, d MMMM yyyy");
  return format(anchorDate, "MMMM yyyy");
}

interface CalendarToolbarProps {
  queryState: CalendarQueryState;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  partyOptions: DataTableFilterOption[];
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
  partyOptions,
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

  const syncFilters = {
    seasonId: state.seasonId,
    brandId: state.brandId,
    status: state.status,
    gender: state.gender,
    owner: state.owner,
    involved: state.involved,
    countries: state.countries,
  };
  const activeFilterLines = [
    filterLine("Season", state.seasonId, seasonOptions),
    filterLine("Brand", state.brandId, brandOptions),
    filterLine("Status", state.status, statusOptions),
    filterLine("Gender", state.gender, genderOptions),
    filterLine("Owner", state.owner, partyOptions),
    filterLine("People Involved", state.involved, partyOptions),
    filterLine("Holiday country", state.countries, holidayCountryOptions),
  ].filter((line): line is string => line !== null);

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
          <CalendarSyncButton
            filters={syncFilters}
            activeFilterLines={activeFilterLines}
            isSyncing={isSyncing}
            onSyncingChange={onSyncingChange}
          />
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
          title="Owner"
          allLabel="All Owners"
          selected={state.owner}
          options={partyOptions}
          onChange={(next) => void setState({ owner: next.length > 0 ? next : null })}
        />
        <CalendarMultiSelectFilter
          title="People Involved"
          allLabel="All People Involved"
          selected={state.involved}
          options={partyOptions}
          onChange={(next) => void setState({ involved: next.length > 0 ? next : null })}
        />
        <CalendarMultiSelectFilter
          icon={<PartyPopper className="size-4" />}
          title="Country"
          allLabel="All Holidays"
          selected={state.countries}
          options={holidayCountryOptions}
          onChange={(next) => void setState({ countries: next.length > 0 ? next : null })}
        />
        {hasActiveTaskFilters(state) ? (
          <Button
            type="button"
            variant="link"
            className="px-1 text-primary transition-opacity duration-150 hover:opacity-70"
            onClick={() =>
              void setState({ seasonId: null, brandId: null, status: null, gender: null, owner: null, involved: null })
            }
          >
            Clear Filters
          </Button>
        ) : null}
      </div>
    </div>
  );
};
