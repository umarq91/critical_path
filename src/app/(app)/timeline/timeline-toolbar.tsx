"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/shared/filter-select";
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
  seasonId: string;
  brandId: string;
  keyStageId: string;
  /** `kind:uuid` party key — see lib/party.ts. */
  owner: string;
  /** `kind:uuid` party key, matched against the `involved` participant role. */
  involved: string;
  /** Free-text term, matched against task name, key stage, owners and people involved. */
  search: string;
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
  enableSearch = false,
  taskCount,
  views = timelineViewValues,
  band,
  compact = false,
  className,
}: TimelineToolbarProps) => {
  const anchorDate = resolveAnchorDate(state.date);
  const range = getTimelineRange(state.view, anchorDate);
  const hasFilters = !!(state.seasonId || state.brandId || state.keyStageId || state.owner || state.involved || state.search);

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
        <FilterSelect
          value={state.seasonId || null}
          onValueChange={(value) => setState({ seasonId: value })}
          options={seasonOptions}
          allLabel="All Seasons"
        />
        <FilterSelect
          value={state.brandId || null}
          onValueChange={(value) => setState({ brandId: value })}
          options={brandOptions}
          allLabel="All Brands"
        />
        {keyStageOptions ? (
          <FilterSelect
            value={state.keyStageId || null}
            onValueChange={(value) => setState({ keyStageId: value })}
            options={keyStageOptions}
            allLabel="All Key Stages"
          />
        ) : null}
        {ownerOptions ? (
          <FilterSelect
            value={state.owner || null}
            onValueChange={(value) => setState({ owner: value })}
            options={ownerOptions}
            allLabel="All Owners"
          />
        ) : null}
        {involvedOptions ? (
          <FilterSelect
            value={state.involved || null}
            onValueChange={(value) => setState({ involved: value })}
            options={involvedOptions}
            allLabel="All People Involved"
          />
        ) : null}
        {hasFilters ? (
          <Button
            type="button"
            variant="link"
            className="px-1 text-primary"
            onClick={() =>
              setState({ seasonId: null, brandId: null, keyStageId: null, owner: null, involved: null, search: null })
            }
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
};
