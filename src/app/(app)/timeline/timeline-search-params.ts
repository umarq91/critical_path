// Same "nuqs/server" split as calendar-search-params.ts — imported by both the Server
// Component (page.tsx, to run the matching query) and the client toolbar (via useQueryStates),
// so it stays on "nuqs/server" rather than the "use client"-marked "nuqs" entry.
import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

// Ordered coarse-to-fine is how the toolbar renders them, and Q1–Q4 are calendar quarters
// (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec), which is what date-fns' startOfQuarter gives.
export const timelineViewValues = ["week", "month", "quarter", "year"] as const;
export type TimelineView = (typeof timelineViewValues)[number];

/** What /timeline opens on. Anything hand-building a /timeline link compares against THIS, not
 *  against its own starting view — nuqs omits a param equal to its default, so a link that
 *  leaves `view` out lands here. */
export const TIMELINE_DEFAULT_VIEW: TimelineView = "year";

/** Rows drawn at once. The window can hold a whole year of work; a chart that keeps growing
 *  past a screenful stops being readable, so it pages instead of scrolling forever. */
export const TIMELINE_PAGE_SIZE = 25;

export const TIMELINE_PAGE_SIZE_OPTIONS = [20, 25, 30];

/** How long the search box waits after the last keystroke before the URL — and therefore the
 *  query — updates. Every param here re-runs the Server Component, so an un-debounced text
 *  input would be one round trip per character. Applied at the call site rather than on the
 *  parser: nuqs rate-limits per key, so a parser-level debounce would flush the accompanying
 *  page reset immediately and the term 400ms later — two navigations per keystroke. */
export const TIMELINE_SEARCH_DEBOUNCE_MS = 400;

// ONE parser definition for every param on this page: the Server Component loads it to build
// its query, and the client hook drives it through useQueryStates. Search and pagination are in
// here too — they narrow the query itself (see listTasksForTimeline), not rows already sent.
export function timelineSearchParams() {
  return {
    view: parseAsStringLiteral(timelineViewValues).withDefault(TIMELINE_DEFAULT_VIEW),
    // Empty string means "today", resolved at render time rather than baked in — a static
    // default would go stale the moment the page is cached.
    date: parseAsString.withDefault(""),
    seasonId: parseAsString.withDefault(""),
    brandId: parseAsString.withDefault(""),
    keyStageId: parseAsString.withDefault(""),
    /** `kind:uuid` party key — owners are task_participants rows, not a column. */
    owner: parseAsString.withDefault(""),
    /** `kind:uuid` party key, matched against the `involved` participant role. */
    involved: parseAsString.withDefault(""),
    /** Free text, matched server-side against task name, key stage, owners and people
     *  involved — see listTasksForTimeline. */
    q: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(TIMELINE_PAGE_SIZE),
  };
}

export const loadTimelineSearchParams = createLoader(timelineSearchParams());
