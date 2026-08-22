"use client";

import { format } from "date-fns";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calendarViewValues, type CalendarView } from "@/app/(app)/calendar/calendar-search-params";
import { resolveAnchorDate, shiftAnchorDate, toQueryDate } from "@/app/(app)/calendar/calendar-utils";
import { syncGoogleCalendar } from "@/app/(app)/calendar/_actions";
import type { CalendarQueryState } from "@/app/(app)/calendar/calendar-query-state";
import type { DataTableFilterOption } from "@/components/data-table/table-features";
import { cn } from "@/lib/utils";

const ALL_VALUE = "__all__";

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
  taskCount: number;
  isSyncing: boolean;
  onSyncingChange: (isSyncing: boolean) => void;
}

export const CalendarToolbar = ({
  queryState,
  seasonOptions,
  brandOptions,
  statusOptions,
  taskCount,
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
    const parts = [
      result.pushedCount > 0 ? `${result.pushedCount} pushed` : null,
      result.pulledCount > 0 ? `${result.pulledCount} pulled` : null,
      result.importedCount > 0 ? `${result.importedCount} imported` : null,
    ].filter(Boolean);
    toast.success(parts.length > 0 ? `Synced with Google Calendar — ${parts.join(", ")}` : "Already up to date with Google Calendar");
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
        <Button type="button" size="sm" variant="outline" className="transition-colors duration-150" onClick={handleSync} disabled={isSyncing}>
          <RefreshCw className={cn("size-4", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing…" : "Sync"}
        </Button>
        <CalendarFilterSelect
          label="Season"
          value={state.seasonId}
          options={seasonOptions}
          onChange={(value) => void setState({ seasonId: value })}
        />
        <CalendarFilterSelect
          label="Brand"
          value={state.brandId}
          options={brandOptions}
          onChange={(value) => void setState({ brandId: value })}
        />
        <CalendarFilterSelect
          label="Status"
          value={state.status}
          options={statusOptions}
          onChange={(value) => void setState({ status: value })}
        />
        {state.seasonId || state.brandId || state.status ? (
          <Button
            type="button"
            variant="link"
            className="px-1 text-primary transition-opacity duration-150 hover:opacity-70"
            onClick={() => void setState({ seasonId: null, brandId: null, status: null })}
          >
            Clear Filters
          </Button>
        ) : null}
      </div>
    </div>
  );
};

function CalendarFilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: DataTableFilterOption[];
  onChange: (value: string | null) => void;
}) {
  const current = value || ALL_VALUE;
  const allLabel = `All ${label}`;

  return (
    <Select value={current} onValueChange={(next) => onChange(next === ALL_VALUE ? null : next)}>
      <SelectTrigger className="h-10 transition-colors duration-150" aria-label={`Filter by ${label.toLowerCase()}`}>
        <SelectValue>
          {(value: string) => (value === ALL_VALUE ? allLabel : (options.find((option) => option.value === value)?.label ?? value))}
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
}
