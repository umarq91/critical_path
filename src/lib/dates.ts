import { parseISO } from "date-fns";

const DATE_LOCALE = "en-AU";

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
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
