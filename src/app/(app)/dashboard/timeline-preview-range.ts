import { addMonths, subMonths } from "date-fns";
import { getTimelineRange, type TimelineRange } from "@/app/(app)/timeline/timeline-utils";

/** Rows the Dashboard's Gantt draws before it stops and defers to /timeline. Enough to read as
 *  a schedule, short enough that the card doesn't outgrow the page it summarises. */
export const TIMELINE_PREVIEW_ROW_COUNT = 12;

/** px cap on the Overdue list beside it, chosen to land near the capped chart's own height. */
export const TIMELINE_PREVIEW_OVERDUE_HEIGHT = 560;

// The Dashboard's Gantt is fed by ONE query and narrowed in the browser, like every other card
// on this page — so Prev/Next can only travel as far as what was fetched. This band IS that
// fetch: last month through next month, padded to whole weeks by getTimelineRange. Stepping
// outside it would draw an empty chart that looks like "no tasks" rather than "not loaded", so
// the buttons clamp here and /timeline is the unbounded view.
export function getTimelinePreviewBand(today = new Date()): TimelineRange {
  return {
    start: getTimelineRange("month", subMonths(today, 1)).start,
    end: getTimelineRange("month", addMonths(today, 1)).end,
  };
}
