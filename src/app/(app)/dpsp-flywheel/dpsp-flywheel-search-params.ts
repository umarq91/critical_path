// Same "nuqs/server" split as timeline-search-params.ts — imported by both the Server
// Component (page.tsx, to run the matching query) and the client toolbar (via useQueryStates).
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** How long the search box waits after the last keystroke before the URL — and therefore the
 *  query — updates. Same reasoning and value as timeline-search-params.ts's debounce. */
export const DPSP_FLYWHEEL_SEARCH_DEBOUNCE_MS = 400;

// ONE parser definition for every param on this page. Unlike Tasks/Timeline there's no
// page/pageSize here — the board fetches its whole (bounded) matching set in one go and lays
// it out as scrollable columns rather than paginating (see listTasksForFlywheel).
export function dpspFlywheelSearchParams() {
  return {
    seasonId: parseAsString.withDefault(""),
    /** `kind:uuid` party key (lib/party.ts) — reuses the Owner filter's mechanism, scoped to
     *  department options only (the toolbar's "Buying"-style picker). */
    department: parseAsString.withDefault(""),
    /** Free text, matched server-side against task name, season, brand, key stage, owners and
     *  people involved — same search box as Tasks/Timeline. */
    q: parseAsString.withDefault(""),
    hideDone: parseAsBoolean.withDefault(false),
  };
}

export const loadDpspFlywheelSearchParams = createLoader(dpspFlywheelSearchParams());
