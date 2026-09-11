import {
  addMonths,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  getQuarter,
  isSameDay,
  isWeekend,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from "date-fns";
import {
  DAY_WIDTH,
  WEEK_OPTIONS,
  getTimelineDayCount,
  type TimelineRange,
} from "@/app/(app)/timeline/timeline-utils";
import type { TimelineView } from "@/app/(app)/timeline/timeline-search-params";

/** A cell in the header's lower band: a day, a week or a month depending on how far out the
 *  view is zoomed. `dayCount` is what gives it a width — every band is measured in days, so
 *  the columns and the bars share one coordinate system. */
export interface TimelineColumn {
  key: string;
  /** Upper line, e.g. "M" (month view), "WK 18" (quarter view), "Jan" (year view). */
  label: string;
  /** Lower line — empty when the column needs only one. */
  subLabel: string;
  dayCount: number;
  isWeekend: boolean;
  isToday: boolean;
}

/** A cell in the header's upper band, always a whole number of columns wide. */
export interface TimelineGroup {
  key: string;
  label: string;
  rangeLabel: string;
  dayCount: number;
}

export interface TimelineHeader {
  groups: TimelineGroup[];
  columns: TimelineColumn[];
  /** CSS background-image drawing one vertical line per column. */
  gridlines: string;
  totalDays: number;
}

// Zooming out swaps the unit of both bands rather than shrinking day cells until they're
// unreadable: a year at one column per day would be 365 ticks nobody can label.
const COLUMN_UNIT: Record<TimelineView, "day" | "week" | "month"> = {
  week: "day",
  month: "day",
  quarter: "week",
  year: "month",
};

const GROUP_UNIT: Record<TimelineView, "week" | "month" | "quarter"> = {
  week: "week",
  month: "week",
  quarter: "month",
  year: "quarter",
};

interface Span {
  start: Date;
  end: Date;
}

// Columns at the window's edges can be partial — a quarter starts mid-month, a month view is
// padded to whole weeks — so a span is always measured against the window, never assumed full.
function clampedDayCount(span: Span, range: TimelineRange) {
  const start = span.start < range.start ? range.start : span.start;
  const end = span.end > range.end ? range.end : span.end;
  return differenceInCalendarDays(end, start) + 1;
}

function buildSpans(view: TimelineView, range: TimelineRange): Span[] {
  const unit = COLUMN_UNIT[view];

  if (unit === "week") {
    return eachWeekOfInterval({ start: range.start, end: range.end }, WEEK_OPTIONS).map((start) => ({
      start,
      end: endOfWeek(start, WEEK_OPTIONS),
    }));
  }
  if (unit === "month") {
    return eachMonthOfInterval({ start: range.start, end: range.end }).map((start) => ({
      start,
      end: endOfMonth(start),
    }));
  }
  return eachDayOfInterval({ start: range.start, end: range.end }).map((start) => ({ start, end: start }));
}

function toColumn(view: TimelineView, span: Span, dayCount: number, today: Date): TimelineColumn {
  const key = format(span.start, "yyyy-MM-dd");
  const unit = COLUMN_UNIT[view];

  if (unit === "week") {
    return { key, label: `WK ${getISOWeek(span.start)}`, subLabel: format(span.start, "dd MMM"), dayCount, isWeekend: false, isToday: false };
  }
  if (unit === "month") {
    return { key, label: format(span.start, "MMM"), subLabel: "", dayCount, isWeekend: false, isToday: false };
  }
  return {
    key,
    // Week view has room for "Mon"; a 40px month-view column does not.
    label: format(span.start, view === "week" ? "EEE" : "EEEEE"),
    subLabel: format(span.start, "d"),
    dayCount,
    isWeekend: isWeekend(span.start),
    isToday: isSameDay(span.start, today),
  };
}

// Groups are built from the columns rather than from the range, so a group boundary always
// lands on a column boundary — a week straddling two months belongs to whichever month it
// starts in, and the two bands stay in alignment.
function toGroup(view: TimelineView, start: Date) {
  const unit = GROUP_UNIT[view];

  if (unit === "quarter") {
    const quarterStart = startOfQuarter(start);
    return {
      key: format(quarterStart, "yyyy-QQQ"),
      label: `Q${getQuarter(start)}`,
      rangeLabel: `${format(quarterStart, "MMM")} - ${format(addMonths(quarterStart, 2), "MMM yyyy")}`,
    };
  }
  if (unit === "month") {
    const monthStart = startOfMonth(start);
    return { key: format(monthStart, "yyyy-MM"), label: format(monthStart, "MMMM"), rangeLabel: format(monthStart, "yyyy") };
  }
  const weekStart = startOfWeek(start, WEEK_OPTIONS);
  return {
    key: format(weekStart, "yyyy-MM-dd"),
    label: `WK ${getISOWeek(start)}`,
    rangeLabel: `${format(weekStart, "dd MMM")} - ${format(endOfWeek(start, WEEK_OPTIONS), "dd MMM")}`,
  };
}

// One vertical line per column. A uniform band (days, or the whole weeks a quarter is padded
// to) is a single repeating gradient; a month band isn't uniform — 28 to 31 days — so it gets
// explicit stops rather than a repeat that would drift five days across a year. Either way it
// is one background on the row, not one node per column across every row.
function gridlineBackground(columns: TimelineColumn[], dayWidth: number) {
  const first = columns[0];
  if (!first) return "none";

  if (columns.every((column) => column.dayCount === first.dayCount)) {
    return `repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px ${first.dayCount * dayWidth}px)`;
  }

  let offset = 0;
  const stops = columns.flatMap((column) => {
    const width = column.dayCount * dayWidth;
    const segment = [`var(--border) ${offset}px ${offset + 1}px`, `transparent ${offset + 1}px ${offset + width}px`];
    offset += width;
    return segment;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function getTimelineHeader(view: TimelineView, range: TimelineRange, today = new Date()): TimelineHeader {
  const spans = buildSpans(view, range);
  const columns = spans.map((span) => toColumn(view, span, clampedDayCount(span, range), today));

  const groups: TimelineGroup[] = [];
  spans.forEach((span, index) => {
    const { key, label, rangeLabel } = toGroup(view, span.start);
    const current = groups.at(-1);
    const dayCount = columns[index]?.dayCount ?? 0;

    if (current?.key === key) {
      current.dayCount += dayCount;
      return;
    }
    groups.push({ key, label, rangeLabel, dayCount });
  });

  return {
    groups,
    columns,
    gridlines: gridlineBackground(columns, DAY_WIDTH[view]),
    totalDays: getTimelineDayCount(range),
  };
}
