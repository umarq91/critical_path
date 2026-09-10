/**
 * Fixed column widths, in px. Every table column picks one, so a row's shape is decided by the
 * column's *kind* rather than by whichever cell happens to hold the longest string — content-
 * sized columns are what make these tables sprawl sideways.
 *
 * The table lays out `table-fixed` at `min-width: <sum of these>`: below that it scrolls, above
 * it the columns share the slack proportionally instead of leaving a gutter. Cells clip with an
 * ellipsis, so pick the size that fits the *typical* value, not the longest possible one.
 */
export type DataTableColumnWidth = "icon" | "xs" | "sm" | "md" | "lg";

const COLUMN_WIDTH_PX: Record<DataTableColumnWidth, number> = {
  /** Row-selection checkbox. */
  icon: 56,
  /** Badges, counts, and the 1–2 icon buttons of an Actions column. */
  xs: 112,
  /** Dates, short codes, avatar stacks. */
  sm: 140,
  /** Names and anything inline-edited through a select. */
  md: 176,
  /** Free text — descriptions, notes. */
  lg: 240,
};

const DEFAULT_COLUMN_WIDTH: DataTableColumnWidth = "md";

export function columnWidthPx(width: DataTableColumnWidth | undefined) {
  return COLUMN_WIDTH_PX[width ?? DEFAULT_COLUMN_WIDTH];
}
