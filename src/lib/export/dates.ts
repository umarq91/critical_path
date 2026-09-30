import { ORG_TIMEZONE, parseDateOnly } from "@/lib/dates";

// A COLUMN DEFINITION calls these, not a writer — csv.ts and xlsx.ts both just receive an
// already-correct `Date` off `ExportColumn.getValue()` and format it, so there is exactly one
// place a date's timezone can go wrong, not one per writer.
//
// exceljs serialises a JS `Date` to an Excel day-number from `date.getTime()` — i.e. treating
// the instant as UTC — not from the Date's local calendar fields. A LOCAL-midnight `Date` (what
// `parseDateOnly` returns, correctly, for a Postgres `date` column) therefore lands on the WRONG
// Excel day for any positive UTC offset: local midnight in Karachi (UTC+5) is 19:00 UTC the
// PREVIOUS day, and that previous day is what exceljs writes. Verified directly against the
// library's own output (`xl/worksheets/sheetN.xml`'s raw serial number) across UTC+5, UTC-8 and
// UTC+14 — only a UTC-midnight-constructed Date lands on the correct day in all three, and (as a
// side effect) `.toISOString().slice(0, 10)` on that same Date is what the CSV writer uses, and
// is equally timezone-proof since `toISOString()` always renders in UTC by spec.
//
// The fix re-encodes the already-correct local calendar day as a UTC-midnight instant. Use this
// for every `date` column (`due_date`, `start_date`, `end_date`) — never hand a writer a
// `parseDateOnly()` result directly.
export function toExportDateOnly(value: string): Date {
  const local = parseDateOnly(value);
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

// `timestamptz` columns (created_at/updated_at) are exported on the client's own clock
// (ORG_TIMEZONE, Melbourne), matching what the app shows on screen. Both writers render a Date
// on the UTC clock (see above), so this returns a Date whose UTC fields are the Melbourne
// wall-clock reading of the instant — deliberately NOT the true instant. The column label says
// "(Melbourne time)" for that reason; don't do arithmetic on the result.
const ORG_CLOCK = new Intl.DateTimeFormat("en-CA", {
  timeZone: ORG_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function toExportTimestamp(value: string): Date {
  const parts = Object.fromEntries(ORG_CLOCK.formatToParts(new Date(value)).map((part) => [part.type, Number(part.value)]));
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
}
