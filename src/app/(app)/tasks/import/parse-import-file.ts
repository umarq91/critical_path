import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import {
  IMPORT_FIELD_BY_HEADER,
  REQUIRED_IMPORT_FIELDS,
  importFieldLabel,
  normaliseImportHeader,
  type TaskImportField,
} from "@/app/(app)/tasks/import/task-import-columns";

export interface ImportSheetRow {
  /** The row number as the user sees it in their spreadsheet (header = row 1). */
  rowNumber: number;
  values: Partial<Record<TaskImportField, string>>;
}

type ParseResult = { ok: true; rows: ImportSheetRow[] } | { ok: false; error: string };

// exceljs hands back a different shape per cell type. Dates arrive as UTC-midnight `Date`s (the
// same encoding the export writes, see lib/export/dates.ts), so the ISO date is read off the UTC
// fields; dayFirstDateToIso accepts ISO as well as DD-MM-YYYY.
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "object") return String(value);
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("formula" in value || "sharedFormula" in value) return cellText(value.result as ExcelJS.CellValue);
  if ("text" in value) return String(value.text);
  return "";
}

async function readXlsx(file: File): Promise<string[][] | null> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return null;
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let column = 1; column <= worksheet.columnCount; column++) cells.push(cellText(row.getCell(column).value).trim());
    rows[rowNumber - 1] = cells;
  });
  return Array.from(rows, (row) => row ?? []);
}

async function readCsv(file: File): Promise<string[][]> {
  const parsed = Papa.parse<string[]>(await file.text(), { skipEmptyLines: false });
  return parsed.data.map((row) => row.map((cell) => cell.trim()));
}

// Reads the first sheet of an .xlsx, or a .csv, into rows keyed by import field. Columns the
// import doesn't use are dropped; fully blank rows are skipped (spreadsheets often carry a tail
// of them) but still count toward row numbers, so "Row 14" matches what the user sees.
export async function parseTaskImportFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith(".xlsx");
  if (!isXlsx && !name.endsWith(".csv")) return { ok: false, error: "Upload an Excel (.xlsx) or CSV (.csv) file" };

  const table = isXlsx ? await readXlsx(file) : await readCsv(file);
  if (!table) return { ok: false, error: "That file couldn't be read as an Excel workbook" };

  const [headerRow = [], ...dataRows] = table;
  const fieldByColumn = headerRow.map((header) => IMPORT_FIELD_BY_HEADER.get(normaliseImportHeader(header)));
  const missing = REQUIRED_IMPORT_FIELDS.filter((field) => !fieldByColumn.includes(field));
  if (missing.length > 0) {
    return { ok: false, error: `Missing column${missing.length === 1 ? "" : "s"}: ${missing.map(importFieldLabel).join(", ")}` };
  }

  const rows: ImportSheetRow[] = [];
  dataRows.forEach((cells, index) => {
    if (cells.every((cell) => !cell)) return;
    const values: ImportSheetRow["values"] = {};
    fieldByColumn.forEach((field, column) => {
      if (field) values[field] = cells[column] ?? "";
    });
    rows.push({ rowNumber: index + 2, values });
  });

  return { ok: true, rows };
}
