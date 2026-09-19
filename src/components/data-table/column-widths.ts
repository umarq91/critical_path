/**
 * Relative column-width weights, not pixel sizes. Every table column picks a kind, and the
 * table always renders at exactly 100% of its container's width (data-table.tsx converts these
 * weights into percentages summing to 100) — a 4-column table (e.g. Seasons) stretches every
 * column proportionally to fill the page instead of leaving a gutter, and a 13-column table
 * (e.g. Tasks) proportionally compresses every column to still fit on one screen with no
 * horizontal scrollbar. Cells still clip with an ellipsis, so pick the kind that fits the
 * *typical* value, not the longest possible one — the trade-off for guaranteeing no scroll is
 * that a table with many columns runs tighter than any one of them would like in isolation.
 */
export type DataTableColumnWidth = "icon" | "xs" | "sm" | "md" | "lg";

const COLUMN_WEIGHT: Record<DataTableColumnWidth, number> = {
  /** Row-selection checkbox. */
  icon: 56,
  /** Badges, short codes, and the 1–2 icon buttons of an Actions column. */
  xs: 112,
  /** Dates and avatar stacks. */
  sm: 140,
  /** Names and anything inline-edited through a select. */
  md: 176,
  /** Free text — descriptions, notes. */
  lg: 240,
};

const DEFAULT_COLUMN_WIDTH: DataTableColumnWidth = "md";

function columnWeight(width: DataTableColumnWidth | undefined) {
  return COLUMN_WEIGHT[width ?? DEFAULT_COLUMN_WIDTH];
}

/** Converts a row of columns' width kinds into percentages that always sum to 100 (or to 0
 *  values if there are no columns), preserving each kind's weight relative to the others. */
export function columnWidthPercents(widths: (DataTableColumnWidth | undefined)[]): number[] {
  const weights = widths.map(columnWeight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => (totalWeight > 0 ? (weight / totalWeight) * 100 : 0));
}
