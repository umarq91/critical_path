// Same "nuqs/server" split as components/data-table/data-table-search-params.ts — this
// module is imported by both the Server Component (page.tsx, to run the matching query) and
// the client toolbar (via useQueryStates), so it stays on "nuqs/server" rather than the
// "use client"-marked "nuqs" entry.
import { createLoader, parseAsArrayOf, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const calendarViewValues = ["day", "week", "month"] as const;
export type CalendarView = (typeof calendarViewValues)[number];

export function calendarSearchParams() {
  return {
    view: parseAsStringLiteral(calendarViewValues).withDefault("month"),
    // Empty string means "today", resolved at request/render time rather than baked into a
    // default here — a static default would go stale the moment the page is cached.
    date: parseAsString.withDefault(""),
    // Every task filter below is multi-select, same as the Tasks grid's own toolbar filters —
    // an empty array means unfiltered (every value shown), not "show nothing". Param names stay
    // singular (seasonId, not seasonIds) even though the value is now an array, so an old
    // single-value link (e.g. seasons' "View in Calendar" — /calendar?seasonId=<uuid>) still
    // parses correctly as a one-element array rather than silently landing unfiltered.
    seasonId: parseAsArrayOf(parseAsString).withDefault([]),
    brandId: parseAsArrayOf(parseAsString).withDefault([]),
    status: parseAsArrayOf(parseAsString).withDefault([]),
    gender: parseAsArrayOf(parseAsString).withDefault([]),
    // Party keys ("user:<uuid>" / "department:<uuid>"), same vocabulary as the Tasks grid's
    // Owner / People Involved filters, matched by participantTaskIds (data/task-participants.ts).
    owner: parseAsArrayOf(parseAsString).withDefault([]),
    involved: parseAsArrayOf(parseAsString).withDefault([]),
    // Empty array means unfiltered (every country shown) — there's no fixed country list to
    // default to, since public_holidays.country is open text (0027_public_holidays.sql).
    countries: parseAsArrayOf(parseAsString).withDefault([]),
  };
}

export const loadCalendarSearchParams = createLoader(calendarSearchParams());
