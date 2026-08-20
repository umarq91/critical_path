import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import type { CalendarView } from "@/app/(app)/calendar/calendar-search-params";

// Tasks only carry a due_date (date, no time-of-day) — so unlike a real Google Calendar,
// "day" and "week" views are agenda-style date groupings, not hour grids. There is no
// due-time to position an hour grid against.

export function resolveAnchorDate(dateParam: string) {
  if (!dateParam) return new Date();
  try {
    const parsed = parseISO(dateParam);
    if (Number.isNaN(parsed.getTime())) return new Date();
    return parsed;
  } catch {
    return new Date();
  }
}

export interface CalendarRange {
  start: Date;
  end: Date;
}

// Month view pads out to full weeks (matches the "31 May" / "1 Jul" leading/trailing days in
// a Google Calendar-style month grid); week/day views are exact.
export function getCalendarRange(view: CalendarView, anchorDate: Date): CalendarRange {
  if (view === "day") return { start: anchorDate, end: anchorDate };
  if (view === "week") {
    return { start: startOfWeek(anchorDate), end: endOfWeek(anchorDate) };
  }
  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  return { start: startOfWeek(monthStart), end: endOfWeek(monthEnd) };
}

export function shiftAnchorDate(view: CalendarView, anchorDate: Date, direction: 1 | -1): Date {
  if (view === "day") return addDays(anchorDate, direction);
  if (view === "week") return direction === 1 ? addWeeks(anchorDate, 1) : subWeeks(anchorDate, 1);
  return direction === 1 ? addMonths(anchorDate, 1) : subMonths(anchorDate, 1);
}

export function toDateKey(value: Date | string) {
  return typeof value === "string" ? value.slice(0, 10) : format(value, "yyyy-MM-dd");
}

export function toQueryDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}
