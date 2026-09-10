import type { MouseEvent } from "react";

/**
 * Columns are fixed-width and clip with an ellipsis, so a hover tooltip is the only way to read
 * a long value in full.
 *
 * The title is set on hover rather than at render for two reasons: it's the *rendered* text we
 * want (a formatted date, a badge's label — not the raw cell value, which is often an ISO string
 * or an id), and it should only appear on cells that are actually clipped. Recomputed on every
 * hover so it can't go stale when the row's data changes underneath it.
 */
export function showTitleWhenTruncated(event: MouseEvent<HTMLElement>) {
  const cell = event.currentTarget;
  const text = cell.textContent?.trim();

  if (text && cell.scrollWidth > cell.clientWidth) {
    cell.title = text;
    return;
  }
  cell.removeAttribute("title");
}
