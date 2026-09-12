import "server-only";
import { toCsv, type CsvRow } from "@/lib/csv";
import type { ExportColumn, ExportSheet } from "@/lib/export/types";

// CSV has no native types — every cell is text — so a column's `dataType` only decides how its
// value is STRINGIFIED here, once, rather than every column definition re-implementing
// "how do I print a date" or "how do I print a boolean" for itself.
function formatCell(column: ExportColumn<unknown>, row: unknown): string | number {
  const value = column.getValue(row);
  if (value === null || value === undefined) return "";

  switch (column.dataType) {
    case "date":
      // ISO date, not a locale string: the point of a CSV date column is that Excel/Sheets
      // recognise it as a date on import, and "2026-01-15" round-trips through every regional
      // date setting unambiguously — "15/01/2026" does not.
      return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
    case "boolean":
      return value ? "TRUE" : "FALSE";
    case "number":
      return typeof value === "number" ? value : Number(value);
    default:
      return String(value);
  }
}

/** A CSV file is exactly one table — unlike `buildWorkbook`, this takes a single sheet, not a
 *  list. `toCsv`'s own escaping (RFC 4180 quoting, `\r\n` rows, UTF-8 BOM on download) is reused
 *  as-is; this only adds the column-aware formatting layer on top. */
export function buildCsv(sheet: ExportSheet): string {
  const header: CsvRow = sheet.columns.map((column) => column.label);
  const rows: CsvRow[] = sheet.rows.map((row) => sheet.columns.map((column) => formatCell(column, row)));
  return toCsv(header, rows);
}
