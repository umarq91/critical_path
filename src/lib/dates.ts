import { addWeeks, endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import type { DueWeekPreset } from "@/constants/due-week-filter";

const DATE_LOCALE = "en-AU";

// Timestamps are shown on the client's own clock (Melbourne), never the runtime's: a Server
// Component renders on a UTC host and a Client Component in whatever zone the browser is in,
// so leaving it to the default gave the same instant two different dates. Same clock as
// REMINDER_ORG_TIMEZONE (data/reminders.ts) — Melbourne and Sydney never differ.
export const ORG_TIMEZONE = "Australia/Melbourne";

// Postgres `date` columns (due_date, start_date, end_date) arrive as bare "yyyy-MM-dd". The
// native `new Date("2026-08-19")` parses that as UTC midnight, which renders as the PREVIOUS
// day for anyone at a negative UTC offset. date-fns' parseISO treats a date-only string as
// LOCAL midnight, which is what a calendar date means — always go through this, never `new
// Date(value)`, for a value that came out of a date column.
export function parseDateOnly(value: string) {
  return parseISO(value.slice(0, 10));
}

export function formatDate(value: string) {
  return parseDateOnly(value).toLocaleDateString(DATE_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// For `timestamptz` columns (audit_log.created_at, created_at/updated_at), where the time of
// day is the point — NOT for date columns: parseDateOnly exists precisely because those must
// not go through `new Date()`, and this deliberately does.
export function formatDateTime(value: string) {
  return new Date(value).toLocaleString(DATE_LOCALE, {
    timeZone: ORG_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// The date-only rendering of a `timestamptz` (Created / Last Updated). NOT formatDate: that
// keeps the first ten characters of the string, which for a timestamp is its UTC date — a
// morning edit in Melbourne would show as the day before.
export function formatTimestampDate(value: string) {
  return new Date(value).toLocaleDateString(DATE_LOCALE, {
    timeZone: ORG_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// An imported file's date is day-first (client's format); schemas and the database want ISO.
// Shared by the Holidays and Tasks bulk imports.
// Slashes are accepted because a spreadsheet re-saving the file often swaps them in, and ISO
// still passes so files made from the older template keep importing. Null = unrecognised.
export function dayFirstDateToIso(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// The Holidays import's stricter twin of dayFirstDateToIso: exactly dd-mm-yyyy (two-digit day and
// month, hyphens), nothing else — client request, since the template states that format.
// Whether the date is real (31-02-2026) is left to the schema. Null = wrong format.
export function strictDayFirstDateToIso(value: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

const WEEK_STARTS_ON_MONDAY = { weekStartsOn: 1 } as const;

// Today's calendar date in Melbourne, not the runtime's: the server is a UTC host, so its own
// "today" is still yesterday for the first 10–11 hours of a Melbourne day.
function orgToday() {
  return parseDateOnly(new Intl.DateTimeFormat("en-CA", { timeZone: ORG_TIMEZONE }).format(new Date()));
}

// Inclusive yyyy-MM-dd bounds for the Tasks "Due" filter. Weeks run Monday to Sunday.
// "Next 2 Weeks" is the two full weeks after this one (next Monday to the Sunday after next),
// so it never overlaps "This Week".
export function dueWeekRange(preset: DueWeekPreset): { from: string; to: string } {
  const thisMonday = startOfWeek(orgToday(), WEEK_STARTS_ON_MONDAY);
  const firstWeek = preset === "this_week" ? thisMonday : addWeeks(thisMonday, 1);
  const lastWeek = preset === "next_2_weeks" ? addWeeks(firstWeek, 1) : firstWeek;
  return {
    from: format(firstWeek, "yyyy-MM-dd"),
    to: format(endOfWeek(lastWeek, WEEK_STARTS_ON_MONDAY), "yyyy-MM-dd"),
  };
}
