import {
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  isWeekend,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { parseDateOnly } from "@/lib/dates";
import type { TimelineView } from "@/app/(app)/timeline/timeline-search-params";

// Monday-start weeks, matching how the rest of the app reads a working week.
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

// px per day. Month view fits ~6 weeks on screen at 40px; Week view spreads 7 days wide enough
// to carry a weekday label and a readable bar caption.
export const DAY_WIDTH: Record<TimelineView, number> = { month: 40, week: 150 };
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

// Month view pads out to whole weeks so the week-number header never shows a partial column;
// week view is exactly the seven days.
export function getTimelineRange(view: TimelineView, anchorDate: Date): TimelineRange {
  if (view === "week") {
    return { start: startOfWeek(anchorDate, WEEK_OPTIONS), end: endOfWeek(anchorDate, WEEK_OPTIONS) };
  }
  return {
    start: startOfWeek(startOfMonth(anchorDate), WEEK_OPTIONS),
    end: endOfWeek(endOfMonth(anchorDate), WEEK_OPTIONS),
  };
}

export function shiftAnchorDate(view: TimelineView, anchorDate: Date, direction: 1 | -1): Date {
  if (view === "week") return direction === 1 ? addWeeks(anchorDate, 1) : subWeeks(anchorDate, 1);
  return direction === 1 ? addMonths(anchorDate, 1) : subMonths(anchorDate, 1);
}

export function toQueryDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

export function getTimelineDays(range: TimelineRange) {
  return eachDayOfInterval({ start: range.start, end: range.end });
}

export interface TimelineDay {
  date: Date;
  key: string;
  isWeekend: boolean;
}

export interface WeekGroup {
  key: string;
  /** e.g. "WK 18". */
  label: string;
  /** e.g. "27 Apr - 03 May". */
  rangeLabel: string;
  dayCount: number;
}

// The header's upper band. Groups the visible days by ISO week so a month window reads as
// "WK 18 · 27 Apr – 03 May" columns rather than 42 undifferentiated day ticks.
export function getWeekGroups(days: Date[]): WeekGroup[] {
  const groups: { key: string; label: string; first: Date; last: Date; dayCount: number }[] = [];

  for (const day of days) {
    const key = format(startOfWeek(day, WEEK_OPTIONS), "yyyy-MM-dd");
    const current = groups.at(-1);

    if (current?.key === key) {
      current.last = day;
      current.dayCount++;
      continue;
    }
    groups.push({ key, label: `WK ${getISOWeek(day)}`, first: day, last: day, dayCount: 1 });
  }

  return groups.map(({ key, label, first, last, dayCount }) => ({
    key,
    label,
    rangeLabel: `${format(first, "dd MMM")} - ${format(last, "dd MMM")}`,
    dayCount,
  }));
}

export function toTimelineDays(days: Date[]): TimelineDay[] {
  return days.map((date) => ({ date, key: format(date, "yyyy-MM-dd"), isWeekend: isWeekend(date) }));
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
  return format(anchorDate, "MMMM yyyy");
}
