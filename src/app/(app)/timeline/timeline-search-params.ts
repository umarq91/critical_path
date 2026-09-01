// Same "nuqs/server" split as calendar-search-params.ts — imported by both the Server
// Component (page.tsx, to run the matching query) and the client toolbar (via useQueryStates),
// so it stays on "nuqs/server" rather than the "use client"-marked "nuqs" entry.
import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const timelineViewValues = ["month", "week"] as const;
export type TimelineView = (typeof timelineViewValues)[number];

export function timelineSearchParams() {
  return {
    view: parseAsStringLiteral(timelineViewValues).withDefault("month"),
    // Empty string means "today", resolved at render time rather than baked in — a static
    // default would go stale the moment the page is cached.
    date: parseAsString.withDefault(""),
    seasonId: parseAsString.withDefault(""),
    brandId: parseAsString.withDefault(""),
  };
}

export const loadTimelineSearchParams = createLoader(timelineSearchParams());
