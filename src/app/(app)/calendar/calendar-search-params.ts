// Same "nuqs/server" split as components/data-table/data-table-search-params.ts — this
// module is imported by both the Server Component (page.tsx, to run the matching query) and
// the client toolbar (via useQueryStates), so it stays on "nuqs/server" rather than the
// "use client"-marked "nuqs" entry.
import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const calendarViewValues = ["day", "week", "month"] as const;
export type CalendarView = (typeof calendarViewValues)[number];

export function calendarSearchParams() {
  return {
    view: parseAsStringLiteral(calendarViewValues).withDefault("month"),
    // Empty string means "today", resolved at request/render time rather than baked into a
    // default here — a static default would go stale the moment the page is cached.
    date: parseAsString.withDefault(""),
    seasonId: parseAsString.withDefault(""),
    brandId: parseAsString.withDefault(""),
    status: parseAsString.withDefault(""),
  };
}

export const loadCalendarSearchParams = createLoader(calendarSearchParams());
