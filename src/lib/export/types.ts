// The generic export engine's one vocabulary: a column KNOWS how to pull and type a value out
// of a row, and nothing else does — csv.ts and xlsx.ts both walk the same definitions, so a
// field added here is available in both formats for free, and a field's display rule (a date
// stays a date, a bool stays a bool) can't drift between the two writers.

/** Only tags what the writers need to render a value correctly — CSV has no native types, so
 *  this is what tells it "format this as an ISO date" instead of stringifying a Date object. */
export type ExportDataType = "string" | "number" | "date" | "boolean";

/** What a single cell can be before a writer formats it. `null`/`undefined` both mean "blank" —
 *  never the string "null", which would sort and filter as real data. */
export type ExportCellValue = string | number | boolean | Date | null | undefined;

export interface ExportColumn<TRow> {
  /** Stable identifier — the query-string value a caller selects this column by, and the CSV
   *  header fallback if `label` is ever empty. Never shown to the user. */
  key: string;
  label: string;
  /** Shown under the label in the configuration UI, only where the field isn't self-explanatory
   *  (e.g. what "Share of All Tasks" is a percentage OF). */
  description?: string;
  /** Which checklist group this column renders under — purely presentational grouping, not a
   *  permissions boundary. */
  category: string;
  /** Pre-ticked in the configuration UI. Reserve `true` for what a person exporting this data
   *  would almost always want; leave everything else off rather than pre-selecting for them. */
  defaultSelected: boolean;
  dataType: ExportDataType;
  getValue: (row: TRow) => ExportCellValue;
  /** XLSX column width in characters — exceljs has no reliable autofit, so this is a fixed hint
   *  per field (the same "declare a width, don't compute one" call the app's own DataTable
   *  columns already make) rather than measuring content at write time. */
  width?: number;
}

export interface ExportColumnGroup<TRow> {
  key: string;
  label: string;
  columns: ExportColumn<TRow>[];
}

/** One writable table — a CSV file IS one of these; an XLSX workbook is one or more. */
export interface ExportSheet<TRow = unknown> {
  name: string;
  columns: ExportColumn<TRow>[];
  rows: TRow[];
}

export function flattenColumns<TRow>(groups: ExportColumnGroup<TRow>[]): ExportColumn<TRow>[] {
  return groups.flatMap((group) => group.columns);
}

export function defaultColumnKeys<TRow>(groups: ExportColumnGroup<TRow>[]): string[] {
  return flattenColumns(groups)
    .filter((column) => column.defaultSelected)
    .map((column) => column.key);
}

/** Every column key across every group — what "Select all" in an export dialog's column
 *  checklist selects, as opposed to `defaultColumnKeys`' pre-ticked subset. */
export function allColumnKeys<TRow>(groups: ExportColumnGroup<TRow>[]): string[] {
  return flattenColumns(groups).map((column) => column.key);
}

export function selectColumns<TRow>(groups: ExportColumnGroup<TRow>[], keys: readonly string[]): ExportColumn<TRow>[] {
  const wanted = new Set(keys);
  return flattenColumns(groups).filter((column) => wanted.has(column.key));
}

// Shared cap for the lookup-entity exports (seasons, brands, key stages) — unlike tasks.ts's
// MAX_EXPORT_ROWS, this deliberately equals PostgREST's own default per-request row cap
// (`db-max-rows`, 1000), so a single `.range()` call is guaranteed to return everything up to
// the limit rather than silently truncating short of it. These are small admin lookup tables
// that will never realistically approach 1000 rows, so unlike tasks there's no need for the
// paged fetch loop — one request, and `rowCount > this` just flags the (practically
// theoretical) truncated case rather than driving real pagination.
export const MAX_LOOKUP_EXPORT_ROWS = 1000;
