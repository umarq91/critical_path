"use client";

import { ChevronLeft, ChevronRight, PartyPopper, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/shared/filter-select";
import { MultiFilterSelect } from "@/components/shared/multi-filter-select";
import { timelineViewValues, type TimelineView } from "@/app/(app)/timeline/timeline-search-params";
import {
  containsRange,
  getTimelineRange,
  periodLabel,
  resolveAnchorDate,
  shiftAnchorDate,
  toQueryDate,
  type TimelineRange,
} from "@/app/(app)/timeline/timeline-utils";
import type { FilterSelectOption } from "@/components/shared/filter-select";
import { cn } from "@/lib/utils";

const VIEW_LABELS: Record<TimelineView, string> = {
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

/** The values this toolbar drives. They live in the URL on /timeline (nuqs) and in component
 *  state on the Dashboard's preview card — the toolbar doesn't care which. */
export interface TimelineControls {
  view: TimelineView;
  date: string;
  /** The five filters below are multi-select: each holds its selected values joined with
   *  MULTI_FILTER_DELIMITER (constants/data-table-filters.ts), the Tasks grid's encoding. */
  seasonId: string;
  brandId: string;
  keyStageId: string;
  /** `kind:uuid` party keys — see lib/party.ts. */
  owner: string;
  /** `kind:uuid` party keys, matched against the `involved` participant role. */
  involved: string;
  /** Free-text term, matched against task name, key stage, owners and people involved. */
  search: string;
  /** Single-select "yes" / "no" (CRITICAL_FILTER_OPTIONS); empty means every task. */
  critical: string;
  /** Which countries' public holidays are marked — not a task filter, so Clear leaves it. */
  countries: string;
}

/** `null` resets a value to its default — what the Today and Clear buttons send. */
export type TimelineControlsPatch = Partial<{
  [K in keyof TimelineControls]: TimelineControls[K] | null;
}>;

interface TimelineToolbarProps {
  state: TimelineControls;
  setState: (patch: TimelineControlsPatch) => void;
  isPending?: boolean;
  seasonOptions: FilterSelectOption[];
  brandOptions: FilterSelectOption[];
  /** Each filter renders only when it is given options, so a consumer that can't answer it
   *  server-side (the Dashboard preview, which narrows already-fetched tasks in the browser)
   *  simply omits it rather than showing a control that would quietly do nothing. */
  keyStageOptions?: FilterSelectOption[];
  ownerOptions?: FilterSelectOption[];
  involvedOptions?: FilterSelectOption[];
  criticalOptions?: FilterSelectOption[];
  /** Countries with at least one public holiday; omitted where no holidays are drawn. */
  holidayCountryOptions?: FilterSelectOption[];
  /** Renders the search box. Off by default — it narrows a list the consumer is expected to
   *  page through, which a fixed-size preview isn't. */
  enableSearch?: boolean;
  /** Tasks matching everything currently applied — filters and search included. */
  taskCount: number;
  /** Zoom levels offered. Defaults to all four; a consumer holding one fixed band of data
   *  passes the subset its fetch can actually fill. */
  views?: readonly TimelineView[];
  /** Clamps Prev/Next to an already-fetched window. Omitted on /timeline, which re-queries per
   *  step and so can travel anywhere; set by the Dashboard preview, which cannot. */
  band?: TimelineRange;
  /** Drops the period label to card-title weight. On /timeline it is the largest thing under the
   *  page header; inside a card it would otherwise out-size the card's own title. */
  compact?: boolean;
  className?: string;
}

export const TimelineToolbar = ({
  state,
  setState,
  isPending = false,
  seasonOptions,
  brandOptions,
  keyStageOptions,
  ownerOptions,
  involvedOptions,
  criticalOptions,
  holidayCountryOptions,
  enableSearch = false,
  taskCount,
  views = timelineViewValues,
  band,
  compact = false,
  className,
}: TimelineToolbarProps) => {
  const anchorDate = resolveAnchorDate(state.date);
  const range = getTimelineRange(state.view, anchorDate);
  const hasFilters = !!(state.seasonId || state.brandId || state.keyStageId || state.owner || state.involved || state.critical || state.search);

  function nextRange(direction: 1 | -1) {
    return getTimelineRange(state.view, shiftAnchorDate(state.view, anchorDate, direction));
  }

  function canShift(direction: 1 | -1) {
    return !band || containsRange(band, nextRange(direction));
  }

  function shift(direction: 1 | -1) {
    setState({ date: toQueryDate(shiftAnchorDate(state.view, anchorDate, direction)) });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              disabled={!canShift(-1)}
              onClick={() => shift(-1)}
              aria-label="Previous period"
            >
              <ChevronLeft />
            </Button>
            {/* date: null clears the value, so the range resolves to "today" at render time. */}
            <Button type="button" size="sm" variant="outline" onClick={() => setState({ date: null })}>
              Today
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              disabled={!canShift(1)}
              onClick={() => shift(1)}
              aria-label="Next period"
            >
              <ChevronRight />
            </Button>
          </div>
          <div className={cn("flex flex-wrap items-baseline gap-2 transition-opacity duration-200", isPending && "opacity-60")}>
            <span className={cn(compact ? "text-h3" : "text-h2", "text-foreground")}>
              {periodLabel(state.view, range, anchorDate)}
            </span>
            <span className="text-sm text-muted-foreground">
              {taskCount} {taskCount === 1 ? "task" : "tasks"}
            </span>
          </div>
        </div>

        <div className="flex items-center rounded-lg border border-border p-0.5">
          {views.map((view) => (
            <Button
              key={view}
              type="button"
              size="sm"
              variant={state.view === view ? "default" : "ghost"}
              className="rounded-md"
              aria-pressed={state.view === view}
              onClick={() => setState({ view })}
            >
              {VIEW_LABELS[view]}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {enableSearch ? (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={state.search}
              onChange={(event) => setState({ search: event.target.value })}
              placeholder="Search task, key stage, owner or person"
              aria-label="Search tasks"
              className="h-8 w-80 pl-8"
            />
          </div>
        ) : null}
        <MultiFilterSelect
          value={state.seasonId}
          onValueChange={(value) => setState({ seasonId: value ?? null })}
          options={seasonOptions}
          title="Season"
          allLabel="All Seasons"
          className="h-8"
        />
        <MultiFilterSelect
          value={state.brandId}
          onValueChange={(value) => setState({ brandId: value ?? null })}
          options={brandOptions}
          title="Brand"
          allLabel="All Brands"
          className="h-8"
        />
        {keyStageOptions ? (
          <MultiFilterSelect
            value={state.keyStageId}
            onValueChange={(value) => setState({ keyStageId: value ?? null })}
            options={keyStageOptions}
            title="Key Stage"
            allLabel="All Key Stages"
            className="h-8"
          />
        ) : null}
        {ownerOptions ? (
          <MultiFilterSelect
            value={state.owner}
            onValueChange={(value) => setState({ owner: value ?? null })}
            options={ownerOptions}
            title="Owner"
            allLabel="All Owners"
            className="h-8"
          />
        ) : null}
        {involvedOptions ? (
          <MultiFilterSelect
            value={state.involved}
            onValueChange={(value) => setState({ involved: value ?? null })}
            options={involvedOptions}
            title="People Involved"
            allLabel="All People Involved"
            className="h-8"
          />
        ) : null}
        {criticalOptions ? (
          <FilterSelect
            value={state.critical || null}
            onValueChange={(value) => setState({ critical: value })}
            options={criticalOptions}
            allLabel="All Tasks"
          />
        ) : null}
        {holidayCountryOptions ? (
          <div className="flex items-center gap-1.5">
            <PartyPopper className="size-4 text-accent-teal" aria-hidden />
            <MultiFilterSelect
              value={state.countries}
              onValueChange={(value) => setState({ countries: value ?? null })}
              options={holidayCountryOptions}
              title="Holiday Country"
              allLabel="All Holidays"
              className="h-8"
            />
          </div>
        ) : null}
        {hasFilters ? (
          <Button
            type="button"
            variant="link"
            className="px-1 text-primary"
            onClick={() =>
              setState({
                seasonId: null,
                brandId: null,
                keyStageId: null,
                owner: null,
                involved: null,
                critical: null,
                search: null,
              })
            }
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
};
