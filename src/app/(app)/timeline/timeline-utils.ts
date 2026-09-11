import {
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  getQuarter,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from "date-fns";
import { parseDateOnly } from "@/lib/dates";
import type { TimelineView } from "@/app/(app)/timeline/timeline-search-params";

// Monday-start weeks, matching how the rest of the app reads a working week.
export const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

// px per day — the one scale every band, bar and gridline is derived from, so zooming out is a
// change of this number plus a coarser header (see timeline-header.ts), not a second geometry.
// Month fits ~6 weeks on screen at 40px; Week spreads 7 days wide enough to carry a weekday
// label and a readable bar caption; Quarter lands a week column at 63px and Year a month column
// at ~90px, both wide enough for their label and narrow enough to avoid a second scrollbar.
export const DAY_WIDTH: Record<TimelineView, number> = { week: 150, month: 40, quarter: 9, year: 3 };
export const ROW_HEIGHT = 44;
export const TASK_COLUMN_WIDTH = 420;
// A same-day task would otherwise be a sliver in Month view; never render narrower than this.
const MIN_BAR_WIDTH = 18;

export interface TimelineRange {
  start: Date;
  end: Date;
}

export function resolveAnchorDate(dateParam: string) {
  if (!dateParam) return new Date();
  const parsed = parseISO(dateParam);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

// Month and Quarter pad out to whole weeks so their week-based header band never shows a
// partial column; Week is exactly the seven days, and Year is exactly Jan 1 – Dec 31 because
// its columns are months, which week-padding would cut in half at both ends.
export function getTimelineRange(view: TimelineView, anchorDate: Date): TimelineRange {
  if (view === "week") {
    return { start: startOfWeek(anchorDate, WEEK_OPTIONS), end: endOfWeek(anchorDate, WEEK_OPTIONS) };
  }
  if (view === "quarter") {
    return {
      start: startOfWeek(startOfQuarter(anchorDate), WEEK_OPTIONS),
      end: endOfWeek(endOfQuarter(anchorDate), WEEK_OPTIONS),
    };
  }
  if (view === "year") {
    return { start: startOfYear(anchorDate), end: endOfYear(anchorDate) };
  }
  return {
    start: startOfWeek(startOfMonth(anchorDate), WEEK_OPTIONS),
    end: endOfWeek(endOfMonth(anchorDate), WEEK_OPTIONS),
  };
}

export function shiftAnchorDate(view: TimelineView, anchorDate: Date, direction: 1 | -1): Date {
  const forward = direction === 1;
  if (view === "week") return forward ? addWeeks(anchorDate, 1) : subWeeks(anchorDate, 1);
  if (view === "quarter") return forward ? addQuarters(anchorDate, 1) : subQuarters(anchorDate, 1);
  if (view === "year") return forward ? addYears(anchorDate, 1) : subYears(anchorDate, 1);
  return forward ? addMonths(anchorDate, 1) : subMonths(anchorDate, 1);
}

export function toQueryDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

export function getTimelineDayCount(range: TimelineRange) {
  return differenceInCalendarDays(range.end, range.start) + 1;
}

interface DatedTask {
  start_date: string | null;
  end_date: string | null;
  due_date: string;
}

export interface BarRange {
  start: Date;
  end: Date;
  /** No start_date AND no end_date — the bar is a single-day marker on due_date, not a schedule. */
  isMilestone: boolean;
}

// start_date/end_date are both nullable while due_date is not (see supabase/schema.md), so
// due_date is the fallback for whichever end is missing. Without this an unscheduled task —
// the overwhelming majority in practice — simply wouldn't appear on the chart at all.
//
// The SQL mirror of this coalescing is timelineOverlapFilter() in data/tasks.ts; the two must
// stay in step or the query and the geometry will disagree about which tasks are visible.
export function timelineBarRange(task: DatedTask): BarRange {
  const due = parseDateOnly(task.due_date);
  const start = task.start_date ? parseDateOnly(task.start_date) : due;
  const rawEnd = task.end_date ? parseDateOnly(task.end_date) : due;

  return {
    start,
    // A row with end before start collapses to a single day rather than rendering a negative bar.
    end: rawEnd < start ? start : rawEnd,
    isMilestone: !task.start_date && !task.end_date,
  };
}

function rangesOverlap(bar: { start: Date; end: Date }, range: TimelineRange) {
  return bar.end >= range.start && bar.start <= range.end;
}

/** Whole-window containment, not overlap — used to clamp period navigation to a fetched band. */
export function containsRange(outer: TimelineRange, inner: TimelineRange) {
  return inner.start >= outer.start && inner.end <= outer.end;
}

// Same predicate getBarGeometry() uses to decide a bar is off-window, exposed for callers that
// hold more tasks than they draw — the Dashboard's Gantt fetches a multi-month band once and
// narrows it in the browser, and without this an off-window task would still occupy a row.
export function overlapsTimelineRange(task: DatedTask, range: TimelineRange) {
  return rangesOverlap(timelineBarRange(task), range);
}

export interface BarGeometry {
  left: number;
  width: number;
  /** Task begins before the visible window — the bar is clipped at the left edge. */
  continuesBefore: boolean;
  /** Task ends after the visible window — the bar is clipped at the right edge. */
  continuesAfter: boolean;
  isMilestone: boolean;
}

// Everything is derived from the task's own dates against the window — no position is ever
// hardcoded, and the same function serves both views by taking dayWidth as a parameter.
export function getBarGeometry(task: DatedTask, range: TimelineRange, dayWidth: number): BarGeometry | null {
  const { start, end, isMilestone } = timelineBarRange(task);
  // Entirely outside the window — nothing to draw.
  if (!rangesOverlap({ start, end }, range)) return null;

  const clampedStart = start < range.start ? range.start : start;
  const clampedEnd = end > range.end ? range.end : end;
  // +1 because both ends are inclusive: a task starting and ending the same day occupies one day.
  const spanDays = differenceInCalendarDays(clampedEnd, clampedStart) + 1;

  return {
    left: differenceInCalendarDays(clampedStart, range.start) * dayWidth,
    width: Math.max(spanDays * dayWidth, MIN_BAR_WIDTH),
    continuesBefore: start < range.start,
    continuesAfter: end > range.end,
    isMilestone,
  };
}

/** px offset of today's column, or null when today falls outside the window. */
export function getTodayOffset(range: TimelineRange, dayWidth: number, today = new Date()) {
  const offset = differenceInCalendarDays(today, range.start);
  if (offset < 0 || offset > differenceInCalendarDays(range.end, range.start)) return null;
  return offset * dayWidth;
}

export function periodLabel(view: TimelineView, range: TimelineRange, anchorDate: Date) {
  if (view === "week") {
    const sameMonth = range.start.getMonth() === range.end.getMonth();
    return sameMonth
      ? `${format(range.start, "dd")} - ${format(range.end, "dd MMM yyyy")}`
      : `${format(range.start, "dd MMM")} - ${format(range.end, "dd MMM yyyy")}`;
  }
  // The quarter/year labels read off the anchor, not the range: a quarter window is padded out
  // to whole weeks, so its first day can belong to the previous quarter.
  if (view === "quarter") return `Q${getQuarter(anchorDate)} ${format(anchorDate, "yyyy")}`;
  if (view === "year") return format(anchorDate, "yyyy");
  return format(anchorDate, "MMMM yyyy");
}
